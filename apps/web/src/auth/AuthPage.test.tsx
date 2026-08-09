import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { AuthPage } from "./AuthPage";

const runtimeConfig = vi.hoisted(() => ({ demoEnabled: true, signupEnabled: true }));
vi.mock("../lib/runtime", () => ({ runtimeConfig }));

function renderAuth(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    mode: "supabase",
    user: null,
    loading: false,
    signIn: vi.fn(async () => ({})),
    signUp: vi.fn(async () => ({})),
    signOut: vi.fn(async () => undefined),
    continueInDemo: vi.fn(),
    ...overrides
  };
  render(<AuthContext.Provider value={value}><AuthPage /></AuthContext.Provider>);
  return value;
}

describe("AuthPage", () => {
  it("wysyła dane logowania do Supabase Auth", async () => {
    const user = userEvent.setup();
    const auth = renderAuth();
    await user.type(screen.getByLabelText("Adres e-mail"), "dev@example.com");
    await user.type(screen.getByLabelText("Hasło"), "bezpieczne-haslo");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    expect(auth.signIn).toHaveBeenCalledWith("dev@example.com", "bezpieczne-haslo");
  });

  it("pozwala jawnie przejść do odseparowanego trybu demo", async () => {
    const user = userEvent.setup();
    const auth = renderAuth();
    await user.click(screen.getByRole("button", { name: "Otwórz wersję demonstracyjną" }));
    expect(auth.continueInDemo).toHaveBeenCalledOnce();
  });

  it("w prywatnym wdrożeniu pokazuje wyłącznie logowanie", () => {
    runtimeConfig.signupEnabled = false;
    renderAuth();
    expect(screen.queryByRole("tab", { name: "Nowe konto" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zaloguj się" })).toBeInTheDocument();
    runtimeConfig.signupEnabled = true;
  });

  it("rejestruje użytkownika, Workspace i pokazuje wymóg potwierdzenia", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn(async () => ({ confirmationRequired: true }));
    renderAuth({ signUp });
    await user.click(screen.getByRole("tab", { name: "Nowe konto" }));
    await user.type(screen.getByLabelText("Imię i nazwisko"), "Ada Lovelace");
    await user.clear(screen.getByLabelText("Nazwa Workspace"));
    await user.type(screen.getByLabelText("Nazwa Workspace"), "Laboratorium");
    await user.type(screen.getByLabelText("Adres e-mail"), "ada@example.com");
    await user.type(screen.getByLabelText("Hasło"), "bezpieczne-haslo");
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(screen.getByLabelText("Hasło")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Utwórz konto" }));
    expect(signUp).toHaveBeenCalledWith({ email: "ada@example.com", password: "bezpieczne-haslo", name: "Ada Lovelace", workspaceName: "Laboratorium" });
    expect(await screen.findByText(/potwierdź rejestrację/)).toBeInTheDocument();
  });
});
