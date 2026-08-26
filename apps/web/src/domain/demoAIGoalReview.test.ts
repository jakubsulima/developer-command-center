import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { createDemoAIGoalReview } from "./demoAIGoalReview";

describe("demo AI Goal Review", () => {
  it("buduje deterministyczną rekomendację bez zapisu", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-1", title: "Cel", outcome: "Rezultat", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
    const review = createDemoAIGoalReview(state, new Date("2026-08-25T10:00:00Z"));
    expect(review.provider).toBe("demo");
    expect(review.review.recommendations[0]?.draftAction?.goalId).toBe("goal-1");
    expect(review.review.goalAssessments[0]?.signalKeys).toContain("goal:goal-1:missing-next-action");
  });

  it("jawnie zatrzymuje analizę pustego portfolio", () => {
    expect(() => createDemoAIGoalReview(structuredClone(emptyState))).toThrow("Nie ma aktywnych Celów");
  });
});
