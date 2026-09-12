import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAdd } from "./QuickAdd";
import { draftStorageKey } from "../hooks/usePersistentDraft";

const store = vi.hoisted(() => ({
  state: { workspaceId: "test", workspaceTimezone: "Europe/Warsaw", goals: [{ id: "goal", title: "Wynik", areaId: "project", visibility: "active", status: "active" }], areas: [{ id: "project", name: "Projekt testowy", visibility: "active" }], goalTemplates: [] },
  createAction: vi.fn(), createGoal: vi.fn(), createArea: vi.fn(), createRecurringAction: vi.fn(), createKnowledge: vi.fn(), capture: vi.fn()
}));
vi.mock("../app/useStore", () => ({ useStore: () => store }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: "tester" }, mode: "demo" }) }));
vi.mock("./action-feedback-context", () => ({ useActionFeedback: () => ({ notifySuccess: vi.fn() }) }));

async function switchType(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByText("Zmień", { exact: true }));
  await user.click(screen.getByRole("button", { name }));
}

beforeEach(() => vi.clearAllMocks());

describe("Dodaj — formularze i kontekst", () => {
  it.each([
    ["action", "Co chcesz zrobić?", "Dodaj Działanie", "createAction"],
    ["goal", "Co chcesz osiągnąć?", "Utwórz Cel", "createGoal"],
    ["project", "Jaki Projekt utworzyć?", "Utwórz Projekt", "createArea"],
    ["routine", "Co ma się powtarzać?", "Utwórz Rutynę", "createRecurringAction"],
    ["library", "Tytuł notatki", "Zapisz w Bibliotece", "createKnowledge"],
    ["inbox", "Co chcesz zachować?", "Zapisz do Skrzynki", "capture"]
  ] as const)("zapisuje %s", async (mode, field, submit, command) => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<QuickAdd open request={{ mode, areaId: "project", pinnedToToday: false }} onClose={close} />);
    await user.type(screen.getByLabelText(field), "Nowy wpis");
    await user.click(screen.getByRole("button", { name: submit }));
    expect(store[command]).toHaveBeenCalledTimes(1);
    if (mode === "action" || mode === "goal" || mode === "routine") expect(store[command]).toHaveBeenCalledWith(expect.objectContaining({ title: "Nowy wpis", areaId: "project" }));
    if (mode === "project") expect(store.createArea).toHaveBeenCalledWith("Nowy wpis", undefined);
    if (mode === "library") expect(store.createKnowledge).toHaveBeenCalledWith(expect.objectContaining({ relations: [expect.objectContaining({ target: { areaId: "project" } })] }));
    if (mode === "inbox") expect(store.capture).toHaveBeenCalledWith("Nowy wpis", "text");
    expect(close).toHaveBeenCalledOnce();
  });

  it("komenda /cel dziedziczy Projekt i zachowuje opis", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "goal" }} onClose={vi.fn()} />);
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
    await user.click(screen.getByRole("button", { name: "Zapisz w Bibliotece" }));
    expect(store.createKnowledge).toHaveBeenCalledWith(expect.objectContaining({ relations: [expect.objectContaining({ target: { areaId: "project" } })] }));
  });

  it("powrót przez Projekt zachowuje Cel, termin i niezależne przypięcie", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "goal", scheduledFor: "2026-09-20", pinnedToToday: false }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Krok");
    await switchType(user, "Projekt");
    expect(screen.getByText("Nowy samodzielny Projekt")).toBeInTheDocument();
    await switchType(user, "Działanie");
    await user.click(screen.getByText("Powiązania i ustawienia"));
    expect(screen.getByLabelText("Cel lub Projekt")).toHaveValue("goal:goal");
    expect(screen.getByLabelText(/Dokładna data/)).toHaveValue("2026-09-20");
    await user.click(screen.getByRole("button", { name: "Jutro" }));
    expect(screen.getByRole("checkbox", { name: /Pokaż na Starcie/ })).not.toBeChecked();
  });

  it("nie zapisuje niedostępnego powiązania, zachowuje tekst i umożliwia odłączenie", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "action", goalId: "removed" }} onClose={vi.fn()} />);
    await user.type(screen.getByLabelText("Co chcesz zrobić?"), "Ważna treść");
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Odłącz niedostępne powiązanie" }));
    await user.click(screen.getByRole("button", { name: "Dodaj Działanie" }));
    expect(store.createAction).toHaveBeenCalledWith(expect.objectContaining({ title: "Ważna treść", goalId: undefined, areaId: undefined }));
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
    expect(JSON.parse(localStorage.getItem(draftStorageKey("tester", "test", "quick-add:projects", "new"))!).value.title).toBe("Ostatnia zmiana");
    view.unmount();
    render(<QuickAdd open request={{ mode: "project", draftKey: "projects" }} onClose={vi.fn()} />);
    expect(screen.getByLabelText("Jaki Projekt utworzyć?")).toHaveValue("Ostatnia zmiana");
    expect(screen.getByRole("status")).toHaveTextContent("Wznowiono szkic");
  });
  it("zmienia pola Wiedzy bez utraty treści, a wybór typu jest tylko w nagłówku", async () => {
    const user = userEvent.setup();
    render(<QuickAdd open request={{ mode: "library" }} onClose={vi.fn()} />);
    expect(screen.queryByText(/^Typ:/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Tytuł notatki"), "Wspólny tytuł");
    await user.type(screen.getByLabelText(/Treść notatki/), "Zachowaj tę treść");
    await user.click(screen.getByRole("radio", { name: /^Materiał/ }));
    await user.type(screen.getByLabelText(/Link HTTP/), "https://example.com");
    await user.click(screen.getByRole("radio", { name: /^Decyzja/ }));
    expect(screen.getByLabelText("Co zostało zdecydowane?")).toHaveValue("Wspólny tytuł");
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
