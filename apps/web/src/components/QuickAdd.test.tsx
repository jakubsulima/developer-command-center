import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { act, fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAdd } from "./QuickAdd";
import { InlineGoalAction } from "./InlineGoalAction";
import { OperationResponseError } from "../lib/operationFailure";
import { emptyDraft } from "./creationDraft";
import type { KnowledgeItem } from "../domain/types";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { localDateForTimeZone } from "../domain/activity";
import { shiftActionDate } from "../domain/actionPresentation";

const store = vi.hoisted(() => ({
  state: { workspaceId: "test", workspaceTimezone: "Europe/Warsaw", goals: [{ id: "goal", title: "Wynik", areaId: "project", visibility: "active", status: "active" }], areas: [{ id: "project", name: "Projekt testowy", visibility: "active" }], goalTemplates: [], knowledge: new Array<KnowledgeItem>(), actions: [], knowledgeLinks: [] },
  createAction: vi.fn(), createGoal: vi.fn(), createArea: vi.fn(), createRecurringAction: vi.fn(), createKnowledge: vi.fn(), capture: vi.fn(), materializeRecurring: vi.fn()
}));
vi.mock("../hooks/useWorkspaceInfinitePage", () => ({ useWorkspaceInfinitePage: () => ({ data: { items: [] }, hasNextPage: false, isError: false }) }));
vi.mock("../app/useStore", () => ({ useStore: () => store }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "tester" }, mode: "demo" }) }));
vi.mock("./action-feedback-context", () => ({ useActionFeedback: () => ({ notifySuccess: vi.fn() }) }));

const render = (ui: ReactElement) => rtlRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

async function switchType(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByText("Zmień", { exact: true }));
  await user.click(screen.getByRole("button", { name }));
}

beforeEach(() => vi.clearAllMocks());

const workspaceToday = () => localDateForTimeZone(new Date(), store.state.workspaceTimezone);

