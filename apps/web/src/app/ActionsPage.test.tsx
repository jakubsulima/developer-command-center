import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { demoState } from "../data/demo";
import { App } from "./App";
import { StoreProvider } from "./store";

beforeEach(() => vi.stubGlobal("indexedDB", undefined));
afterEach(() => vi.unstubAllGlobals());

function renderApp(path = "/actions?view=open", withHistory = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location-address">{location.pathname}{location.search}{location.hash}</output>;
  }
  function HistoryControls() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate(-1)}>Back test</button><button onClick={() => navigate(1)}>Forward test</button></>;
  }
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App />{withHistory ? <HistoryControls /> : null}<LocationProbe /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
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
    await user.click(screen.getByRole("button", { name: "Filtry Działań" }));
    await user.selectOptions(screen.getByLabelText("Filtr Projektu"), "area-finanse");
    await user.selectOptions(screen.getByLabelText("Filtr Celu"), "");
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Samodzielny krok" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtr Celu"), "goal-budget");
    expect(await screen.findByText("Projekt i cel muszą pasować jednocześnie.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtr Projektu"), "");
    expect(screen.getByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
  });

  it("oddziela status od filtra terminu", async () => {
    const state = structuredClone(demoState);
    state.actions = [
      { ...state.actions[1]!, id: "today", title: "Krok na dziś", scheduledFor: undefined, pinnedToToday: true },
      { ...state.actions[1]!, id: "none", title: "Krok bez terminu", scheduledFor: undefined },
      { ...state.actions[1]!, id: "blocked", title: "Krok zablokowany", status: "blocked", scheduledFor: undefined },
      { ...state.actions[1]!, id: "done", title: "Krok ukończony", status: "completed", completedAt: "2026-09-22T08:00:00.000Z" },
      { ...state.actions[1]!, id: "cancelled", title: "Krok anulowany", status: "cancelled", scheduledFor: undefined },
      { ...state.actions[1]!, id: "skipped", title: "Krok pominięty", status: "skipped", scheduledFor: undefined },
    ];
    state.workspaceTimezone = "Europe/Warsaw";
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp();

    const quickViews = screen.getByRole("group", { name: "Szybkie widoki Działań" });
    expect(within(quickViews).getByRole("button", { name: "Otwarte" })).toHaveAttribute("aria-pressed", "true");
    expect(within(quickViews).getByRole("button", { name: "Na dziś" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtry Działań" }));
    for (const label of ["Do zrobienia", "W toku", "Testowanie", "Zablokowane", "Ukończone", "Anulowane", "Pominięte"]) {
      expect(within(screen.getByLabelText("Status Działań")).getByRole("option", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Bez terminu" }));
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=unscheduled");
    expect(await screen.findByRole("link", { name: "Krok bez terminu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Krok na dziś" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status Działań"), "blocked");
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=blocked");
    expect(await screen.findByRole("link", { name: "Krok zablokowany" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Termin Działań" })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status Działań"), "cancelled");
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=cancelled");
    expect(await screen.findByRole("link", { name: "Krok anulowany" })).toBeInTheDocument();
  });

  it("liczy status jako filtr, pokazuje go po zwinięciu i czyści bez usuwania innych parametrów", async () => {
    const user = userEvent.setup();
    renderApp("/actions?view=completed&project=area-finanse&goal=goal-budget&highlight=action-budget-upcoming&other=keep");
    const filterToggle = await screen.findByRole("button", { name: "Filtry Działań, aktywne: 3" });
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Ukończone");
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Finanse");
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Zbudować spokojny budżet domowy");
    await user.click(filterToggle);
    expect(screen.getByLabelText("Aktywne filtry")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?highlight=action-budget-upcoming&other=keep");
    expect(screen.queryByLabelText("Aktywne filtry")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtry Działań" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otwarte" })).toHaveAttribute("aria-pressed", "true");
  });

  it("odtwarza etykietę filtra statusu przy adresie bezpośrednim oraz Wstecz/Dalej", async () => {
    const user = userEvent.setup();
    renderApp("/actions?view=completed&highlight=action-budget-overdue", true);
    expect(await screen.findByRole("button", { name: "Filtry Działań, aktywne: 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Ukończone");

    await user.selectOptions(screen.getByLabelText("Status Działań"), "blocked");
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=blocked&highlight=action-budget-overdue");
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Zablokowane");
    await user.click(screen.getByRole("button", { name: "Back test" }));
    await screen.findByText("Ukończone", { selector: ".actions-active-filters .badge" });
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=completed&highlight=action-budget-overdue");
    await user.click(screen.getByRole("button", { name: "Forward test" }));
    await screen.findByText("Zablokowane", { selector: ".actions-active-filters .badge" });
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=blocked&highlight=action-budget-overdue");
  });

  it("ukończenie korzysta z istniejącej komendy i usuwa wiersz z Otwarte", async () => {
    const user = userEvent.setup();
    renderApp();
    const row = (await screen.findByRole("link", { name: "Spisać stałe koszty" })).closest("section") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Zmień status: Do zrobienia — Spisać stałe koszty" }));
    await user.click(within(screen.getByRole("dialog", { name: "Zmień status Działania" })).getByRole("button", { name: /Ukończone/ }));
    expect((await screen.findAllByRole("status")).some((status) => status.textContent?.includes("Status zmieniono na „Ukończone”."))).toBe(true);
    expect(screen.queryByRole("link", { name: "Spisać stałe koszty" })).not.toBeInTheDocument();
  });

  it("zamyka proste Działanie jednym dotknięciem i cofa je z listy", async () => {
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const link = await screen.findByRole("link", { name: "Pobrać historię transakcji" });
    const row = link.closest("section") as HTMLElement;

    await user.click(within(row).getByRole("button", { name: "Ukończ: Pobrać historię transakcji" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pobrać historię transakcji" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("link", { name: "Pobrać historię transakcji" })).toBeInTheDocument();
  });

  it("zmienia status bezpośrednio z wiersza bez dodatkowego menu", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, id: "late-pinned", title: "Zaległy przypięty krok", pinnedToToday: true, scheduledFor: "2026-08-01" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const row = (await screen.findByRole("link", { name: "Zaległy przypięty krok" })).closest("section") as HTMLElement;
    expect(within(row).queryByRole("button", { name: "Więcej opcji: Zaległy przypięty krok" })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Zmień status: Do zrobienia — Zaległy przypięty krok" }));
    await user.click(within(screen.getByRole("dialog", { name: "Zmień status Działania" })).getByRole("button", { name: /W trakcie testowania/ }));
    expect(await screen.findByRole("button", { name: "Zmień status: W trakcie testowania — Zaległy przypięty krok" })).toBeInTheDocument();
  });

  it("anuluje pojedyncze Działanie, zachowuje rekord i pozwala je cofnąć", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, id: "late-cancel", title: "Anulowany krok", scheduledFor: "2026-08-01" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const row = (await screen.findByRole("link", { name: "Anulowany krok" })).closest("section") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Zmień status: Do zrobienia — Anulowany krok" }));
    await user.click(within(screen.getByRole("dialog", { name: "Zmień status Działania" })).getByRole("button", { name: /Anulowane/ }));
    expect(await screen.findByText("Status zmieniono na „Anulowane”.")).toBeInTheDocument();
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
    const contextNavigation = document.querySelector<HTMLElement>(".context-navigation")!;
    expect(within(contextNavigation).getByRole("link", { name: "Działania" })).toHaveAttribute("href", "/actions?view=overdue");
    await user.click(within(contextNavigation).getByRole("button", { name: "Wszystkie Działania" }));
    expect(await screen.findByRole("heading", { name: "Działania" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue");
  });
});
