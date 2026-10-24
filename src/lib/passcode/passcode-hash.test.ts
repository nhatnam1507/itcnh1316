import { describe, expect, it } from "vitest";
import { hashPasscode } from "../../../scripts/hash-passcode.mjs";
import { verifyPasscode } from "./passcode-hash";

describe("verifyPasscode", () => {
  it("accepts the correct passcode for a hash made by the generation script", async () => {
    const hash = await hashPasscode("lop-12a1-2016");
    expect(hash).toMatch(/^scrypt:16384:8:1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    expect(await verifyPasscode("lop-12a1-2016", hash)).toBe(true);
  });

  it("rejects a wrong passcode", async () => {
    const hash = await hashPasscode("lop-12a1-2016");
    expect(await verifyPasscode("lop-12a1-2017", hash)).toBe(false);
    expect(await verifyPasscode("", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPasscode("same-passcode")).not.toBe(await hashPasscode("same-passcode"));
  });

  it("treats NFC and NFD forms of a Vietnamese passcode as equal", async () => {
    const hash = await hashPasscode("mật-khẩu".normalize("NFD"));
    expect(await verifyPasscode("mật-khẩu".normalize("NFC"), hash)).toBe(true);
  });

  it("produces a hash that survives .env variable expansion", async () => {
    expect(await hashPasscode("x")).not.toContain("$");
  });

  it("rejects malformed or unsafe hashes instead of throwing", async () => {
    expect(await verifyPasscode("x", "")).toBe(false);
    expect(await verifyPasscode("x", "bcrypt:abc")).toBe(false);
    expect(await verifyPasscode("x", "scrypt:1000:8:1:c2FsdHNhbHQ=:aGFzaGhhc2hoYXNoaGFzaA==")).toBe(false);
    expect(await verifyPasscode("x", `scrypt:${2 ** 24}:8:1:c2FsdHNhbHQ=:aGFzaGhhc2hoYXNoaGFzaA==`)).toBe(false);
  });
});
