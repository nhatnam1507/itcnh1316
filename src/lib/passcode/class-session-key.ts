import type { ServerEnv } from "@/lib/env";

/**
 * The signing key covers the passcode hash as well as SESSION_SECRET, so rotating
 * either one invalidates every existing viewer session.
 */
export function classSessionSigningKey(env: Pick<ServerEnv, "SESSION_SECRET" | "CLASS_PASSCODE_HASH">): string {
  return `${env.SESSION_SECRET}\u0000${env.CLASS_PASSCODE_HASH}`;
}
