import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("Następny krok")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Następne Działanie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Szybki wpis postępu" })).toBeInTheDocument();
    expect(screen.getByLabelText("Treść aktualizacji")).toBeInTheDocument();
    expect(screen.getByText("Kryteria sukcesu")).toBeInTheDocument();
    expect(screen.getByLabelText(/Postęp kryteriów/)).toBeInTheDocument();
    expect(screen.getByText("Bez daty docelowej")).toBeInTheDocument();
    expect(screen.getByText("Więcej", { selector: "summary" })).toBeInTheDocument();
    expect(screen.queryByText(/Focus Session|Rozpocznij fokus|timer/i)).not.toBeInTheDocument();
    expect(screen.queryByText("decision")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ukończ: Zaprojektuj encje i relacje dla transakcji" }));
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
    const action = await screen.findByRole("link", { name: "Otwórz Działanie: Zaprojektuj encje i relacje dla transakcji" });
    await user.click(action);
    expect(await screen.findByRole("heading", { name: "FinTrack API" })).toBeInTheDocument();
    expect(screen.getAllByText("Zaprojektuj encje i relacje dla transakcji").length).toBeGreaterThan(0);
  });
});
