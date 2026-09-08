import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useAuth } from "./useAuth";
import SupabaseAuthProvider from "./SupabaseAuthProvider";

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("../lib/supabase", () => ({ getSupabase: getClient }));

function Probe() {
  const auth = useAuth();
  const [message, setMessage] = useState("");
  return <>
    <span>{auth.loading ? "loading" : `${auth.mode}:${auth.user?.name ?? "anonymous"}`}</span>
    <button onClick={() => void auth.signIn("dev@example.com", "password").then((result) => setMessage(result.error ?? "signed-in"))}>Login</button>
    <button onClick={() => void auth.signUp({ email: "new@example.com", password: "password", name: "New Dev", workspaceName: "Private" }).then((result) => setMessage(result.confirmationRequired ? "confirm" : result.error ?? "registered"))}>Register</button>
    <button onClick={auth.continueInDemo}>Demo</button>
    <button onClick={() => void auth.signOut()}>Logout</button>
    <output>{message}</output>
  </>;
}

function setup(overrides: Record<string, unknown> = {}) {
  let listener: ((event: string, session: unknown) => void) | undefined;
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email: "dev@example.com", user_metadata: { full_name: "Dev User" } } }, error: null })),
    onAuthStateChange: vi.fn((callback) => { listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    signInWithPassword: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides
  };
  getClient.mockReturnValue({ auth });
  const queryClient = new QueryClient();
  queryClient.setQueryData(["workspace-state", "user-1"], { private: true });
  render(<QueryClientProvider client={queryClient}><SupabaseAuthProvider><Probe /></SupabaseAuthProvider></QueryClientProvider>);
  return { auth, queryClient, emit: (event: string, session: unknown) => listener?.(event, session) };
}

describe("SupabaseAuthProvider", () => {
  beforeEach(() => { getClient.mockReset(); });

  it("waliduje sesję, mapuje użytkownika i reaguje na wylogowanie Auth", async () => {
    const harness = setup();
    expect(await screen.findByText("supabase:Dev User")).toBeInTheDocument();
    harness.emit("SIGNED_OUT", null);
    expect(await screen.findByText("supabase:anonymous")).toBeInTheDocument();
  });

  it("przekazuje logowanie i rejestrację z metadanymi Workspace", async () => {
    const user = userEvent.setup();
    const harness = setup({ signInWithPassword: vi.fn(async () => ({ error: { message: "Niepoprawne dane" } })) });
    await screen.findByText("supabase:Dev User");
    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByText("Niepoprawne dane")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(await screen.findByText("confirm")).toBeInTheDocument();
    expect(harness.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { data: { full_name: "New Dev", workspace_name: "Private" } } }));
  });

  it("czyści prywatny cache podczas lokalnego wylogowania", async () => {
    localStorage.setItem("command-center-state-v1", "private");
    localStorage.setItem("command-center-draft-v2:user-1:workspace-1:goal-edit:goal-1", "private");
    sessionStorage.setItem("command-global-search", "tajny projekt");
    const user = userEvent.setup();
    const harness = setup();
    await screen.findByText("supabase:Dev User");
    await user.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(harness.auth.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(harness.queryClient.getQueryData(["workspace-state", "user-1"])).toBeUndefined();
    expect(localStorage.getItem("command-center-state-v1")).toBeNull();
    expect(localStorage.getItem("command-center-draft-v2:user-1:workspace-1:goal-edit:goal-1")).toBeNull();
    expect(sessionStorage.getItem("command-global-search")).toBeNull();
  });

  it("pozwala wejść do demo bez wywoływania zdalnego signOut", async () => {
    const user = userEvent.setup();
    const harness = setup();
    await screen.findByText("supabase:Dev User");
    await user.click(screen.getByRole("button", { name: "Demo" }));
    expect(screen.getByText("demo:Jakub Kowalski")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByText("supabase:Dev User")).toBeInTheDocument();
    expect(harness.auth.signOut).not.toHaveBeenCalled();
  });
});
