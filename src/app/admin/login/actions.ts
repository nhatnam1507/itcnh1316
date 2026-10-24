"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/require-admin";
import { requireClassAccess } from "@/lib/passcode/class-session";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSessionClient } from "@/lib/supabase/session-client";

export type AdminLoginState = { error: string } | null;

const credentialsSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(200),
});

const INVALID = "Login failed. Check your email and password.";

export async function adminLoginAction(_previous: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  await requireClassAccess();
  if (!(await consumeRateLimit("admin-login"))) {
    return { error: "Too many login attempts from this network. Try again in 15 minutes." };
  }

  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: INVALID };

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: INVALID };

  // A valid account that is not an admin gets the same generic message and no session.
  if (!(await getAdminSession())) {
    await supabase.auth.signOut();
    return { error: INVALID };
  }
  redirect("/admin");
}
