import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { demoState } from "../data/demo";
import { App } from "./App";
import { StoreProvider } from "./store";
import { StoreContext, type AppStore } from "./store-context";
import { useStore } from "./useStore";

beforeEach(() => vi.stubGlobal("indexedDB", undefined));
afterEach(() => vi.unstubAllGlobals());
// Route imports can take longer than the default query timeout on a cold run.
configure({ asyncUtilTimeout: 5000 });

function renderApp(path = "/actions?view=open", withHistory = false, interceptStore?: (store: AppStore) => AppStore) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let currentStore: AppStore;
  function StoreProbe({ children }: { children: ReactNode }) {
    currentStore = useStore();
    return <StoreContext.Provider value={interceptStore?.(currentStore) ?? currentStore}>{children}</StoreContext.Provider>;
  }
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location-address">{location.pathname}{location.search}{location.hash}</output>;
  }
  function HistoryControls() {
    const navigate = useNavigate();
    return <><button onClick={() => navigate(-1)}>Back test</button><button onClick={() => navigate(1)}>Forward test</button></>;
  }
  const view = render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><StoreProbe><App />{withHistory ? <HistoryControls /> : null}<LocationProbe /></StoreProbe></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
  return { ...view, queryClient, store: () => currentStore };
}

function enableDesktopPreview() {
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
    matches: media === "(min-width: 1440px)", media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()
  })));
}

