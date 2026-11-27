import { useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { StoreProvider } from "../app/store";
import { AppLoading } from "./AuthRoot";
import { AuthPage } from "./AuthPage";
import { useAuth } from "./useAuth";
import { passwordResetPath } from "./auth-context";
import { runtimeConfig } from "../lib/runtime";

const PasswordResetPage = lazy(() => import("./PasswordResetPage"));

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, mode, user } = useAuth();
  const { pathname } = useLocation();
  if (pathname === passwordResetPath && mode === "supabase" && (runtimeConfig.passwordResetEnabled ?? runtimeConfig.signupEnabled)) {
    return <Suspense fallback={<AppLoading label="Otwieranie zmiany hasła…" />}><PasswordResetPage /></Suspense>;
  }
  if (loading) return <AppLoading label="Sprawdzanie sesji…" />;
  if (!user || (pathname === passwordResetPath && mode === "supabase")) return <AuthPage unavailableReset={pathname === passwordResetPath} />;
  return <StoreProvider captureOnly={pathname === "/capture"}>{children}</StoreProvider>;
}
