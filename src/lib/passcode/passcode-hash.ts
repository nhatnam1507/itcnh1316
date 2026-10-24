import "server-only";
import { scrypt, timingSafeEqual } from "node:crypto";

// Bounds keep a malformed hash from requesting absurd amounts of memory or CPU.
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;

type ParsedHash = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function parseHash(encoded: string): ParsedHash | null {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = parts.slice(1, 4).map((value) => Number.parseInt(value, 10));
  const salt = Buffer.from(parts[4], "base64");
  const hash = Buffer.from(parts[5], "base64");
  const isPowerOfTwo = Number.isInteger(N) && N > 1 && (N & (N - 1)) === 0;
  if (!isPowerOfTwo || N > MAX_N || !(r >= 1 && r <= MAX_R) || !(p >= 1 && p <= MAX_P)) return null;
  if (salt.length < 8 || hash.length < 16) return null;
  return { N, r, p, salt, hash };
}

function deriveKey(passcode: string, { N, r, p, salt, hash }: ParsedHash): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(passcode.normalize("NFC"), salt, hash.length, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Constant-time check of a passcode against a `scrypt:N:r:p:saltB64:hashB64` hash. */
export async function verifyPasscode(passcode: string, encodedHash: string): Promise<boolean> {
  const parsed = parseHash(encodedHash);
  if (!parsed) return false;
  const derived = await deriveKey(passcode, parsed);
  return timingSafeEqual(derived, parsed.hash);
}
