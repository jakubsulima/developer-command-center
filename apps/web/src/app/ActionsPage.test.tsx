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

  it("wraca ze szczegółu do adresu listy", async () => {
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    await user.click(await screen.findByRole("link", { name: "Pobrać historię transakcji" }));
    expect(await screen.findByRole("heading", { name: "Pobrać historię transakcji" })).toBeInTheDocument();
    expect(within(document.querySelector(".context-navigation")!).getByRole("link", { name: "Działania" })).toHaveAttribute("href", "/actions?view=overdue");
    await user.click(screen.getByRole("button", { name: "Wszystkie Działania" }));
    expect(await screen.findByRole("heading", { name: "Działania" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue");
  });
});
