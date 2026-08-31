import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { App } from "./App";
import { StoreProvider } from "./store";

function renderApp(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("goal-centric workspace", () => {
  it("przechwytuje treść bez wcześniejszej klasyfikacji", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge?section=inbox&capture=true");
    const capture = await screen.findByPlaceholderText("Zapisz myśl, Działanie lub link…");
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
    await user.click(screen.getByRole("button", { name: "Nowy cel" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy cel" });
    expect(within(dialog).getByText("Cel to prosty rezultat do wykonania. Wystarczy nazwa — resztę możesz dopisać później.")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Nazwa Celu"));
    await user.paste("Uruchomić nowy produkt");
    await user.click(within(dialog).getByLabelText(/Jaki jest pierwszy krok/));
    await user.paste("Zbudować formularz startowy");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz cel" }));
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
    await user.click(await screen.findByRole("button", { name: "Nowy projekt" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy projekt" });
    await user.type(within(dialog).getByLabelText("Nazwa Projektu"), "Zdrowie");
    await user.type(within(dialog).getByLabelText(/Krótki kontekst/), "Cele, Działania i wiedza o zdrowiu");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz Projekt" }));
    expect(await screen.findByRole("heading", { name: "Zdrowie" })).toBeInTheDocument();
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

    expect(within(goals).getByText("Bieżący Cel")).toBeInTheDocument();
    expect(within(goals).queryByText("Osiągnięty Cel")).not.toBeInTheDocument();
    await user.click(within(goals).getByRole("button", { name: /Historia/ }));
    expect(within(goals).getByText("Osiągnięty Cel")).toBeInTheDocument();
    expect(within(goals).queryByText("Bieżący Cel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Działania" }));
    const actions = screen.getByRole("region", { name: "Działania" });
    expect(within(actions).getByText("Otwarte Działanie")).toBeInTheDocument();
    expect(within(actions).queryByText("Ukończone Działanie")).not.toBeInTheDocument();
    await user.click(within(actions).getByRole("button", { name: /Historia/ }));
    expect(within(actions).getByText("Ukończone Działanie")).toBeInTheDocument();
    expect(within(actions).queryByText("Otwarte Działanie")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Projekt: Projekt nawigacji" }));

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
    await user.click(screen.getByRole("button", { name: "Nowa rutyna" }));
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
    expect(recurringAction.parentElement).toHaveTextContent("cykliczne");
  });

  it("dodaje Działanie ze Startu wyłącznie przez centralny przycisk", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    expect(screen.queryByRole("button", { name: "Dodaj Działanie" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Otwórz centrum dodawania" }));
    const dialog = screen.getByRole("dialog", { name: "Dodaj" });
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
    expect(screen.getByRole("button", { name: "Otwórz centrum dodawania" })).toBeInTheDocument();
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
