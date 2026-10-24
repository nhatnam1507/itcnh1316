import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { requireClassAccess } from "@/lib/passcode/class-session";
import { createSessionClient } from "@/lib/supabase/session-client";

type SessionClient = Awaited<ReturnType<typeof createSessionClient>>;

/** Memoized per request, so a layout and its page share one Auth round trip. */
export const getAdminSession = cache(async (): Promise<{ user: User; supabase: SessionClient } | null> => {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS lets a user read only their own admins row, so a hit proves admin status.
  const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error || !data) return null;
  return { user, supabase };
});

/** Every admin page and action calls this; non-admins go to the admin login. */
export async function requireAdmin(): Promise<{ user: User; supabase: SessionClient }> {
  await requireClassAccess();
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}
