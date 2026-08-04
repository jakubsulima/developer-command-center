import { lazy, Suspense, type ReactNode } from "react";
import { isSupabaseConfigured, runtimeConfig } from "../lib/runtime";
import DemoAuthProvider from "./DemoAuthProvider";

const SupabaseAuthProvider = lazy(() => import("./SupabaseAuthProvider"));

export function AuthRoot({ children }: { children: ReactNode }) {
  if (runtimeConfig.configurationError) {
    return (
      <main className="workspace-error" role="alert">
        <span className="loading-mark">!</span>
        <h1>Backend nie jest skonfigurowany</h1>
        <p>{runtimeConfig.configurationError}</p>
        <p>Uzupełnij zmienne środowiskowe zgodnie z <code>apps/web/.env.example</code> i uruchom aplikację ponownie.</p>
      </main>
    );
  }
  if (!isSupabaseConfigured) return <DemoAuthProvider>{children}</DemoAuthProvider>;
  return (
    <Suspense fallback={<AppLoading label="Łączenie z bezpieczną sesją…" />}>
      <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
    </Suspense>
  );
}

export function AppLoading({ label = "Ładowanie Command…" }: { label?: string }) {
  return <div className="app-loading" role="status"><span className="loading-mark">&gt;_</span><span>{label}</span></div>;
}
