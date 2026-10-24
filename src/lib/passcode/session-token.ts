// Signed viewer-session token: base64url({"exp":<ms>}) + "." + base64url(HMAC-SHA256).
// Uses Web Crypto only, so both the proxy and server code can verify it.

export const CLASS_SESSION_COOKIE = "class_session";

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function createSessionToken(secret: string, expiresAtMs: number): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: expiresAtMs })));
  const signature = await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(secret: string, token: string, nowMs: number): Promise<boolean> {
  if (token.length > 512) return false;
  const [payload, signatureText, ...rest] = token.split(".");
  if (!payload || !signatureText || rest.length > 0) return false;
  const signature = fromBase64Url(signatureText);
  if (!signature) return false;

  // crypto.subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify("HMAC", await importKey(secret), signature, encoder.encode(payload));
  if (!valid) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof exp === "number" && exp > nowMs;
  } catch {
    return false;
  }
}
