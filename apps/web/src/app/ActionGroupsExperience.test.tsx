import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { draftStorageKey } from "../hooks/usePersistentDraft";
import { App } from "./App";
import { StoreProvider } from "./store";

configure({ asyncUtilTimeout: 5000 });
beforeEach(() => {
  vi.stubGlobal("indexedDB", undefined);
  const state = structuredClone(emptyState);
  state.areas = [
    { id: "project", name: "Command test", description: "", visibility: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    { id: "other-project", name: "Drugi Projekt", description: "", visibility: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" }
  ];
  state.goals = [
    { id: "ui", title: "UI/UX", outcome: "Stały temat", kind: "custom", groupType: "category", areaId: "project", status: "active", priority: "normal", visibility: "active" },
    { id: "performance", title: "Wydajność", outcome: "", kind: "custom", groupType: "category", areaId: "project", status: "active", priority: "normal", visibility: "active" },
    { id: "legacy", title: "Istniejące zadanie", outcome: "Zachowany rezultat", kind: "custom", areaId: "project", status: "active", priority: "normal", visibility: "active" },
    { id: "other-group", title: "Wdrożenie", outcome: "", kind: "custom", groupType: "category", areaId: "other-project", status: "active", priority: "normal", visibility: "active" }
  ];
  state.actions = [{ id: "action", title: "Popraw ekran", detail: "Zachowany opis", goalId: "ui", areaId: "project", status: "ready", position: 0, isNext: true, pinnedToToday: false, version: 1, checklist: [] }];
  state.goalCriteria = [{ id: "criterion", goalId: "legacy", title: "Zachowane kryterium", completed: true }];
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
});
afterEach(() => vi.unstubAllGlobals());

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

async function openProjectEditor(user: ReturnType<typeof userEvent.setup>, projectName = "Command test") {
  await user.click(await screen.findByLabelText(`Opcje Projektu: ${projectName}`));
  await user.click(screen.getByRole("menuitem", { name: "Edytuj Projekt" }));
  return screen.findByRole("dialog", { name: "Edytuj Projekt" });
}

it.each(["escape", "krzyżyk", "tło", "anuluj"])("zachowuje szkic projektu po zamknięciu przez %s i pozwala go odrzucić", async (closeMethod) => {
  const user = userEvent.setup();
  open("/projects/project");
  const editor = await openProjectEditor(user);
  const context = within(editor).getByLabelText("Kontekst");
  fireEvent.change(context, { target: { value: "Nowy kontekst projektu" } });

  if (closeMethod === "escape") await user.keyboard("{Escape}");
  else if (closeMethod === "krzyżyk") await user.click(within(editor).getByRole("button", { name: "Zamknij okno" }));
  else if (closeMethod === "tło") fireEvent.mouseDown(editor.parentElement!);
  else await user.click(within(editor).getByRole("button", { name: "Anuluj" }));
  expect(screen.queryByRole("dialog", { name: "Edytuj Projekt" })).not.toBeInTheDocument();

  const reopened = await openProjectEditor(user);
  expect(within(reopened).getByLabelText("Kontekst")).toHaveValue("Nowy kontekst projektu");
  const key = draftStorageKey("demo-user", "demo-workspace", "project-edit", "project");
  expect(JSON.parse(localStorage.getItem(key)!).value.description).toBe("Nowy kontekst projektu");
  await user.click(within(reopened).getByRole("button", { name: "Odrzuć szkic" }));
  expect(within(reopened).getByLabelText("Kontekst")).toHaveValue("");
  expect(localStorage.getItem(key)).toBeNull();
});

it("przywraca szkic wyłącznie w jego projekcie i usuwa go po zapisie", async () => {
  const user = userEvent.setup();
  const key = draftStorageKey("demo-user", "demo-workspace", "project-edit", "project");
  localStorage.setItem(key, JSON.stringify({
    version: 2,
    savedAt: "2026-11-20T10:00:00Z",
    value: { name: "Command test", description: "Przywrócony kontekst", categoryIds: [], preset: "standard" }
  }));
  const otherProject = open("/projects/other-project");
  const otherEditor = await openProjectEditor(user, "Drugi Projekt");
  expect(within(otherEditor).getByLabelText("Kontekst")).toHaveValue("");
  otherProject.unmount();

  open("/projects/project");
  const editor = await openProjectEditor(user);
  expect(within(editor).getByLabelText("Kontekst")).toHaveValue("Przywrócony kontekst");
  await user.click(within(editor).getByRole("button", { name: "Zapisz Projekt" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edytuj Projekt" })).not.toBeInTheDocument());
  expect(screen.getByText("Przywrócony kontekst")).toBeVisible();
  expect(localStorage.getItem(key)).toBeNull();
});

it("zostawia edytor projektu otwarty, gdy zapis zmienionego szkicu kończy się błędem", async () => {
  const user = userEvent.setup();
  open("/projects/project");
  const editor = await openProjectEditor(user);
  const setItem = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.endsWith(":project-edit:project")) throw new Error("Brak miejsca na szkic");
    setItem.call(this, key, value);
  });
  try {
    fireEvent.change(within(editor).getByLabelText("Kontekst"), { target: { value: "Treść do odzyskania" } });
    await user.keyboard("{Escape}");
    expect(within(editor).getByRole("alert")).toHaveTextContent("Brak miejsca na szkic");
    expect(within(editor).getByLabelText("Kontekst")).toHaveValue("Treść do odzyskania");
  } finally {
    write.mockRestore();
  }
});

it("przełącza fokus, wybór i panel kart projektu klawiaturą", async () => {
  const user = userEvent.setup();
  open("/projects/project?view=actions");
  const tabs = within(await screen.findByRole("tablist", { name: "Zawartość Projektu" }));
  const actions = tabs.getByRole("tab", { name: "Działania" });
  actions.focus();
  await user.tab({ shift: true });
  expect(screen.getByRole("tablist")).not.toContainElement(document.activeElement as HTMLElement);
  await user.tab();
  expect(actions).toHaveFocus();
  for (const [key, label] of [
    ["Home", "Przegląd"],
    ["ArrowLeft", "Wiedza"],
    ["ArrowRight", "Przegląd"],
    ["ArrowRight", "Grupy działań"],
    ["End", "Wiedza"]
  ]) {
    await user.keyboard(`{${key}}`);
    const selected = tabs.getByRole("tab", { name: label, selected: true });
    expect(selected).toHaveFocus();
    expect(selected).toHaveAttribute("aria-controls", screen.getByRole("tabpanel", { name: label }).id);
  }
  await user.tab();
  expect(screen.getByRole("tabpanel", { name: "Wiedza" })).toHaveFocus();
});

it("utrzymuje status i odrzucenie szkicu grupy nad głównymi akcjami", async () => {
  const user = userEvent.setup();
  open("/goals/ui");
  await user.click(await screen.findByText("Opcje grupy", { selector: "summary span" }));
  await user.click(screen.getByRole("button", { name: "Edytuj grupę" }));
  const editor = screen.getByRole("dialog", { name: "Edytuj grupę działań" });
  const fields = within(editor);
  const description = fields.getByLabelText("Opis");
  expect(description).toHaveValue("Stały temat");
  expect(fields.queryByRole("button", { name: "Odrzuć szkic" })).not.toBeInTheDocument();

  const setItem = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.endsWith(":goal-edit:ui")) throw new Error("Brak miejsca na szkic grupy");
    setItem.call(this, key, value);
  });
  try {
    fireEvent.change(description, { target: { value: "Tymczasowy opis grupy" } });
    const status = fields.getByText("Zapisywanie szkicu…").parentElement;
    const discard = fields.getByRole("button", { name: "Odrzuć szkic" });
    const save = fields.getByRole("button", { name: "Zapisz grupę" });
    expect(discard.parentElement).toContainElement(status);
    expect(save.parentElement).toContainElement(fields.getByRole("button", { name: "Anuluj" }));
    expect(discard.parentElement?.nextElementSibling).toBe(save.parentElement);
    const error = await fields.findByRole("alert");
    expect(error).toHaveTextContent("Brak miejsca na szkic grupy");
    expect(discard.parentElement).toContainElement(error);
  } finally {
    write.mockRestore();
  }
  await user.click(fields.getByRole("button", { name: "Ponów" }));
  expect(fields.getByText("Szkic zapisany na tym urządzeniu")).toBeVisible();
  await user.click(fields.getByRole("button", { name: "Odrzuć szkic" }));
  expect(description).toHaveValue("Stały temat");
  expect(fields.queryByRole("button", { name: "Odrzuć szkic" })).not.toBeInTheDocument();
});

