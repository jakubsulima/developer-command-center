import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, configure, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyState } from "../data/empty";
import type { AppState, InboxItem } from "../domain/types";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { KnowledgeInbox } from "./InboxPage";

const mocks = vi.hoisted(() => ({ store: vi.fn(), triage: vi.fn(), status: vi.fn(), release: vi.fn(), proposal: vi.fn(), notifyUndo: vi.fn() }));
vi.mock("../app/useStore", () => ({ useStore: mocks.store }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "user" }, mode: "demo" }) }));
vi.mock("../hooks/useWorkspaceInfinitePage", () => ({ useWorkspaceInfinitePage: () => ({ data: { items: [] }, isPending: false, isError: false, hasNextPage: false }), mergePagedItems: (items: InboxItem[]) => items }));
vi.mock("../components/action-feedback-context", async (original) => ({ ...await original<typeof import("../components/action-feedback-context")>(), useActionFeedback: () => ({ notifyUndo: mocks.notifyUndo }) }));

configure({ asyncUtilTimeout: 5000 });
let fixture: AppState;
let desktop: boolean;
const mediaListeners = new Set<() => void>();
beforeEach(() => {
  desktop = true;
  mediaListeners.clear();
  vi.stubGlobal("matchMedia", vi.fn((media: string) => ({
    matches: media === "(min-width: 1200px)" && desktop, media, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    addEventListener: (_event: string, listener: () => void) => { if (media === "(min-width: 1200px)") mediaListeners.add(listener); },
    removeEventListener: (_event: string, listener: () => void) => { mediaListeners.delete(listener); }
  })));
  mocks.triage.mockReset().mockResolvedValue(undefined);
  mocks.status.mockReset().mockResolvedValue(undefined);
  mocks.release.mockReset();
  mocks.notifyUndo.mockReset();
  fixture = { ...structuredClone(emptyState), workspaceId: "workspace", inbox: [
    { id: "a", content: "Pierwsza myśl", kind: "text", status: "unprocessed", createdAt: "2026-11-13T10:00:00Z" },
    { id: "b", content: "Druga myśl", kind: "text", status: "unprocessed", createdAt: "2026-11-13T09:00:00Z" },
    { id: "old", content: "Historyczny wpis", kind: "text", status: "resolved", createdAt: "2026-11-12T09:00:00Z" }
  ] };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Harness() {
  const [state, setState] = useState(fixture);
  const location = useLocation();
  mocks.store.mockReturnValue({ state, mode: "demo", loading: false, releaseDueInbox: mocks.release, requestInboxTriageProposal: mocks.proposal,
    triageInboxIntent: async (id: string, input: unknown) => {
      await mocks.triage(id, input);
      setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === id ? { ...item, status: "resolved" } : item) }));
    },
    setInboxStatus: async (id: string, status: InboxItem["status"]) => {
      await mocks.status(id, status);
      setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === id ? { ...item, status } : item) }));
    }
  });
  return <><KnowledgeInbox /><output data-testid="address">{location.pathname}{location.search}</output></>;
}
function start(path = "/knowledge?section=inbox&other=keep") {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}><Harness /></MemoryRouter></QueryClientProvider>);
}
const panel = () => screen.getByRole("complementary", { name: "Przetwarzanie wpisu" });
const row = (id: string) => document.querySelector<HTMLElement>(`[data-inbox-id="${id}"]`)!;
async function openNote(user: ReturnType<typeof userEvent.setup>, id = "a") {
  await user.click(within(row(id)).getByRole("button", { name: "Uporządkuj" }));
  await user.click(within(panel()).getByRole("button", { name: "Zapisz notatkę" }));
  return within(panel()).getByLabelText("Treść notatki");
}

it("pozostawia listę obok edytora i zachowuje parametry widoku", async () => {
  const user = userEvent.setup();
  start();
  expect(within(panel()).getByText("Wybierz wpis ze Skrzynki")).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Pierwsza myśl" }));
  expect(within(panel()).getByRole("heading", { name: "Co chcesz z tym zrobić?" })).toHaveFocus();
  expect(screen.getByRole("link", { name: "Druga myśl" })).toBeInTheDocument();
  expect(row("a")).toHaveAttribute("data-selected", "true");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge?section=inbox&other=keep&item=a&organize=true");
});

