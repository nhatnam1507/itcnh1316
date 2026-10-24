import "server-only";
import { getClientFingerprint } from "@/lib/client-fingerprint";
import { getSecretClient } from "@/lib/supabase/secret-client";

export const RATE_LIMIT_BUCKETS = {
  unlock: { max: 5, window: "15 minutes" },
  "change-request": { max: 5, window: "1 hour" },
  "admin-login": { max: 10, window: "15 minutes" },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMIT_BUCKETS;

/** Records an attempt; returns false once the caller is over the bucket's limit. */
export async function consumeRateLimit(bucket: RateLimitBucket): Promise<boolean> {
  const { max, window } = RATE_LIMIT_BUCKETS[bucket];
  const { data, error } = await getSecretClient().rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_fingerprint: await getClientFingerprint(),
    p_window: window,
    p_max: max,
  });
  if (error) throw new Error(`Rate limit check failed: ${error.code ?? "unknown"}`);
  return data === true;
}

/** Gives back the latest attempt, so a bucket counts only failed attempts. */
export async function refundRateLimit(bucket: RateLimitBucket): Promise<void> {
  const { error } = await getSecretClient().rpc("refund_rate_limit", {
    p_bucket: bucket,
    p_fingerprint: await getClientFingerprint(),
  });
  if (error) throw new Error(`Rate limit refund failed: ${error.code ?? "unknown"}`);
}
