import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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
  it("completes a Goal Action without Focus", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    expect(await screen.findByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
    expect(screen.queryByText("Następny krok")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Następne Działanie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Szybki wpis postępu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Treść aktualizacji")).toBeInTheDocument();
    expect(screen.getByText("Kryteria sukcesu")).toBeInTheDocument();
    expect(screen.getByLabelText(/Postęp kryteriów/)).toBeInTheDocument();
    expect(screen.queryByText("Bez daty docelowej")).not.toBeInTheDocument();
    const goalOptions = screen.getByText("Opcje Celu").closest("details") as HTMLDetailsElement;
    expect(within(goalOptions).getByRole("button", { name: "Edytuj Cel" })).not.toBeVisible();
    await user.click(within(goalOptions).getByText("Opcje Celu"));
    expect(within(goalOptions).getByText(/Wysoka ważność/)).toHaveTextContent("Bez daty docelowej");
    await user.click(within(goalOptions).getByRole("button", { name: "Edytuj Cel" }));
    expect(goalOptions).not.toHaveAttribute("open");
    const editGoalDialog = screen.getByRole("dialog", { name: "Edytuj Cel i kryteria" });
    expect(editGoalDialog).toBeVisible();
    await user.click(within(editGoalDialog).getByRole("button", { name: "Anuluj" }));
    const details = screen.getByRole("region", { name: "Szczegóły Celu" });
    const actionsSection = within(details).getByText("Działania", { selector: "strong" }).closest("details") as HTMLDetailsElement;
    expect(actionsSection).not.toHaveAttribute("open");
    await user.click(within(screen.getByRole("navigation", { name: "Nawigacja mobilna" })).getByRole("button", { name: "Dodaj Działanie do Celu FinTrack API" }));
    const quickAdd = screen.getByRole("dialog", { name: "Dodaj" });
    expect(within(quickAdd).getByLabelText("Co chcesz zrobić?")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(details).getByText("Działania", { selector: "strong" }));
    expect(actionsSection).toHaveAttribute("open");
    await user.click(within(details).getByText("Działania", { selector: "strong" }));
    expect(screen.queryByText(/Focus Session|Rozpocznij fokus|timer/i)).not.toBeInTheDocument();
    expect(screen.queryByText("decision")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ukończ: Zaprojektuj encje i relacje dla transakcji" }));
    await user.click(within(details).getByText("Działania", { selector: "strong" }));
    await user.click(within(details).getByText("Historia Działań"));
    expect(screen.getByRole("button", { name: "Przywróć: Zaprojektuj encje i relacje dla transakcji" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cofnij" })).toBeInTheDocument();
  });

  it("saves a quick progress entry from the first screen", async () => {
    const user = userEvent.setup();
    renderApp("/goals/fintrack-api");
    expect(await screen.findByRole("heading", { name: "Następne Działanie" })).toBeInTheDocument();
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
