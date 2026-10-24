import type { FieldErrors } from "@/lib/validation/person-schema";

/** Serializable result returned by server actions to `useActionState` forms. */
export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error?: string; fieldErrors?: FieldErrors; values?: Record<string, string> };
