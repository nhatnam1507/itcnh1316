import "server-only";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { geocodeAddress, type Coordinates } from "@/lib/geocode/nominatim";
import type { Database } from "@/lib/supabase/database.types";
import type { PersonCreateInput, PersonUpdateInput } from "@/lib/validation/person-schema";

export type AdminPerson = Database["public"]["Tables"]["people"]["Row"];

type Pin = Pick<AdminPerson, "latitude" | "longitude" | "location_source">;

/** Uses the admin's pin when set; otherwise geocodes the address, falling back to "no pin". */
async function resolvePin(input: PersonCreateInput): Promise<Pin> {
  if (input.latitude !== undefined && input.longitude !== undefined) {
    return { latitude: input.latitude, longitude: input.longitude, location_source: input.location_source ?? "manual" };
  }
  const found = await geocodeAddress(input.address);
  return found
    ? { latitude: found.lat, longitude: found.lng, location_source: "geocoded" }
    : { latitude: null, longitude: null, location_source: null };
}

export async function listPeopleForAdmin(): Promise<AdminPerson[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("people").select("*").order("full_name", { ascending: true });
  if (error) throw new Error(`Could not load people: ${error.code}`);
  return data;
}

export async function getPersonForAdmin(id: string): Promise<AdminPerson | null> {
  const { supabase } = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await supabase.from("people").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the person: ${error.code}`);
  return data;
}

export async function createPerson(input: PersonCreateInput): Promise<AdminPerson> {
  const { supabase } = await requireAdmin();
  const pin = await resolvePin(input);
  const { data, error } = await supabase
    .from("people")
    .insert({
      full_name: input.full_name,
      date_of_birth: input.date_of_birth,
      mobile_phone: input.mobile_phone,
      address: input.address,
      ...pin,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Could not create the person: ${error.code}`);
  return data;
}

export async function updatePerson(input: PersonUpdateInput): Promise<AdminPerson | null> {
  const { supabase } = await requireAdmin();
  const pin = await resolvePin(input);
  const { data, error } = await supabase
    .from("people")
    .update({
      full_name: input.full_name,
      date_of_birth: input.date_of_birth,
      mobile_phone: input.mobile_phone,
      address: input.address,
      ...pin,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Could not update the person: ${error.code}`);
  return data;
}

export type DeletePersonOutcome = "deleted" | "not_found" | "name_mismatch";

/** Deletes a person (and, by FK cascade, their change requests) after the typed-name check. */
export async function deletePerson(id: string, confirmationName: string): Promise<DeletePersonOutcome> {
  const { supabase } = await requireAdmin();
  if (!z.uuid().safeParse(id).success) return "not_found";
  const { data: person, error: readError } = await supabase.from("people").select("full_name").eq("id", id).maybeSingle();
  if (readError) throw new Error(`Could not load the person: ${readError.code}`);
  if (!person) return "not_found";
  if (confirmationName.trim().normalize("NFC") !== person.full_name.normalize("NFC")) return "name_mismatch";

  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) throw new Error(`Could not delete the person: ${error.code}`);
  return "deleted";
}

/** Geocodes an address for the admin's pin preview. */
export async function locateAddress(address: string): Promise<Coordinates | null> {
  await requireAdmin();
  return geocodeAddress(address);
}
