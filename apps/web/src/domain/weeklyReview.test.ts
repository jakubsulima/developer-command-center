import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import type { AppState } from "./types";
import { deriveWeeklyReview, weekBounds } from "./weeklyReview";
import { polishCount } from "./labels";

describe("automatyczne podsumowanie tygodnia", () => {
  it("wyznacza tydzień od poniedziałku do poniedziałku", () => {
    const { start, end } = weekBounds(new Date("2026-08-08T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-08-02T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-09T22:00:00.000Z");
  });

  it("liczy aktywność i proponuje decyzje z bieżącego stanu", () => {
    const state: AppState = {
      ...emptyState,
      goals: [{ id: "g-1", title: "Cel", outcome: "Wynik", kind: "custom", status: "active", visibility: "active", priority: "normal" }],
      actions: [
        { id: "a-1", version: 1, goalId: "g-1", title: "Gotowe", detail: "", status: "completed", position: 0, isNext: false, pinnedToToday: false, checklist: [], completedAt: "2026-08-05T10:00:00.000Z" },
        { id: "a-2", version: 1, goalId: "g-1", title: "Blokada", detail: "", status: "blocked", position: 1, isNext: false, pinnedToToday: false, checklist: [] }
      ],
      inbox: [{ id: "i-1", kind: "text", content: "Myśl", createdAt: "2026-08-07T10:00:00.000Z", status: "unprocessed" }]
    };

    const result = deriveWeeklyReview(state, new Date("2026-08-08T12:00:00.000Z"));
    expect(result.completedActions).toBe(1);
    expect(result.generatedSummary).toContain("Ukończono 1 Działanie");
    expect(result.suggestions.map((suggestion) => suggestion.id)).toEqual(["blocked", "next-actions", "inbox"]);
  });

  it("nie pokazuje Focus ani historycznego limitu Commitments w bieżącej domenie", () => {
    const state: AppState = {
      ...emptyState,
      projects: [{ id: "legacy-project", name: "Stary projekt", initials: "SP", color: "violet", technology: "", outcome: "", status: "W trakcie", commitmentStatus: "active", nextStep: "", primary: true, usedMinutes: 0, requirements: [], workItems: [] }],
      focusSessions: [{ id: "focus", projectId: "legacy-project", workItemId: "work", startedAt: "2026-08-03T10:00:00.000Z", endedAt: "2026-08-03T11:00:00.000Z", scratchpad: "" }]
    };

    const result = deriveWeeklyReview(state, new Date("2026-08-08T12:00:00.000Z"));
    expect(result.focusMinutes).toBe(0);
    expect(result.suggestions.some((suggestion) => suggestion.id === "wip")).toBe(false);
    expect(result.generatedSummary).not.toContain("min");
  });

  it("odrzuca aktywność i blokady należące do archiwalnych rodziców", () => {
    const state: AppState = {
      ...emptyState,
      goals: [{ id: "archived-goal", title: "Archiwalny Cel", outcome: "", kind: "custom", status: "active", visibility: "archived", priority: "normal" }],
      actions: [
        { id: "completed", version: 1, goalId: "archived-goal", title: "Stare Działanie", detail: "", status: "completed", position: 0, isNext: false, pinnedToToday: false, checklist: [], completedAt: "2026-08-05T10:00:00.000Z" },
        { id: "blocked", version: 1, goalId: "archived-goal", title: "Stara blokada", detail: "", status: "blocked", blocker: "Stary kontekst", position: 1, isNext: false, pinnedToToday: false, checklist: [] }
      ]
    };

    const result = deriveWeeklyReview(state, new Date("2026-08-08T12:00:00.000Z"));
    expect(result.completedActions).toBe(0);
    expect(result.suggestions).toEqual([expect.objectContaining({ id: "continue" })]);
  });

  it.each([0, 1, 2, 5, 12, 22, 112])("zachowuje poprawną odmianę dla liczby %s", (count) => {
    const lastTwo = count % 100;
    const last = count % 10;
    const expected = count === 1 ? "Działanie" : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "Działania" : "Działań";
    expect(polishCount(count, "Działanie", "Działania", "Działań")).toBe(`${count} ${expected}`);
  });
});
