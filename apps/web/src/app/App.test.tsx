import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { App } from "./App";
import { StoreProvider } from "./store";

beforeEach(() => vi.stubGlobal("indexedDB", undefined));
afterEach(() => vi.unstubAllGlobals());

function renderApp(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="location-state">{JSON.stringify({ pathname: location.pathname, search: location.search, state: location.state })}</output>;
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <DemoAuthProvider><StoreProvider><App /><LocationProbe /></StoreProvider></DemoAuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("goal-centric workspace", () => {
  it.each([767, 768])("kontynuuje szkic Działania inline w panelu i wraca do grupy przy %s px", async (width) => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    try {
      const state = structuredClone(emptyState);
      state.areas = [{ id: "shared-project", name: "Wspólny Projekt", description: "", visibility: "active", createdAt: "2026-11-03", updatedAt: "2026-11-03" }];
      state.goals = [{ id: "shared-goal", title: "Wspólna grupa", outcome: "Wynik", areaId: "shared-project", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
      localStorage.setItem("command-center-state-v1", JSON.stringify(state));
      const user = userEvent.setup();
      renderApp("/goals/shared-goal");
      await screen.findByRole("heading", { name: "Wspólna grupa", level: 1 }, { timeout: 5_000 });
      await user.type(screen.getByRole("textbox", { name: "Nowe Działanie" }), "Wspólny szkic");
      const date = screen.getByLabelText("Termin Działania");
      await user.type(date, "2026-12-08");
      await user.click(screen.getByRole("button", { name: "Więcej szczegółów" }));
      const panel = await screen.findByRole("dialog", { name: "Nowe Działanie" });
      expect(within(panel).getByLabelText("Co chcesz zrobić?")).toHaveValue("Wspólny szkic");
      expect(within(panel).getByLabelText(/Dokładna data/)).toHaveValue("2026-12-08");
      await user.click(within(panel).getByText("Projekt, grupa i przypięcie"));
      await user.type(within(panel).getByLabelText("Opis"), "Pełny opis");
      await user.click(within(panel).getByRole("button", { name: "Zamknij okno" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByRole("textbox", { name: "Nowe Działanie" })).toHaveValue("Wspólny szkic");
      await user.click(screen.getByRole("button", { name: "Więcej szczegółów" }));
      const resumed = await screen.findByRole("dialog", { name: "Nowe Działanie" });
      expect(within(resumed).getByLabelText("Opis")).toHaveValue("Pełny opis");
      await user.click(within(resumed).getByRole("button", { name: "Dodaj Działanie" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(JSON.parse(screen.getByTestId("location-state").textContent!).pathname).toBe("/goals/shared-goal");
      await user.type(screen.getByRole("textbox", { name: "Nowe Działanie" }), "Drugi krok");
      await user.click(screen.getByRole("button", { name: "Dodaj" }));
      await waitFor(() => expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions).toHaveLength(2));
      const actions = JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions;
      expect(actions[0]).toMatchObject({ title: "Wspólny szkic", detail: "Pełny opis", scheduledFor: "2026-12-08", goalId: "shared-goal", areaId: "shared-project" });
      expect(actions[0].id).not.toBe(actions[1].id);
    } finally { Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth }); }
  });

  it("Dodaj materiał otwiera Materiał, a notatka przy Działaniu wymaga tylko treści", async () => {
    const state = structuredClone(emptyState);
    state.actions = [{ id: "related-action", version: 1, title: "Krok z Wiedzą", detail: "", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [] }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    const user = userEvent.setup();
    renderApp("/actions/related-action");
    await screen.findByRole("heading", { name: "Krok z Wiedzą" });
    await user.click(screen.getByText("Połącz wiedzę"));
    await user.click(screen.getByRole("button", { name: "Dodaj materiał" }));
    const dialog = await screen.findByRole("dialog", { name: "Dodaj do Biblioteki" });
    expect(within(dialog).getByRole("radio", { name: /Materiał/ })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: /Notatka/ }));
    await user.type(within(dialog).getByLabelText("Treść notatki"), "Sama treść notatki");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz notatkę" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state;
      expect(saved.knowledge).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Sama treść notatki", detail: "Sama treść notatki" })]));
      expect(saved.knowledgeLinks).toEqual(expect.arrayContaining([expect.objectContaining({ actionId: "related-action", meaning: "reference" })]));
    });
  });
  it("na telefonie dodaje książkę przez skrót materiału w Bibliotece", async () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp("/knowledge");
    await screen.findByRole("heading", { name: "Wiedza" });
    const navigation = await screen.findByRole("main");
    await user.click(within(navigation).getByRole("button", { name: "Dodaj nowy element Wiedzy" }));
    await user.click(screen.getByRole("menuitem", { name: "Dodaj materiał" }));
    const dialog = await screen.findByRole("dialog", { name: "Dodaj materiał" });
    await user.click(within(dialog).getByLabelText("To książka"));
    await user.type(within(dialog).getByLabelText("Nazwa materiału"), "Książka mobilna");
    const details = within(dialog).getByText("Szczegóły", { exact: true });
    expect(details.closest("details")).not.toHaveAttribute("open");
    await user.click(details);
    await user.type(within(dialog).getByRole("textbox", { name: "Dlaczego warto zachować?" }), "Opis zapisany ze szczegółów.");
    await user.click(details);
    await user.click(within(dialog).getByRole("button", { name: "Dodaj książkę" }));
    expect(await screen.findByText("Książka mobilna")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const saved = JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state;
    expect(saved.knowledge).toContainEqual(expect.objectContaining({
      title: "Książka mobilna", detail: "Opis zapisany ze szczegółów.", resourceFormat: "book"
    }));
  });

  it("otwiera zapisaną notatkę także poza bieżącym filtrem Biblioteki", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge?q=niepasujaca-fraza");
    await user.click(within(await screen.findByRole("main")).getByRole("button", { name: "Dodaj nowy element Wiedzy" }));
    await user.click(screen.getByRole("menuitem", { name: "Dodaj notatkę" }));
    const dialog = await screen.findByRole("dialog", { name: "Dodaj notatkę" });
    await user.type(within(dialog).getByLabelText("Treść notatki"), "Nowa notatka testowa");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz notatkę" }));
    expect(await screen.findByRole("heading", { name: "Brak pasujących wpisów" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Otwórz wpis" }));
    expect(await screen.findByRole("heading", { name: "Nowa notatka testowa" })).toBeInTheDocument();
  });

  it("przechwytuje treść bez wcześniejszej klasyfikacji", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge?section=inbox&capture=true");
    const capture = await screen.findByPlaceholderText("Zapisz myśl, zadanie albo wklej link…");
    await user.type(capture, "Sprawdzić indeks na tabeli transakcji");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(await screen.findByText("Sprawdzić indeks na tabeli transakcji")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("tworzy Grupa działań z pierwszym Działaniem bez mechaniki Focus", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp("/goals");
    await screen.findByRole("heading", { name: "Grupy działań" });
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "Dodaj nową grupę działań" }));
    const dialog = await screen.findByRole("dialog", { name: "Nowa grupa działań" });
    await user.click(within(dialog).getByLabelText("Nazwa grupy"));
    await user.paste("Uruchomić nowy produkt");
    await user.click(within(dialog).getByText("Więcej opcji"));
    await user.click(within(dialog).getByLabelText(/Pierwsze Działanie/));
    await user.paste("Zbudować formularz startowy");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz grupę" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(JSON.parse(screen.getByTestId("location-state").textContent!).pathname).toBe("/goals");
    await user.click(screen.getByRole("button", { name: "Otwórz" }));
    expect(await screen.findByRole("heading", { name: "Uruchomić nowy produkt", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Zbudować formularz startowy").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/timer|rozpocznij fokus/i)).not.toBeInTheDocument();
  });

  it("tworzy własny szablon zadania", async () => {
    const user = userEvent.setup();
    renderApp("/goals");
    await screen.findByRole("heading", { name: "Grupy działań" });
    await user.click(screen.getByRole("button", { name: "Szablony zadań" }));
    const dialog = screen.getByRole("dialog", { name: "Własne szablony zadań" });
    await user.type(within(dialog).getByLabelText("Nazwa", { selector: "#template-name" }), "Plan kwartalny");
    await user.type(within(dialog).getByLabelText("Domyślne pierwsze Działanie"), "Określ miernik");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz szablon" }));
    expect(await within(dialog).findByText("Plan kwartalny")).toBeInTheDocument();
  });

  it("tworzy stały Projekt jako osobny kontener", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await screen.findByRole("heading", { name: "Projekty" });
    await user.click(within(await screen.findByRole("main")).getByRole("button", { name: "Dodaj nowy Projekt" }));
    const dialog = await screen.findByRole("dialog", { name: "Nowy Projekt" });
    await user.type(within(dialog).getByLabelText("Jaki Projekt utworzyć?"), "Zdrowie");
    await user.type(within(dialog).getByLabelText("Opis"), "Grupy działań, Działania i wiedza o zdrowiu");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz Projekt" }));
    expect(await screen.findByRole("heading", { name: "Zdrowie" })).toBeInTheDocument();
  });

  it("grupuje listę Projektów domyślnie i pomija puste kategorie", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.projectCategories = [
      { id: "category-work", name: "Praca", color: "#60a5fa" },
      { id: "category-empty", name: "Pusta", color: "#a78bfa" }
    ];
    state.areas = [
      { id: "project-work", name: "Projekt pracy", description: "", categoryIds: ["category-work"], visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "project-other", name: "Projekt bez kategorii", description: "", categoryIds: [], visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }
    ];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects");
    await screen.findByRole("heading", { name: "Projekty", level: 1 });
    expect(within(screen.getByRole("heading", { name: /Praca/, level: 2 })).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("heading", { name: /Bez kategorii/, level: 2 })).getByText("1")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Pusta/ })).not.toBeInTheDocument();
    expect(document.querySelectorAll(".project-index-row")).toHaveLength(2);

    await user.click(screen.getByLabelText("Więcej opcji widoku"));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Grupuj kategoriami" }));
    expect(document.querySelectorAll(".project-category-heading")).toHaveLength(0);
    expect(document.querySelectorAll(".project-index-row")).toHaveLength(2);
    expect(within(screen.getByRole("heading", { name: "Projekt pracy" }).closest(".project-card")!).getByText("Praca")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Więcej opcji widoku"));
    await user.selectOptions(screen.getByLabelText("Filtruj po kategorii"), "category-empty");
    expect(screen.getByText("Brak projektów pasujących do tego widoku.")).toBeInTheDocument();
  });

  it("oddziela bieżące grupy działań i Działania od historii Projektu", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-history", name: "Projekt z historią", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [
      { id: "goal-current", title: "Bieżąca grupa", outcome: "Nadal trwa", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-history", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "goal-history", title: "Osiągnięty Grupa działań", outcome: "Gotowy rezultat", kind: "custom", status: "achieved", visibility: "active", priority: "normal", areaId: "project-history", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-02T08:00:00.000Z" }
    ];
    state.actions = [
      { id: "action-current", version: 1, goalId: "goal-current", areaId: "project-history", title: "Otwarte Działanie", detail: "", status: "ready", position: 0, isNext: true, pinnedToToday: false, checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "action-history", version: 1, goalId: "goal-history", areaId: "project-history", title: "Ukończone Działanie", detail: "", status: "completed", position: 1, isNext: false, pinnedToToday: false, checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-02T08:00:00.000Z" }
    ];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    const projectView = renderApp("/projects/project-history");
    await screen.findByRole("heading", { name: "Projekt z historią" });
    expect(screen.queryByRole("region", { name: "Grupy działań" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Działania" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Grupy działań" }));
    const goals = screen.getByRole("region", { name: "Grupy działań" });
    const projectAdd = within(screen.getByRole("main")).getByRole("button", { name: "Dodaj w Projekcie Projekt z historią" });

    expect(within(goals).getByText("Bieżąca grupa")).toBeInTheDocument();
    expect(within(goals).queryByText("Osiągnięty Grupa działań")).not.toBeInTheDocument();
    await user.click(projectAdd);
    await user.click(screen.getByRole("menuitem", { name: "Grupa działań" }));
    expect(await screen.findByRole("dialog", { name: "Nowa grupa działań" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    const groupView = within(goals).getByRole("combobox", { name: "Widok grup działań" });
    await user.selectOptions(groupView, "history");
    expect(within(goals).getByText("Osiągnięty Grupa działań")).toBeInTheDocument();
    expect(within(goals).queryByText("Bieżąca grupa")).not.toBeInTheDocument();
    expect(groupView).toHaveValue("history");

    await user.click(screen.getByRole("tab", { name: "Działania" }));
    const actions = screen.getByRole("region", { name: "Działania" });
    expect(within(actions).getByText("Otwarte Działanie")).toBeInTheDocument();
    expect(within(actions).queryByText("Ukończone Działanie")).not.toBeInTheDocument();
    expect(within(actions).queryByRole("button", { name: "Więcej opcji: Otwarte Działanie" })).not.toBeInTheDocument();
    within(actions).getByRole("button", { name: "Ukończ: Otwarte Działanie" }).focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    const statusDialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
    expect(within(statusDialog).queryByText("Pominięte")).not.toBeInTheDocument();
    expect(within(statusDialog).getByRole("button", { name: /W trakcie testowania/ })).toBeInTheDocument();
    await user.click(within(statusDialog).getByRole("button", { name: /W toku/ }));
    await waitFor(() => expect(statusDialog).not.toBeInTheDocument());
    await waitFor(() => expect(actions.querySelector('[data-action-id="action-current"]')).toHaveClass("in_progress"));
    await user.click(projectAdd);
    await user.click(screen.getByRole("menuitem", { name: "Działanie" }));
    expect(await screen.findByRole("dialog", { name: "Nowe Działanie" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(actions).getByLabelText(/Filtruj Działania/));
    const filters = screen.getByRole("dialog", { name: "Filtry Działań" });
    expect(within(filters).getByRole("button", { name: "Otwarte: 1", pressed: true })).toBeInTheDocument();
    await user.click(within(filters).getByRole("button", { name: "Historia: 1" }));
    expect(within(actions).getByText("Ukończone Działanie")).toBeInTheDocument();
    expect(actions.querySelector('[data-action-id="action-history"]')).toHaveClass("completed");
    expect(within(actions).queryByText("Otwarte Działanie")).not.toBeInTheDocument();
    expect(within(actions).getByLabelText("Filtruj Działania. Wybrano: Historia")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Wiedza" }));
    await user.click(projectAdd);
    expect(screen.getByRole("menuitem", { name: "Notatka" })).toBeInTheDocument();

    projectView.unmount();
    const restored = renderApp("/projects/project-history?view=actions");
    expect(await screen.findByRole("button", { name: "Filtruj Działania. Wybrano: Historia" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Działania" })).toHaveTextContent("Ukończone Działanie");
    restored.unmount();

    renderApp("/projects/project-history?view=actions&actions=open");
    expect(await screen.findByRole("button", { name: "Filtruj Działania. Wybrano: Otwarte" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Działania" })).toHaveTextContent("Otwarte Działanie");
  });

  it("otwiera od razu formularz Działania z Przeglądu i zapisuje Projekt oraz wybrana grupa", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-create-action", name: "Projekt tworzenia", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [{ id: "goal-create-action", title: "Grupa działań formularza", outcome: "Wybór grupy działa", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-create-action" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    const app = renderApp("/projects/project-create-action");
    await screen.findByRole("heading", { name: "Projekt tworzenia" });
    await user.click(screen.getByRole("button", { name: /^Dodaj Działanie$/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nowe Działanie" });
    expect(within(dialog).getByText("Projekt: Projekt tworzenia")).toBeInTheDocument();
    await user.click(within(dialog).getByText("Projekt, grupa i przypięcie"));
    await user.selectOptions(within(dialog).getByLabelText("Grupa działań"), "goal-create-action");
    await user.type(within(dialog).getByLabelText("Co chcesz zrobić?"), "Przygotować pierwszy krok");
    await user.click(within(dialog).getByRole("button", { name: "Dodaj Działanie" }));

    expect(await screen.findByRole("link", { name: "Otwórz Działanie: Przygotować pierwszy krok" })).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Przygotować pierwszy krok", areaId: "project-create-action", goalId: "goal-create-action" })
    ])));

    app.unmount();
    renderApp("/projects/project-create-action");
    expect(await screen.findByRole("link", { name: "Otwórz Działanie: Przygotować pierwszy krok" })).toBeInTheDocument();
  });

  it("anulowanie formularza z Przeglądu nie zapisuje Działania", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-cancel-action", name: "Projekt bez zapisu", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [{ id: "goal-cancel-action", title: "Bieżąca grupa", outcome: "Rezultat", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-cancel-action" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-cancel-action");
    await screen.findByRole("heading", { name: "Projekt bez zapisu" });
    await user.click(screen.getByRole("button", { name: /^Dodaj Działanie$/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nowe Działanie" });
    await user.type(within(dialog).getByLabelText("Co chcesz zrobić?"), "Tylko szkic");
    await user.click(within(dialog).getByRole("button", { name: "Zamknij okno" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nowe Działanie" })).not.toBeInTheDocument());
    await waitFor(() => expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions).toHaveLength(0));
    expect(screen.getByRole("button", { name: /^Dodaj Działanie$/ })).toBeInTheDocument();
  });

  it("otwiera formularz pierwszej grupy bezpośrednio z Przeglądu Projektu", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-first-goal", name: "Projekt bez grupy", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-first-goal");
    await screen.findByRole("heading", { name: "Projekt bez grupy" });
    expect(screen.getByRole("heading", { name: "Utwórz pierwszą grupę działań" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Utwórz grupę działań" }));

    const form = await screen.findByRole("dialog", { name: "Nowa grupa działań" });
    expect(within(form).getByLabelText("Nazwa grupy")).toBeInTheDocument();
  });

  it("otwiera wskazane Działanie z Przeglądu i wraca do tego Projektu", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-open-action", name: "Projekt powrotu", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.actions = [{ id: "action-open-action", version: 1, title: "Wskazany krok", detail: "", areaId: "project-open-action", status: "ready", position: 0, isNext: true, pinnedToToday: false, checklist: [] }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-open-action");
    await screen.findByRole("heading", { name: "Projekt powrotu" });
    await user.click(screen.getByRole("link", { name: "Otwórz Działanie: Wskazany krok" }));
    expect(await screen.findByRole("heading", { name: "Wskazany krok", level: 1 })).toBeInTheDocument();
    const routeState = JSON.parse(screen.getByTestId("location-state").textContent ?? "{}");
    expect(routeState).toMatchObject({ pathname: "/actions/action-open-action", state: { returnTo: "/projects/project-open-action" } });
    expect(routeState.state.breadcrumbs).toContainEqual({ label: "Projekt powrotu", to: "/projects/project-open-action" });
    await user.click(within(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).getByRole("link", { name: "Projekt powrotu" }));

    expect(await screen.findByRole("heading", { name: "Projekt powrotu" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Przegląd" })).toHaveAttribute("aria-selected", "true");
  });

  it("odświeża sygnał po zmianie statusu i nie tworzy go dla Archiwum ani Kosza", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [
      { id: "project-signals", name: "Projekt sygnałów", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "project-archived-signal", name: "Projekt archiwalny", description: "", visibility: "archived", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "project-trashed-signal", name: "Projekt w koszu", description: "", visibility: "trashed", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }
    ];
    state.actions = [
      { id: "action-signals", version: 1, title: "Odblokować raport", detail: "", areaId: "project-signals", status: "blocked", blocker: "Czekam na dane", position: 0, isNext: false, pinnedToToday: false, checklist: [] },
      { id: "action-archived-signal", version: 1, title: "Ukryta blokada", detail: "", areaId: "project-archived-signal", status: "blocked", blocker: "Archiwum", position: 0, isNext: false, pinnedToToday: false, checklist: [] },
      { id: "action-trashed-signal", version: 1, title: "Usunięta blokada", detail: "", areaId: "project-trashed-signal", status: "blocked", blocker: "Kosz", position: 0, isNext: false, pinnedToToday: false, checklist: [] }
    ];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-signals");
    await screen.findByRole("heading", { name: "Projekt sygnałów" });
    expect(screen.getByText("Czekam na dane")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Działania" }));
    const row = document.querySelector('[data-action-id="action-signals"]') as HTMLElement;
    within(row).getByRole("button", { name: "Ukończ: Odblokować raport", description: /Status: Zablokowane\./ }).focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    const statusDialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
    await user.click(within(statusDialog).getByRole("button", { name: /W toku/ }));
    await waitFor(() => expect(statusDialog).not.toBeInTheDocument());
    await user.click(screen.getByRole("tab", { name: "Przegląd" }));
    expect(await screen.findByText("W toku · bez wyznaczonego terminu.")).toBeInTheDocument();
    expect(screen.queryByText("Czekam na dane")).not.toBeInTheDocument();

    await user.click(within(screen.getByRole("navigation", { name: "Główna nawigacja" })).getByRole("link", { name: "Projekty" }));
    await screen.findByRole("heading", { name: "Projekty", level: 1 });
    const activeCard = (await screen.findByRole("heading", { name: "Projekt sygnałów" })).closest(".project-card") as HTMLElement;
    expect(within(activeCard).getByLabelText("Najbliższy ruch: Możesz zrobić teraz — Odblokować raport")).toBeInTheDocument();
    expect(within(activeCard).getByText("Działania")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Więcej opcji widoku"));
    await user.click(screen.getByRole("menuitemradio", { name: "Archiwum" }));
    const archivedCard = (await screen.findByRole("heading", { name: "Projekt archiwalny" })).closest(".project-card") as HTMLElement;
    expect(within(archivedCard).queryByLabelText(/Najbliższy ruch/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Więcej opcji widoku"));
    await user.click(screen.getByRole("menuitemradio", { name: "Kosz" }));
    const trashedCard = (await screen.findByRole("heading", { name: "Projekt w koszu" })).closest(".project-card") as HTMLElement;
    expect(within(trashedCard).queryByLabelText(/Najbliższy ruch/)).not.toBeInTheDocument();
  });

  it("udostępnia kompletne menu zarządzania Projektem", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-menu", name: "Projekt menu", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-menu");
    await screen.findByRole("heading", { name: "Projekt menu" });
    await user.click(screen.getByLabelText("Opcje Projektu: Projekt menu"));

    expect(screen.getByRole("menuitem", { name: "Edytuj Projekt" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Archiwizuj Projekt" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Przenieś do Kosza" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Przenieś do Kosza" }));
    expect(screen.getByRole("dialog", { name: "Przenieść Projekt do Kosza?" })).toBeInTheDocument();
  });

  it("wraca ze szczegółu grupy do tej samej zakładki Projektu", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-navigation", name: "Projekt nawigacji", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [{ id: "goal-navigation", title: "Grupa działań nawigacji", outcome: "Spójny powrót", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-navigation", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-navigation");
    await screen.findByRole("heading", { name: "Projekt nawigacji" });
    await user.click(screen.getByRole("tab", { name: "Grupy działań" }));
    await user.click(screen.getByRole("link", { name: "Otwórz grupę: Grupa działań nawigacji" }));

    expect(await screen.findByRole("heading", { name: "Grupa działań nawigacji" })).toBeInTheDocument();
    await user.click(within(document.querySelector(".context-navigation")!).getByRole("link", { name: "Projekt nawigacji" }));

    expect(await screen.findByRole("heading", { name: "Projekt nawigacji" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Grupy działań" })).toHaveAttribute("aria-selected", "true");
  });

  it("udostępnia sekcje Projektu w jednym pasku nawigacji", async () => {
    renderApp("/projects/area-finanse");
    await screen.findByRole("heading", { name: "Finanse" });

    const navigation = screen.getByRole("tablist", { name: "Zawartość Projektu" });
    const tabs = within(navigation).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveAccessibleName("Przegląd");
    expect(tabs[1]).toHaveAccessibleName("Grupy działań");
    expect(tabs[2]).toHaveAccessibleName("Działania");
    expect(tabs[3]).toHaveAccessibleName("Wiedza");
    expect(screen.queryByText("Pętla pracy — wskazówka")).not.toBeInTheDocument();
  });

  it("tworzy, edytuje i wzbogaca własną serię cykliczną", async () => {
    const user = userEvent.setup();
    renderApp("/routines");
    await screen.findByRole("heading", { name: "Rutyny" });
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "Dodaj nową Rutynę" }));
    const create = await screen.findByRole("dialog", { name: "Nowa Rutyna" });
    expect(within(create).getByLabelText("Powtarzaj")).toHaveValue("week");
    await user.type(within(create).getByLabelText("Co ma się powtarzać?"), "Cotygodniowy plan posiłków");
    await user.type(within(create).getByLabelText("Opis"), "Ustal menu i listę zakupów");
    await user.click(within(create).getByRole("button", { name: "Utwórz Rutynę" }));
    const routine = await screen.findByRole("heading", { name: "Cotygodniowy plan posiłków" });
    expect(routine).toBeInTheDocument();
    expect(within(routine.closest("section") as HTMLElement).getByText("Najbliższe wykonania")).toBeInTheDocument();
    await user.click(within(routine.closest("section") as HTMLElement).getByRole("link", { name: "Edytuj ustawienia rutyny: Cotygodniowy plan posiłków" }));
    const edit = screen.getByRole("dialog", { name: "Edytuj Rutynę" });
    await user.clear(within(edit).getByLabelText("Nazwa"));
    await user.type(within(edit).getByLabelText("Nazwa"), "Plan posiłków i zakupów");
    await user.click(within(edit).getByRole("button", { name: "Zapisz Rutynę" }));
    expect(await screen.findByRole("heading", { name: "Plan posiłków i zakupów" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("navigation", { name: "Główna nawigacja" })).getByRole("link", { name: "Start" }));
    const recurringAction = await screen.findByText("Plan posiłków i zakupów");
    expect(recurringAction.closest("[data-action-id]")).toHaveTextContent("Z Rutyny");
  });

  it("dodaje Działanie ze Startu przez przycisk w nagłówku strony", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    expect(within(screen.getByRole("main")).getByRole("button", { name: "Dodaj nowe Działanie na Starcie" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("main")).getByRole("button", { name: "Dodaj nowe Działanie na Starcie" }));
    const dialog = await screen.findByRole("dialog", { name: "Nowe Działanie" });
    await user.type(within(dialog).getByLabelText("Co chcesz zrobić?"), "Przygotować plan rozmowy");
    await user.click(within(dialog).getByRole("button", { name: "Dodaj Działanie" }));
    expect(await screen.findByText("Przygotować plan rozmowy")).toBeInTheDocument();
  });

  it("pusty Start prowadzi do działających akcji wejściowych", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    expect(screen.queryByRole("link", { name: "Zobacz wszystkie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Przejdź do decyzji" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zapisz do Skrzynki" })).toHaveAttribute("href", "/capture");
    expect(within(screen.getByRole("main")).getByRole("button", { name: "Dodaj nowe Działanie na Starcie" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Na dziś" })).getByRole("button", { name: "Dodaj Działanie" })).toBeInTheDocument();
  });

  it("przypina istniejące Działanie na pustym Starcie i cofa wybór z zachowaniem terminu", async () => {
    const action = { id: "later", title: "Przygotować szkic", detail: "", status: "ready", scheduledFor: "2099-12-01", pinnedToToday: false, checklist: [], position: 0, version: 1, isNext: false };
    localStorage.setItem("command-center-state-v1", JSON.stringify({
      ...emptyState,
      actions: [action, { ...action, id: "blocked", status: "blocked", title: "Oczekuje na dostęp" }],
    }));
    const user = userEvent.setup();
    renderApp();
    const today = within(await screen.findByRole("region", { name: "Na dziś" }));
    const picker = today.getByRole("combobox", { name: "Wybierz istniejące Działanie" });
    expect(within(picker).queryByRole("option", { name: /Oczekuje na dostęp/ })).toBeNull();
    await user.selectOptions(picker, action.id);
    await user.click(today.getByRole("button", { name: "Przypnij na dziś" }));
    expect(await today.findByRole("link", { name: action.title })).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions[0]).toMatchObject({
      id: action.id, pinnedToToday: true, scheduledFor: action.scheduledFor,
    }));
    await user.click(await screen.findByRole("button", { name: "Cofnij" }));
    expect(await today.findByRole("option", { name: /Przygotować szkic.*2099/ })).toBeInTheDocument();
    expect(today.queryByRole("link", { name: action.title })).toBeNull();
  });

  it("prowadzi z listy przez Start do odhaczenia kroku samodzielnego Działania", async () => {
    const action = {
      id: "outline", title: "Przygotować konspekt", detail: "", status: "ready", scheduledFor: "2099-12-02",
      pinnedToToday: false, checklist: [{ id: "outline-intro", title: "Napisać wstęp", completed: false }],
      position: 0, version: 1, isNext: false,
    };
    localStorage.setItem("command-center-state-v1", JSON.stringify({ ...emptyState, actions: [action] }));
    const user = userEvent.setup();
    renderApp("/actions");
    await user.click(await screen.findByRole("button", { name: `Przypnij do Startu: ${action.title}` }));
    await user.click(within(screen.getByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("link", { name: "Start" }));
    const today = await screen.findByRole("region", { name: "Na dziś" });
    await user.click(within(today).getByRole("link", { name: action.title }));
    await user.click(await screen.findByRole("checkbox", { name: "Napisać wstęp" }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions[0]).toMatchObject({
      id: action.id, pinnedToToday: true, scheduledFor: action.scheduledFor, status: "ready",
      checklist: [{ id: "outline-intro", completed: true }],
    }));
  });

  it("pokazuje propozycję AI i nie zmienia Skrzynki przed zatwierdzeniem", async () => {
    const user = userEvent.setup();
    localStorage.setItem("command-center-state-v1", JSON.stringify({
      ...emptyState,
      inbox: [{ id: "inbox-ai", kind: "text", content: "Zrob budzet domowy", createdAt: "2026-08-27T09:00:00.000Z", status: "unprocessed" }]
    }));
    renderApp("/knowledge?section=inbox");
    await user.click(await screen.findByRole("link", { name: "Zrob budzet domowy" }));
    const dialog = screen.getByRole("dialog", { name: "Co chcesz z tym zrobić?" });
    await user.click(within(dialog).getByRole("button", { name: "Zaproponuj przez AI" }));
    const preview = await screen.findByRole("dialog", { name: "Podgląd propozycji AI" });
    expect(within(preview).getByText("Działanie")).toBeInTheDocument();
    expect(within(preview).getAllByText("Zrob budzet domowy").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Zrob budzet domowy").length).toBeGreaterThan(0);
    await user.click(within(preview).getByRole("button", { name: "Zatwierdź" }));
    expect(await screen.findByText(/^Zapisano\. Działanie · /)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Podgląd propozycji AI" })).not.toBeInTheDocument();
  });
});
