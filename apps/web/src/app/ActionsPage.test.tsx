import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { demoState } from "../data/demo";
import { App } from "./App";
import { StoreProvider } from "./store";

beforeEach(() => vi.stubGlobal("indexedDB", undefined));
afterEach(() => vi.unstubAllGlobals());

function renderApp(path = "/actions?view=open") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location-address">{location.pathname}{location.search}{location.hash}</output>;
  }
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /><LocationProbe /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

describe("lista wszystkich Działań", () => {
  it("pokazuje samodzielne Działanie i zachowuje sprzeczne filtry", async () => {
    const state = structuredClone(demoState);
    state.actions.push({ id: "standalone", version: 1, title: "Samodzielny krok", detail: "Bez kontekstu", status: "ready", position: 9, isNext: false, pinnedToToday: false, checklist: [] });
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp();
    expect(await screen.findByRole("heading", { name: "Działania" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Samodzielny krok" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtr Projektu"), "area-finanse");
    await user.selectOptions(screen.getByLabelText("Filtr Celu"), "");
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Samodzielny krok" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtr Celu"), "goal-budget");
    expect(await screen.findByText("Filtry łączą się przez AND.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtr Projektu"), "");
    expect(screen.getByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
  });

  it("ukończenie korzysta z istniejącej komendy i usuwa wiersz z Otwarte", async () => {
    const user = userEvent.setup();
    renderApp();
    const row = (await screen.findByRole("link", { name: "Spisać stałe koszty" })).closest("section") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Ukończ Działanie: Spisać stałe koszty" }));
    expect((await screen.findAllByRole("status")).some((status) => status.textContent?.includes("Działanie ukończone."))).toBe(true);
    expect(screen.queryByRole("link", { name: "Spisać stałe koszty" })).not.toBeInTheDocument();
  });

  it("wykonuje przełożenie z menu wiersza i zachowuje przypięcie", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, id: "late-pinned", title: "Zaległy przypięty krok", pinnedToToday: true, scheduledFor: "2026-08-01" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const row = (await screen.findByRole("link", { name: "Zaległy przypięty krok" })).closest("section") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Więcej opcji: Zaległy przypięty krok" }));
    expect(screen.getByRole("button", { name: "Dzisiaj" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Jutro" }));
    expect(await screen.findByText(/Nadal przypięte na dziś/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Zaległy przypięty krok" })).not.toBeInTheDocument();
  });

  it("anuluje pojedyncze Działanie, zachowuje rekord i pozwala je cofnąć", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, id: "late-cancel", title: "Anulowany krok", scheduledFor: "2026-08-01" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const row = (await screen.findByRole("link", { name: "Anulowany krok" })).closest("section") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Więcej opcji: Anulowany krok" }));
    await user.click(screen.getByRole("button", { name: "Anuluj Działanie" }));
    expect(await screen.findByText("Działanie anulowano. Rekord zachowano.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anulowany krok" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("link", { name: "Anulowany krok" })).toBeInTheDocument();
  });

  it("odnajduje highlight spoza pierwszej strony bez ręcznego paginowania", async () => {
    const state = structuredClone(demoState);
    state.actions = Array.from({ length: 31 }, (_, index) => ({ ...state.actions[1]!, id: `late-${index}`, title: `Zaległy ${index}`, scheduledFor: "2026-08-01", position: index }));
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    renderApp("/actions?view=overdue&highlight=late-30");
    const link = await screen.findByRole("link", { name: "Zaległy 30" });
    expect(link.closest("section")).toHaveAttribute("data-highlighted", "true");
  });

  it("wraca ze szczegółu do adresu listy", async () => {
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    await user.click(await screen.findByRole("link", { name: "Pobrać historię transakcji" }));
    expect(await screen.findByRole("heading", { name: "Pobrać historię transakcji" })).toBeInTheDocument();
    expect(within(document.querySelector(".context-navigation")!).getByRole("link", { name: "Działania" })).toHaveAttribute("href", "/actions?view=overdue");
    await user.click(within(document.querySelector(".context-navigation")!).getByRole("link", { name: "Działania" }));
    expect(await screen.findByRole("heading", { name: "Działania" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue");
  });
});
