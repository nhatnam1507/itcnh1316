import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

/**
 * Service-role client: bypasses RLS. Call only after requireClassAccess(), and only
 * with fixed queries. The one exception is the rate-limit RPC on the unlock page.
 */
export function getSecretClient(): SupabaseClient<Database> {
  if (!client) {
    const env = getServerEnv();
    client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
