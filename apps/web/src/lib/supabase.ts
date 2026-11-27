import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./runtime";
import { passwordResetPath } from "../auth/auth-context";

let client: SupabaseClient | null = null;

export function getSupabase() {
  const { url, publishableKey } = requireSupabaseConfig();
  client ??= createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: typeof window === "undefined" || window.location.pathname !== passwordResetPath
      },
      global: { headers: { "x-client-info": "developer-command-center/0.1" } }
    });
  return client;
}