it("rozdziela szkice wpisów i przywraca treść oraz intencję po przełączeniu", async () => {
  const user = userEvent.setup();
  start();
  const first = await openNote(user);
  await user.clear(first); await user.type(first, "Moje opracowanie A");
  await user.click(screen.getByRole("link", { name: "Druga myśl" }));
  expect(within(panel()).queryByLabelText("Treść notatki")).not.toBeInTheDocument();
  const second = await openNote(user, "b");
  expect(second).toHaveValue("Druga myśl");
  await user.clear(second); await user.type(second, "Moje opracowanie B");
  await user.click(screen.getByRole("link", { name: "Pierwsza myśl" }));
  expect(await within(panel()).findByLabelText("Treść notatki")).toHaveValue("Moje opracowanie A");
  const savedB = JSON.parse(localStorage.getItem(draftStorageKey("user", "workspace", "inbox-knowledge-note", "b"))!);
  expect(savedB.value.detail).toBe("Moje opracowanie B");
});

it("zapisuje szkic przy Escape i oddaje fokus do wybranego wpisu", async () => {
  const user = userEvent.setup();
  start();
  await user.click(screen.getByRole("link", { name: "Pierwsza myśl" }));
  const title = screen.getByRole("link", { name: "Pierwsza myśl" });
  await user.click(within(panel()).getByRole("button", { name: "Zapisz notatkę" }));
  const content = within(panel()).getByLabelText("Treść notatki");
  await user.clear(content); await user.type(content, "Szkic do wznowienia");
  await user.keyboard("{Escape}");
  expect(within(panel()).getByText("Wybierz wpis ze Skrzynki")).toBeInTheDocument();
  expect(title).toHaveFocus();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge?section=inbox&other=keep");
  await user.click(title);
  expect(await within(panel()).findByLabelText("Treść notatki")).toHaveValue("Szkic do wznowienia");
});

it("blokuje przełączenie, gdy zapis szkicu na urządzeniu nie działa", async () => {
  const user = userEvent.setup();
  start();
  const content = await openNote(user);
  await user.clear(content); await user.type(content, "Niezapisana treść");
  const original = Storage.prototype.setItem;
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.includes("inbox-knowledge-note")) throw new DOMException("Quota", "QuotaExceededError");
    return original.call(this, key, value);
  });
  await user.click(screen.getByRole("link", { name: "Druga myśl" }));
  expect(within(panel()).getByLabelText("Treść notatki")).toHaveValue("Niezapisana treść");
  expect((await within(panel()).findAllByRole("alert")).some((alert) => alert.textContent?.includes("Nie udało się zapisać szkicu"))).toBe(true);
  expect(screen.getByTestId("address")).toHaveTextContent("item=a");
  storage.mockRestore();
  await user.click(screen.getByRole("link", { name: "Druga myśl" }));
  expect(screen.getByTestId("address")).toHaveTextContent("item=b");
});

it("blokuje zmianę wpisu podczas zapisu, a po sukcesie proponuje następny wpis", async () => {
  let finishSave!: () => void;
  mocks.triage.mockImplementation(() => new Promise<void>((resolve) => { finishSave = resolve; }));
  const user = userEvent.setup();
  start();
  await openNote(user);
  await user.click(within(panel()).getByRole("button", { name: "Zapisz notatkę" }));
  expect(mocks.triage).toHaveBeenCalledTimes(1);
  expect(within(row("b")).getByRole("button", { name: "Uporządkuj" })).toBeDisabled();
  expect(within(panel()).getByRole("button", { name: "Zamknij przetwarzanie wpisu" })).toBeDisabled();
  await user.click(screen.getByRole("link", { name: "Druga myśl" }));
  expect(screen.getByTestId("address")).toHaveTextContent("item=a");
  await act(async () => finishSave());
  expect(await within(panel()).findByRole("status")).toHaveTextContent("Zapisano.");
  expect(document.querySelector('[data-inbox-id="a"]')).not.toBeInTheDocument();
  await user.click(within(panel()).getByRole("button", { name: "Następny wpis" }));
  expect(screen.getByTestId("address")).toHaveTextContent("item=b");
  expect(within(panel()).getByRole("heading", { name: "Co chcesz z tym zrobić?" })).toBeInTheDocument();
});

it("po błędzie zachowuje edytowaną treść i ponawia zapis właściwego wpisu", async () => {
  mocks.triage.mockRejectedValueOnce(new Error("Błąd połączenia"));
  const user = userEvent.setup();
  start();
  const content = await openNote(user);
  await user.clear(content); await user.type(content, "Treść do ponowienia");
  await user.click(within(panel()).getByRole("button", { name: "Zapisz notatkę" }));
  expect(await within(panel()).findByRole("alert")).toHaveTextContent("Błąd połączenia");
  expect(within(panel()).getByLabelText("Treść notatki")).toHaveValue("Treść do ponowienia");
  await user.click(within(panel()).getByRole("button", { name: "Zapisz notatkę" }));
  expect(await within(panel()).findByRole("status")).toHaveTextContent("Zapisano.");
  expect(mocks.triage).toHaveBeenCalledTimes(2);
  expect(mocks.triage.mock.calls.every(([id, input]) => id === "a" && input.detail === "Treść do ponowienia")).toBe(true);
});