describe("lista wszystkich Działań", () => {
  it("zamyka Moje widoki po wyborze filtra i przy otwarciu zapisu oraz przywraca fokus po zamknięciu", async () => {
    vi.stubGlobal("innerWidth", 390);
    const user = userEvent.setup();
    const state = structuredClone(demoState);
    const createdAt = "2026-08-01T08:00:00.000Z";
    state.savedActionViews = [{ id: "overdue-view", name: "Moje zaległe", filters: { view: "open", schedule: "overdue" }, filterVersion: 1, position: 0, version: 1, createdAt, updatedAt: createdAt }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    renderApp();
    const picker = await screen.findByText(/^Moje widoki/);
    const details = picker.closest("details");
    await user.click(picker);
    await user.click(screen.getByRole("button", { name: "Zaległe" }));
    expect(details).not.toHaveAttribute("open");

    await user.click(picker);
    await user.click(screen.getByRole("button", { name: "Moje zaległe" }));
    expect(details).not.toHaveAttribute("open");
    expect(picker).toHaveFocus();

    await user.click(picker);
    await user.click(screen.getByRole("button", { name: "Zapisz obecny widok" }));
    expect(details).not.toHaveAttribute("open");
    const dialog = screen.getByRole("dialog", { name: "Zapisz widok Działań" });
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(picker).toHaveFocus());
    expect(details).not.toHaveAttribute("open");

    await user.click(picker);
    await user.click(screen.getByRole("button", { name: "Zapisz obecny widok" }));
    await user.type(screen.getByLabelText("Nazwa widoku"), "Drugi widok");
    await user.click(within(screen.getByRole("dialog", { name: "Zapisz widok Działań" })).getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(picker).toHaveFocus());
    expect(details).not.toHaveAttribute("open");

    const selection = screen.getByRole("button", { name: "Zaznacz działania" });
    await user.click(selection);
    expect(selection).toHaveAttribute("aria-pressed", "true");
  });

  it("pokazuje zapisane Działanie od razu, zachowując wcześniej widoczny wiersz", async () => {
    const user = userEvent.setup();
    renderApp();
    const oldTitle = await screen.findByRole("link", { name: "Spisać stałe koszty" });
    await user.click(screen.getByRole("button", { name: "Dodaj nowe Działanie" }));
    const dialog = await screen.findByRole("dialog", { name: "Nowe Działanie" });
    await user.type(within(dialog).getByLabelText("Co chcesz zrobić?"), "Krok bez odświeżania strony");
    await user.type(within(dialog).getByLabelText("Opis"), "Treść nowego kroku");
    await user.click(within(dialog).getByRole("button", { name: "Dodaj Działanie" }));
    expect(await screen.findByRole("link", { name: "Krok bez odświeżania strony" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Spisać stałe koszty" })).toBe(oldTitle);
  });

  it("odświeża listę po zmianie statusu bez usuwania wczytanych wierszy", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp();
    const title = await screen.findByRole("link", { name: "Spisać stałe koszty" });
    const states: string[] = [];
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === "workspace-page" && event.query.queryKey[1] === "actions") states.push(event.query.state.status);
    });
    try {
      const trigger = screen.getByRole("button", { name: "Ukończ: Spisać stałe koszty" });
      trigger.focus();
      await user.keyboard("{Shift>}{Enter}{/Shift}");
      const dialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
      expect(dialog.parentElement).toHaveClass("action-status-menu-backdrop");
      await user.click(within(dialog).getByRole("button", { name: /W toku/ }));
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(await screen.findByRole("button", { name: "Ukończ: Spisać stałe koszty", description: /Status: W toku\./ })).toBeInTheDocument();
      expect(title.isConnected).toBe(true);
      expect(screen.getByRole("link", { name: "Spisać stałe koszty" })).toBe(title);
      expect(states.length).toBeGreaterThan(0);
      expect(states).not.toContain("pending");
    } finally { unsubscribe(); }
  });

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
    await user.selectOptions(screen.getByLabelText("Filtr grupy"), "");
    await user.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Samodzielny krok" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtry Działań, aktywne: 1" }));
    await user.selectOptions(screen.getByLabelText("Filtr grupy"), "goal-budget");
    await user.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(await screen.findByText("Projekt i grupa muszą pasować jednocześnie.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtry Działań, aktywne: 2" }));
    await user.selectOptions(screen.getByLabelText("Filtr Projektu"), "");
    await user.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(await screen.findByRole("link", { name: "Spisać stałe koszty" })).toBeInTheDocument();
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
    expect(within(quickViews).getByRole("button", { name: "Na dziś lub przypięte" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filtry Działań" }));
    for (const label of ["Do zrobienia", "W toku", "W trakcie testowania", "Zablokowane", "Ukończone", "Anulowane", "Pominięte"]) {
      expect(within(screen.getByLabelText("Status Działań")).getByRole("option", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Bez terminu" }));
    await user.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(screen.getByTestId("location-address")).toHaveTextContent("schedule=unscheduled");
    expect(await screen.findByRole("link", { name: "Krok bez terminu" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Krok na dziś" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Filtry Działań, aktywne: 1" }));
    expect(screen.getByRole("group", { name: "Termin Działań" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status Działań"), "blocked");
    await user.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=blocked");
    expect(await screen.findByRole("link", { name: "Krok zablokowany" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("schedule=unscheduled");

    await user.click(screen.getByRole("button", { name: "Filtry Działań, aktywne: 2" }));
    await user.selectOptions(screen.getByLabelText("Status Działań"), "cancelled");
    await user.click(screen.getByRole("button", { name: "Gotowe" }));
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
    await user.click(within(screen.getByRole("dialog", { name: "Filtry Działań" })).getByRole("button", { name: "Gotowe" }));
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

    await user.click(screen.getByRole("button", { name: "Filtry Działań, aktywne: 1" }));
    await user.selectOptions(screen.getByLabelText("Status Działań"), "blocked");
    await user.click(within(screen.getByRole("dialog", { name: "Filtry Działań" })).getByRole("button", { name: "Gotowe" }));
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=blocked&highlight=action-budget-overdue");
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Zablokowane");
    await user.click(screen.getByRole("button", { name: "Back test" }));
    await screen.findByText("Ukończone", { selector: ".actions-active-filters .badge" });
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=completed&highlight=action-budget-overdue");
    await user.click(screen.getByRole("button", { name: "Forward test" }));
    await screen.findByText("Zablokowane", { selector: ".actions-active-filters .badge" });
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=blocked&highlight=action-budget-overdue");
  });

  it("zapamiętuje połączenie filtrów i daje pierwszeństwo filtrom z adresu", async () => {
    const user = userEvent.setup();
    const initial = renderApp("/actions");
    await user.click(await screen.findByRole("button", { name: "Filtry Działań" }));
    const panel = within(screen.getByRole("dialog", { name: "Filtry Działań" }));
    await user.selectOptions(panel.getByLabelText("Status Działań"), "testing");
    await user.click(panel.getByRole("button", { name: "Bez terminu" }));
    await user.selectOptions(panel.getByLabelText("Filtr Projektu"), "area-finanse");
    await user.click(panel.getByRole("button", { name: "Gotowe" }));
    initial.unmount();

    const directLink = renderApp("/actions?view=today");
    expect(await screen.findByRole("button", { name: "Filtry Działań, aktywne: 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Aktywne filtry")).toHaveTextContent("Na dziś");
    directLink.unmount();

    const restored = renderApp("/actions");
    await user.click(await screen.findByRole("button", { name: "Filtry Działań, aktywne: 3" }));
    const restoredPanel = within(screen.getByRole("dialog", { name: "Filtry Działań" }));
    expect(restoredPanel.getByLabelText("Status Działań")).toHaveValue("testing");
    expect(restoredPanel.getByRole("button", { name: "Bez terminu", pressed: true })).toBeInTheDocument();
    expect(restoredPanel.getByLabelText("Filtr Projektu")).toHaveValue("area-finanse");
    await user.click(restoredPanel.getByRole("button", { name: "Wyczyść filtry" }));
    await user.click(restoredPanel.getByRole("button", { name: "Gotowe" }));
    restored.unmount();

    renderApp("/actions");
    expect(await screen.findByRole("button", { name: "Filtry Działań" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Aktywne filtry")).not.toBeInTheDocument();
  });

  it("ukończenie korzysta z istniejącej komendy i usuwa wiersz z Otwarte", async () => {
    const user = userEvent.setup();
    renderApp();
    const row = (await screen.findByRole("link", { name: "Spisać stałe koszty" })).closest("section") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: "Ukończ: Spisać stałe koszty" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Zmień status Działania" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Spisać stałe koszty" })).not.toBeInTheDocument();
  });

  it("kończy Działanie przez ikonę statusu i pozwala je przywrócić", async () => {
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const link = await screen.findByRole("link", { name: "Pobrać historię transakcji" });
    const row = link.closest("section") as HTMLElement;

    expect(within(row).queryByText("Do zrobienia")).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Ukończ: Pobrać historię transakcji" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pobrać historię transakcji" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("link", { name: "Pobrać historię transakcji" })).toBeInTheDocument();
  });

  it("przypina istniejące działanie z wiersza bez zmiany terminu i pozwala cofnąć obie zmiany", async () => {
    const user = userEvent.setup();
    const { store } = renderApp("/actions?view=overdue");
    const title = "Pobrać historię transakcji";
    const readAction = () => store().state.actions.find((action) => action.title === title);
    await user.click(await screen.findByRole("button", { name: `Przypnij do Startu: ${title}` }));
    const pinNotice = await screen.findByText("Działanie przypięte do Startu.");
    expect(readAction()).toMatchObject({ pinnedToToday: true, scheduledFor: "2026-08-01" });
    await user.click(within(pinNotice.closest("[role=status]") as HTMLElement).getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("button", { name: `Przypnij do Startu: ${title}` })).toBeInTheDocument();
    expect(readAction()).toMatchObject({ pinnedToToday: false, scheduledFor: "2026-08-01" });

    await user.click(screen.getByRole("button", { name: `Przypnij do Startu: ${title}` }));
    await user.click(await screen.findByRole("button", { name: `Odepnij od Startu: ${title}` }));
    const unpinNotice = await screen.findByText("Działanie odpięte od Startu.");
    await user.click(within(unpinNotice.closest("[role=status]") as HTMLElement).getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("button", { name: `Odepnij od Startu: ${title}` })).toBeInTheDocument();
    expect(readAction()).toMatchObject({ pinnedToToday: true, scheduledFor: "2026-08-01" });
  });

  it("pokazuje przypięte działanie z przyszłym terminem w szybkim widoku Na dziś", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, title: "Przypięte na później", pinnedToToday: true, scheduledFor: "2099-01-15" }];
    state.recurringActionTemplates = [];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: "Na dziś lub przypięte" }));
    const link = await screen.findByRole("link", { name: "Przypięte na później" });
    const row = link.closest("[data-action-id]") as HTMLElement;
    expect(row.closest("[data-schedule-group]")).toBeNull();
    expect(row.querySelector(".action-schedule")).toHaveTextContent("15 sty");
  });

  it("zachowuje fokus przy przenoszeniu przypinanego działania pomiędzy grupami", async () => {
    const state = structuredClone(demoState);
    const title = "Działanie bez terminu";
    state.actions = [{ ...state.actions[1]!, title, pinnedToToday: false, scheduledFor: undefined }];
    state.recurringActionTemplates = [];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp();

    const withoutDate = await screen.findByRole("region", { name: "Bez terminu" });
    within(withoutDate).getByRole("button", { name: `Przypnij do Startu: ${title}` }).focus();
    await user.keyboard("{Enter}");
    const today = await screen.findByRole("region", { name: "Przypięte do Startu" });
    await waitFor(() => expect(within(today).getByRole("button", { name: `Odepnij od Startu: ${title}` })).toHaveFocus());

    await user.keyboard("{Enter}");
    const restored = await screen.findByRole("region", { name: "Bez terminu" });
    await waitFor(() => expect(within(restored).getByRole("button", { name: `Przypnij do Startu: ${title}` })).toHaveFocus());
  });

  it("zmienia terminy zaznaczonych działań i ponawia wyłącznie niezapisane zmiany", async () => {
    const user = userEvent.setup();
    const state = structuredClone(demoState);
    const action = state.actions[1]!;
    state.actions = [
      { ...action, id: "first", title: "Pierwsze zaległe", pinnedToToday: true },
      { ...action, id: "retry", title: "Drugie zaległe" },
      { ...action, id: "untouched", title: "Niezaznaczone" },
      { ...action, id: "blocked", title: "Zablokowane zaległe", status: "blocked", blocker: "Czekam na odpowiedź" },
    ];
    state.recurringActionTemplates = [];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const update = vi.fn((store: AppStore, id: string, changes: Parameters<AppStore["updateAction"]>[1], version?: number) => store.updateAction(id, changes, version));
    update.mockImplementationOnce((store, id, changes, version) => store.updateAction(id, changes, version))
      .mockRejectedValueOnce(new Error("Zapis chwilowo niedostępny."));
    const { store } = renderApp("/actions?schedule=overdue", false, (current) => ({ ...current, updateAction: (...args) => update(current, ...args) }));
    await user.click(await screen.findByRole("button", { name: "Zaznacz działania" }));
    expect(screen.getByRole("checkbox", { name: "Zaznacz: Zablokowane zaległe" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Zaznacz: Pierwsze zaległe" }));
    await user.click(screen.getByRole("checkbox", { name: "Zaznacz: Drugie zaległe" }));
    await user.click(screen.getByRole("button", { name: "Zmień termin" }));
    const dialog = screen.getByRole("dialog", { name: "Zmień termin zaległych działań" });
    fireEvent.change(within(dialog).getByLabelText("Nowy termin"), { target: { value: "2099-01-15" } });
    await user.click(within(dialog).getByRole("button", { name: "Zapisz termin" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Udało się zapisać 1 z 2 zmian.");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Drugie zaległe — Zapis chwilowo niedostępny.");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz termin" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(update.mock.calls.map(([, id]) => id)).toEqual(["first", "retry", "retry"]);
    expect(store().state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "first", scheduledFor: "2099-01-15", pinnedToToday: true }),
      expect.objectContaining({ id: "retry", scheduledFor: "2099-01-15" }),
      expect.objectContaining({ id: "untouched", scheduledFor: action.scheduledFor }),
      expect.objectContaining({ id: "blocked", scheduledFor: action.scheduledFor, status: "blocked" }),
    ]));
  });

  it("pomija tylko zaznaczone zaległe wystąpienie bez zmiany innych terminów rutyny", async () => {
    const user = userEvent.setup();
    const state = structuredClone(demoState);
    const action = state.actions[1]!;
    const recurringTemplateId = state.recurringActionTemplates[0]!.id;
    state.recurringActionTemplates[0]!.status = "paused";
    state.actions = [
      { ...action, id: "past", title: "Zaległe wystąpienie", recurringTemplateId, occurrenceDate: "2026-08-01" },
      { ...action, id: "past-other", title: "Zaległe wystąpienie", recurringTemplateId, occurrenceDate: "2026-08-02" },
      { ...action, id: "future", title: "Przyszłe wystąpienie", recurringTemplateId, occurrenceDate: "2099-01-15", scheduledFor: "2099-01-15" },
      { ...action, id: "future-moved", title: "Przyszłe wystąpienie przeniesione", recurringTemplateId, occurrenceDate: "2099-01-22" },
      { ...action, id: "single", title: "Jednorazowe zaległe" },
    ];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const { store } = renderApp("/actions?view=overdue");
    await user.click(await screen.findByRole("button", { name: "Zaznacz działania" }));
    expect(screen.getByRole("button", { name: "Ukończ: Zaległe wystąpienie, wystąpienie rutyny z 1 sierpnia 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ukończ: Zaległe wystąpienie, wystąpienie rutyny z 2 sierpnia 2026" })).toBeInTheDocument();
    const firstOccurrence = screen.getByRole("checkbox", { name: "Zaznacz: Zaległe wystąpienie, wystąpienie rutyny z 1 sierpnia 2026" });
    const otherOccurrence = screen.getByRole("checkbox", { name: "Zaznacz: Zaległe wystąpienie, wystąpienie rutyny z 2 sierpnia 2026" });
    await user.click(firstOccurrence);
    expect(otherOccurrence).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Zaznacz: Jednorazowe zaległe" }));
    await user.click(screen.getByRole("checkbox", { name: "Zaznacz: Przyszłe wystąpienie przeniesione, wystąpienie rutyny z 22 stycznia 2099" }));
    await user.click(screen.getByRole("button", { name: "Pomiń wystąpienia" }));
    const dialog = screen.getByRole("dialog", { name: "Pomiń zaległe wystąpienia rutyn" });
    expect(within(dialog).getByText("Zaznaczono 1 wystąpienie rutyny.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Pomiń wystąpienia" }));
    expect(await screen.findByText("Pominięto 1 wystąpienie rutyny.")).toBeInTheDocument();
    expect(firstOccurrence).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Zaznacz: Jednorazowe zaległe" })).toBeChecked();
    expect(store().state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "past", status: "skipped" }),
      expect.objectContaining({ id: "past-other", status: "ready" }),
      expect.objectContaining({ id: "future", status: "ready", scheduledFor: "2099-01-15" }),
      expect.objectContaining({ id: "future-moved", status: "ready", scheduledFor: action.scheduledFor }),
      expect.objectContaining({ id: "single", status: "ready", scheduledFor: action.scheduledFor }),
    ]));
    expect(store().state.recurringActionTemplates).toEqual(state.recurringActionTemplates);
  });

  it("otwiera menu po przytrzymaniu wiersza i zwija je po wyborze statusu", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, id: "late-pinned", title: "Zaległy przypięty krok", pinnedToToday: true, scheduledFor: "2026-08-01" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const title = await screen.findByRole("link", { name: "Zaległy przypięty krok" });
    const row = title.closest("section") as HTMLElement;
    expect(within(row).queryByRole("button", { name: "Więcej opcji: Zaległy przypięty krok" })).not.toBeInTheDocument();
    await user.pointer({ keys: "[MouseLeft>]", target: title });
    const dialog = await screen.findByRole("dialog", { name: "Zmień status Działania" });
    expect(dialog.parentElement).toHaveClass("action-status-menu-backdrop");
    const options = within(dialog).getByRole("group", { name: "Nowy status Działania" });
    expect(within(dialog).getAllByRole("button")).toEqual(within(options).getAllByRole("button"));
    expect(within(dialog).queryByRole("heading")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Zaległy przypięty krok")).not.toBeInTheDocument();
    await user.pointer("[/MouseLeft]");
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue");
    expect(screen.queryByText("Działanie ukończone.")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /W trakcie testowania/ }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(await screen.findByRole("button", { name: "Ukończ: Zaległy przypięty krok", description: /Status: W trakcie testowania\./ })).toBeInTheDocument();
  });

  it("przywraca ukończone Działanie po kliknięciu ikony", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, status: "completed", completedAt: "2026-08-01T08:00:00.000Z" }];
    const title = state.actions[0]!.title;
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=completed");
    await user.click(await screen.findByRole("button", { name: `Przywróć: ${title}` }));
    expect(await screen.findByText("Status zmieniono na „Do zrobienia”.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: title })).not.toBeInTheDocument();
  });

  it("anuluje pojedyncze Działanie, zachowuje rekord i pozwala je cofnąć", async () => {
    const state = structuredClone(demoState);
    state.actions = [{ ...state.actions[1]!, id: "late-cancel", title: "Anulowany krok", scheduledFor: "2026-08-01" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    const row = (await screen.findByRole("link", { name: "Anulowany krok" })).closest("section") as HTMLElement;
    within(row).getByRole("button", { name: "Ukończ: Anulowany krok" }).focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    const dialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
    await user.click(within(dialog).getByRole("button", { name: /Anulowane/ }));
    expect(await screen.findByText("Status zmieniono na „Anulowane”.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Anulowany krok" })).not.toBeInTheDocument();
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
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
    expect(await screen.findByRole("heading", { name: "Pobrać historię transakcji" }, { timeout: 5000 })).toBeInTheDocument();
    const contextNavigation = document.querySelector<HTMLElement>(".context-navigation")!;
    expect(within(contextNavigation).getByRole("link", { name: "Działania" })).toHaveAttribute("href", "/actions?view=overdue");
    await user.click(within(contextNavigation).getByRole("button", { name: "Wszystkie Działania" }));
    expect(await screen.findByRole("heading", { name: "Działania" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue");
  });

  it("otwiera podgląd na desktopie bez opuszczania listy i przywraca fokus po Escape", async () => {
    enableDesktopPreview();
    const user = userEvent.setup();
    renderApp("/actions?view=overdue&project=area-finanse&other=keep");
    const title = await screen.findByRole("link", { name: "Pobrać historię transakcji" });
    await user.click(title);

    const preview = await screen.findByRole("complementary", { name: "Pobrać historię transakcji" });
    expect(within(preview).getByText("Ostatnie trzy miesiące")).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: "Pobrać historię transakcji" })).toHaveFocus();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue&project=area-finanse&other=keep&preview=action-budget-overdue");
    expect(title).toHaveAttribute("href", "/actions/action-budget-overdue");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("complementary", { name: "Pobrać historię transakcji" })).not.toBeInTheDocument();
    expect(title).toHaveFocus();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue&project=area-finanse&other=keep");
  });

  it("wraca z pełnego widoku do listy z wybranym podglądem i filtrami", async () => {
    enableDesktopPreview();
    const user = userEvent.setup();
    renderApp("/actions?view=overdue&project=area-finanse");
    await user.click(await screen.findByRole("link", { name: "Pobrać historię transakcji" }));
    const preview = await screen.findByRole("complementary", { name: "Pobrać historię transakcji" });
    await user.click(within(preview).getByRole("link", { name: "Otwórz pełny widok" }));
    const contextNavigation = await screen.findByRole("navigation", { name: "Ścieżka kontekstu" });
    await user.click(within(contextNavigation).getByRole("button", { name: "Wszystkie Działania" }));
    expect(await screen.findByRole("complementary", { name: "Pobrać historię transakcji" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("/actions?view=overdue&project=area-finanse&preview=action-budget-overdue");
  });

  it("zmienia status w podglądzie i zamyka tylko dialog przy pierwszym Escape", async () => {
    enableDesktopPreview();
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    await user.click(await screen.findByRole("link", { name: "Pobrać historię transakcji" }));
    const preview = await screen.findByRole("complementary", { name: "Pobrać historię transakcji" });
    await user.click(within(preview).getByRole("button", { name: "Zmień status: Do zrobienia — Pobrać historię transakcji" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Zmień status Działania" })).not.toBeInTheDocument();
    expect(preview).toBeInTheDocument();

    await user.click(within(preview).getByRole("button", { name: "Zmień status: Do zrobienia — Pobrać historię transakcji" }));
    const dialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
    await user.click(within(dialog).getByRole("button", { name: /W trakcie testowania/ }));
    expect(await within(preview).findByRole("button", { name: "Zmień status: W trakcie testowania — Pobrać historię transakcji" })).toBeInTheDocument();
    expect(screen.getByTestId("location-address")).toHaveTextContent("view=overdue&preview=action-budget-overdue");
  });

  it("ukończenie z podglądu usuwa wiersz z Otwarte i pozwala cofnąć zmianę", async () => {
    enableDesktopPreview();
    const user = userEvent.setup();
    renderApp("/actions?view=overdue");
    await user.click(await screen.findByRole("link", { name: "Pobrać historię transakcji" }));
    const preview = await screen.findByRole("complementary", { name: "Pobrać historię transakcji" });
    await user.click(within(preview).getByRole("button", { name: "Ukończ Działanie" }));
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pobrać historię transakcji" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Pobrać historię transakcji" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("link", { name: "Pobrać historię transakcji" })).toBeInTheDocument();
  });
});
