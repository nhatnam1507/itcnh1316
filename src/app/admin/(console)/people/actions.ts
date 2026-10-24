"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPerson,
  deletePerson,
  locateAddress,
  updatePerson,
} from "@/features/people/people-admin";
import type { ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { Coordinates } from "@/lib/geocode/nominatim";
import {
  addressSchema,
  fieldErrorsOf,
  formValues,
  personCreateSchema,
  personUpdateSchema,
} from "@/lib/validation/person-schema";

function revalidateDirectory() {
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function savePersonAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const values = formValues(formData);

  let saved;
  if (values.id) {
    const parsed = personUpdateSchema.safeParse(values);
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error), values };
    saved = await updatePerson(parsed.data);
    if (!saved) return { ok: false, error: "This person no longer exists.", values };
  } else {
    const parsed = personCreateSchema.safeParse(values);
    if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error), values };
    saved = await createPerson(parsed.data);
  }

  revalidateDirectory();
  redirect(`/admin/people/${saved.id}?saved=${saved.latitude === null ? "nopin" : "ok"}`);
}

export async function locateAddressAction(address: string): Promise<Coordinates | null> {
  await requireAdmin();
  const parsed = addressSchema.safeParse(address);
  if (!parsed.success) return null;
  return locateAddress(parsed.data);
}

export async function deletePersonAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const { id = "", confirmation_name = "" } = formValues(formData);
  const outcome = await deletePerson(id, confirmation_name);
  if (outcome === "name_mismatch") {
    return { ok: false, fieldErrors: { confirmation_name: ["The name does not match exactly."] } };
  }
  if (outcome === "not_found") return { ok: false, error: "This person no longer exists." };

  revalidateDirectory();
  redirect("/admin?deleted=1");
}
