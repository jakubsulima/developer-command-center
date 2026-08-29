import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import DemoAuthProvider from "../auth/DemoAuthProvider";
import { emptyState } from "../data/empty";
import { App } from "./App";
import { StoreProvider } from "./store";

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={queryClient}><DemoAuthProvider><StoreProvider><App /></StoreProvider></DemoAuthProvider></QueryClientProvider></MemoryRouter>);
}

function seedNavigationState() {
  const state = structuredClone(emptyState);
  state.areas = [{ id: "nav-project", name: "Projekt Nawigacji", description: "", visibility: "active", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
  state.goals = [{ id: "nav-goal", title: "Cel Nawigacji", outcome: "Gotowy kontekst", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "nav-project", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
  state.actions = [{ id: "nav-action", version: 1, title: "Wykonać krok", detail: "", goalId: "nav-goal", areaId: "nav-project", status: "ready", position: 0, isNext: true, pinnedToToday: false, checklist: [], createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }];
  state.knowledge = [{ id: "nav-knowledge", type: "note", title: "Wiedza Nawigacji", detail: "" }];
  state.knowledgeLinks = [{ id: "nav-link", knowledgeItemId: "nav-knowledge", actionId: "nav-action", meaning: "reference", createdAt: "2026-08-01T08:00:00.000Z" }];
  localStorage.setItem("command-center-state-v1", JSON.stringify(state));
}

describe("spójna nawigacja kontekstowa", () => {
  it("przenosi pełny kontekst przez Projekt → Cel → Działanie → Wiedza i wraca do źródła", async () => {
    seedNavigationState();
    const user = userEvent.setup();
    renderApp("/projects/nav-project?view=goals");

    await user.click(await screen.findByRole("link", { name: "Otwórz Cel: Cel Nawigacji" }));
    expect(await screen.findByRole("heading", { name: "Cel Nawigacji" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).toHaveTextContent("Projekt Nawigacji");

    await user.click(screen.getByRole("link", { name: "Wykonać krok" }));
    expect(await screen.findByRole("heading", { name: "Wykonać krok" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).toHaveTextContent("Cel Nawigacji");

    await user.click(screen.getByRole("button", { name: "Wiedza · 1" }));
    await user.click(screen.getByRole("link", { name: /Wiedza Nawigacji/ }));
    expect(await screen.findByRole("heading", { name: "Wiedza Nawigacji" })).toBeInTheDocument();
    const breadcrumbs = screen.getByRole("navigation", { name: "Ścieżka kontekstu" });
    expect(within(breadcrumbs).getByLabelText("Pominięte poziomy")).toBeInTheDocument();
    expect(within(breadcrumbs).getByText("Wiedza: Wiedza Nawigacji")).toHaveAttribute("aria-current", "page");

    await user.click(within(breadcrumbs).getByRole("button", { name: "Działanie: Wykonać krok" }));
    expect(await screen.findByRole("heading", { name: "Wykonać krok" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cel: Cel Nawigacji" }));
    expect(await screen.findByRole("heading", { name: "Cel Nawigacji" })).toBeInTheDocument();
  });

  it("przekierowuje stary adres Działania przez replace do nowej trasy", async () => {
    seedNavigationState();
    renderApp("/goals/nav-goal?action=nav-action");
    expect(await screen.findByRole("heading", { name: "Wykonać krok" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ścieżka kontekstu" })).toHaveTextContent("Cel Nawigacji");
  });

  it("odtwarza fokus i podświetlenie źródłowej karty po powrocie", async () => {
    seedNavigationState();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderApp("/projects/nav-project?view=goals");
    const goalLink = await screen.findByRole("link", { name: "Otwórz Cel: Cel Nawigacji" });
    await user.click(goalLink);
    await user.click(screen.getByRole("button", { name: "Projekt: Projekt Nawigacji" }));
    const card = await screen.findByText("Cel Nawigacji");
    await waitFor(() => expect(card.closest("[data-navigation-card-id=\"goal-nav-goal\"]")).toHaveFocus());
    expect(card.closest("[data-navigation-card-id=\"goal-nav-goal\"]")).toHaveClass("navigation-card-highlight");
    expect(scrollTo).toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
