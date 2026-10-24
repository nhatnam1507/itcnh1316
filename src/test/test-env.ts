import { vi } from "vitest";
import { resetServerEnvForTests } from "@/lib/env";

export const TEST_ENV = {
  SUPABASE_URL: "http://127.0.0.1:1",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "secret-test-key",
  CLASS_PASSCODE_HASH: "scrypt:16384:8:1:c2FsdHNhbHRzYWx0:aGFzaGhhc2hoYXNoaGFzaA",
  SESSION_SECRET: "s".repeat(48),
  RATE_LIMIT_SALT: "test-rate-limit-salt",
  NOMINATIM_CONTACT_EMAIL: "admin@example.com",
} as const;

export function stubServerEnv(overrides: Partial<Record<keyof typeof TEST_ENV, string>> = {}): void {
  resetServerEnvForTests();
  for (const [key, value] of Object.entries({ ...TEST_ENV, ...overrides })) vi.stubEnv(key, value);
}

export function clearServerEnv(): void {
  vi.unstubAllEnvs();
  resetServerEnvForTests();
}