it("bezpiecznie zmienia widoki, pokazuje historię i przywraca jej wpis", async () => {
  const user = userEvent.setup();
  start();
  const content = await openNote(user);
  await user.clear(content); await user.type(content, "Szkic przed filtrowaniem");
  await user.click(screen.getByRole("tab", { name: "Przetworzone" }));
  await user.click(screen.getByRole("link", { name: "Historyczny wpis" }));
  expect(within(panel()).getByText("Wpis jest w widoku: Przetworzone.")).toBeInTheDocument();
  expect(within(panel()).queryByRole("button", { name: "Zapisz notatkę" })).not.toBeInTheDocument();
  await user.click(within(row("old")).getByRole("button", { name: "Przywróć teraz" }));
  await user.click(screen.getByRole("tab", { name: "Nowe" }));
  expect(screen.getByRole("link", { name: "Historyczny wpis" })).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Pierwsza myśl" }));
  expect(await within(panel()).findByLabelText("Treść notatki")).toHaveValue("Szkic przed filtrowaniem");
});

it("ponawia odłożenie wpisu bez zamykania szkicu innego wpisu", async () => {
  let finishStatus!: () => void;
  mocks.status.mockRejectedValueOnce(new Error("Brak połączenia"))
    .mockImplementationOnce(() => new Promise<void>((resolve) => { finishStatus = resolve; }));
  const user = userEvent.setup();
  start();
  await user.click(within(row("a")).getByRole("button", { name: "Odłóż do jutra" }));
  await within(row("a")).findByRole("alert");
  const content = await openNote(user, "b");
  await user.clear(content); await user.type(content, "Opracowanie drugiego wpisu");
  await user.click(within(row("a")).getByRole("button", { name: "Spróbuj ponownie" }));
  expect(within(panel()).getByRole("button", { name: "Zapisz notatkę" })).toBeDisabled();
  expect(screen.getByRole("tab", { name: "Przetworzone" })).toBeDisabled();
  await act(async () => finishStatus());
  expect(within(panel()).getByLabelText("Treść notatki")).toHaveValue("Opracowanie drugiego wpisu");
  expect(screen.getByTestId("address")).toHaveTextContent("item=b");
  expect(document.querySelector('[data-inbox-id="a"]')).not.toBeInTheDocument();
  const savedB = JSON.parse(localStorage.getItem(draftStorageKey("user", "workspace", "inbox-knowledge-note", "b"))!);
  expect(savedB.value.detail).toBe("Opracowanie drugiego wpisu");
});

it("zachowuje formularz po zmianie szerokości z desktopu na mobile i z powrotem", async () => {
  const user = userEvent.setup();
  start();
  const content = await openNote(user);
  await user.clear(content); await user.type(content, "Treść na obu ekranach");
  await act(async () => { desktop = false; mediaListeners.forEach((listener) => listener()); });
  const dialog = screen.getByRole("dialog", { name: "Zapisz w Bibliotece" });
  expect(within(dialog).getByLabelText("Treść notatki")).toHaveValue("Treść na obu ekranach");
  expect(screen.queryByRole("complementary", { name: "Przetwarzanie wpisu" })).not.toBeInTheDocument();
  await act(async () => { desktop = true; mediaListeners.forEach((listener) => listener()); });
  expect(within(panel()).getByLabelText("Treść notatki")).toHaveValue("Treść na obu ekranach");
});

it("na mobile pozostawia dotychczasowy dialog bez zmiany adresu przy otwieraniu", async () => {
  desktop = false;
  const user = userEvent.setup();
  start();
  await user.click(within(row("a")).getByRole("button", { name: "Uporządkuj" }));
  expect(screen.getByRole("dialog", { name: "Co chcesz z tym zrobić?" })).toBeInTheDocument();
  expect(screen.queryByRole("complementary", { name: "Przetwarzanie wpisu" })).not.toBeInTheDocument();
  expect(screen.getByTestId("address")).toHaveTextContent("/knowledge?section=inbox&other=keep");
});

it("otwiera wskazany wpis z adresu bez resetowania wybranej intencji", async () => {
  const user = userEvent.setup();
  start("/knowledge?section=inbox&item=a&organize=true");
  await user.click(await within(panel()).findByRole("button", { name: "Zapisz notatkę" }));
  const content = within(panel()).getByLabelText("Treść notatki");
  await user.clear(content); await user.type(content, "Kontynuowana treść");
  await user.click(within(row("a")).getByRole("button", { name: "Uporządkuj" }));
  expect(within(panel()).getByLabelText("Treść notatki")).toHaveValue("Kontynuowana treść");
});
