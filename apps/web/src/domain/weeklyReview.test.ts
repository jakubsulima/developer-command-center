import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import type { AppState } from "./types";
import { deriveWeeklyReview, weekBounds } from "./weeklyReview";

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
});
