"use server";

import { redirect } from "next/navigation";
import { getServerEnv } from "@/lib/env";
import { issueClassSession } from "@/lib/passcode/class-session";
import { verifyPasscode } from "@/lib/passcode/passcode-hash";
import { consumeRateLimit, refundRateLimit } from "@/lib/rate-limit";

export type UnlockState = { error: string } | null;

const DENIED = "ACCESS DENIED. Check the passcode and try again.";

export async function unlockAction(_previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const passcode = formData.get("passcode");
  if (typeof passcode !== "string" || passcode.length === 0 || passcode.length > 200) return { error: DENIED };

  // Every attempt is counted up front so parallel guesses cannot slip past the limit;
  // a correct passcode gives its attempt back, so only failures count.
  if (!(await consumeRateLimit("unlock"))) {
    return { error: "Too many failed attempts from this network. Try again in 15 minutes." };
  }
  if (!(await verifyPasscode(passcode, getServerEnv().CLASS_PASSCODE_HASH))) return { error: DENIED };

  await refundRateLimit("unlock");
  await issueClassSession();
  redirect("/");
}
