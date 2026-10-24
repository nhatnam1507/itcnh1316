import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Clears rate-limit rows in the local Supabase stack so repeated runs from 127.0.0.1
 * start under every limit. Uses the local stack's secret key from the test environment.
 */
export default async function globalSetup() {
  loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must point at the local stack for e2e tests.");
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error("e2e tests only run against a local Supabase stack.");
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.from("rate_limit_events").delete().gte("id", 0);
  if (error) throw new Error(`Could not reset rate limits: ${error.message}`);
}
