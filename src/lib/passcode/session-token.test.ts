import { describe, expect, it } from "vitest";
import { classSessionSigningKey } from "./class-session-key";
import { createSessionToken, verifySessionToken } from "./session-token";

const SECRET = "x".repeat(48);
const NOW = Date.UTC(2026, 9, 19);
const DAY = 24 * 60 * 60 * 1000;

describe("session token", () => {
  it("verifies a token before it expires", async () => {
    const token = await createSessionToken(SECRET, NOW + DAY);
    expect(await verifySessionToken(SECRET, token, NOW)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(SECRET, NOW + DAY);
    expect(await verifySessionToken(SECRET, token, NOW + DAY)).toBe(false);
  });

  it("rejects a token whose expiry was tampered with", async () => {
    const token = await createSessionToken(SECRET, NOW + DAY);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ exp: NOW + 365 * DAY })).toString("base64url");
    expect(await verifySessionToken(SECRET, `${forgedPayload}.${signature}`, NOW)).toBe(false);
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await createSessionToken(SECRET, NOW + DAY);
    const flipped = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(await verifySessionToken(SECRET, flipped, NOW)).toBe(false);
  });

  it("rejects garbage tokens", async () => {
    for (const token of ["", ".", "abc", "a.b.c", "a.!!!", "x".repeat(600)]) {
      expect(await verifySessionToken(SECRET, token, NOW)).toBe(false);
    }
  });

  it("invalidates existing tokens when SESSION_SECRET changes", async () => {
    const before = classSessionSigningKey({ SESSION_SECRET: SECRET, CLASS_PASSCODE_HASH: "scrypt:a" });
    const after = classSessionSigningKey({ SESSION_SECRET: "y".repeat(48), CLASS_PASSCODE_HASH: "scrypt:a" });
    const token = await createSessionToken(before, NOW + DAY);
    expect(await verifySessionToken(after, token, NOW)).toBe(false);
  });

  it("invalidates existing tokens when the passcode hash changes", async () => {
    const before = classSessionSigningKey({ SESSION_SECRET: SECRET, CLASS_PASSCODE_HASH: "scrypt:old" });
    const after = classSessionSigningKey({ SESSION_SECRET: SECRET, CLASS_PASSCODE_HASH: "scrypt:new" });
    const token = await createSessionToken(before, NOW + DAY);
    expect(await verifySessionToken(after, token, NOW)).toBe(false);
  });
});
