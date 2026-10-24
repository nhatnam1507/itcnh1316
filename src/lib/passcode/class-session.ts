import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getServerEnv } from "@/lib/env";
import { classSessionSigningKey } from "./class-session-key";
import { CLASS_SESSION_COOKIE, createSessionToken, verifySessionToken } from "./session-token";

export const hasClassAccess = cache(async (): Promise<boolean> => {
  const token = (await cookies()).get(CLASS_SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifySessionToken(classSessionSigningKey(getServerEnv()), token, Date.now());
});

/** Every data function calls this; the proxy alone is not trusted as the gate. */
export async function requireClassAccess(): Promise<void> {
  if (!(await hasClassAccess())) redirect("/unlock");
}

export async function issueClassSession(): Promise<void> {
  const env = getServerEnv();
  const maxAgeSeconds = env.PASSCODE_SESSION_DAYS * 24 * 60 * 60;
  const token = await createSessionToken(classSessionSigningKey(env), Date.now() + maxAgeSeconds * 1000);
  (await cookies()).set(CLASS_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}
