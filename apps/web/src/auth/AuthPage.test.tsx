import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { AuthPage } from "./AuthPage";

const runtimeConfig = vi.hoisted(() => ({ demoEnabled: true, signupEnabled: true, passwordResetEnabled: undefined as boolean | undefined, supabase: { url: "https://project.supabase.co" } }));
const requestPasswordReset = vi.hoisted(() => vi.fn<(email: string) => Promise<void>>().mockResolvedValue(undefined));
vi.mock("../lib/runtime", () => ({ runtimeConfig }));
vi.mock("./passwordRecovery", () => ({ requestPasswordReset }));

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

  it("w prywatnym wdrożeniu prowadzi z logowania do właściwego panelu Supabase", async () => {
    const user = userEvent.setup();
    runtimeConfig.signupEnabled = false;
    try {
      const auth = renderAuth();
      expect(screen.queryByRole("tab", { name: "Nowe konto" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Zaloguj się" })).toBeInTheDocument();
      await user.click(screen.getByText("Nie pamiętam hasła"));
      expect(screen.getByText(/Skontaktuj się z administratorem Command/)).toBeVisible();
      await user.click(screen.getByText("Dla administratora"));
      expect(screen.getByRole("link", { name: "Otwórz panel Supabase" })).toHaveAttribute("href", "https://supabase.com/dashboard/project/project/auth/users");
      expect(auth.signIn).not.toHaveBeenCalled();
    } finally {
      runtimeConfig.signupEnabled = true;
    }
  });

  it("przy otwartej rejestracji pozwala poprosić o link bez ujawniania istnienia konta", async () => {
    const user = userEvent.setup();
    const auth = renderAuth();
    await user.type(screen.getByLabelText("Adres e-mail"), "dev@example.com");
    await user.click(screen.getByRole("button", { name: "Nie pamiętam hasła" }));
    expect(screen.getByLabelText("Adres e-mail")).toHaveFocus();
    expect(screen.queryByLabelText("Hasło")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wyślij link do zmiany hasła" }));
    expect(requestPasswordReset).toHaveBeenCalledWith("dev@example.com");
    expect(await screen.findByRole("status")).toHaveTextContent("Jeśli ten adres jest przypisany do konta");
    expect(auth.signIn).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Wróć do logowania" }));
    expect(screen.getByLabelText("Adres e-mail")).toHaveValue("dev@example.com");
    expect(screen.getByRole("button", { name: "Nie pamiętam hasła" })).toHaveFocus();
  });

  it("udostępnia odzyskiwanie hasła niezależnie od rejestracji", async () => {
    const user = userEvent.setup();
    runtimeConfig.signupEnabled = false;
    runtimeConfig.passwordResetEnabled = true;
    try {
      renderAuth();
      expect(screen.queryByRole("tab", { name: "Nowe konto" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Nie pamiętam hasła" }));
      expect(screen.getByRole("button", { name: "Wyślij link do zmiany hasła" })).toBeInTheDocument();
    } finally {
      runtimeConfig.signupEnabled = true;
      runtimeConfig.passwordResetEnabled = undefined;
    }
  });

  it("rejestruje użytkownika, Workspace i pokazuje wymóg potwierdzenia", async () => {
    const user = userEvent.setup();
    const signUp = vi.fn(async () => ({ confirmationRequired: true }));
    renderAuth({ signUp });
    await user.click(screen.getByRole("tab", { name: "Nowe konto" }));
    await user.type(screen.getByLabelText("Imię i nazwisko"), "Ada Lovelace");
    await user.clear(screen.getByLabelText("Nazwa przestrzeni pracy"));
    await user.type(screen.getByLabelText("Nazwa przestrzeni pracy"), "Laboratorium");
    await user.type(screen.getByLabelText("Adres e-mail"), "ada@example.com");
    await user.type(screen.getByLabelText("Hasło"), "bezpieczne-haslo");
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(screen.getByLabelText("Hasło")).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Utwórz konto" }));
    expect(signUp).toHaveBeenCalledWith({ email: "ada@example.com", password: "bezpieczne-haslo", name: "Ada Lovelace", workspaceName: "Laboratorium" });
    expect(await screen.findByText(/potwierdź rejestrację/)).toBeInTheDocument();
  });
});
