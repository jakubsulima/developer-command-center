import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { nextWorkspaceWeek, selectedReviewGoalIds, weeklyPlanActions } from "./weeklyPlan";

describe("weekly plan", () => {
  it("uses workspace dates across a daylight saving boundary", () => {
    expect(nextWorkspaceWeek(new Date("2026-10-21T22:00:00Z"), "Europe/Warsaw").dates).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"
    ]);
  });

  it("selects only open, visible actions in chosen goals or standalone work", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-1", title: "Cel", outcome: "", kind: "personal", status: "active", priority: "normal", visibility: "active", createdAt: "", updatedAt: "", version: 1 }];
    state.actions = [
      { id: "selected", version: 1, title: "Krok", detail: "", goalId: "goal-1", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [] },
      { id: "standalone", version: 1, title: "Samodzielny", detail: "", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [] },
      { id: "done", version: 1, title: "Gotowe", detail: "", goalId: "goal-1", status: "completed", position: 1, isNext: false, pinnedToToday: false, checklist: [] }
    ];
    expect(weeklyPlanActions(state, ["goal-1"], false).map((action) => action.id)).toEqual(["selected"]);
    expect(weeklyPlanActions(state, ["goal-1"], true).map((action) => action.id)).toEqual(["selected", "standalone"]);
  });

  it("reads both historical string and current array answers", () => {
    expect(selectedReviewGoalIds({ selectedGoalIds: '["a","b"]' })).toEqual(["a", "b"]);
    expect(selectedReviewGoalIds({ selectedGoalIds: ["a", "b"] })).toEqual(["a", "b"]);
    expect(selectedReviewGoalIds({ selectedGoalIds: "invalid" })).toEqual([]);
  });
});
