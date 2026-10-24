import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";
import { hardenCookieOptions } from "./hardened-cookie-options";

/** Admin session client (authenticated role), so RLS enforces is_admin() as well. */
export async function createSessionClient() {
  const cookieStore = await cookies();
  const env = getServerEnv();
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: hardenCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, hardenCookieOptions(options));
          }
        } catch {
          // Server Components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
