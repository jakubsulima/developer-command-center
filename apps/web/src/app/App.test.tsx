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
  it("przechwytuje treść bez wcześniejszej klasyfikacji", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge?section=inbox&capture=true");
    const capture = await screen.findByPlaceholderText("Zapisz treść lub link…");
    await user.type(capture, "Sprawdzić indeks na tabeli transakcji");
    await user.click(screen.getByRole("button", { name: "Zapisz do Skrzynki" }));
    expect(screen.getAllByText("Sprawdzić indeks na tabeli transakcji").length).toBeGreaterThanOrEqual(1);
    expect(capture).toHaveValue("");
  });

  it("tworzy Cel z pierwszym Działaniem bez mechaniki Focus", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp("/goals");
    await screen.findByRole("heading", { name: "Cele" });
    await user.click(within(screen.getByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: "Dodaj nowy Cel" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy Cel" });
    expect(within(dialog).getByText("Cel to prosty rezultat do wykonania. Wystarczy nazwa — resztę możesz dopisać później.")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Nazwa Celu"));
    await user.paste("Uruchomić nowy produkt");
    await user.click(within(dialog).getByLabelText(/Jaki jest pierwszy krok/));
    await user.paste("Zbudować formularz startowy");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz Cel" }));
    expect(await screen.findByRole("heading", { name: "Uruchomić nowy produkt", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText("Zbudować formularz startowy").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/timer|rozpocznij fokus/i)).not.toBeInTheDocument();
  });

  it("tworzy własny szablon Celu", async () => {
    const user = userEvent.setup();
    renderApp("/goals");
    await screen.findByRole("heading", { name: "Cele" });
    await user.click(screen.getByRole("button", { name: "Szablony Celów" }));
    const dialog = screen.getByRole("dialog", { name: "Własne szablony Celów" });
    await user.type(within(dialog).getByLabelText("Nazwa", { selector: "#template-name" }), "Plan kwartalny");
    await user.type(within(dialog).getByLabelText("Domyślne pierwsze Działanie"), "Określ miernik");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz szablon" }));
    expect(await within(dialog).findByText("Plan kwartalny")).toBeInTheDocument();
  });

  it("tworzy stały Projekt jako osobny kontener", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(within(await screen.findByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: "Dodaj nowy Projekt" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy projekt" });
    await user.type(within(dialog).getByLabelText("Nazwa Projektu"), "Zdrowie");
    await user.type(within(dialog).getByLabelText(/Krótki kontekst/), "Cele, Działania i wiedza o zdrowiu");
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

  it("oddziela bieżące Cele i Działania od historii Projektu", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-history", name: "Projekt z historią", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [
      { id: "goal-current", title: "Bieżący Cel", outcome: "Nadal trwa", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-history", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "goal-history", title: "Osiągnięty Cel", outcome: "Gotowy rezultat", kind: "custom", status: "achieved", visibility: "active", priority: "normal", areaId: "project-history", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-02T08:00:00.000Z" }
    ];
    state.actions = [
      { id: "action-current", version: 1, goalId: "goal-current", areaId: "project-history", title: "Otwarte Działanie", detail: "", status: "ready", position: 0, isNext: true, pinnedToToday: false, checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" },
      { id: "action-history", version: 1, goalId: "goal-history", areaId: "project-history", title: "Ukończone Działanie", detail: "", status: "completed", position: 1, isNext: false, pinnedToToday: false, checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-02T08:00:00.000Z" }
    ];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-history");
    await screen.findByRole("heading", { name: "Projekt z historią" });
    const overview = screen.getByRole("region", { name: "Co jest teraz najważniejsze" });
    expect(within(overview).getByRole("button", { name: "Otwórz Cele — 1 bieżący" })).toBeInTheDocument();
    expect(within(overview).getByRole("button", { name: "Otwórz Działania — 1 otwarte" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Cele" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Działania" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Cele" }));
    const goals = screen.getByRole("region", { name: "Cele" });
    const mobileNavigation = screen.getByRole("navigation", { name: "Nawigacja mobilna" });

    expect(within(goals).getByText("Bieżący Cel")).toBeInTheDocument();
    expect(within(goals).queryByText("Osiągnięty Cel")).not.toBeInTheDocument();
    await user.click(within(mobileNavigation).getByRole("button", { name: "Dodaj Cel do Projektu Projekt z historią" }));
    expect(screen.getByRole("dialog", { name: "Nowy Cel w Projekcie" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(goals).getByText("Więcej opcji Celów"));
    await user.click(within(goals).getByRole("button", { name: /Pokaż historię/ }));
    expect(within(goals).getByText("Osiągnięty Cel")).toBeInTheDocument();
    expect(within(goals).queryByText("Bieżący Cel")).not.toBeInTheDocument();
    expect(within(goals).getByText("Historia Celów")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Działania" }));
    const actions = screen.getByRole("region", { name: "Działania" });
    expect(within(actions).getByText("Otwarte Działanie")).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Zmień status: Do zrobienia — Otwarte Działanie" })).toHaveTextContent("Do zrobienia");
    expect(within(actions).queryByText("Ukończone Działanie")).not.toBeInTheDocument();
    expect(within(actions).queryByRole("button", { name: "Więcej opcji: Otwarte Działanie" })).not.toBeInTheDocument();
    expect(within(actions).queryByRole("button", { name: "Ukończ: Otwarte Działanie" })).not.toBeInTheDocument();
    await user.click(within(actions).getByRole("button", { name: "Zmień status: Do zrobienia — Otwarte Działanie" }));
    const statusDialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
    expect(within(statusDialog).queryByText("Pominięte")).not.toBeInTheDocument();
    expect(within(statusDialog).getByRole("button", { name: /W trakcie testowania/ })).toBeInTheDocument();
    await user.click(within(statusDialog).getByRole("button", { name: /W toku/ }));
    await waitFor(() => expect(actions.querySelector('[data-action-id="action-current"]')).toHaveClass("in_progress"));
    await user.click(within(mobileNavigation).getByRole("button", { name: "Dodaj Działanie do Projektu Projekt z historią" }));
    expect(screen.getByRole("dialog", { name: "Nowe Działanie w Projekcie" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(actions).getByLabelText(/Filtruj Działania/));
    expect(within(actions).getByRole("menuitemradio", { name: "Otwarte: 1" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(actions).getByRole("menuitemradio", { name: "Historia: 1" }));
    expect(within(actions).getByText("Ukończone Działanie")).toBeInTheDocument();
    expect(actions.querySelector('[data-action-id="action-history"]')).toHaveClass("completed");
    expect(within(actions).queryByText("Otwarte Działanie")).not.toBeInTheDocument();
    expect(within(actions).getByText("Filtr: Historia")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Wiedza" }));
    expect(within(mobileNavigation).getByRole("button", { name: "Dodaj Wiedzę do Projektu Projekt z historią" })).toBeInTheDocument();
  });

  it("otwiera od razu formularz Działania z Przeglądu i zapisuje Projekt oraz wybrany Cel", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-create-action", name: "Projekt tworzenia", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [{ id: "goal-create-action", title: "Cel formularza", outcome: "Wybór Celu działa", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-create-action" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    const app = renderApp("/projects/project-create-action");
    await screen.findByRole("heading", { name: "Projekt tworzenia" });
    await user.click(screen.getByRole("button", { name: /^Dodaj Działanie$/ }));
    const dialog = screen.getByRole("dialog", { name: "Nowe Działanie w Projekcie" });
    expect(within(dialog).getByText("Projekt tworzenia")).toBeInTheDocument();
    await user.click(within(dialog).getByText("Szczegóły i przypisanie"));
    await user.selectOptions(within(dialog).getByLabelText("Cel opcjonalnie"), "goal-create-action");
    await user.type(within(dialog).getByLabelText("Co trzeba zrobić?"), "Przygotować pierwszy krok");
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
    state.goals = [{ id: "goal-cancel-action", title: "Bieżący Cel", outcome: "Rezultat", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-cancel-action" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-cancel-action");
    await screen.findByRole("heading", { name: "Projekt bez zapisu" });
    await user.click(screen.getByRole("button", { name: /^Dodaj Działanie$/ }));
    const dialog = screen.getByRole("dialog", { name: "Nowe Działanie w Projekcie" });
    await user.type(within(dialog).getByLabelText("Co trzeba zrobić?"), "Tylko szkic");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj" }));

    expect(screen.queryByRole("dialog", { name: "Nowe Działanie w Projekcie" })).not.toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("command-center-local-workspace-v2")!).state.actions).toHaveLength(0));
    expect(screen.getByRole("button", { name: /^Dodaj Działanie$/ })).toBeInTheDocument();
  });

  it("bez bieżącego Celu prowadzi do karty Celów zamiast tworzyć Cel automatycznie", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-first-goal", name: "Projekt bez Celu", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-first-goal");
    await screen.findByRole("heading", { name: "Projekt bez Celu" });
    expect(screen.getByRole("heading", { name: "Ustal pierwszy Cel" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Przejdź do Celów" }));

    expect(screen.getByRole("tab", { name: "Cele" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Cele" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Nowy Cel w Projekcie" })).not.toBeInTheDocument();
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
    await user.click(within(row).getByRole("button", { name: "Zmień status: Zablokowane — Odblokować raport" }));
    await user.click(within(screen.getByRole("dialog", { name: "Zmień status Działania" })).getByRole("button", { name: /W toku/ }));
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

    expect(screen.getByRole("menuitem", { name: "Edytuj informacje" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Archiwizuj Projekt" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Przenieś do Kosza" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Przenieś do Kosza" }));
    expect(screen.getByRole("dialog", { name: "Przenieść Projekt do Kosza?" })).toBeInTheDocument();
  });

  it("wraca ze szczegółu Celu do tej samej zakładki Projektu", async () => {
    const user = userEvent.setup();
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project-navigation", name: "Projekt nawigacji", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    state.goals = [{ id: "goal-navigation", title: "Cel nawigacji", outcome: "Spójny powrót", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project-navigation", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));

    renderApp("/projects/project-navigation");
    await screen.findByRole("heading", { name: "Projekt nawigacji" });
    await user.click(screen.getByRole("tab", { name: "Cele" }));
    await user.click(screen.getByRole("link", { name: "Otwórz Cel: Cel nawigacji" }));

    expect(await screen.findByRole("heading", { name: "Cel nawigacji" })).toBeInTheDocument();
    await user.click(within(document.querySelector(".context-navigation")!).getByRole("link", { name: "Projekt nawigacji" }));

    expect(await screen.findByRole("heading", { name: "Projekt nawigacji" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cele" })).toHaveAttribute("aria-selected", "true");
  });

  it("pokazuje pętlę pracy jako zwiniętą wskazówkę", async () => {
    const user = userEvent.setup();
    renderApp("/projects/area-finanse");
    await screen.findByRole("heading", { name: "Finanse" });

    const summary = screen.getByText("Pętla pracy — wskazówka").closest("summary") as HTMLElement;
    const guide = summary.closest("details") as HTMLDetailsElement;
    const flowHeading = screen.getByRole("heading", { name: "Od kierunku do wiedzy", hidden: true });

    expect(guide).not.toHaveAttribute("open");
    expect(flowHeading).not.toBeVisible();

    await user.click(summary);

    expect(guide).toHaveAttribute("open");
    expect(flowHeading).toBeVisible();
  });

  it("tworzy, edytuje i wzbogaca własną serię cykliczną", async () => {
    const user = userEvent.setup();
    renderApp("/routines");
    await screen.findByRole("heading", { name: "Rutyny" });
    await user.click(within(screen.getByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: "Dodaj nową Rutynę" }));
    const create = screen.getByRole("dialog", { name: "Nowe Działanie cykliczne" });
    expect(within(create).getByText("Tak zapiszesz Rutynę")).toBeInTheDocument();
    expect(within(create).getByRole("button", { name: /Co tydzień/ })).toHaveAttribute("aria-pressed", "true");
    await user.type(within(create).getByLabelText("Nazwa"), "Cotygodniowy plan posiłków");
    await user.type(within(create).getByLabelText("Opis"), "Ustal menu i listę zakupów");
    await user.click(within(create).getByRole("button", { name: "Utwórz serię" }));
    const routine = await screen.findByRole("heading", { name: "Cotygodniowy plan posiłków" });
    expect(routine).toBeInTheDocument();
    expect(within(routine.closest("section") as HTMLElement).getByText("Najbliższe wykonania")).toBeInTheDocument();
    await user.click(within(routine.closest("section") as HTMLElement).getByRole("link", { name: "Edytuj ustawienia" }));
    const edit = screen.getByRole("dialog", { name: "Edytuj serię cykliczną" });
    await user.clear(within(edit).getByLabelText("Nazwa"));
    await user.type(within(edit).getByLabelText("Nazwa"), "Plan posiłków i zakupów");
    await user.click(within(edit).getByRole("button", { name: "Zapisz serię" }));
    expect(await screen.findByRole("heading", { name: "Plan posiłków i zakupów" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("navigation", { name: "Główna nawigacja" })).getByRole("link", { name: "Start" }));
    const recurringAction = await screen.findByText("Plan posiłków i zakupów");
    expect(recurringAction.closest(".today-action")).toHaveTextContent("Rutyna: Plan posiłków i zakupów");
  });

  it("dodaje Działanie ze Startu wyłącznie przez centralny przycisk", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    expect(screen.queryByRole("button", { name: "Dodaj Działanie" })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Dodaj nowe Działanie na Starcie" }));
    const dialog = screen.getByRole("dialog", { name: "Nowe Działanie" });
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
    expect(screen.getByRole("link", { name: "Zapisz do Skrzynki" })).toHaveAttribute("href", "/knowledge?section=inbox&capture=true");
    expect(screen.queryByRole("button", { name: "Dodaj Działanie" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Dodaj nowe Działanie na Starcie" })).toBeInTheDocument();
  });

  it("pokazuje propozycję AI i nie zmienia Skrzynki przed zatwierdzeniem", async () => {
    const user = userEvent.setup();
    localStorage.setItem("command-center-state-v1", JSON.stringify({
      ...emptyState,
      inbox: [{ id: "inbox-ai", kind: "text", content: "Zrob budzet domowy", createdAt: "2026-08-27T09:00:00.000Z", status: "unprocessed" }]
    }));
    renderApp("/knowledge?section=inbox");
    await user.click(await screen.findByRole("button", { name: "Przetwórz" }));
    const dialog = screen.getByRole("dialog", { name: "Co chcesz z tym zrobić?" });
    await user.click(within(dialog).getByRole("button", { name: "Zaproponuj przez AI" }));
    const preview = await screen.findByRole("dialog", { name: "Podgląd propozycji AI" });
    expect(within(preview).getByText("Działanie")).toBeInTheDocument();
    expect(within(preview).getAllByText("Zrob budzet domowy").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /Nowe/ })).toHaveTextContent("1");
    await user.click(within(preview).getByRole("button", { name: "Zatwierdź" }));
    expect(await screen.findByRole("heading", { name: "Start" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Podgląd propozycji AI" })).not.toBeInTheDocument();
  });
});
