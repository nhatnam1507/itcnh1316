import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getServerEnv } from "@/lib/env";

export function fingerprintIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

/** HMAC of the client's IP. The raw IP is never stored or logged. */
export async function getClientFingerprint(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
  return fingerprintIp(ip, getServerEnv().RATE_LIMIT_SALT);
}
