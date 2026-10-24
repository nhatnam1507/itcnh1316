import { z } from "zod";

const VIETNAM_MOBILE = /^(?:\+84|0)([35789]\d{8})$/;

/** Accepts `0…` or `+84…` Vietnamese mobile numbers and returns the `+84…` form. */
export function normalizeVietnamMobile(input: string): string | null {
  const compact = input.replace(/[\s.-]/g, "");
  const match = VIETNAM_MOBILE.exec(compact);
  return match ? `+84${match[1]}` : null;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Empty form fields arrive as "" — treat them as absent. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** Vietnamese text can arrive precomposed (NFC) or decomposed (NFD); store one form. */
const nfc = (value: string) => value.normalize("NFC");

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(120, "Use at most 120 characters.")
  .transform(nfc);

export const dateOfBirthSchema = z
  .string()
  .trim()
  .refine(isRealIsoDate, "Enter a valid date.")
  .refine((value) => value >= "1900-01-01", "Enter a date after 1900.")
  .refine((value) => value <= todayIsoDate(), "Date of birth cannot be in the future.");

export const mobilePhoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeVietnamMobile(value);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Enter a Vietnamese mobile number, e.g. 0912 345 678." });
    return z.NEVER;
  }
  return normalized;
});

export const addressSchema = z
  .string()
  .trim()
  .min(5, "Use at least 5 characters.")
  .max(300, "Use at most 300 characters.")
  .transform(nfc);

const coordinate = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().min(min).max(max).optional());

const personFieldsSchema = z.object({
  full_name: fullNameSchema,
  date_of_birth: dateOfBirthSchema,
  mobile_phone: mobilePhoneSchema,
  address: addressSchema,
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  location_source: z.preprocess(blankToUndefined, z.enum(["geocoded", "manual"]).optional()),
});

const pinIsPaired = (value: { latitude?: number; longitude?: number }) =>
  (value.latitude === undefined) === (value.longitude === undefined);

export const personCreateSchema = personFieldsSchema.refine(pinIsPaired, {
  message: "Set both latitude and longitude, or neither.",
  path: ["latitude"],
});

export const personUpdateSchema = personFieldsSchema
  .extend({ id: z.uuid() })
  .refine(pinIsPaired, { message: "Set both latitude and longitude, or neither.", path: ["latitude"] });

export const changeRequestSchema = z
  .object({
    person_id: z.uuid(),
    proposed_full_name: z.preprocess(blankToUndefined, fullNameSchema.optional()),
    proposed_date_of_birth: z.preprocess(blankToUndefined, dateOfBirthSchema.optional()),
    proposed_mobile_phone: z.preprocess(blankToUndefined, mobilePhoneSchema.optional()),
    proposed_address: z.preprocess(blankToUndefined, addressSchema.optional()),
    requester_note: z.preprocess(
      blankToUndefined,
      z.string().trim().max(500, "Use at most 500 characters.").optional(),
    ),
  })
  .refine(
    (value) =>
      [value.proposed_full_name, value.proposed_date_of_birth, value.proposed_mobile_phone, value.proposed_address].some(
        (field) => field !== undefined,
      ),
    { message: "Propose at least one change.", path: ["form"] },
  );

export type PersonCreateInput = z.infer<typeof personCreateSchema>;
export type PersonUpdateInput = z.infer<typeof personUpdateSchema>;
export type ChangeRequestInput = z.infer<typeof changeRequestSchema>;

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const { fieldErrors, formErrors } = z.flattenError(error);
  const errors: FieldErrors = { ...fieldErrors };
  const form = [...formErrors, ...((errors.form as string[] | undefined) ?? [])];
  errors.form = form.length ? form : undefined;
  return errors;
}

/** Reads only string fields from a submitted form. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export const changeRequestReviewSchema = z
  .object({
    request_id: z.uuid(),
    reviewer_note: z.preprocess(
      blankToUndefined,
      z.string().trim().max(500, "Use at most 500 characters.").optional(),
    ),
    latitude: coordinate(-90, 90),
    longitude: coordinate(-180, 180),
    location_source: z.preprocess(blankToUndefined, z.enum(["geocoded", "manual"]).optional()),
  })
  .refine(pinIsPaired, { message: "Set both latitude and longitude, or neither.", path: ["latitude"] });

export type ChangeRequestReviewInput = z.infer<typeof changeRequestReviewSchema>;
