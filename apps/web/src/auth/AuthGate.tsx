import type { ReactNode } from "react";
import { StoreProvider } from "../app/store";
import { AppLoading } from "./AuthRoot";
import { AuthPage } from "./AuthPage";
import { useAuth } from "./useAuth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <AppLoading />;
  if (!user) return <AuthPage />;
  return <StoreProvider>{children}</StoreProvider>;
}
