import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { App } from "./App";
import { StoreProvider } from "./store";

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

describe("goal-centric experience", () => {
  it("completes the featured Action in one touch and can undo it", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    // The first detail route is lazy-loaded; allow its cold import to finish.
    const complete = await screen.findByRole("button", { name: "Ukończ: Zaprojektuj encje i relacje dla transakcji" }, { timeout: 5000 });

    await user.click(complete);
    expect(await screen.findByText("Działanie ukończone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(await screen.findByRole("button", { name: "Ukończ: Zaprojektuj encje i relacje dla transakcji" })).toBeInTheDocument();
  });

  it("completes a Goal Action without Focus", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    expect(await screen.findByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
    expect(screen.queryByText("Następny krok")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Działania" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Szybki wpis postępu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Treść aktualizacji")).toBeInTheDocument();
    expect(screen.getByText("Kryteria sukcesu")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Kryteria sukcesu" })).getAllByRole("checkbox").length).toBeGreaterThan(0);
    expect(screen.queryByText("Bez daty docelowej")).not.toBeInTheDocument();
    const goalOptions = screen.getByText("Opcje grupy").closest("details") as HTMLDetailsElement;
    expect(within(goalOptions).getByRole("button", { name: "Edytuj grupę" })).not.toBeVisible();
    await user.click(within(goalOptions).getByText("Opcje grupy"));
    expect(within(goalOptions).getByText(/Wysoka ważność/)).toHaveTextContent("Bez daty docelowej");
    await user.click(within(goalOptions).getByRole("button", { name: "Edytuj grupę" }));
    expect(goalOptions).not.toHaveAttribute("open");
    const editGoalDialog = screen.getByRole("dialog", { name: "Edytuj grupę działań" });
    expect(editGoalDialog).toBeVisible();
    await user.click(within(editGoalDialog).getByRole("button", { name: "Anuluj" }));
    const addAction = within(screen.getByRole("main")).getByRole("button", { name: "Dodaj Działanie do grupy FinTrack API" });
    await user.click(addAction);
    const quickAdd = await screen.findByRole("dialog", { name: "Nowe Działanie" });
    expect(within(quickAdd).getByLabelText("Co chcesz zrobić?")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(quickAdd).not.toBeInTheDocument();
      expect(addAction).toHaveFocus();
    });
    expect(screen.queryByText(/Focus Session|Rozpocznij fokus|timer/i)).not.toBeInTheDocument();
    expect(screen.queryByText("decision")).not.toBeInTheDocument();
    screen.getByRole("button", { name: "Ukończ: Zaprojektuj encje i relacje dla transakcji" }).focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    const statusDialog = screen.getByRole("dialog", { name: "Zmień status Działania" });
    await user.click(within(statusDialog).getByRole("button", { name: /Ukończone/ }));
    await waitFor(() => expect(statusDialog).not.toBeInTheDocument());
    await user.click(screen.getByText("Historia Działań"));
    expect(screen.getByRole("button", { name: "Przywróć: Zaprojektuj encje i relacje dla transakcji" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cofnij" })).toBeInTheDocument();
  });

  it("saves a quick progress entry from the first screen", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    expect(await screen.findByRole("heading", { name: "Działania" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Treść aktualizacji"), "Sprawdziłem model danych.");
    await user.click(screen.getByRole("button", { name: "Zapisz postęp" }));
    expect(await screen.findByText("Sprawdziłem model danych.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Notatka", selected: true })).toBeInTheDocument();
  });

  it("opens a legacy project as a persistent Project context", async () => {
    renderApp("/projects/fintrack-api");
    expect(await screen.findByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fokus/i })).not.toBeInTheDocument();
  });

  it("opens a Project action inside its Goal context", async () => {
    const user = userEvent.setup();
    renderApp("/projects/fintrack-api");
    await user.click(await screen.findByRole("tab", { name: "Działania" }));
    const action = await screen.findByRole("link", { name: "Otwórz Działanie: Zaprojektuj encje i relacje dla transakcji" });
    await user.click(action);
    expect(await screen.findByRole("heading", { name: "Zaprojektuj encje i relacje dla transakcji" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).toHaveTextContent("FinTrack API");
    expect(screen.getAllByText("Zaprojektuj encje i relacje dla transakcji").length).toBeGreaterThan(0);
  });
});
