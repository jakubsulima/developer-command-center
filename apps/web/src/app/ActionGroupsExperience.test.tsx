import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configure, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { App } from "./App";
import { StoreProvider } from "./store";

configure({ asyncUtilTimeout: 5000 });
beforeEach(() => {
  vi.stubGlobal("indexedDB", undefined);
  const state = structuredClone(emptyState);
  state.areas = [{ id: "project", name: "Command test", description: "", visibility: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" }];
  state.goals = [
    { id: "ui", title: "UI/UX", outcome: "Stały temat", kind: "custom", groupType: "category", areaId: "project", status: "active", priority: "normal", visibility: "active" },
    { id: "performance", title: "Wydajność", outcome: "", kind: "custom", groupType: "category", areaId: "project", status: "active", priority: "normal", visibility: "active" },
    { id: "legacy", title: "Istniejące zadanie", outcome: "Zachowany rezultat", kind: "custom", areaId: "project", status: "active", priority: "normal", visibility: "active" }
  ];
  state.actions = [{ id: "action", title: "Popraw ekran", detail: "Zachowany opis", goalId: "ui", areaId: "project", status: "ready", position: 0, isNext: true, pinnedToToday: false, version: 1, checklist: [] }];
  state.goalCriteria = [{ id: "criterion", goalId: "legacy", title: "Zachowane kryterium", completed: true }];
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
});
afterEach(() => vi.unstubAllGlobals());

function open(path: string) {
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

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
  expect(screen.getByRole("link", { name: /Grupa działań: Wydajność/ })).toBeInTheDocument();
  expect(screen.getByText("Zachowany opis")).toBeInTheDocument();
});