describe("Dodaj — formularze i kontekst", () => {
  it.each(["action", "goal"] as const)("%s z książki pokazuje materiał i blokuje jego odłączenie w trakcie zapisu", async (mode) => {
    const user = userEvent.setup();
    let finish!: (id: string) => void;
    const create = mode === "action" ? store.createAction : store.createGoal;
    create.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    store.state.knowledge.push({ id: "book", type: "resource", title: "Książka źródłowa", detail: "", resourceFormat: "book" });
    try {
      render(<QuickAdd open request={{ mode, materialKnowledgeIds: ["book"] }} onClose={vi.fn()} />);
      expect(screen.getByText("Książka źródłowa")).toBeVisible();
      await user.type(screen.getByLabelText(mode === "action" ? "Co chcesz zrobić?" : "Co chcesz osiągnąć?"), "Krok z książki");
      await user.click(screen.getByRole("button", { name: mode === "action" ? "Dodaj Działanie" : "Utwórz Cel" }));
      expect(screen.getByRole("button", { name: "Odłącz materiał: Książka źródłowa" })).toBeDisabled();
      expect(create.mock.calls[0][0]).toMatchObject({ materialKnowledgeIds: ["book"] });
      await act(async () => finish("created-from-book"));
    } finally { store.state.knowledge.length = 0; }
  });

  it("po odrzuceniu niedostępnego materiału pozwala go odłączyć i ponowić poprawiony zapis", async () => {
    const user = userEvent.setup();
    store.createAction.mockRejectedValueOnce(new OperationResponseError("knowledge_not_found", "P0001")).mockResolvedValueOnce("corrected");
    render(<QuickAdd open request={{ mode: "action", materialKnowledgeIds: ["missing-book"] }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Krok bez utraconej książki");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    await user.click(screen.getByRole("button", { name: "Odłącz materiał: Niedostępny materiał" }));
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction.mock.calls[1][0].materialKnowledgeIds).toEqual([]);
    expect(store.createAction.mock.calls[1][1]).not.toBe(store.createAction.mock.calls[0][1]);
  });
  it.each(["quick-add:start", "creation:start:action"])("Start otwiera Działanie, a dawną Decyzję z %s zachowuje we właściwym typie", async (kind) => {
    const user = userEvent.setup();
    const source = draftStorageKey("tester", "test", kind, "new");
    const value = { ...emptyDraft, mode: "library", libraryKind: "decision", title: "Dawny wybór", detail: "Pełne uzasadnienie", content: "Dawny wybór\nPełne uzasadnienie", knowledgeIdempotencyKey: "decision-key" };
    const raw = JSON.stringify({ version: 2, savedAt: "2026-11-03", value });
    localStorage.setItem(source, raw);
    render(<QuickAdd open request={{ mode: "action", draftKey: "start", scheduledFor: workspaceToday() }} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Nowe Działanie" })).toBeVisible();
    expect(screen.getByLabelText("Co chcesz zrobić?")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Dzisiaj" })).toBeChecked();
    const destination = draftStorageKey("tester", "test", "creation:start:library", "new");
    expect(localStorage.getItem(destination)).toBe(raw);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Nowy krok");
    await switchType(user, "Biblioteka");
    expect(screen.getByLabelText("Co zostało zdecydowane?")).toHaveValue("Dawny wybór");
    expect(screen.getByLabelText("Uzasadnienie i konsekwencje")).toHaveValue("Pełne uzasadnienie");
    expect(localStorage.getItem(destination)).toBe(raw);
  });

  it("przenosząc dawny typ zachowuje konflikt i nie tworzy kolejnych kopii po wznowieniu", async () => {
    const user = userEvent.setup();
    const source = draftStorageKey("tester", "test", "creation:start:action", "new");
    const destination = draftStorageKey("tester", "test", "creation:start:library", "new");
    const envelope = (title: string) => JSON.stringify({ version: 2, savedAt: "2026-11-03", value: { ...emptyDraft, mode: "library", libraryKind: "decision", title, content: title, detail: "Uzasadnienie", knowledgeIdempotencyKey: title } });
    const old = envelope("Dawna decyzja"), current = envelope("Nowsza decyzja");
    localStorage.setItem(source, old); localStorage.setItem(destination, current);
    const first = render(<QuickAdd open request={{ mode: "action", draftKey: "start" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Co chcesz zrobić?")).toHaveValue("");
    first.unmount();
    render(<QuickAdd open request={{ mode: "action", draftKey: "start" }} onClose={vi.fn()} />);
    const copies = Object.keys(localStorage).filter((key) => key.startsWith(`${destination}:recovery:`));
    expect(copies).toHaveLength(1);
    expect(localStorage.getItem(copies[0])).toBe(old);
    expect(localStorage.getItem(destination)).toBe(current);
    await switchType(user, "Biblioteka");
    expect(screen.getByLabelText("Co zostało zdecydowane?")).toHaveValue("Nowsza decyzja");
    expect(screen.getByText(/Dawna decyzja/)).toBeInTheDocument();
  });

  it.each([false, true])("błąd kopii podczas migracji typu zachowuje odczytany szkic, własny=%s", (hasOwn) => {
    const source = draftStorageKey("tester", "test", hasOwn ? "quick-add:start" : "creation:start:action", "new");
    const raw = JSON.stringify({ version: 2, savedAt: "2026-11-03", value: { ...emptyDraft, mode: "library", libraryKind: "decision", title: "Ocalić wybór", detail: "Całe uzasadnienie", knowledgeIdempotencyKey: "pending-copy" } });
    localStorage.setItem(source, raw);
    if (hasOwn) localStorage.setItem(draftStorageKey("tester", "test", "creation:start:action", "new"), JSON.stringify({ version: 2, savedAt: "2026-11-03", value: { ...emptyDraft, title: "Własny krok", knowledgeIdempotencyKey: "own-action" } }));
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage_failed"); });
    try {
      render(<QuickAdd open request={{ mode: "action", draftKey: "start" }} onClose={vi.fn()} />);
      if (hasOwn) expect(screen.getByLabelText("Co chcesz zrobić?")).toHaveValue("Własny krok");
      else expect(screen.getByLabelText("Co zostało zdecydowane?")).toHaveValue("Ocalić wybór");
      expect(screen.getByText(/Nie udało się rozdzielić szkiców/)).toBeVisible();
      expect(localStorage.getItem(source)).toBe(raw);
    } finally { write.mockRestore(); }
  });

  it("potwierdzenie w pustym slocie docelowym kieruje dawny szkic do odzyskiwania", () => {
    const source = draftStorageKey("tester", "test", "creation:start:action", "new");
    const destination = draftStorageKey("tester", "test", "creation:start:library", "new");
    const raw = JSON.stringify({ version: 2, savedAt: "2026-11-03", value: { ...emptyDraft, mode: "library", title: "Niewysłana notatka", detail: "Treść", knowledgeIdempotencyKey: "not-sent" } });
    localStorage.setItem(source, raw); localStorage.setItem(`${destination}:receipt`, JSON.stringify({ id: "confirmed", url: "/knowledge/confirmed", message: "Zapisano" }));
    render(<QuickAdd open request={{ mode: "action", draftKey: "start" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Co chcesz zrobić?")).toHaveValue("");
    expect(localStorage.getItem(destination)).toBeNull();
    const recovery = Object.keys(localStorage).find((key) => key.startsWith(`${destination}:recovery:`));
    expect(localStorage.getItem(recovery!)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(`${destination}:receipt`)!).id).toBe("confirmed");
  });

  it("nie przekierowuje nierozstrzygniętej operacji zapisanej wcześniej w innym typie", () => {
    const source = draftStorageKey("tester", "test", "creation:start:action", "new");
    const raw = JSON.stringify({ version: 2, savedAt: "2026-11-03", value: { ...emptyDraft, mode: "library", libraryKind: "note", detail: "Niepewny zapis", attempted: true, knowledgeIdempotencyKey: "pending-note" } });
    localStorage.setItem(source, raw);
    render(<QuickAdd open request={{ mode: "action", draftKey: "start" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Treść notatki")).toBeDisabled();
    expect(localStorage.getItem(source)).toBe(raw);
    expect(localStorage.getItem(draftStorageKey("tester", "test", "creation:start:library", "new"))).toBeNull();
  });
  it("Działanie i Notatka po zmianie typu używają niezależnych identyfikatorów operacji", async () => {
    const user = userEvent.setup();
    store.createKnowledge.mockResolvedValueOnce("saved-note");
    const first = render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Treść obu szkiców");
    await switchType(user, "Biblioteka");
    await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    const noteKey = store.createKnowledge.mock.calls[0][0].idempotencyKey;
    first.unmount();
    render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction.mock.calls[0][1]).not.toBe(noteKey);
  });

  it("powrót do istniejącego szkicu typu zachowuje jego własny identyfikator", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Szkic Działania");
    await switchType(user, "Biblioteka");
    const read = (kind: string) => JSON.parse(localStorage.getItem(draftStorageKey("tester", "test", `creation:global:${kind}`, "new"))!).value;
    const actionKey = read("action").knowledgeIdempotencyKey;
    expect(read("library").knowledgeIdempotencyKey).not.toBe(actionKey);
    await switchType(user, "Działanie");
    expect(read("action").knowledgeIdempotencyKey).toBe(actionKey);
  });

  it("po jednoznacznym odrzuceniu odblokowuje poprawę i odłączenie kontekstu również po wznowieniu", async () => {
    const user = userEvent.setup();
    store.createAction.mockRejectedValueOnce(new Error("Utworzenie Działania: goal_not_found"));
    const first = render(<QuickAdd open request={{ mode: "action", goalId: "goal" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Do poprawy");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Co chcesz zrobić?")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Odrzuć szkic" })).toBeEnabled();
    const rejectedKey = store.createAction.mock.calls[0][1];
    first.unmount();
    const goals = store.state.goals;
    store.state.goals = [];
    try {
      render(<QuickAdd open request={{ mode: "action", goalId: "goal" }} onClose={vi.fn()} />);
      expect(screen.getByLabelText("Co chcesz zrobić?")).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Odłącz niedostępne powiązanie" }));
      await user.type(screen.getByLabelText("Co chcesz zrobić?"), " bez Celu");
      await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
      expect(store.createAction.mock.calls[1][0]).toMatchObject({ title: "Do poprawy bez Celu", goalId: undefined });
      expect(store.createAction.mock.calls[1][1]).not.toBe(rejectedKey);
    } finally { store.state.goals = goals; }
  });

  it("po utracie odpowiedzi zachowuje blokadę i ponawia ten sam payload oraz identyfikator po wznowieniu", async () => {
    const user = userEvent.setup();
    store.createAction.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce("retried-action");
    const first = render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Niepewny wynik");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    await screen.findByRole("alert");
    const firstCall = store.createAction.mock.calls[0];
    first.unmount();
    render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Co chcesz zrobić?")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction.mock.calls[1]).toEqual(firstCall);
  });

  it("odrzucona Notatka zachowuje treść i pozwala zapisać poprawioną próbę z nowym kluczem", async () => {
    const user = userEvent.setup();
    store.createKnowledge.mockRejectedValueOnce(new OperationResponseError("Utworzenie elementu Wiedzy: foreign key violation", "23503")).mockResolvedValueOnce("corrected-note");
    render(<QuickAdd open request={{ mode: "library" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Treść notatki"), "Pełna treść");
    await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Zmień typ wpisu" })).toBeEnabled();
    expect(screen.getByLabelText("Treść notatki")).toBeEnabled();
    await user.type(screen.getByLabelText("Treść notatki"), " po poprawie");
    await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    const [rejected, corrected] = store.createKnowledge.mock.calls;
    expect(corrected[0].detail).toBe("Pełna treść po poprawie");
    expect(corrected[0].idempotencyKey).not.toBe(rejected[0].idempotencyKey);
  });

  it("odrzucenie późniejszego retry nie usuwa niepewności wcześniejszej utraty odpowiedzi", async () => {
    const user = userEvent.setup();
    store.createAction.mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new OperationResponseError("workspace_access_denied", "P0001"));
    render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Niepewny zapis");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Dodaj Działanie" })).toBeEnabled());
    expect(store.createAction).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Co chcesz zrobić?")).toBeDisabled();
    expect(store.createAction.mock.calls[1]).toEqual(store.createAction.mock.calls[0]);
  });

  it("błąd utrwalania szkicu przed retry nie odblokowuje niepotwierdzonej próby", async () => {
    const user = userEvent.setup();
    store.createAction.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<QuickAdd open request={{ mode: "action" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Niepewny zapis");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    await screen.findByRole("alert");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage_failed"); });
    try {
      await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
      expect(store.createAction).toHaveBeenCalledOnce();
      expect(screen.getByLabelText("Co chcesz zrobić?")).toBeDisabled();
      expect(screen.getByRole("button", { name: "Odrzuć szkic" })).toBeDisabled();
    } finally { write.mockRestore(); }
  });

  it.each([true, false])("inline po błędzie zachowuje odrzucenie=%s również po wznowieniu", async (rejected) => {
    const user = userEvent.setup();
    store.createAction.mockRejectedValueOnce(rejected ? new OperationResponseError("goal_not_found", "P0001") : new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("inline-corrected");
    const goal = { id: "goal", title: "Wynik", outcome: "Rezultat", areaId: "project", visibility: "active" as const, status: "active" as const, kind: "custom" as const, priority: "normal" as const };
    const first = render(<InlineGoalAction goal={goal} />);
    await user.type(screen.getByLabelText("Nowe Działanie"), "Krok inline");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    await screen.findByRole("alert");
    first.unmount();
    render(<InlineGoalAction goal={goal} />);
    const input = screen.getByLabelText("Nowe Działanie");
    if (rejected) { expect(input).toBeEnabled(); await user.type(input, " poprawiony"); }
    else expect(input).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    const [original, retried] = store.createAction.mock.calls;
    if (rejected) {
      expect(retried[0].title).toBe("Krok inline poprawiony");
      expect(retried[1]).not.toBe(original[1]);
    } else expect(retried).toEqual(original);
  });
  it("Dodaj dowolne zaczyna od wyboru typu bez głównego pola formularza", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Dodaj" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cel" }));
    expect(screen.getByLabelText("Co chcesz osiągnąć?")).toBeInTheDocument();
  });
  it("po ponownym otwarciu częściowej Rutyny ponawia tylko przygotowanie wystąpień", async () => {
    const user = userEvent.setup();
    store.createRecurringAction.mockResolvedValueOnce("series");
    store.materializeRecurring.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const first = render(<QuickAdd open request={{ mode: "routine", draftKey: "routines-list" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co ma się powtarzać?"), "Przegląd");
    await user.click(screen.getByText("Więcej opcji", { exact: true }));
    await user.type(screen.getByLabelText(/Checklista/), "Sprawdź plan\nZapisz decyzję");
    await user.selectOptions(screen.getByLabelText("Po dłuższej przerwie"), "carry_one");
    await user.click(screen.getByRole("button", { name: "Utwórz Rutynę" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Rutyna została zapisana");
    expect(store.createRecurringAction.mock.calls[0][0]).toMatchObject({ checklist: ["Sprawdź plan", "Zapisz decyzję"], missedPolicy: "carry_one" });
    first.unmount();
    const close = vi.fn();
    render(<QuickAdd open request={{ mode: "routine", draftKey: "routines-list" }} onClose={close} />);
    expect(screen.getByLabelText("Co ma się powtarzać?")).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Ponów przygotowanie wystąpień" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(store.createRecurringAction).toHaveBeenCalledOnce();
    expect(store.materializeRecurring).toHaveBeenCalledTimes(2);
  });

  it("po sukcesie i błędzie czyszczenia szkicu nie tworzy drugiego Projektu", async () => {
    const user = userEvent.setup();
    store.createArea.mockResolvedValueOnce("created-project");
    const first = render(<QuickAdd open request={{ mode: "project", draftKey: "projects-list" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Jaki Projekt utworzyć?"), "Potwierdzony");
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("storage_failed"); });
    await user.click(screen.getByRole("button", { name: "Utwórz Projekt" }));
    await waitFor(() => expect(screen.getByText(/Zapis się udał/)).toBeVisible());
    first.unmount();
    render(<QuickAdd open request={{ mode: "project", draftKey: "projects-list" }} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Utwórz Projekt" })).toBeDisabled();
    remove.mockRestore();
    await user.click(screen.getByRole("button", { name: "Usuń zapisany szkic" }));
    expect(store.createArea).toHaveBeenCalledOnce();
  });

  it.each([320, 390, 767, 768, 1440])("przy szerokości %s zachowuje kryteria i pierwszy krok Celu", async (width) => {
    const previous = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    try {
      const user = userEvent.setup();
      render(<QuickAdd open request={{ mode: "goal" }} onClose={vi.fn()} />);
      await user.type(screen.getByLabelText("Co chcesz osiągnąć?"), "Rezultat");
      await user.click(screen.getByText("Więcej opcji"));
      await user.selectOptions(screen.getByLabelText("Rodzaj Celu"), "learning");
      await user.type(screen.getByLabelText(/Jaki jest pierwszy krok/), "Otworzyć materiał");
      await user.type(screen.getByLabelText(/Kryteria sukcesu/), "Pokazać wynik\nOcenić próbę");
      await user.click(screen.getByRole("button", { name: "Utwórz Cel" }));
      expect(store.createGoal.mock.calls[0][0]).toMatchObject({ kind: "learning", firstActionTitle: "Otworzyć materiał", criteria: ["Pokazać wynik", "Ocenić próbę"] });
    } finally { Object.defineProperty(window, "innerWidth", { configurable: true, value: previous }); }
  });

  it("podczas wolnego zapisu blokuje Escape, tło, zmianę typu i kolejne wysłanie", async () => {
    let finish!: (id: string) => void;
    store.createAction.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const close = vi.fn();
    render(<QuickAdd open request={{ mode: "action" }} onClose={close} />);
    fireEvent.change(screen.getByLabelText("Co chcesz zrobić?"), { target: { value: "Zamrożony payload" } });
    const submit = screen.getByRole("button", { name: "Dodaj Działanie" });
    fireEvent.submit(submit.closest("form")!);
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.querySelector("[data-modal-backdrop]")!);
    fireEvent.submit(submit.closest("form")!);
    expect(screen.getByRole("button", { name: "Zmień typ wpisu" })).toBeDisabled();
    expect(close).not.toHaveBeenCalled();
    expect(store.createAction).toHaveBeenCalledOnce();
    await act(async () => finish("action-confirmed"));
    expect(close).toHaveBeenCalledOnce();
  });
  it.each([
    ["action", "Co chcesz zrobić?", "Dodaj Działanie", "createAction"],
    ["goal", "Co chcesz osiągnąć?", "Utwórz Cel", "createGoal"],
    ["project", "Jaki Projekt utworzyć?", "Utwórz Projekt", "createArea"],
    ["routine", "Co ma się powtarzać?", "Utwórz Rutynę", "createRecurringAction"],
    ["library", "Treść notatki", "Zapisz notatkę", "createKnowledge"],
    ["inbox", "Co chcesz zapamiętać lub zrobić?", "Zapisz", "capture"]
  ] as const)("zapisuje %s", async (mode, field, submit, command) => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<QuickAdd open request={{ mode, areaId: "project", pinnedToToday: false }} onClose={close} />);
    await user.type(screen.getByLabelText(field), "Nowy wpis");
    await user.click(screen.getByRole("button", { name: submit }));
    expect(store[command]).toHaveBeenCalledTimes(1);
    if (mode === "action" || mode === "goal" || mode === "routine") expect(store[command].mock.calls[0][0]).toMatchObject({ title: "Nowy wpis", areaId: "project" });
    if (mode === "project") expect(store.createArea).toHaveBeenCalledWith("Nowy wpis", undefined, undefined, [], "standard");
    if (mode === "library") expect(store.createKnowledge).toHaveBeenCalledWith(expect.objectContaining({ relations: [expect.objectContaining({ target: { areaId: "project" } })] }));
    if (mode === "inbox") expect(store.capture).toHaveBeenCalledWith("Nowy wpis", "text", expect.any(String));
    expect(close).toHaveBeenCalledOnce();
  });

  it("komenda /cel dziedziczy Projekt i zachowuje opis", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "goal" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Co chcesz zrobić?")).toBeVisible();
    expect(screen.getByLabelText("Opis")).not.toBeVisible();
    await user.click(screen.getByText("Opis i powiązania").closest("summary")!);
    await user.type(screen.getByLabelText(/Opis/), "Opis rezultatu");
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "/cel Nowy wynik");
    expect(screen.getByLabelText(/Projekt opcjonalnie/)).toHaveValue("area:project");
    await user.click(screen.getByRole("button", { name: "Utwórz Cel" }));
    expect(store.createGoal).toHaveBeenCalledWith(expect.objectContaining({ areaId: "project", title: "Nowy wynik", outcome: "Opis rezultatu" }));
  });

  it("Biblioteka pokazuje odziedziczony Cel i pozwala jawnie go odłączyć", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "goal" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Notatka");
    await switchType(user, "Biblioteka");
    expect(screen.getByRole("button", { name: "Usuń powiązanie: Wynik" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Usuń powiązanie: Wynik" }));
    await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    expect(store.createKnowledge).toHaveBeenCalledWith(expect.objectContaining({ relations: [expect.objectContaining({ target: { areaId: "project" } })] }));
  });

  it("zapisuje krótką notatkę z samej treści i wylicza tytuł", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<QuickAdd open request={{ mode: "library", draftKey: "content-only-note" }} onClose={close} />);
    await user.type(screen.getByLabelText("Treść notatki"), "  \nMyśl do zachowania\nDruga linia  ");
    await user.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    expect(store.createKnowledge).toHaveBeenCalledWith(expect.objectContaining({
      kind: "note",
      title: "Myśl do zachowania",
      detail: "Myśl do zachowania\nDruga linia",
      idempotencyKey: expect.any(String)
    }));
    expect(close).toHaveBeenCalledOnce();
  });

  it("utrzymuje otwarte i aktywne pole opisu po usunięciu ostatniego znaku", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "goal" }} onClose={vi.fn()} />);
    const disclosure = document.querySelector<HTMLDetailsElement>(".quick-add-detail-disclosure")!;
    await user.click(within(disclosure).getByText("Dodaj opis"));
    const detail = screen.getByLabelText("Rezultat");
    await user.type(detail, "Opis do skasowania");
    await user.clear(detail);

    expect(disclosure.open).toBe(true);
    expect(detail).toBeVisible();
    expect(detail).toHaveFocus();
    await user.type(detail, "Nowy opis");
    expect(detail).toHaveValue("Nowy opis");
    expect(detail).toHaveFocus();
  });

  it("otwiera odtworzony opis, pozwala go ręcznie zwinąć i zachowuje go po zmianie typu", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    const first = render(<QuickAdd open request={{ mode: "project", draftKey: "project-description" }} onClose={close} />);
    const disclosure = document.querySelector<HTMLDetailsElement>(".quick-add-detail-disclosure")!;
    await user.click(within(disclosure).getByText("Dodaj opis"));
    await user.type(screen.getByLabelText("Opis"), "Kontekst Projektu");
    await user.click(screen.getByRole("button", { name: "Zamknij okno" }));
    expect(close).toHaveBeenCalledOnce();
    first.unmount();

    render(<QuickAdd open request={{ mode: "project", draftKey: "project-description" }} onClose={vi.fn()} />);
    const restoredDisclosure = document.querySelector<HTMLDetailsElement>(".quick-add-detail-disclosure")!;
    expect(screen.getByLabelText("Opis")).toBeVisible();
    expect(screen.getByLabelText("Opis")).toHaveValue("Kontekst Projektu");
    await user.click(within(restoredDisclosure).getByText("Dodaj opis"));
    expect(screen.getByLabelText("Opis")).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Zmień typ wpisu" }));
    await user.click(screen.getByRole("button", { name: "Działanie" }));
    expect(screen.getByLabelText("Co chcesz zrobić?")).toBeInTheDocument();
    expect(screen.getByLabelText("Opis")).toHaveValue("Kontekst Projektu");
  });

  it("powrót przez Projekt zachowuje Cel, termin i niezależne przypięcie", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "goal", scheduledFor: workspaceToday(), pinnedToToday: false }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Krok");
    await switchType(user, "Projekt");
    expect(screen.getByText("Nowy samodzielny Projekt")).toBeInTheDocument();
    await switchType(user, "Działanie");
    await user.click(screen.getByText("Opis i powiązania"));
    expect(screen.getByLabelText("Cel lub Projekt")).toHaveValue("goal:goal");
    expect(screen.getByRole("radio", { name: "Dzisiaj" })).toBeChecked();
    expect(screen.queryByLabelText(/Dokładna data/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Jutro" }));
    expect(screen.getByRole("checkbox", { name: /Pokaż na Starcie/ })).not.toBeChecked();
  });

  it("zachowuje niestandardowy termin i nie zmienia przypięcia", async () => {
    const user = userEvent.setup();
    const customDate = shiftActionDate(workspaceToday(), 16);
    render(<QuickAdd open request={{ mode: "action", scheduledFor: customDate, pinnedToToday: true }} onClose={vi.fn()} />);
    await user.click(screen.getByText("Opis i powiązania"));
    expect(screen.getByRole("radio", { name: "Inna data" })).toBeChecked();
    expect(screen.getByLabelText(/Dokładna data/)).toHaveValue(customDate);
    await user.click(screen.getByRole("radio", { name: "Bez terminu" }));
    expect(screen.getByRole("checkbox", { name: /Pokaż na Starcie/ })).toBeChecked();
  });

  it("nie zapisuje niedostępnego powiązania, zachowuje tekst i umożliwia odłączenie", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "removed" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Ważna treść");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Odłącz niedostępne powiązanie" }));
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Ważna treść", goalId: undefined, areaId: undefined }), expect.any(String));
  });

  it("walidacja Rutyny wskazuje konkretne pole", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "routine" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co ma się powtarzać?"), "Przegląd");
    await user.clear(screen.getByLabelText("Co ile?"));
    await user.type(screen.getByLabelText("Co ile?"), "100");
    await user.click(screen.getByRole("button", { name: "Utwórz Rutynę" }));
    expect(screen.getByRole("alert")).toHaveTextContent("od 1 do 99");
    expect(screen.getByLabelText("Co ile?")).toHaveFocus();
    expect(store.createRecurringAction).not.toHaveBeenCalled();
  });

  it("chroni przed podwójnym zapisem i zachowuje tekst po błędzie", async () => {
    let reject!: (error: Error) => void;
    store.createAction.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
    const user = userEvent.setup();
    const close = vi.fn();
    render(<QuickAdd open request={{ mode: "action" }} onClose={close} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Nie zgub tego");
    const form = screen.getByRole("button", { name: "Dodaj Działanie" }).closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(store.createAction).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Co chcesz zrobić?")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zamknij okno" })).toBeDisabled();
    reject(new Error("network"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Co chcesz zrobić?")).toHaveValue("Nie zgub tego");
    expect(close).not.toHaveBeenCalled();
  });

  it("natychmiast zapisuje szkic przy zamknięciu i odzyskuje go", async () => {
    const user = userEvent.setup();
    const view = render(<QuickAdd open request={{ mode: "project", draftKey: "projects" }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Jaki Projekt utworzyć?"), { target: { value: "Ostatnia zmiana" } });
    await user.click(screen.getByRole("button", { name: "Zamknij okno" }));
    expect(JSON.parse(localStorage.getItem(draftStorageKey("tester", "test", "creation:global:project", "new"))!).value.title).toBe("Ostatnia zmiana");
    view.unmount();
    render(<QuickAdd open request={{ mode: "project", draftKey: "projects" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Jaki Projekt utworzyć?")).toHaveValue("Ostatnia zmiana");
    expect(screen.getByRole("status")).toHaveTextContent("Wznowiono szkic");
  });
  it("zmienia pola Wiedzy bez utraty treści, a wybór typu jest tylko w nagłówku", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "library" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/^Typ:/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Treść notatki"), "Zachowaj tę treść");
    await user.click(screen.getByRole("radio", { name: /^Materiał/ }));
    await user.type(screen.getByLabelText(/Link HTTP/), "https://example.com");
    await user.click(screen.getByRole("radio", { name: /^Decyzja/ }));
    expect(screen.getByLabelText("Co zostało zdecydowane?")).toHaveValue("");
    expect(screen.getByLabelText("Uzasadnienie i konsekwencje")).toBeRequired();
    expect(screen.getByLabelText("Uzasadnienie i konsekwencje")).toHaveValue("Zachowaj tę treść");
    expect(screen.queryByLabelText(/Link HTTP/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Materiał/ }));
    expect(screen.getByLabelText(/Link HTTP/)).toHaveValue("https://example.com");
    await user.click(screen.getByRole("button", { name: "Zmień typ wpisu" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Zmień typ wpisu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog", { name: "Dodaj do Biblioteki" })).toBeInTheDocument();
  });

});
