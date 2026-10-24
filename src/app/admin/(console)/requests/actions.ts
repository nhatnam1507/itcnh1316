"use server";

import { revalidatePath } from "next/cache";
import { approveRequest, rejectRequest } from "@/features/change-requests/change-request-service";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formValues } from "@/lib/validation/person-schema";

function revalidateAfterReview() {
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function approveRequestAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const result = await approveRequest(formValues(formData));
  if (result.ok) revalidateAfterReview();
  return result;
}

export async function rejectRequestAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const result = await rejectRequest(formValues(formData));
  if (result.ok) revalidateAfterReview();
  return result;
}
