import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { AuthGate } from "./AuthGate";
import { AuthRoot } from "./AuthRoot";
import { useAuth } from "./useAuth";

const base: AuthContextValue = {
  mode: "supabase", user: null, loading: false,
  signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), continueInDemo: vi.fn()
};

describe("infrastruktura Auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pokazuje loading, formularz i aplikację zgodnie ze stanem sesji", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrap = (value: AuthContextValue) => <QueryClientProvider client={queryClient}><AuthContext.Provider value={value}><AuthGate><div>Private app</div></AuthGate></AuthContext.Provider></QueryClientProvider>;
    const { rerender } = render(wrap({ ...base, loading: true }));
    expect(screen.getByRole("status")).toHaveTextContent("Ładowanie Command");
    rerender(wrap(base));
    expect(screen.getByRole("heading", { name: "Witaj ponownie" })).toBeInTheDocument();
    rerender(wrap({ ...base, mode: "demo", user: { id: "user", email: "dev@example.com", name: "Dev" } }));
    expect(screen.getByText("Private app")).toBeInTheDocument();
  });

  it("bez konfiguracji Supabase uruchamia bezpieczny tryb demo", () => {
    function Consumer() { const auth = useAuth(); return <span>{auth.mode}:{auth.user?.name}</span>; }
    render(<AuthRoot><Consumer /></AuthRoot>);
    expect(screen.getByText("demo:Jakub Kowalski")).toBeInTheDocument();
  });

  it("pokazuje jawny błąd konfiguracji zamiast lokalnego fallbacku", async () => {
    vi.stubEnv("VITE_DATA_BACKEND", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.resetModules();
    const { AuthRoot: MisconfiguredAuthRoot } = await import("./AuthRoot");
    render(<MisconfiguredAuthRoot><div>Private app</div></MisconfiguredAuthRoot>);
    expect(screen.getByRole("alert")).toHaveTextContent("Backend nie jest skonfigurowany");
    expect(screen.queryByText("Private app")).not.toBeInTheDocument();
  });

  it("hooki kontekstowe zgłaszają użycie poza Providerem", () => {
    function BadAuth() { useAuth(); return null; }
    expect(() => render(<BadAuth />)).toThrow("useAuth must be used within AuthRoot");
  });
});
