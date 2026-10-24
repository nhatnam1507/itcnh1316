import "server-only";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getClientFingerprint } from "@/lib/client-fingerprint";
import { geocodeAddress } from "@/lib/geocode/nominatim";
import { requireClassAccess } from "@/lib/passcode/class-session";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { Database } from "@/lib/supabase/database.types";
import { getSecretClient } from "@/lib/supabase/secret-client";
import {
  changeRequestReviewSchema,
  changeRequestSchema,
  fieldErrorsOf,
  type ChangeRequestReviewInput,
} from "@/lib/validation/person-schema";

type ChangeRequestRow = Database["public"]["Tables"]["change_requests"]["Row"];
type PersonRow = Database["public"]["Tables"]["people"]["Row"];

export type PendingChangeRequest = ChangeRequestRow & { person: PersonRow };

/**
 * Visitors with the class passcode may only create a pending request. The status is
 * left to the database default, so a visitor can never edit a record directly.
 */
export async function submitChangeRequest(values: Record<string, string>): Promise<ActionResult> {
  await requireClassAccess();

  const parsed = changeRequestSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  if (!(await consumeRateLimit("change-request"))) {
    return { ok: false, error: "Too many requests from this network. Try again in an hour." };
  }

  const supabase = getSecretClient();
  const { data: person, error: personError } = await supabase
    .from("people")
    .select("id")
    .eq("id", parsed.data.person_id)
    .maybeSingle();
  if (personError) throw new Error(`Could not load the person: ${personError.code}`);
  if (!person) return { ok: false, error: "That classmate no longer exists." };

  const { error } = await supabase.from("change_requests").insert({
    person_id: parsed.data.person_id,
    proposed_full_name: parsed.data.proposed_full_name ?? null,
    proposed_date_of_birth: parsed.data.proposed_date_of_birth ?? null,
    proposed_mobile_phone: parsed.data.proposed_mobile_phone ?? null,
    proposed_address: parsed.data.proposed_address ?? null,
    requester_note: parsed.data.requester_note ?? null,
    requester_fingerprint: await getClientFingerprint(),
  });
  if (error) throw new Error(`Could not save the change request: ${error.code}`);
  return { ok: true, message: "Transmission queued for review." };
}

export async function listPendingRequests(): Promise<PendingChangeRequest[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("change_requests")
    .select("*, person:people!inner(*)")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(`Could not load change requests: ${error.code}`);
  return data;
}

export async function countPendingRequests(): Promise<number> {
  const { supabase } = await requireAdmin();
  const { count, error } = await supabase
    .from("change_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw new Error(`Could not count change requests: ${error.code}`);
  return count ?? 0;
}

function reviewError(code: string | undefined): ActionResult {
  switch (code) {
    case "55000":
      return { ok: false, error: "This request was already reviewed." };
    case "P0002":
      return { ok: false, error: "This request no longer exists." };
    case "42501":
      return { ok: false, error: "You are not allowed to review requests." };
    case "22023":
      return { ok: false, error: "The pin is invalid. Set both coordinates or clear the pin." };
    default:
      throw new Error(`Review failed: ${code ?? "unknown"}`);
  }
}

/**
 * Approves atomically through approve_change_request(). When the address changes and
 * the admin set no pin, the proposed address is geocoded first.
 */
export async function approveRequest(values: Record<string, string>): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = changeRequestReviewSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const pin = await pinForApproval(supabase, parsed.data);
  const { error } = await supabase.rpc("approve_change_request", {
    p_request_id: parsed.data.request_id,
    p_latitude: pin?.latitude,
    p_longitude: pin?.longitude,
    p_location_source: pin?.location_source,
    p_reviewer_note: parsed.data.reviewer_note,
  });
  if (error) return reviewError(error.code);
  return { ok: true, message: "Change applied." };
}

async function pinForApproval(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  input: ChangeRequestReviewInput,
): Promise<{ latitude: number; longitude: number; location_source: "geocoded" | "manual" } | null> {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { latitude: input.latitude, longitude: input.longitude, location_source: input.location_source ?? "manual" };
  }
  const { data } = await supabase
    .from("change_requests")
    .select("proposed_address")
    .eq("id", input.request_id)
    .maybeSingle();
  if (!data?.proposed_address) return null;
  const found = await geocodeAddress(data.proposed_address);
  return found ? { latitude: found.lat, longitude: found.lng, location_source: "geocoded" } : null;
}

export async function rejectRequest(values: Record<string, string>): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = changeRequestReviewSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) };

  const { error } = await supabase.rpc("reject_change_request", {
    p_request_id: parsed.data.request_id,
    p_reviewer_note: parsed.data.reviewer_note,
  });
  if (error) return reviewError(error.code);
  return { ok: true, message: "Request rejected." };
}
