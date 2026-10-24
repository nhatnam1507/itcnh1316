import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  CLASS_PASSCODE_HASH: z.string().startsWith("scrypt:"),
  SESSION_SECRET: z
    .string()
    .refine((value) => new TextEncoder().encode(value).length >= 32, {
      message: "SESSION_SECRET must be at least 32 bytes",
    }),
  PASSCODE_SESSION_DAYS: z.coerce.number().int().positive().max(365).default(30),
  RATE_LIMIT_SALT: z.string().min(16),
  NOMINATIM_CONTACT_EMAIL: z.email(),
  GEOCODE_COUNTRY_CODES: z
    .string()
    .regex(/^[a-z]{2}(,[a-z]{2})*$/)
    .default("vn"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

/**
 * Parses the server environment on first use. Validation is lazy so that
 * `next build` succeeds without secrets present.
 */
export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    const result = serverEnvSchema.safeParse(process.env);
    if (!result.success) {
      // Report variable names only; never echo the values.
      const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
      throw new Error(`Invalid or missing server environment variables: ${names.join(", ")}`);
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}

export function resetServerEnvForTests(): void {
  cachedEnv = undefined;
}
