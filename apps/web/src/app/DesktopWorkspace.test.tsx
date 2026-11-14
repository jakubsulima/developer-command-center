import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import type { AppState } from "../domain/types";
import { App } from "./App";
import { StoreProvider } from "./store";

configure({ asyncUtilTimeout: 5000 });
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.stubGlobal("indexedDB", undefined);
  setDesktop(true);
  const state: AppState = structuredClone(emptyState);
  state.areas = ["one", "two"].map((id) => ({ id, name: `Projekt ${id}`, description: "Kontekst pracy", visibility: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" }));
  state.goals = [
    { id: "current-goal", areaId: "one", title: "Bieżący rezultat", outcome: "Działający wynik", kind: "project", status: "active", visibility: "active", priority: "normal", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    { id: "old-goal", areaId: "one", title: "Dawny rezultat", outcome: "Gotowe", kind: "project", status: "achieved", visibility: "active", priority: "normal", createdAt: "2026-01-01", updatedAt: "2026-01-01" }
  ];
  state.actions = [
    { id: "step", areaId: "one", goalId: "current-goal", version: 1, title: "Bieżący krok", detail: "Opis kroku", status: "ready", position: 0, isNext: true, pinnedToToday: false, checklist: [] },
    { id: "done", areaId: "one", version: 1, title: "Historyczny krok", detail: "", status: "completed", position: 1, isNext: false, pinnedToToday: false, checklist: [] },
    { id: "other", areaId: "two", version: 1, title: "Inny Projekt", detail: "", status: "ready", position: 2, isNext: false, pinnedToToday: false, checklist: [] }
  ];
  state.knowledge = [
    { id: "note", type: "note", title: "Notatka Projektu", detail: "Pełna treść notatki.\n".repeat(50), sourceUrl: "javascript:alert(1)", createdAt: "2026-01-02", version: 1 },
    { id: "book", type: "resource", resourceFormat: "book", title: "Książka źródłowa", detail: "Opis książki", resourceAuthor: "Autor", readingStatus: "reading", sourceUrl: "https://example.com/book", createdAt: "2026-01-01", version: 1 },
    { id: "unrelated", type: "note", title: "Wiedza innego Projektu", detail: "Inny kontekst", createdAt: "2026-01-01" }
  ];
  state.knowledgeLinks = [
    { id: "note-project", knowledgeItemId: "note", areaId: "one", meaning: "reference", createdAt: "2026-01-01" },
    { id: "note-book", knowledgeItemId: "note", targetKnowledgeItemId: "book", meaning: "source", createdAt: "2026-01-01" },
    { id: "unrelated-project", knowledgeItemId: "unrelated", areaId: "two", meaning: "reference", createdAt: "2026-01-01" }
  ];
  state.inbox = [
    { id: "capture-one", kind: "text", status: "unprocessed", content: "Pierwsza myśl do przetworzenia", createdAt: "2026-11-13T10:00:00Z" },
    { id: "capture-two", kind: "text", status: "unprocessed", content: "Druga myśl do przetworzenia", createdAt: "2026-11-13T09:00:00Z" }
  ];
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
});

function setDesktop(enabled: boolean) {
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
    matches: enabled && ["(min-width: 1200px)", "(min-width: 1440px)"].includes(media), media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn()
  })));
}

function renderWorkspace(path: string) {
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="address">{location.pathname}{location.search}</output>;
  }
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DemoAuthProvider><StoreProvider><App /><LocationProbe /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

it("łączy bieżące Działania, Grupy działań i Wiedzę w Przeglądzie właściwego Projektu", async () => {
  const user = userEvent.setup();
  renderWorkspace("/projects/one");
  const actions = await screen.findByRole("region", { name: /Działania Projektu/ });
  expect(within(actions).getByRole("link", { name: "Bieżący krok" })).toBeInTheDocument();
  expect(within(actions).queryByText("Historyczny krok")).not.toBeInTheDocument();
  expect(within(actions).queryByText("Inny Projekt")).not.toBeInTheDocument();
  const context = screen.getByRole("complementary", { name: "Kontekst Projektu" });
  expect(within(context).getByRole("link", { name: /Bieżący rezultat/ })).toBeInTheDocument();
  expect(within(context).queryByText("Dawny rezultat")).not.toBeInTheDocument();
  expect(await within(context).findByRole("link", { name: /Notatka Projektu/ })).toBeInTheDocument();
  expect(within(context).queryByText("Wiedza innego Projektu")).not.toBeInTheDocument();
  await user.click(within(actions).getByRole("button", { name: "Wszystkie Działania" }));
  expect(within(screen.getByRole("navigation", { name: "Zawartość Projektu" })).getByRole("button", { name: /Działania/ })).toHaveAttribute("aria-current", "page");
});

