import type { ReactNode } from "react";
import { AuthContext, demoUser, type AuthContextValue } from "./auth-context";

const demoAuth: AuthContextValue = {
  mode: "demo",
  user: demoUser,
  loading: false,
  async signIn() { return {}; },
  async signUp() { return {}; },
  async signOut() {},
  continueInDemo() {}
};

export default function DemoAuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={demoAuth}>{children}</AuthContext.Provider>;
}
