import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { demoState } from "../data/demo";
import { App } from "./App";
import { StoreProvider } from "./store";

function renderApp(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

describe("regresje nowego modelu Celów", () => {
  it.each([
    ["/", "Start"], ["/routines", "Rutyny"], ["/goals", "Cele"], ["/inbox", "Wiedza"], ["/knowledge", "Wiedza"],
    ["/focus", "Start"], ["/projects", "Projekty"], ["/projects/fintrack-api", "FinTrack API"],
    ["/learning", "Cele"], ["/actions?view=unknown", "Działania"], ["/review", "Podsumowanie tygodnia"], ["/nieznana-trasa", "Start"]
  ])("renderuje lub przekierowuje trasę %s", async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it.each([
    ["/", "Start", "Dodaj nowe Działanie na Starcie", "Nowe Działanie"],
    ["/actions", "Działania", "Dodaj nowe Działanie", "Nowe Działanie"],
    ["/goals", "Cele", "Dodaj nowy Cel", "Nowy Cel"],
    ["/projects", "Projekty", "Dodaj nowy Projekt", "Nowy Projekt"],
    ["/routines", "Rutyny", "Dodaj nową Rutynę", "Nowa Rutyna"],
    ["/knowledge", "Wiedza", "Dodaj nowy element Wiedzy", "Dodaj do Biblioteki"],
    ["/knowledge?section=inbox", "Wiedza", "Dodaj do Skrzynki", "Dodaj do Skrzynki"],
    ["/goals/fintrack-api", "FinTrack API", "Dodaj Działanie do Celu FinTrack API", "Nowe Działanie"],
    ["/projects/fintrack-api", "FinTrack API", "Dodaj w Projekcie FinTrack API", "Nowe Działanie"],
    ["/projects/fintrack-api?view=actions", "FinTrack API", "Dodaj Działanie do Projektu FinTrack API", "Nowe Działanie"],
    ["/projects/fintrack-api?view=goals", "FinTrack API", "Dodaj Cel do Projektu FinTrack API", "Nowy Cel"],
    ["/projects/fintrack-api?view=knowledge", "FinTrack API", "Dodaj Wiedzę do Projektu FinTrack API", "Dodaj do Biblioteki"]
  ])("mobilne Dodaj otwiera właściwy formularz: %s", async (path, heading, trigger, title) => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 767px)", media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    try {
      const user = userEvent.setup();
      renderApp(path);
      await screen.findByRole("heading", { name: heading, level: 1 });
      await user.click(within(screen.getByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: trigger }));
      const dialog = await screen.findByRole("dialog", { name: title });
      if (path.includes("/projects/fintrack-api")) expect(dialog).toHaveTextContent("Projekt: FinTrack API");
      await user.keyboard("{Control>}j{/Control}");
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it("pokazuje Projekty i Cele jako osobne kierunki nawigacji i nie eksponuje Fokusów", async () => {
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    const navigation = screen.getByRole("navigation", { name: "Główna nawigacja" });
    for (const label of ["Start", "Projekty", "Rutyny", "Cele", "Wiedza", "Podsumowanie"]) expect(within(navigation).getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: /Inbox/ })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: /nauka|fokus/i })).not.toBeInTheDocument();
  });

  it("udostępnia komplet głównych sekcji z mobilnej nawigacji", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    await screen.findByRole("heading", { name: "FinTrack API" });
    const mobileNavigation = screen.getByRole("navigation", { name: "Nawigacja mobilna" });
    expect(within(mobileNavigation).getByRole("link", { name: /Start/ })).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("link", { name: /Projekty/ })).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("link", { name: /Wiedza/ })).toBeInTheDocument();
    expect(within(mobileNavigation).getByRole("button", { name: "Otwórz menu Więcej" })).toHaveAttribute("aria-current", "page");
    await user.click(within(mobileNavigation).getByRole("button", { name: "Otwórz menu Więcej" }));
    const more = screen.getByRole("dialog", { name: "Więcej" });
    for (const label of ["Cele", "Działania", "Rutyny", "Skrzynka", "Podsumowanie"]) expect(within(more).getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
    await user.click(within(more).getByRole("button", { name: /Wyszukaj/ }));
    expect(screen.getByRole("dialog", { name: "Wyszukiwanie globalne" })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: "Wyszukiwanie globalne" })).getByRole("button", { name: "Zamknij okno" }));
    await user.click(within(mobileNavigation).getByRole("button", { name: "Otwórz menu Więcej" }));
    await user.click(within(screen.getByRole("dialog", { name: "Więcej" })).getByRole("button", { name: /Dodaj dowolne/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("otwiera działające menu profilu i zamyka je klawiszem Escape", async () => {
    const user = userEvent.setup();
    renderApp();
    const trigger = await screen.findByRole("button", { name: "Otwórz menu profilu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "Opcje profilu" });
    expect(within(menu).getByRole("menuitem", { name: "Eksportuj dane" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Przywróć dane demo" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu", { name: "Opcje profilu" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("prowadzi tworzenie przez centralny przycisk i oddziela je od centrum profilu", async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByRole("heading", { name: "Start" });
    expect(screen.queryByRole("button", { name: "Otwórz szybkie akcje" })).not.toBeInTheDocument();
    await user.click(await within(screen.getByRole("banner")).findByRole("button", { name: "Dodaj nowe Działanie na Starcie" }));
    const createCenter = screen.getByRole("dialog");
    const quickAdd = createCenter.querySelector(".quick-add");
    expect(quickAdd).not.toHaveClass("mobile-chooser");
    await user.click(within(createCenter).getByText("Zmień", { exact: true }));
    for (const mode of ["Działanie", "Cel", "Do Skrzynki"]) expect(within(createCenter).getByRole("button", { name: mode })).toBeInTheDocument();
    await user.click(within(createCenter).getByLabelText("Co chcesz zrobić?"));
    expect(within(createCenter).getByLabelText("Co chcesz zrobić?")).toHaveFocus();
    expect(within(createCenter).queryByRole("button", { name: "Inbox" })).not.toBeInTheDocument();
    expect(within(createCenter).getByRole("button", { name: "Rutyna" })).toBeInTheDocument();
    await user.click(within(createCenter).getByText("Powiązania i ustawienia"));
    const dateChoices = within(createCenter).getByRole("group", { name: "Termin Działania" });
    await user.click(within(dateChoices).getByRole("button", { name: "Dzisiaj" }));
    expect(within(dateChoices).getByRole("button", { name: "Dzisiaj" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(createCenter).getByRole("button", { name: "Zamknij okno" }));

    await user.click(screen.getByRole("button", { name: "Otwórz menu Więcej" }));
    const profileCenter = screen.getByRole("dialog", { name: "Więcej" });
    expect(within(profileCenter).getByText("Jakub Kowalski")).toBeInTheDocument();
    expect(within(profileCenter).getByRole("button", { name: /Eksport danych/ })).toBeInTheDocument();
    expect(within(profileCenter).getByRole("link", { name: /Podsumowanie/ })).toHaveAttribute("href", "/review");
    expect(within(profileCenter).queryByText("Działanie cykliczne")).not.toBeInTheDocument();
  });

  it("pokazuje Na dziś przed zwiniętymi wyjątkami i rozwija pełną listę", async () => {
    const user = userEvent.setup();
    const state = structuredClone(demoState);
    state.goals = [
      ...state.goals,
      ...Array.from({ length: 3 }, (_, index) => ({
        ...state.goals[0]!,
        id: `goal-extra-${index + 1}`,
        title: `Cel bez następnego ${index + 1}`,
        createdAt: `2026-08-${String(2 + index).padStart(2, "0")}T08:00:00.000Z`
      }))
    ];
    localStorage.setItem("command-center-state-v1", JSON.stringify(state));
    renderApp();

    const priority = await screen.findByRole("region", { name: "Najważniejsze teraz" });
    const today = screen.getByRole("region", { name: "Na dziś" });
    const overviewToggle = screen.getByRole("button", { name: /Dalszy plan/ });
    expect(overviewToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(overviewToggle);
    const attention = screen.getByRole("region", { name: "Wymaga uwagi" });
    expect(overviewToggle).toHaveAttribute("aria-expanded", "true");
    expect(Boolean(priority.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(today.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(attention.querySelectorAll(".attention-list > a")).toHaveLength(2);
    const attentionCount = Number(within(attention).getByLabelText(/spraw wymaga uwagi$/).getAttribute("aria-label")?.match(/\d+/)?.[0]);
    expect(within(attention).getByRole("link", { name: "Zobacz wszystkie" })).toHaveAttribute("href", "/?show=attention");

    await user.click(within(attention).getByRole("link", { name: "Zobacz wszystkie" }));
    expect(screen.getByRole("region", { name: "Wymaga uwagi" }).querySelectorAll(".attention-list > a")).toHaveLength(attentionCount);
    await user.click(within(screen.getByRole("region", { name: "Wymaga uwagi" })).getByRole("link", { name: "Zwiń listę" }));
    expect(screen.getByRole("region", { name: "Wymaga uwagi" }).querySelectorAll(".attention-list > a")).toHaveLength(2);
  });

  it("pokazuje ogólne Rutyny niezależnie od planu dnia i otwiera ich ustawienia", async () => {
    const user = userEvent.setup();
    renderApp("/routines");
    expect(await screen.findByRole("heading", { name: "Rutyny" })).toBeInTheDocument();
    const routine = screen.getByRole("heading", { name: "Przegląd budżetu" }).closest("section") as HTMLElement;
    expect(within(routine).getByText("Co tydzień · Wt")).toBeInTheDocument();
    expect(within(routine).getByRole("link", { name: "Zbudować spokojny budżet domowy" })).toBeInTheDocument();
    expect(within(routine).getByText("Najbliższe wykonania")).toBeInTheDocument();
    await user.click(within(routine).getByRole("link", { name: "Edytuj ustawienia" }));
    expect(await screen.findByRole("dialog", { name: "Edytuj serię cykliczną" })).toBeInTheDocument();
  });

  it("wyszukuje Cel, otwiera wynik i obsługuje Escape", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = await screen.findByRole("combobox", { name: "Szukaj w Projektach, Celach, Działaniach i Wiedzy" });
    await user.type(search, "Portfolio");
    expect((await screen.findAllByRole("option", { name: /Portfolio v2/ }))[0]).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.type(search, "Portfolio");
    await user.click((await screen.findAllByRole("option", { name: /Portfolio v2/ }))[0]!);
    expect(await screen.findByRole("heading", { name: "Portfolio v2" })).toBeInTheDocument();
  });

  it("otwiera wyszukiwanie mobilne w osobnym panelu i zamyka je po nawigacji", async () => {
    const user = userEvent.setup();
    sessionStorage.removeItem("command-global-search");
    renderApp();
    await user.click(await screen.findByRole("button", { name: "Otwórz wyszukiwanie" }));
    let dialog = screen.getByRole("dialog", { name: "Wyszukiwanie globalne" });
    let search = within(dialog).getByRole("combobox", { name: "Szukaj w Projektach, Celach, Działaniach i Wiedzy" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(within(dialog).queryByRole("listbox", { name: "Wyniki wyszukiwania" })).not.toBeInTheDocument();
    await user.type(search, "x");
    expect(within(dialog).getByRole("status")).toHaveTextContent("Wpisz co najmniej 2 znaki");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Wyszukiwanie globalne" })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Otwórz wyszukiwanie" }));
    dialog = screen.getByRole("dialog", { name: "Wyszukiwanie globalne" });
    search = within(dialog).getByRole("combobox", { name: "Szukaj w Projektach, Celach, Działaniach i Wiedzy" });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, "Portfolio");
    expect(await within(dialog).findByRole("listbox", { name: "Wyniki wyszukiwania" })).toBeInTheDocument();
    const goalResult = (await within(dialog).findAllByRole("option")).find((option) => within(option).queryByText("Portfolio v2"));
    expect(goalResult).toBeDefined();
    await user.click(goalResult!);
    expect(await screen.findByRole("heading", { name: "Portfolio v2" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Wyszukiwanie globalne" })).not.toBeInTheDocument();
  });

  it("wykonuje intencyjne triage Inboxu do Wiedzy i zachowuje źródło", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge?section=inbox");
    const source = await screen.findByText("https://www.postgresql.org/docs/current/erd.html");
    const item = source.closest("section") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: "Przetwórz" }));
    const decision = screen.getByRole("dialog", { name: "Co chcesz z tym zrobić?" });
    await user.click(within(decision).getByText("Zapisz w Bibliotece").closest("button")!);
    await user.clear(screen.getByLabelText("Nazwa materiału"));
    await user.type(screen.getByLabelText("Nazwa materiału"), "Dokumentacja PostgreSQL ERD");
    const knowledgeDialog = screen.getByRole("dialog", { name: "Zapisz w Bibliotece" });
    await user.click(within(knowledgeDialog).getByRole("button", { name: "Zapisz materiał" }));
    await user.click(screen.getAllByRole("link", { name: /Wiedza/ })[0]!);
    expect(await screen.findByText("Dokumentacja PostgreSQL ERD")).toBeInTheDocument();
    expect(screen.getByText(/Źródło: Skrzynka/)).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Dokumentacja PostgreSQL ERD" }));
    expect(await screen.findByRole("heading", { name: "Pochodzenie" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /https:\/\/www\.postgresql\.org\/docs\/current\/erd\.html.*Otwórz przechwycenie/ })).toBeInTheDocument();
  });

  it("filtruje Wiedzę i pokazuje pusty wynik", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    const search = await screen.findByRole("searchbox", { name: "Szukaj w wiedzy" });
    await user.type(search, "nieistniejący-obiekt");
    expect(screen.getByRole("heading", { name: "Brak pasujących obiektów" })).toBeInTheDocument();
  });

  it("otwiera mobilny arkusz filtrów Celów i ujawnia ich stan programowo", async () => {
    const user = userEvent.setup();
    renderApp("/goals");
    await user.click(await screen.findByRole("button", { name: "Filtry (0)" }));
    const dialog = screen.getByRole("dialog", { name: "Filtry Celów (0)" });
    expect(within(dialog).getByRole("button", { name: "Aktywny" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(dialog).getByRole("button", { name: "Wstrzymany" }));
    expect(screen.queryByRole("dialog", { name: "Filtry Celów (0)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filtry (1)" })).toBeInTheDocument();
  });

  it("pokazuje walidację nowego Celu przy konkretnych polach", async () => {
    const user = userEvent.setup();
    renderApp("/goals");
    await user.click(within(await screen.findByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: "Dodaj nowy Cel" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy cel" });
    await user.type(within(dialog).getByLabelText("Nazwa Celu"), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz cel" }));
    expect(within(dialog).getByText("Podaj nazwę Celu.")).toBeInTheDocument();
    expect(within(dialog).queryByText("Opisz obserwowalny rezultat.")).not.toBeInTheDocument();
  });

  it("tworzy element Wiedzy z wieloma powiązanymi Celami", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    await screen.findByRole("heading", { name: "Wiedza" });
    await user.click(within(screen.getByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: "Dodaj nowy element Wiedzy" }));
    const dialog = screen.getByRole("dialog", { name: "Dodaj do Biblioteki" });
    await user.type(within(dialog).getByLabelText("Tytuł notatki"), "Decyzja o modelu danych");
    const goals = within(dialog).getByRole("combobox", { name: "Powiązane Cele" });
    await user.click(goals);
    await user.click(within(within(dialog).getByRole("listbox", { name: "Powiązane Cele" })).getAllByRole("option")[0]!);
    await user.click(goals);
    await user.click(within(within(dialog).getByRole("listbox", { name: "Powiązane Cele" })).getAllByRole("option")[0]!);
    expect(within(dialog).getAllByRole("button", { name: /Usuń powiązanie/ })).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Zapisz notatkę" }));
    const created = screen.getByText("Decyzja o modelu danych").closest("section") as HTMLElement;
    expect(within(created).getByText("2 powiązania")).toBeInTheDocument();
    expect(within(created).queryByText("FinTrack API")).not.toBeInTheDocument();
  });

  it("edytuje treść i różnicę relacji Wiedzy w jednym zapisie", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge/know-3");
    await screen.findByRole("heading", { name: "PostgreSQL: constraints and normalization" });
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    await user.click(screen.getByRole("button", { name: "Usuń powiązanie: Zbudować spokojny budżet domowy" }));
    const goals = screen.getByRole("combobox", { name: "Powiązane Cele" });
    await user.click(goals);
    await user.click(within(screen.getByRole("listbox", { name: "Powiązane Cele" })).getByRole("option", { name: "FinTrack API" }));
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
    const relations = screen.getByRole("heading", { name: "Powiązania" }).closest("section") as HTMLElement;
    expect(await within(relations).findByRole("link", { name: "FinTrack API" })).toBeInTheDocument();
    expect(within(relations).queryByRole("link", { name: "Zbudować spokojny budżet domowy" })).not.toBeInTheDocument();
  });

  it("dołącza materiał do decyzji jako potwierdzenie", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge/know-2");
    await screen.findByRole("heading", { name: "Typ danych dla kwot pieniężnych" });
    await user.click(screen.getByText("Dodaj potwierdzenie", { selector: "summary" }));
    await user.selectOptions(screen.getByLabelText("Materiał potwierdzający decyzję"), "know-3");
    await user.click(screen.getByRole("button", { name: "Dołącz" }));
    expect(await screen.findByRole("link", { name: "PostgreSQL: constraints and normalization" })).toBeInTheDocument();
  });

  it("łączy jeden element Wiedzy z wieloma Projektami i pokazuje transfer kontekstu", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge/know-3");
    await screen.findByRole("heading", { name: "PostgreSQL: constraints and normalization" });
    const panel = screen.getByRole("region", { name: "Powiązania" });
    expect(within(panel).getByRole("link", { name: /Finanse/ })).toBeInTheDocument();
    await user.click(within(panel).getByText("Połącz wiedzę", { selector: "summary" }));
    await user.selectOptions(within(panel).getByLabelText("Połącz z kolejnym Projektem"), "portfolio-v2");
    await user.click(within(panel).getByRole("button", { name: "Połącz Projekt" }));
    expect(await within(panel).findByRole("link", { name: /Portfolio v2/ })).toBeInTheDocument();
    expect(within(panel).getByText("Łączy 2 Projekty")).toBeInTheDocument();
  });

  it("archiwizuje Wiedzę i pozwala cofnąć zmianę", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    const title = await screen.findByText("Wzorce modelowania transakcji");
    const item = title.closest("section") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: "Więcej opcji: Wzorce modelowania transakcji" }));
    await user.click(within(screen.getByRole("dialog", { name: "Wiedza — więcej opcji" })).getByRole("button", { name: "Archiwizuj" }));
    const notice = await screen.findByText("„Wzorce modelowania transakcji” przeniesiono do Archiwum.");
    await user.click(within(notice.closest("section") as HTMLElement).getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByText("Wzorce modelowania transakcji")).toBeInTheDocument();
  });

  it("wymaga potwierdzenia przed przeniesieniem Celu do Kosza", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    await screen.findByRole("heading", { name: "FinTrack API" });
    await user.click(screen.getByText("Opcje Celu"));
    await user.click(screen.getByRole("button", { name: "Przenieś do kosza" }));
    const dialog = screen.getByRole("alertdialog", { name: "Przenieść Cel do Kosza?" });
    expect(dialog).toHaveTextContent("Działania, kryteria, Wiedza i historia postępu pozostaną zachowane.");
    await user.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("alertdialog", { name: "Przenieść Cel do Kosza?" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
  });

  it("historyczny zapis Fokusu jest wyłącznie do odczytu", async () => {
    renderApp("/history/focus/session-001");
    expect(await screen.findByRole("heading", { name: "Nie znaleziono historycznego wpisu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start|wznów|pauza|checkpoint/i })).not.toBeInTheDocument();
  });

  it("otwiera pełne dodawanie skrótem z dowolnego widoku bez utraty kontekstu", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    await screen.findByRole("heading", { name: "FinTrack API" });
    await user.keyboard("{Control>}j{/Control}");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Powiązania i ustawienia")).toBeInTheDocument();
    await user.click(within(dialog).getByText("Zmień", { exact: true }));
    await user.click(within(dialog).getByRole("button", { name: "Do Skrzynki" }));
    await user.type(within(dialog).getByLabelText("Co chcesz zachować?"), "Pomysł zapisany przy Celu");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz do Skrzynki" }));
    expect(await screen.findByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
  });

  it("rozpoznaje komendę /cel i tworzy Cel z jednego pola", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    await user.keyboard("{Control>}j{/Control}");
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Co chcesz zrobić?");
    await user.type(input, "/cel Uporządkować dokumentację");
    expect(within(dialog).getByRole("heading", { name: "Nowy Cel" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Co chcesz osiągnąć?")).toHaveValue("Uporządkować dokumentację");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz Cel" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Cel utworzony.");
  });

  it("przechwytuje Wiedzę z tego samego szybkiego formularza do późniejszego przetworzenia", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    await user.click(within(screen.getByRole("banner")).getByRole("button", { name: "Dodaj nowe Działanie na Starcie" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByText("Zmień", { exact: true }));
    await user.click(within(dialog).getByRole("button", { name: "Do Skrzynki" }));
    await user.type(within(dialog).getByLabelText("Co chcesz zachować?"), "Wzorzec adaptera\nOddziela integrację od domeny.");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz do Skrzynki" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
  });

  it("pokazuje automatyczne podsumowanie tygodnia z sugestiami", async () => {
    renderApp("/review");
    expect(await screen.findByRole("heading", { name: "Podsumowanie tygodnia" })).toBeInTheDocument();
    expect(screen.getByText("Podsumowanie systemowe")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Co warto zrobić dalej" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zamknij tydzień" })).toBeEnabled();
  });

  it("edytuje Działanie, zmienia stan Celu i wiąże materiał z Działaniem", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    await screen.findByRole("heading", { name: "FinTrack API" });
    await user.click(screen.getByText("Opcje Celu"));
    await user.selectOptions(screen.getByLabelText("Stan Celu"), "paused");
    expect(screen.getByRole("option", { name: "Wstrzymany", selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Więcej opcji: Zaprojektuj encje i relacje dla transakcji" }));
    await user.click(within(screen.getByRole("dialog", { name: "Działanie — więcej opcji" })).getByRole("button", { name: "Edytuj" }));
    const edit = screen.getByRole("dialog", { name: "Edytuj Działanie" });
    await user.clear(within(edit).getByLabelText("Nazwa"));
    await user.type(within(edit).getByLabelText("Nazwa"), "Zaprojektuj model transakcji");
    await user.click(within(edit).getByRole("button", { name: "Zapisz zmiany" }));
    await user.click(await screen.findByRole("link", { name: "Zaprojektuj model transakcji" }));
    const actionKnowledge = await screen.findByRole("region", { name: "Wiedza Działania" });
    expect(within(actionKnowledge).getByText("Materiały")).toBeVisible();
    await user.click(within(actionKnowledge).getByText("Połącz wiedzę", { selector: "summary" }));
    await user.selectOptions(within(actionKnowledge).getByLabelText("Podepnij Wiedzę do Działania: Zaprojektuj model transakcji"), "know-3");
    await user.click(within(actionKnowledge).getByRole("button", { name: "Połącz" }));
    expect(await within(actionKnowledge).findByText("PostgreSQL: constraints and normalization")).toBeInTheDocument();
    const unlink = within(actionKnowledge).getByRole("button", { name: "Odłącz PostgreSQL: constraints and normalization od Działania" });
    unlink.focus();
    await user.keyboard("{Enter}");
    expect(within(actionKnowledge).queryByText("PostgreSQL: constraints and normalization")).not.toBeInTheDocument();
  });
});
