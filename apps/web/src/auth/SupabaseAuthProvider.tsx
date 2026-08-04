import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "../lib/supabase";
import { runtimeConfig } from "../lib/runtime";
import { AuthContext, demoUser, type AuthContextValue, type CurrentUser } from "./auth-context";

function mapUser(user: User): CurrentUser {
  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  return {
    id: user.id,
    email: user.email ?? "",
    name: fullName || user.email?.split("@")[0] || "Użytkownik"
  };
}

export default function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoOverride, setDemoOverride] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    let active = true;

    void client.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setUser(!error && data.user ? mapUser(data.user) : null);
      setLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") setUser(null);
      else if (session?.user) setUser(mapUser(session.user));
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    mode: demoOverride ? "demo" : "supabase",
    user: demoOverride ? demoUser : user,
    loading: demoOverride ? false : loading,
    async signIn(email, password) {
      const { error } = await getSupabase().auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUp({ email, password, name, workspaceName }) {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { full_name: name, workspace_name: workspaceName } }
      });
      if (error) return { error: error.message };
      return { confirmationRequired: !data.session };
    },
    async signOut() {
      if (demoOverride) {
        setDemoOverride(false);
        return;
      }
      await getSupabase().auth.signOut({ scope: "local" });
      queryClient.removeQueries({ queryKey: ["workspace-state"] });
      localStorage.removeItem("command-center-state-v1");
      setUser(null);
    },
    continueInDemo() {
      if (runtimeConfig.demoEnabled) setDemoOverride(true);
    }
  }), [demoOverride, loading, queryClient, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
