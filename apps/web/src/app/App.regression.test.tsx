import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { App } from "./App";
import { StoreProvider } from "./store";

function renderApp(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

describe("regresje widoków i przepływów", () => {
  it.each([
    ["/", "Dzisiaj"], ["/focus", "Niezawodne API do zarządzania finansami osobistymi"], ["/inbox", "Inbox"],
    ["/projects", "Projekty"], ["/projects/fintrack-api", "FinTrack API"], ["/learning", "Nauka"],
    ["/knowledge", "Wiedza"], ["/review", "Przegląd tygodnia"], ["/nieznana-trasa", "Dzisiaj"]
  ])("renderuje trasę %s", (path, heading) => {
    renderApp(path);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("wyszukuje wyłącznie w aktywnym Workspace, otwiera wynik i obsługuje Escape", async () => {
    const user = userEvent.setup();
    renderApp();
    const search = screen.getByRole("searchbox", { name: "Wyszukaj lub wpisz polecenie…" });
    await user.type(search, "Portfolio");
    expect(screen.getByRole("option", { name: /Portfolio v2/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.type(search, "Portfolio");
    await user.click(screen.getByRole("option", { name: /Portfolio v2/ }));
    expect(await screen.findByRole("heading", { name: "Portfolio v2" })).toBeInTheDocument();
  });

  it("obsługuje szybki Capture skrótem klawiaturowym", async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const quickCapture = screen.getByRole("textbox", { name: "Zapisz myśl, zadanie lub link" });
    await user.type(quickCapture, "Capture ze skrótu{Control>}{Enter}{/Control}");
    expect(quickCapture).toHaveValue("");
    await user.click(screen.getByRole("link", { name: /Inbox 4/ }));
    const inboxList = container.querySelector(".inbox-list");

    expect(inboxList).not.toBeNull();
    expect(within(inboxList as HTMLElement).getByText("Capture ze skrótu")).toBeInTheDocument();
  });

  it("wymaga jawnego rozwinięcia i zatwierdzenia AI Proposal", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Zobacz propozycję" }));
    expect(screen.getByText("Proponowana zmiana")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zatwierdź" }));
    expect(screen.getByText("Propozycja zatwierdzona")).toBeInTheDocument();
  });

  it("wykonuje zatwierdzoną AI Proposal dopiero po osobnej akcji", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Zobacz propozycję" }));
    await user.click(screen.getByRole("button", { name: "Zatwierdź" }));
    expect(screen.getByText("Oczekuje na wykonanie")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wykonaj zatwierdzoną komendę" }));
    expect(screen.getByText("Wykonanie zakończone")).toBeInTheDocument();
  });

  it("zamyka modal klawiszem Escape bez zapisania", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(screen.getByRole("button", { name: "Nowy projekt" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("po zamknięciu modalu przywraca fokus do elementu, który go otworzył", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    const opener = screen.getByRole("button", { name: "Nowy projekt" });
    await user.click(opener);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });

  it("przechwytuje różne typy Inbox Itemów, wykonuje triage i decyzję AI", async () => {
    const user = userEvent.setup();
    const { container } = renderApp("/inbox");
    await user.click(screen.getByRole("button", { name: "Link" }));
    await user.type(screen.getByLabelText("Treść przechwycenia"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    const inboxList = container.querySelector(".inbox-list") as HTMLElement;
    const newItem = within(inboxList).getByText("https://example.com").closest("section") as HTMLElement;
    await user.click(within(newItem).getByRole("button", { name: "Oznacz jako przetworzone" }));
    expect(within(inboxList).queryByText("https://example.com")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Odrzuć" }));
    expect(screen.queryByText("Propozycja klasyfikacji AI")).not.toBeInTheDocument();
  });

  it("triage tworzy Resource z pochodzeniem i zachowuje kopertę Inbox Itemu", async () => {
    const user = userEvent.setup();
    renderApp("/inbox");
    const rawItem = screen.getByText("https://www.postgresql.org/docs/current/erd.html").closest("section") as HTMLElement;
    await user.click(within(rawItem).getByRole("button", { name: "Triaguj" }));
    const dialog = screen.getByRole("dialog", { name: "Triage Inbox Itemu" });
    await user.selectOptions(within(dialog).getByLabelText("Obiekt docelowy"), "resource");
    await user.clear(within(dialog).getByLabelText("Tytuł obiektu"));
    await user.type(within(dialog).getByLabelText("Tytuł obiektu"), "Dokumentacja PostgreSQL ERD");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz i rozwiąż" }));

    await user.click(screen.getByRole("link", { name: "Wiedza" }));
    expect(await screen.findByText("Dokumentacja PostgreSQL ERD")).toBeInTheDocument();
    expect(screen.getByText(/Źródło: Inbox/)).toBeInTheDocument();
  });

  it("odkłada i odrzuca Inbox Item z listy triage", async () => {
    const user = userEvent.setup();
    renderApp("/inbox");
    await user.click(screen.getAllByRole("button", { name: "Odłóż do jutra" })[0]!);
    await user.click(screen.getAllByRole("button", { name: "Odrzuć Inbox Item" })[0]!);
    expect(screen.getByText("1 elementów czeka na triage")).toBeInTheDocument();
  });

  it("po odrzuceniu Inbox Itemu pokazuje wynik i pozwala go cofnąć", async () => {
    const user = userEvent.setup();
    const { container } = renderApp("/inbox");
    const inbox = container.querySelector(".inbox-list") as HTMLElement;
    const item = within(inbox).getByText("Sprawdzić wydajność zapytań w endpointzie /transactions").closest("section") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: "Odrzuć Inbox Item" }));
    const notice = await screen.findByText("Inbox Item odrzucony.");
    expect(within(inbox).queryByText("Sprawdzić wydajność zapytań w endpointzie /transactions")).not.toBeInTheDocument();
    await user.click(within(notice.closest("section") as HTMLElement).getByRole("button", { name: "Cofnij" }));
    expect(await within(inbox).findByText("Sprawdzić wydajność zapytań w endpointzie /transactions")).toBeInTheDocument();
  });

  it("filtruje Knowledge i pokazuje prawidłowy pusty wynik", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    const search = screen.getByRole("searchbox", { name: "Szukaj w wiedzy" });
    await user.type(search, "DECIMAL");
    expect(screen.getByText("Typ danych dla kwot pieniężnych")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "nieistniejący-obiekt");
    expect(screen.getByRole("heading", { name: "Brak pasujących obiektów" })).toBeInTheDocument();
  });

  it("tworzy Investigation i obsługuje odwracalne Archive oraz Trash", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    await user.click(screen.getByRole("button", { name: "Nowy obiekt" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy obiekt wiedzy" });
    await user.selectOptions(within(dialog).getByLabelText("Typ obiektu"), "investigation");
    await user.type(within(dialog).getByLabelText("Tytuł / pytanie"), "Czy indeks złożony skróci zapytanie?");
    await user.type(within(dialog).getByLabelText("Treść"), "Porównaj EXPLAIN ANALYZE przed i po.");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz obiekt" }));
    const item = screen.getByText("Czy indeks złożony skróci zapytanie?").closest("section") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: "Archiwizuj" }));
    expect(screen.queryByText("Czy indeks złożony skróci zapytanie?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const archived = screen.getByText("Czy indeks złożony skróci zapytanie?").closest("section") as HTMLElement;
    await user.click(within(archived).getByRole("button", { name: "Przenieś do Trash" }));
    await user.click(screen.getByRole("button", { name: "Trash" }));
    expect(screen.getByText("Czy indeks złożony skróci zapytanie?")).toBeInTheDocument();
  });

  it("po Archive obiektu Knowledge wykonuje undo przez Store", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    const item = screen.getByText("Wzorce modelowania transakcji").closest("section") as HTMLElement;
    await user.click(within(item).getByRole("button", { name: "Archiwizuj" }));
    const notice = await screen.findByText("„Wzorce modelowania transakcji” przeniesiono do Archive.");
    expect(screen.queryByText("Wzorce modelowania transakcji")).not.toBeInTheDocument();
    await user.click(within(notice.closest("section") as HTMLElement).getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByText("Wzorce modelowania transakcji")).toBeInTheDocument();
  });

  it("tworzy Resource z URL i filtruje Knowledge po typie", async () => {
    const user = userEvent.setup();
    renderApp("/knowledge");
    await user.click(screen.getByRole("button", { name: "Nowy obiekt" }));
    const dialog = screen.getByRole("dialog", { name: "Nowy obiekt wiedzy" });
    await user.selectOptions(within(dialog).getByLabelText("Typ obiektu"), "resource");
    await user.type(within(dialog).getByLabelText("Tytuł / pytanie"), "Dokumentacja indeksów");
    await user.type(within(dialog).getByLabelText("Treść"), "Materiały źródłowe");
    await user.selectOptions(within(dialog).getByLabelText("Powiązany Project"), "fintrack-api");
    await user.type(within(dialog).getByLabelText("URL źródła"), "https://example.com/indexes");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz obiekt" }));
    await user.selectOptions(screen.getByLabelText("Filtr typu"), "resource");
    expect(screen.getByText("Dokumentacja indeksów")).toBeInTheDocument();
    expect(screen.queryByText("Wzorce modelowania transakcji")).not.toBeInTheDocument();
  });

  it("nie kończy Review bez decyzji i zapisuje ukończony przegląd", async () => {
    const user = userEvent.setup();
    const { container } = renderApp("/review");
    const complete = screen.getByRole("button", { name: "Zakończ przegląd" });
    expect(complete).toBeDisabled();
    for (const button of container.querySelectorAll<HTMLButtonElement>(".review-questions button")) await user.click(button);
    await user.type(screen.getByLabelText("Najważniejsza decyzja na kolejny tydzień"), "Ograniczam WIP do dwóch kierunków.");
    expect(complete).toBeEnabled();
    await user.click(complete);
    expect(await screen.findByText("Ukończony")).toBeInTheDocument();
  });

  it("zapisuje Daily Review w niezmiennej historii obok Weekly Review", async () => {
    const user = userEvent.setup();
    const { container } = renderApp("/review");
    await user.selectOptions(screen.getByLabelText("Typ przeglądu"), "daily");
    for (const button of container.querySelectorAll<HTMLButtonElement>(".review-questions button")) await user.click(button);
    await user.type(screen.getByLabelText("Najważniejsza decyzja"), "Jutro kontynuuję główny Work Item.");
    await user.click(screen.getByRole("button", { name: "Zakończ przegląd" }));
    expect(screen.getByText("Daily Review • ukończony")).toBeInTheDocument();
  });

  it("wymaga świadomego uzasadnienia przed przekroczeniem limitu WIP", async () => {
    const user = userEvent.setup();
    renderApp("/projects");
    await user.click(screen.getByRole("button", { name: "Nowy projekt" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Limit trzech aktywnych Commitments jest wykorzystany.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Nazwa projektu"), "Incydent produkcyjny");
    await user.type(within(dialog).getByLabelText("Outcome — obserwowalna zmiana"), "Usługa ponownie odpowiada");
    await user.type(within(dialog).getByLabelText("Pierwszy fizyczny krok"), "Odtwórz błąd na produkcji");
    expect(within(dialog).getByRole("button", { name: "Utwórz projekt" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Uzasadnienie przekroczenia WIP"), "Incydent blokuje użytkowników");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz projekt" }));
    expect(await screen.findByRole("heading", { name: "Incydent produkcyjny" })).toBeInTheDocument();
  });

  it("zarządza Commitmentem i stanem Work Itemu z Project Workspace", async () => {
    const user = userEvent.setup();
    renderApp("/projects/portfolio-v2");

    await user.click(screen.getByRole("button", { name: "Ustaw jako Primary" }));
    expect(screen.getByText("Primary commitment")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wstrzymaj Commitment" }));
    expect(screen.getByRole("button", { name: "Wznów Commitment" })).toBeInTheDocument();
    expect(screen.getByText("Wstrzymany commitment")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Status: Dokończ sekcję case studies" }), "completed");
    expect(screen.getByRole("option", { name: "Ukończony", selected: true })).toBeInTheDocument();
  });

  it("osłania release Commitmentu i przeniesienie Projectu do Trash", async () => {
    const user = userEvent.setup();
    renderApp("/projects/portfolio-v2");
    const releaseOpener = screen.getByRole("button", { name: "Zwolnij Commitment" });
    await user.click(releaseOpener);
    const releaseDialog = screen.getByRole("alertdialog", { name: "Zwolnić Commitment?" });
    expect(releaseDialog).toHaveTextContent("Project, Outcome, Work Items, checkpointy i historia pozostaną bez zmian.");
    await user.click(within(releaseDialog).getByRole("button", { name: "Anuluj" }));
    expect(releaseOpener).toHaveFocus();
    await user.click(releaseOpener);
    await user.click(within(screen.getByRole("alertdialog", { name: "Zwolnić Commitment?" })).getByRole("button", { name: "Zwolnij Commitment" }));
    expect(await screen.findByText("Zwolniony commitment")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Przenieś Project do Trash" }));
    const trashDialog = screen.getByRole("alertdialog", { name: "Przenieść Project do Trash?" });
    expect(trashDialog).toHaveTextContent("Project można przywrócić z widoku Trash");
    await user.click(within(trashDialog).getByRole("button", { name: "Przenieś do Trash" }));
    expect(await screen.findByRole("heading", { name: "Projekty" })).toBeInTheDocument();
    expect(screen.getByText("Project „Portfolio v2” przeniesiono do Trash.")).toBeInTheDocument();
  });

  it("archiwizuje Project bez zmiany jego statusu domenowego i pozwala go przywrócić", async () => {
    const user = userEvent.setup();
    renderApp("/projects/portfolio-v2");
    await user.click(screen.getByRole("button", { name: "Archiwizuj Project" }));
    expect(await screen.findByRole("heading", { name: "Projekty" })).toBeInTheDocument();
    expect(screen.queryByText("Portfolio v2")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive" }));
    const project = screen.getByText("Portfolio v2").closest("section") as HTMLElement;
    expect(within(project).getByText("Zagrożony")).toBeInTheDocument();
    await user.click(within(project).getByRole("button", { name: "Przywróć" }));
    await user.click(screen.getByRole("button", { name: "Aktywne" }));
    expect(screen.getByText("Portfolio v2")).toBeInTheDocument();
  });

  it("kończy Work Item bez checkpointu wznowienia i proponuje kolejny krok", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: "Rozpocznij fokus" }));
    await user.click(screen.getByRole("button", { name: "Zapisz checkpoint" }));
    await user.selectOptions(screen.getByLabelText("Powód zakończenia sesji"), "work_item_completed");
    await user.click(screen.getByRole("button", { name: "Zapisz i zakończ" }));

    expect(screen.getByText("Work Item ukończony")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rozpocznij kolejny Work Item" })).toBeInTheDocument();
  });

  it("promuje kopię Session Scratchpadu do Note", async () => {
    const user = userEvent.setup();
    renderApp("/focus");
    await user.click(screen.getByRole("button", { name: "Wznów fokus" }));
    const scratchpad = screen.getByLabelText(/Session scratchpad/);
    await user.clear(scratchpad);
    await user.type(scratchpad, "Hipoteza: indeks złożony przyspieszy endpoint");
    await user.click(screen.getByRole("button", { name: "Promuj fragment" }));
    const dialog = screen.getByRole("dialog", { name: "Promuj fragment scratchpadu" });
    await user.type(within(dialog).getByLabelText("Tytuł"), "Hipoteza indeksu");
    await user.click(within(dialog).getByRole("button", { name: "Promuj kopię" }));
    await user.click(screen.getByRole("link", { name: "Wiedza" }));
    expect(screen.getByText("Hipoteza indeksu")).toBeInTheDocument();
  });

  it("zapisuje opcjonalny kontekst techniczny i poprawia checkpoint przed wznowieniem", async () => {
    const user = userEvent.setup();
    renderApp("/focus");
    await user.click(screen.getByRole("button", { name: "Wznów fokus" }));
    await user.click(screen.getByRole("button", { name: "Zapisz checkpoint" }));
    await user.type(screen.getByLabelText("Aktualny stan"), "Repozytorium działa");
    await user.type(screen.getByLabelText("Następna fizyczna akcja"), "Dodać test błędu");
    await user.click(screen.getByText("Opcjonalny kontekst techniczny"));
    await user.type(screen.getByLabelText("Branch"), "feat/repository");
    await user.type(screen.getByLabelText("Plik"), "src/repository.ts");
    await user.type(screen.getByLabelText("URL"), "https://example.com/spec");
    await user.type(screen.getByLabelText("Blocker"), "Brak fixture");
    await user.type(screen.getByLabelText("Notatka"), "Sprawdź rollback");
    await user.click(screen.getByRole("button", { name: "Zapisz i zakończ" }));
    const editedState = screen.getByLabelText("Edytuj aktualny stan");
    await user.clear(editedState);
    await user.type(editedState, "Repozytorium i rollback działają");
    await user.clear(screen.getByLabelText("Edytuj następną akcję"));
    await user.type(screen.getByLabelText("Edytuj następną akcję"), "Dodać test integracyjny");
    await user.click(screen.getByRole("button", { name: "Zapisz korektę" }));
    expect(editedState).toHaveValue("Repozytorium i rollback działają");
  });

  it("tworzy Learning Goal i udostępnia go podczas checkpointu", async () => {
    const user = userEvent.setup();
    renderApp("/learning");
    await user.click(screen.getByRole("button", { name: "Nowy cel nauki" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Mierzalny rezultat nauki"), "Projektuj polityki RLS");
    await user.type(within(dialog).getByLabelText("Kryterium demonstracji"), "Obroń izolację dwóch Workspace");
    await user.type(within(dialog).getByLabelText("Rozwijany Skill"), "PostgreSQL Security");
    await user.click(within(dialog).getByRole("button", { name: "Utwórz cel" }));
    await user.click(screen.getAllByRole("link", { name: "Dzisiaj" })[0]!);
    await user.click(screen.getByRole("button", { name: "Rozpocznij fokus" }));
    await user.click(screen.getByRole("button", { name: "Zapisz checkpoint" }));
    expect(screen.getByRole("option", { name: "Projektuj polityki RLS" })).toBeInTheDocument();
  });

  it("osiąga Learning Goal na podstawie zaakceptowanego dowodu", async () => {
    const user = userEvent.setup();
    renderApp("/learning");
    await user.click(screen.getByRole("button", { name: "Oznacz jako osiągnięty" }));
    expect(screen.getByText("Cel osiągnięty")).toBeInTheDocument();
  });

  it("porzuca Learning Goal dopiero po zapisaniu powodu", async () => {
    const user = userEvent.setup();
    renderApp("/learning");
    await user.click(screen.getByRole("button", { name: "Porzuć" }));
    const dialog = screen.getByRole("alertdialog", { name: "Porzucić Learning Goal?" });
    await user.type(within(dialog).getByLabelText("Powód porzucenia"), "Cel zastąpiła praktyczna demonstracja");
    await user.click(within(dialog).getByRole("button", { name: "Porzuć cel" }));
    expect(screen.getByText("Cel porzucony")).toBeInTheDocument();
  });

  it("pokazuje bezpieczne puste stany i obsługuje brak projektu", () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    renderApp("/projects/brak");
    expect(screen.getByRole("heading", { name: "Nie znaleziono projektu" })).toBeInTheDocument();
  });

  it("prowadzi z pustej Nauki do wyboru pierwszego Work Itemu", async () => {
    localStorage.setItem("command-center-state-v1", JSON.stringify(emptyState));
    const user = userEvent.setup();
    renderApp("/learning");
    expect(screen.getByRole("heading", { name: "Brak ocenionych prób" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wybierz Work Item" }));
    expect(await screen.findByRole("heading", { name: "Projekty" })).toBeInTheDocument();
  });

  it("eksportuje dane demo do wersjonowanego pliku JSON", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderApp();
    await user.click(screen.getByRole("button", { name: "Eksportuj dane" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
  });
});
