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

it("łączy bieżące Działania, Cele i Wiedzę w Przeglądzie właściwego Projektu", async () => {
  const user = userEvent.setup();
  renderWorkspace("/projects/one");
  const actions = await screen.findByRole("region", { name: /Bieżące Działania/ });
  expect(within(actions).getByRole("link", { name: "Bieżący krok" })).toBeInTheDocument();
  expect(within(actions).queryByText("Historyczny krok")).not.toBeInTheDocument();
  expect(within(actions).queryByText("Inny Projekt")).not.toBeInTheDocument();
  const context = screen.getByRole("complementary", { name: "Kontekst Projektu" });
  expect(within(context).getByRole("link", { name: /Bieżący rezultat/ })).toBeInTheDocument();
  expect(within(context).queryByText("Dawny rezultat")).not.toBeInTheDocument();
  expect(await within(context).findByRole("link", { name: /Notatka Projektu/ })).toBeInTheDocument();
  expect(within(context).queryByText("Wiedza innego Projektu")).not.toBeInTheDocument();
  await user.click(within(actions).getByRole("button", { name: "Wszystkie Działania" }));
  expect(screen.getByRole("tab", { name: /Działania/ })).toHaveAttribute("aria-selected", "true");
});

it("zmienia status z Przeglądu przez istniejącą komendę i pozwala cofnąć zmianę", async () => {
  const user = userEvent.setup();
  renderWorkspace("/projects/one");
  const actions = await screen.findByRole("region", { name: /Bieżące Działania/ });
  await user.click(within(actions).getByRole("button", { name: "Zmień status: Do zrobienia — Bieżący krok" }));
  await user.click(within(screen.getByRole("dialog", { name: "Zmień status Działania" })).getByRole("button", { name: /W toku/ }));
  expect(await within(actions).findByRole("button", { name: "Zmień status: W toku — Bieżący krok" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cofnij" }));
  expect(await within(actions).findByRole("button", { name: "Zmień status: Do zrobienia — Bieżący krok" })).toBeInTheDocument();
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
  expect(screen.queryByRole("region", { name: /Bieżące Działania/ })).not.toBeInTheDocument();
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
