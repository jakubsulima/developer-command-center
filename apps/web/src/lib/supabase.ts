import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./runtime";

let client: SupabaseClient | null = null;

export function getSupabase() {
  const { url, publishableKey } = requireSupabaseConfig();
  client ??= createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { headers: { "x-client-info": "developer-command-center/0.1" } }
    });
  return client;
}