it("tworzy kategorię z samej nazwy i po ukończeniu Działania pozwala dodać kolejne", async () => {
  const user = userEvent.setup();
  open("/goals");
  await user.click(await screen.findByRole("button", { name: "Dodaj nową grupę działań" }));
  const dialog = await screen.findByRole("dialog", { name: "Nowa grupa działań" });
  expect(within(dialog).getByLabelText("Typ grupy")).toHaveValue("category");
  await user.type(within(dialog).getByLabelText("Nazwa grupy"), "Nowa kategoria");
  await user.click(within(dialog).getByRole("button", { name: "Utwórz grupę" }));
  await user.click(await screen.findByRole("link", { name: "Otwórz grupę: Nowa kategoria" }));
  const actions = await screen.findByRole("region", { name: "Działania" });
  expect(screen.queryByRole("region", { name: "Kryteria sukcesu" })).not.toBeInTheDocument();
  await user.type(within(actions).getByRole("textbox", { name: "Nowe Działanie" }), "Pierwsza poprawka");
  await user.click(within(actions).getByRole("button", { name: "Dodaj" }));
  await user.click(await within(actions).findByRole("button", { name: "Ukończ: Pierwsza poprawka" }));
  await waitFor(() => expect(within(actions).getByRole("textbox", { name: "Nowe Działanie" })).toHaveValue(""));
  await user.type(within(actions).getByRole("textbox", { name: "Nowe Działanie" }), "Kolejna poprawka");
  await user.click(within(actions).getByRole("button", { name: "Dodaj" }));
  expect(await within(actions).findByRole("button", { name: "Ukończ: Kolejna poprawka" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Zamknij zadanie" })).not.toBeInTheDocument();
});

it("stary adres zadania zachowuje rezultat i kryteria oraz blokuje ich utratę przy konwersji", async () => {
  const user = userEvent.setup();
  open("/goals/legacy");
  await screen.findByRole("heading", { name: "Istniejące zadanie" });
  expect(screen.getByText("Zachowany rezultat")).toBeInTheDocument();
  expect(screen.getByText("Zachowane kryterium")).toBeInTheDocument();
  await user.click(screen.getByText("Opcje grupy", { selector: "summary span" }));
  await user.click(screen.getByRole("button", { name: "Edytuj grupę" }));
  const edit = screen.getByRole("dialog", { name: "Edytuj grupę działań" });
  expect(within(edit).getByLabelText("Typ grupy")).toHaveValue("task");
  expect(within(edit).getByRole("option", { name: "Kategoria" })).toBeDisabled();
  expect(within(edit).getByText(/Zadanie ma kryteria sukcesu/)).toBeInTheDocument();
});

it("przenosi Działanie do innej grupy w tym samym Projekcie bez zmiany ID i opisu", async () => {
  const user = userEvent.setup();
  open("/actions/action");
  await user.click(await screen.findByRole("button", { name: "Edytuj" }));
  const edit = await screen.findByRole("dialog", { name: "Edytuj Działanie" });
  await user.selectOptions(within(edit).getByLabelText("Grupa działań"), "performance");
  await user.click(within(edit).getByRole("button", { name: "Zapisz zmiany" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const breadcrumbs = screen.getByRole("navigation", { name: "Ścieżka kontekstu" });
  expect(within(breadcrumbs).getByRole("link", { name: "Grupa: Wydajność" })).toHaveAttribute("href", "/goals/performance");
  expect(screen.getByText("Zachowany opis")).toBeInTheDocument();
});

it("przywraca stary szkic, przenosi Działanie razem z grupą i pozwala zdjąć oba przypisania", async () => {
  const user = userEvent.setup();
  const key = draftStorageKey("demo-user", "demo-workspace", "goal-action-edit", "action");
  localStorage.setItem(key, JSON.stringify({
    version: 2,
    savedAt: "2026-11-20T10:00:00Z",
    baseVersion: 1,
    value: { title: "Popraw panel", detail: "Opis ze szkicu", goalId: "ui", scheduledFor: "", checklist: [] }
  }));
  open("/actions/action");
  await user.click(await screen.findByRole("button", { name: "Edytuj" }));

  let edit = await screen.findByRole("dialog", { name: "Edytuj Działanie" });
  expect(within(edit).getByLabelText("Nazwa")).toHaveValue("Popraw panel");
  expect(within(edit).getByLabelText("Projekt")).toHaveValue("project");
  expect(within(edit).getByLabelText("Grupa działań")).toHaveValue("ui");
  await user.selectOptions(within(edit).getByLabelText("Projekt"), "other-project");
  expect(within(edit).getByLabelText("Grupa działań")).toHaveValue("");
  expect(within(edit).queryByRole("option", { name: "UI/UX" })).not.toBeInTheDocument();
  expect(within(edit).getByText(/usunie oznaczenie „Następne”/)).toBeVisible();
  await user.selectOptions(within(edit).getByLabelText("Grupa działań"), "other-group");
  await user.click(within(edit).getByRole("button", { name: "Zapisz zmiany" }));

  expect(await screen.findByRole("heading", { name: "Popraw panel" })).toBeInTheDocument();
  expect(screen.getByText("Opis ze szkicu")).toBeVisible();
  expect(within(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).getByRole("link", { name: "Grupa: Wdrożenie" })).toHaveAttribute("href", "/goals/other-group");
  expect(localStorage.getItem(key)).toBeNull();
  await user.click(screen.getByRole("button", { name: "Edytuj" }));

  edit = await screen.findByRole("dialog", { name: "Edytuj Działanie" });
  expect(within(edit).getByLabelText("Projekt")).toHaveValue("other-project");
  await user.selectOptions(within(edit).getByLabelText("Grupa działań"), "");
  expect(within(edit).queryByText(/usunie oznaczenie „Następne”/)).not.toBeInTheDocument();
  await user.click(within(edit).getByRole("button", { name: "Zapisz zmiany" }));
  expect(await within(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).findByRole("link", { name: "Drugi Projekt" })).toHaveAttribute("href", "/projects/other-project");
  await user.click(screen.getByRole("button", { name: "Edytuj" }));

  edit = await screen.findByRole("dialog", { name: "Edytuj Działanie" });
  expect(within(edit).getByLabelText("Grupa działań")).toHaveValue("");
  await user.selectOptions(within(edit).getByLabelText("Projekt"), "");
  await user.click(within(edit).getByRole("button", { name: "Zapisz zmiany" }));
  expect(await within(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).findByRole("link", { name: "Start" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Popraw panel" })).toBeVisible();
});
