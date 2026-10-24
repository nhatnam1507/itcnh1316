"use server";

import { submitChangeRequest } from "@/features/change-requests/change-request-service";
import type { ActionResult } from "@/lib/action-result";
import { formValues } from "@/lib/validation/person-schema";

export async function submitChangeRequestAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const values = formValues(formData);
  const result = await submitChangeRequest(values);
  return result.ok ? result : { ...result, values };
}
