import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { StoreContext, type AppStore } from "../app/store-context";
import { emptyState } from "../data/empty";
import { AuthContext, demoUser, type AuthContextValue } from "../auth/auth-context";
import { FirstFocusOnboarding } from "./CommandPage";

const auth: AuthContextValue = {
  mode: "demo", user: demoUser, loading: false,
  signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), continueInDemo: vi.fn()
};

describe("prowadzony pierwszy Focus", () => {
  it("po błędzie zapisu pozostawia kreator otwarty i zachowuje wpisaną treść", async () => {
    const createProject = vi.fn().mockRejectedValue(new Error("Brak połączenia z repozytorium"));
    const store = {
      state: structuredClone(emptyState),
      mode: "demo",
      loading: false,
      syncing: false,
      createProject,
      startFocus: vi.fn()
    } as unknown as AppStore;
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <StoreContext.Provider value={store}>
            <FirstFocusOnboarding showEmptyPanel />
          </StoreContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Rozpocznij pierwszy fokus" }));
    const dialog = screen.getByRole("dialog", { name: "Przygotuj pierwszy fokus" });
    await user.type(within(dialog).getByLabelText("Rezultat"), "Użytkownik odzyskuje konto");
    await user.click(within(dialog).getByRole("button", { name: "Dalej" }));
    await user.type(within(dialog).getByLabelText("Pierwsza konkretna akcja"), "Dodać endpoint resetu hasła");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz pierwszy krok" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Brak połączenia z repozytorium");
    expect(within(dialog).getByLabelText("Pierwsza konkretna akcja")).toHaveValue("Dodać endpoint resetu hasła");
    await user.click(within(dialog).getByRole("button", { name: "Wstecz" }));
    expect(within(dialog).getByLabelText("Rezultat")).toHaveValue("Użytkownik odzyskuje konto");
  });
});
