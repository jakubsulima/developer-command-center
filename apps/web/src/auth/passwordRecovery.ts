import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "../lib/runtime";
import { passwordResetPath } from "./auth-context";

let recoveryClient: SupabaseClient | undefined;

function getRecoveryAuth() {
  const { url, publishableKey } = requireSupabaseConfig();
  if (recoveryClient) return recoveryClient.auth;
  // Only the PKCE verifier survives the redirect. The recovery session cannot
  // replace a Command login or survive a reload of the password form.
  const session = new Map<string, string>();
  recoveryClient = createClient(url, publishableKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: `command-password-recovery:${new URL(url).hostname}`,
      storage: {
        getItem: (key) => key.endsWith("-code-verifier") ? localStorage.getItem(key) : session.get(key) ?? null,
        setItem: (key, value) => {
          if (key.endsWith("-code-verifier")) localStorage.setItem(key, value);
          else session.set(key, value);
        },
        removeItem: (key) => {
          if (key.endsWith("-code-verifier")) localStorage.removeItem(key);
          else session.delete(key);
        }
      }
    }
  });
  return recoveryClient.auth;
}

export async function requestPasswordReset(email: string) {
  const redirectTo = new URL(passwordResetPath, window.location.origin).href;
  const { error } = await getRecoveryAuth().resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function openPasswordRecovery(code: string, flowId?: string) {
  const auth = getRecoveryAuth();
  let recoveryToken: string | undefined;
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") recoveryToken = session?.access_token;
  });
  try {
    const { data, error } = await auth.exchangeCodeForSession(code, { flowId });
    if (error || !data.session || data.session.access_token !== recoveryToken) throw new Error("invalid_recovery_link");
  } finally {
    subscription.unsubscribe();
  }
  return {
    async updatePassword(password: string) {
      const { error } = await auth.updateUser({ password });
      if (error) return error.code === "weak_password" || error.code === "same_password" ? "password" as const
        : error.code === "session_expired" || error.code === "session_not_found" || error.status === 401 ? "expired" as const
        : "retry" as const;
      await auth.signOut({ scope: "local" }).catch(() => undefined);
      return "saved" as const;
    }
  };
}
