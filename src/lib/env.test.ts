import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getServerEnv, resetServerEnvForTests } from "./env";

const validEnv = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
  SUPABASE_SECRET_KEY: "secret-test-key",
  CLASS_PASSCODE_HASH: "scrypt:16384:8:1:c2FsdA:aGFzaA",
  SESSION_SECRET: "x".repeat(32),
  RATE_LIMIT_SALT: "salt-salt-salt-salt",
  NOMINATIM_CONTACT_EMAIL: "admin@example.com",
};

describe("getServerEnv", () => {
  beforeEach(() => {
    resetServerEnvForTests();
    for (const [key, value] of Object.entries(validEnv)) vi.stubEnv(key, value);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvForTests();
  });

  it("parses a valid environment and applies defaults", () => {
    // CI sets these at job level; clear them so the defaults apply.
    vi.stubEnv("PASSCODE_SESSION_DAYS", undefined);
    vi.stubEnv("GEOCODE_COUNTRY_CODES", undefined);
    const env = getServerEnv();
    expect(env.PASSCODE_SESSION_DAYS).toBe(30);
    expect(env.GEOCODE_COUNTRY_CODES).toBe("vn");
    expect(env.SUPABASE_URL).toBe(validEnv.SUPABASE_URL);
  });

  it("coerces numeric session days", () => {
    vi.stubEnv("PASSCODE_SESSION_DAYS", "7");
    expect(getServerEnv().PASSCODE_SESSION_DAYS).toBe(7);
  });

  it("rejects a session secret shorter than 32 bytes", () => {
    vi.stubEnv("SESSION_SECRET", "too-short");
    expect(() => getServerEnv()).toThrow(/SESSION_SECRET/);
  });

  it("names missing variables without echoing any values", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_URL", "not a url");
    let message = "";
    try {
      getServerEnv();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SUPABASE_URL/);
    expect(message).not.toContain("not a url");
    expect(message).not.toContain(validEnv.SESSION_SECRET);
  });

  it("memoizes the parsed result", () => {
    expect(getServerEnv()).toBe(getServerEnv());
  });
});
