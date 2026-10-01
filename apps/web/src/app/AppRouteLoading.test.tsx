import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { demoState } from "../data/demo";
import { AppShell } from "../components/AppShell";
import { App } from "./App";
import { StoreProvider } from "./store";

const delayedActionsRoute = vi.hoisted(() => {
  let resolveModule!: (module: unknown) => void;
  const promise = new Promise<unknown>((resolve) => { resolveModule = resolve; });
  return { promise, resolve: (module: unknown) => resolveModule(module) };
});

vi.mock("../pages/ActionsPage", async () => delayedActionsRoute.promise);

beforeEach(() => {
  vi.stubGlobal("indexedDB", undefined);
  localStorage.removeItem("command-center-local-workspace-v2");
  localStorage.setItem("command-center-state-v1", JSON.stringify(structuredClone(demoState)));
});
afterEach(() => vi.unstubAllGlobals());

describe("ekran ładowania widoku", () => {
  it("blokuje skróty, zdarzenia i tymczasowe panele, a po załadowaniu używa kontekstu strony", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<MemoryRouter initialEntries={["/actions"]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);

    const loadingStatus = await screen.findByRole("status", { name: "Ładowanie widoku" });
    const loadingShell = loadingStatus.closest(".app-shell") as HTMLElement;
    expect(loadingShell.querySelector(".topbar-add-button")).toBeDisabled();
    expect(loadingShell.querySelector(".capture-fab")).toBeDisabled();
    expect(loadingShell.querySelector(".mobile-search-trigger")).toBeDisabled();
    expect(loadingShell.querySelector(".mobile-more-trigger")).toBeDisabled();
    expect(loadingShell.querySelector<HTMLInputElement>("#global-search")).toBeDisabled();

    fireEvent.keyDown(window, { key: "j", metaKey: true });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent(window, new CustomEvent("app-shell:quick-add", { detail: { mode: "action", goalId: "goal-budget" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Opcje profilu" })).not.toBeInTheDocument();

    await act(async () => {
      delayedActionsRoute.resolve({ ActionsPage: () => <AppShell addAction={{
        label: "Dodaj Działanie",
        shortLabel: "Działanie",
        ariaLabel: "Dodaj nowe Działanie",
        quickAdd: { mode: "action", goalId: "goal-budget", areaId: "area-finanse", pinnedToToday: false, draftKey: "slow-actions" }
      }}><h1>Załadowane Działania</h1></AppShell> });
    });

    expect(await screen.findByRole("heading", { name: "Załadowane Działania" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(document.querySelector<HTMLButtonElement>(".topbar-add-button")!);
    const dialog = await screen.findByRole("dialog", { name: "Nowe Działanie" });
    expect(dialog).toHaveTextContent("Cel: Zbudować spokojny budżet domowy");
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Krok po załadowaniu");
    expect(screen.getByLabelText("Co chcesz zrobić?")).toHaveValue("Krok po załadowaniu");
  });
});
