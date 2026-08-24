import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
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
    ["/learning", "Cele"], ["/review", "Podsumowanie tygodnia"], ["/nieznana-trasa", "Start"]
  ])("renderuje lub przekierowuje trasę %s", async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
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
    for (const label of ["Cele", "Rutyny", "Podsumowanie"]) expect(within(more).getByRole("link", { name: new RegExp(label) })).toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Otwórz szybkie akcje" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Otwórz centrum dodawania" }));
    const createCenter = screen.getByRole("dialog", { name: "Dodaj" });
    const quickAdd = createCenter.querySelector(".quick-add");
    expect(quickAdd).toHaveClass("mobile-chooser");
    for (const mode of ["Działanie", "Cel", "Do Skrzynki"]) expect(within(createCenter).getByRole("button", { name: mode })).toBeInTheDocument();
    expect(within(createCenter).queryByRole("button", { name: "Inbox" })).not.toBeInTheDocument();
    expect(within(createCenter).getByRole("button", { name: /Działanie cykliczne/ })).toBeInTheDocument();
    await user.click(within(createCenter).getByRole("button", { name: "Działanie" }));
    expect(quickAdd).toHaveClass("mobile-expanded");
    expect(within(createCenter).getByRole("button", { name: "Wróć do wyboru typu" })).toBeInTheDocument();
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
    const dialog = screen.getByRole("dialog", { name: "Wyszukiwanie globalne" });
    const search = within(dialog).getByRole("combobox", { name: "Szukaj w Projektach, Celach, Działaniach i Wiedzy" });
    await waitFor(() => expect(search).toHaveFocus());
    expect(within(dialog).queryByRole("listbox", { name: "Wyniki wyszukiwania" })).not.toBeInTheDocument();
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
    await user.clear(screen.getByLabelText("Tytuł"));
    await user.type(screen.getByLabelText("Tytuł"), "Dokumentacja PostgreSQL ERD");
    const knowledgeDialog = screen.getByRole("dialog", { name: "Zapisz w Bibliotece" });
    await user.click(within(knowledgeDialog).getByRole("button", { name: "Zapisz" }));
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
    await user.click(await screen.findByRole("button", { name: "Nowy cel" }));
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
    await user.click(screen.getByRole("button", { name: "Nowy element Biblioteki" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy element Biblioteki" });
    await user.type(within(dialog).getByLabelText("Tytuł / pytanie"), "Decyzja o modelu danych");
    const goals = within(dialog).getByRole("combobox", { name: "Powiązane Cele" });
    await user.click(goals);
    await user.click(within(within(dialog).getByRole("listbox", { name: "Powiązane Cele" })).getAllByRole("option")[0]!);
    await user.click(goals);
    await user.click(within(within(dialog).getByRole("listbox", { name: "Powiązane Cele" })).getAllByRole("option")[0]!);
    expect(within(dialog).getAllByRole("button", { name: /Usuń powiązanie/ })).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Zapisz w Bibliotece" }));
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
    await user.selectOptions(screen.getByLabelText("Materiał potwierdzający decyzję"), "know-3");
    await user.click(screen.getByRole("button", { name: "Dołącz" }));
    expect(await screen.findByRole("link", { name: "PostgreSQL: constraints and normalization" })).toBeInTheDocument();
  });

  it("łączy jeden element Wiedzy z wieloma Projektami i pokazuje transfer kontekstu", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge/know-3");
    await screen.findByRole("heading", { name: "PostgreSQL: constraints and normalization" });
    const panel = screen.getByRole("heading", { name: "Projekty i transfer wiedzy" }).closest("section") as HTMLElement;
    expect(within(panel).getByRole("link", { name: "Finanse" })).toBeInTheDocument();
    await user.selectOptions(within(panel).getByLabelText("Połącz z kolejnym Projektem"), "portfolio-v2");
    await user.click(within(panel).getByRole("button", { name: "Połącz Projekt" }));
    expect(await within(panel).findByRole("link", { name: "Portfolio v2" })).toBeInTheDocument();
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
    await user.click(screen.getByText("Więcej", { selector: "summary" }));
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

  it("dodaje z dowolnego widoku do kolejki Wiedzy bez utraty kontekstu i czyści draft po sukcesie", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    await screen.findByRole("heading", { name: "FinTrack API" });
    await user.click(screen.getByRole("button", { name: "Otwórz szybkie dodawanie" }));
    const dialog = screen.getByRole("dialog", { name: "Dodaj" });
    expect(within(dialog).getByText("Powiązania i ustawienia")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Do Skrzynki" }));
    await user.type(within(dialog).getByLabelText("Co chcesz zachować?"), "Pomysł zapisany przy Celu");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz do Skrzynki" }));
    expect(await screen.findByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Dodaj" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
  });

  it("rozpoznaje komendę /cel i tworzy Cel z jednego pola", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    await user.keyboard("{Control>}j{/Control}");
    const dialog = screen.getByRole("dialog", { name: "Dodaj" });
    const input = within(dialog).getByLabelText("Co chcesz zrobić?");
    await user.type(input, "/cel Uporządkować dokumentację");
    expect(within(dialog).getByRole("button", { name: "Cel" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByLabelText("Co chcesz osiągnąć?")).toHaveValue("Uporządkować dokumentację");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz Cel" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Cel utworzony.");
  });

  it("przechwytuje Wiedzę z tego samego szybkiego formularza do późniejszego przetworzenia", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Start" });
    await user.click(screen.getByRole("button", { name: "Otwórz szybkie dodawanie" }));
    const dialog = screen.getByRole("dialog", { name: "Dodaj" });
    await user.click(within(dialog).getByRole("button", { name: "Do Skrzynki" }));
    await user.type(within(dialog).getByLabelText("Co chcesz zachować?"), "Wzorzec adaptera\nOddziela integrację od domeny.");
    await user.click(within(dialog).getByRole("button", { name: "Zapisz do Skrzynki" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
  });

  it("pokazuje automatyczne podsumowanie tygodnia z sugestiami", async () => {
    renderApp("/review");
    expect(await screen.findByRole("heading", { name: "Podsumowanie tygodnia" })).toBeInTheDocument();
    expect(screen.getByText("Automatyczne podsumowanie")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Co warto zrobić dalej" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zamknij tydzień" })).toBeEnabled();
  });

  it("edytuje Działanie, zmienia stan Celu i wiąże materiał z Działaniem", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    await screen.findByRole("heading", { name: "FinTrack API" });
    await user.selectOptions(screen.getByLabelText("Stan Celu"), "paused");
    expect(screen.getByRole("option", { name: "Wstrzymany", selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edytuj: Zaprojektuj encje i relacje dla transakcji" }));
    const edit = screen.getByRole("dialog", { name: "Edytuj Działanie" });
    await user.clear(within(edit).getByLabelText("Nazwa"));
    await user.type(within(edit).getByLabelText("Nazwa"), "Zaprojektuj model transakcji");
    await user.click(within(edit).getByRole("button", { name: "Zapisz zmiany" }));
    expect(await screen.findByRole("button", { name: "Edytuj: Zaprojektuj model transakcji" })).toBeInTheDocument();
    const actionKnowledge = screen.getAllByRole("region", { name: "Wiedza Działania" })[0];
    const relationToggle = within(actionKnowledge).getByRole("button", { name: "Dodaj wiedzę" });
    expect(relationToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(relationToggle);
    expect(relationToggle).toHaveAttribute("aria-expanded", "true");
    await user.selectOptions(within(actionKnowledge).getByLabelText("Podepnij Wiedzę do Działania: Zaprojektuj model transakcji"), "know-3");
    await user.click(within(actionKnowledge).getByRole("button", { name: "Połącz" }));
    expect(await within(actionKnowledge).findByText("PostgreSQL: constraints and normalization")).toBeInTheDocument();
  });
});
