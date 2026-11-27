import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "./auth-context";
import { AuthGate } from "./AuthGate";

const openPasswordRecovery = vi.hoisted(() => vi.fn());
vi.mock("./passwordRecovery", () => ({ openPasswordRecovery }));
vi.mock("../lib/runtime", () => ({ isSupabaseConfigured: true, runtimeConfig: { signupEnabled: true } }));

const auth: AuthContextValue = {
  mode: "supabase", loading: false, user: { id: "user", name: "User", email: "user@example.com" },
  signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), continueInDemo: vi.fn()
};

function LocationProbe() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="location">{pathname}{search}{hash}</output>;
}

function renderCallback(path: string) {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><LocationProbe /><AuthContext.Provider value={auth}>
    <AuthGate>Private workspace</AuthGate>
  </AuthContext.Provider></MemoryRouter></StrictMode>);
}

describe("strona zmiany hasła", () => {
  beforeEach(() => { openPasswordRecovery.mockReset(); });

  it("wymienia kod jeden raz w StrictMode, usuwa go z adresu i zapisuje zgodne hasła", async () => {
    const updatePassword = vi.fn<(password: string) => Promise<string>>().mockResolvedValue("saved");
    openPasswordRecovery.mockResolvedValue({ updatePassword });
    const user = userEvent.setup();
    renderCallback("/reset-password?code=valid-code&sb_flow_id=flow-id");
    const password = await screen.findByLabelText("Nowe hasło", { exact: true });
    const confirmation = screen.getByLabelText("Powtórz nowe hasło");
    expect(openPasswordRecovery).toHaveBeenCalledExactlyOnceWith("valid-code", "flow-id");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/reset-password$/);
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    expect(password).toHaveFocus();
    await user.type(password, "nowe-bezpieczne-haslo");
    await user.type(confirmation, "inne-bezpieczne-haslo");
    const submit = screen.getByRole("button", { name: "Zapisz nowe hasło" });
    await user.click(submit);
    expect(screen.getByRole("alert")).toHaveTextContent("muszą być takie same");
    expect(updatePassword).not.toHaveBeenCalled();
    await user.clear(confirmation);
    await user.type(confirmation, "nowe-bezpieczne-haslo");
    await user.click(submit);
    expect(updatePassword).toHaveBeenCalledExactlyOnceWith("nowe-bezpieczne-haslo");
    expect(await screen.findByRole("heading", { name: "Hasło zostało zmienione" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wróć do logowania" })).toHaveAttribute("href", "/");
  });

  it("z wygasłego linku pozwala wrócić po nowy link", async () => {
    openPasswordRecovery.mockRejectedValue(new Error("expired"));
    renderCallback("/reset-password?code=expired");
    expect(await screen.findByRole("alert")).toHaveTextContent("Link wygasł");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/reset-password$/);
    expect(screen.queryByLabelText("Nowe hasło", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wróć do logowania" })).toBeInTheDocument();
  });

  it("po odświeżeniu już użytego linku nie udostępnia formularza istniejącej sesji", async () => {
    renderCallback("/reset-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("Poproś o nowy link");
    expect(openPasswordRecovery).not.toHaveBeenCalled();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });
});