it("zmienia status z Przeglądu przez istniejącą komendę i pozwala cofnąć zmianę", async () => {
  const user = userEvent.setup();
  renderWorkspace("/projects/one");
  const actions = await screen.findByRole("region", { name: /Działania Projektu/ });
  await user.click(within(actions).getByRole("button", { name: "Zmień status: Do zrobienia — Bieżący krok" }));
  await user.click(within(screen.getByRole("dialog", { name: "Zmień status Działania" })).getByRole("button", { name: /W toku/ }));
  expect(await within(actions).findByRole("button", { name: "Zmień status: W toku — Bieżący krok" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cofnij" }));
  expect(await within(actions).findByRole("button", { name: "Zmień status: Do zrobienia — Bieżący krok" })).toBeInTheDocument();
});

it("filtruje pełną listę Działań w Przeglądzie i zachowuje filtr po przejściu do sekcji", async () => {
  const user = userEvent.setup();
  renderWorkspace("/projects/one?other=keep");
  const actions = await screen.findByRole("region", { name: /Działania Projektu/ });
  await user.selectOptions(within(actions).getByLabelText("Filtr Działań"), "history");
  expect(within(actions).getByRole("link", { name: "Historyczny krok" })).toBeInTheDocument();
  expect(within(actions).queryByRole("link", { name: "Bieżący krok" })).not.toBeInTheDocument();
  expect(screen.getByTestId("address")).toHaveTextContent("other=keep&actions=history");
  await user.click(within(actions).getByRole("button", { name: "Wszystkie Działania" }));
  expect(screen.getByRole("region", { name: "Działania" })).toHaveTextContent("Historyczny krok");
  expect(screen.getByTestId("address")).toHaveTextContent("actions=history&view=actions");
});

it("menu Projektu otwiera właściwy formularz, zapisuje opis i przywraca fokus", async () => {
  const user = userEvent.setup();
  renderWorkspace("/projects/one");
  const trigger = await screen.findByRole("button", { name: "Dodaj w Projekcie Projekt one" });
  await user.click(trigger);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("menuitem", { name: "Działanie" }));
  const dialog = await screen.findByRole("dialog", { name: "Nowe Działanie" });
  await user.type(within(dialog).getByLabelText("Co chcesz zrobić?"), "Nowy krok Projektu");
  await user.type(within(dialog).getByLabelText("Opis"), "Opis bez rozwijania");
  await user.click(within(dialog).getByRole("button", { name: "Dodaj Działanie" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
  const actions = screen.getByRole("region", { name: /Działania Projektu/ });
  expect(within(actions).getByRole("link", { name: "Nowy krok Projektu" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Kontekst Projektu" })).toHaveTextContent("Bieżący rezultat");
});

it("pokazuje pełną treść Wiedzy w podglądzie, zachowuje filtry i przywraca fokus po Escape", async () => {
  const user = userEvent.setup();
  renderWorkspace("/knowledge?kind=note&area=one&other=keep");
  const title = await screen.findByRole("link", { name: "Notatka Projektu" });
  await user.click(title);
  const preview = await screen.findByRole("complementary", { name: "Notatka Projektu" });
  expect(within(preview).getByRole("heading", { name: "Notatka Projektu" })).toHaveFocus();
  expect(within(preview).getByRole("region", { name: "Treść Wiedzy" }).textContent).toContain("Pełna treść notatki.\n".repeat(50));
  expect(within(preview).getByRole("link", { name: /Źródło: Książka źródłowa/ })).toBeInTheDocument();
  expect(within(preview).queryByRole("link", { name: "Otwórz źródło" })).not.toBeInTheDocument();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge?kind=note&area=one&other=keep&preview=note");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("complementary", { name: "Notatka Projektu" })).not.toBeInTheDocument();
  expect(title).toHaveFocus();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge?kind=note&area=one&other=keep");
});

it("wraca z pełnego widoku Wiedzy do wybranego podglądu i filtrów", async () => {
  const user = userEvent.setup();
  renderWorkspace("/knowledge?kind=note&area=one");
  await user.click(await screen.findByRole("link", { name: "Notatka Projektu" }));
  const preview = await screen.findByRole("complementary", { name: "Notatka Projektu" });
  await user.click(within(preview).getByRole("link", { name: "Otwórz pełny widok" }));
  const breadcrumb = await screen.findByRole("navigation", { name: "Ścieżka kontekstu" });
  await user.click(within(breadcrumb).getByRole("link", { name: "Wiedza" }));
  expect(await screen.findByRole("complementary", { name: "Notatka Projektu" })).toBeInTheDocument();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge?kind=note&area=one&preview=note");
});

it("na mobile zachowuje samodzielny ekran Wiedzy", async () => {
  setDesktop(false);
  const user = userEvent.setup();
  renderWorkspace("/knowledge");
  await user.click(await screen.findByRole("link", { name: "Notatka Projektu" }));
  expect(await screen.findByRole("navigation", { name: "Ścieżka kontekstu" })).toBeInTheDocument();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge/note");
  expect(screen.queryByRole("complementary", { name: "Notatka Projektu" })).not.toBeInTheDocument();
});

it("zamyka podgląd wpisu wykluczonego przez filtry i pokazuje metadane książki", async () => {
  const user = userEvent.setup();
  renderWorkspace("/knowledge?preview=note");
  await screen.findByRole("complementary", { name: "Notatka Projektu" });
  await user.click(screen.getByRole("button", { name: "Książki" }));
  await waitFor(() => expect(screen.queryByRole("complementary", { name: "Notatka Projektu" })).not.toBeInTheDocument());
  await user.click(await screen.findByRole("link", { name: "Książka źródłowa" }));
  const preview = await screen.findByRole("complementary", { name: "Książka źródłowa" });
  expect(within(preview).getByText(/Autor/)).toBeInTheDocument();
  expect(within(preview).getByRole("link", { name: "Otwórz źródło" })).toHaveAttribute("href", "https://example.com/book");
  expect(within(preview).getByRole("link", { name: "Otwórz źródło" })).toHaveAttribute("rel", "noopener noreferrer");
});

it("na mobile pozostawia Przegląd bez dodatkowych sekcji desktopowych", async () => {
  setDesktop(false);
  renderWorkspace("/projects/one");
  await screen.findByRole("region", { name: "Co jest teraz najważniejsze" });
  expect(screen.queryByRole("region", { name: /Działania Projektu/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("complementary", { name: "Kontekst Projektu" })).not.toBeInTheDocument();
});

it("przetwarza wpis w bocznym panelu, zachowuje oryginał i tworzy rzeczywiste Działanie", async () => {
  const user = userEvent.setup();
  renderWorkspace("/knowledge?section=inbox");
  await user.click(await screen.findByRole("link", { name: "Pierwsza myśl do przetworzenia" }));
  const processing = screen.getByRole("complementary", { name: "Przetwarzanie wpisu" });
  await user.click(within(processing).getByRole("button", { name: /^Dodaj Działanie/ }));
  const title = within(processing).getByLabelText("Jakie Działanie wykonać?");
  await user.clear(title); await user.type(title, "Nowy krok ze Skrzynki");
  await user.click(within(processing).getByRole("button", { name: "Zapisz" }));
  expect(await within(processing).findByRole("status")).toHaveTextContent("Zapisano.");
  expect(screen.getByRole("link", { name: "Druga myśl do przetworzenia" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: "Przetworzone" }));
  expect(await screen.findByRole("link", { name: "Pierwsza myśl do przetworzenia" })).toBeInTheDocument();
  await user.click(within(screen.getByRole("navigation", { name: "Główna nawigacja" })).getByRole("link", { name: "Działania" }));
  expect(await screen.findByRole("link", { name: "Nowy krok ze Skrzynki" })).toBeInTheDocument();
});

it("otwiera Grupa działań klawiaturą i wraca do pełnej listy z jej filtrami", async () => {
  const user = userEvent.setup();
  renderWorkspace("/goals?status=all&kind=project&other=keep");
  const goal = await screen.findByRole("link", { name: "Otwórz grupę: Bieżący rezultat" });
  expect(screen.getByRole("link", { name: "Otwórz grupę: Dawny rezultat" })).toBeInTheDocument();
  goal.focus();
  expect(goal.tabIndex).toBe(0);
  await user.keyboard("{Enter}");
  expect(await screen.findByRole("heading", { name: "Bieżący rezultat", level: 1 })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Wszystkie grupy" }));
  await screen.findByRole("link", { name: "Otwórz grupę: Bieżący rezultat" });
  await waitFor(() => expect(screen.getByRole("link", { name: "Otwórz grupę: Bieżący rezultat" })).toHaveFocus());
  expect(screen.getByTestId("address")).toHaveTextContent("/goals?status=all&kind=project&other=keep");
  await user.selectOptions(screen.getByRole("combobox", { name: "Rodzaj zadania" }), "learning");
  expect(await screen.findByText("Nie ma tu jeszcze grup działań")).toBeInTheDocument();
  await user.click(screen.getAllByRole("button", { name: "Wyczyść filtry" })[0]!);
  expect(await screen.findByRole("link", { name: "Otwórz grupę: Bieżący rezultat" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Otwórz grupę: Dawny rezultat" })).not.toBeInTheDocument();
});

it("przywraca Grupa działań bez Projektu z archiwum do aktywnej listy", async () => {
  const state = JSON.parse(localStorage.getItem("command-center-state-v1")!) as AppState;
  state.goals.push({ id: "archived-goal", title: "Wznawiany rezultat", outcome: "Wynik", kind: "custom", status: "active", visibility: "archived", priority: "normal" });
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
  const user = userEvent.setup();
  renderWorkspace("/goals?status=archived");
  await user.click(await screen.findByRole("button", { name: "Przywróć" }));
  expect(await screen.findByText("Nie ma tu jeszcze grup działań")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Aktywny" }));
  const restored = await screen.findByRole("link", { name: "Otwórz grupę: Wznawiany rezultat" });
  expect(within(restored).getByText("Bez Projektu")).toBeInTheDocument();
  expect(within(restored).getByText("Brak następnego Działania")).toBeInTheDocument();
});

function seedProjectCategories() {
  const state = JSON.parse(localStorage.getItem("command-center-state-v1")!) as AppState;
  state.projectCategories = [{ id: "work", name: "Praca", color: "#60a5fa" }, { id: "learning", name: "Nauka", color: "#a78bfa" }];
  state.areas[0]!.categoryIds = ["work", "learning"];
  state.areas[1]!.categoryIds = ["learning"];
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
}

it("filtruje i grupuje Projekty z bezpośredniego paska desktopowego", async () => {
  seedProjectCategories();
  const user = userEvent.setup();
  renderWorkspace("/projects");
  const filter = await screen.findByRole("combobox", { name: "Filtruj po kategorii" });
  expect(screen.queryByLabelText("Więcej opcji widoku")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Otwórz projekt Projekt one" })).toHaveLength(2);
  await user.selectOptions(filter, "work");
  expect(screen.getAllByRole("link", { name: "Otwórz projekt Projekt one" })).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Otwórz projekt Projekt two" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Grupuj kategoriami" }));
  expect(screen.getByRole("button", { name: "Grupuj kategoriami" })).toHaveAttribute("aria-pressed", "false");
  await user.selectOptions(filter, "");
  expect(screen.getAllByRole("link", { name: /Otwórz projekt Projekt/ })).toHaveLength(2);
  await user.click(screen.getByRole("link", { name: "Otwórz projekt Projekt one" }));
  expect(await screen.findByRole("heading", { name: "Projekt one", level: 1 })).toBeInTheDocument();
});

it("odświeża desktopowy filtr po usunięciu wybranej kategorii", async () => {
  seedProjectCategories();
  const user = userEvent.setup();
  renderWorkspace("/projects");
  await user.selectOptions(await screen.findByRole("combobox", { name: "Filtruj po kategorii" }), "work");
  await user.click(screen.getByRole("button", { name: "Zarządzaj kategoriami" }));
  const manager = await screen.findByRole("dialog", { name: "Kategorie projektów" });
  await user.click(within(manager).getByRole("button", { name: "Usuń kategorię Praca" }));
  await waitFor(() => expect(within(manager).queryByRole("button", { name: "Usuń kategorię Praca" })).not.toBeInTheDocument());
  await user.click(within(manager).getByRole("button", { name: "Zamknij" }));
  expect(screen.getByRole("combobox", { name: "Filtruj po kategorii" })).toHaveValue("");
  expect(screen.getByRole("link", { name: "Otwórz projekt Projekt two" })).toBeInTheDocument();
});

it("przywraca Projekt z desktopowego Archiwum", async () => {
  const state = JSON.parse(localStorage.getItem("command-center-state-v1")!) as AppState;
  state.areas[1]!.visibility = "archived";
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
  const user = userEvent.setup();
  renderWorkspace("/projects");
  await user.click(await screen.findByRole("button", { name: "Archiwum" }));
  expect(screen.getByRole("heading", { name: "Projekt two" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Projekt one" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Przywróć Projekt" }));
  await user.click(screen.getByRole("button", { name: "Aktywne" }));
  expect(await screen.findByRole("link", { name: "Otwórz projekt Projekt two" })).toBeInTheDocument();
});

it("na mobile zachowuje opcje Projektów w dotychczasowym menu", async () => {
  setDesktop(false);
  const user = userEvent.setup();
  renderWorkspace("/projects");
  await user.click(await screen.findByLabelText("Więcej opcji widoku"));
  expect(screen.queryByRole("group", { name: "Widok Projektów" })).not.toBeInTheDocument();
  const options = screen.getByRole("menu", { name: "Opcje widoku projektów" });
  await user.click(within(options).getByRole("menuitemradio", { name: "Archiwum" }));
  expect(await screen.findByText("Brak projektów pasujących do tego widoku.")).toBeInTheDocument();
});
