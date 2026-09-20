import { describe, expect, it } from "vitest";
import type { AIGoalReview, AIGoalReviewRecommendation } from "./aiGoalReview";
import { AI_GOAL_REVIEW_SCHEMA_VERSION } from "./aiGoalReview";
import { aiSignalLabel, selectAIStartGuidance, selectPrimaryAIRecommendation, shortenAIStartSummary } from "./aiStartGuidance";
import type { Goal, GoalAction } from "./types";

const recommendation = (id: string, horizon: AIGoalReviewRecommendation["horizon"], changes: Partial<AIGoalReviewRecommendation> = {}): AIGoalReviewRecommendation => ({
  id, title: id, reason: "Powód", suggestedNextStep: "Krok", horizon, confidence: "medium", goalIds: [], actionIds: [], signalKeys: [], ...changes
});

const review = (recommendations: AIGoalReviewRecommendation[]): AIGoalReview => ({
  reviewId: "review", status: "ready", cached: false, generatedAt: "2026-09-19T10:00:00.000Z", periodStart: "2026-08-22", periodEnd: "2026-09-19", provider: "test", model: "test", analyzedGoalIds: [], omittedGoalIds: [],
  review: { schemaVersion: AI_GOAL_REVIEW_SCHEMA_VERSION, headline: "Kierunek", summary: "Podsumowanie", overallStatus: "attention", recommendations, checks: [], goalAssessments: [] }
});
const goal = (changes: Partial<Goal> = {}): Goal => ({ id: "goal", title: "Cel", outcome: "Rezultat", kind: "custom", status: "active", visibility: "active", priority: "normal", ...changes });
const action = (changes: Partial<GoalAction> = {}): GoalAction => ({ id: "action", version: 1, title: "Działanie", detail: "", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [], ...changes });

describe("AI start guidance", () => {
  it("wybiera now, potem this_week, a na końcu pierwszy dostępny element", () => {
    expect(selectPrimaryAIRecommendation([recommendation("later", "later"), recommendation("week", "this_week"), recommendation("now", "now")])?.id).toBe("now");
    expect(selectPrimaryAIRecommendation([recommendation("later", "later"), recommendation("week", "this_week")])?.id).toBe("week");
    expect(selectPrimaryAIRecommendation([recommendation("later", "later")])?.id).toBe("later");
    expect(selectPrimaryAIRecommendation([])).toBeUndefined();
  });

  it("wybiera szkic, Działanie, Cel albo jawny brak CTA", () => {
    const activeGoal = goal();
    const openAction = action();
    expect(selectAIStartGuidance(review([recommendation("draft", "now", { goalIds: [activeGoal.id], actionIds: [openAction.id], draftAction: { goalId: activeGoal.id, title: "Krok", detail: "" } })]), [activeGoal], [openAction]).cta.kind).toBe("draft");
    expect(selectAIStartGuidance(review([recommendation("action", "now", { goalIds: [activeGoal.id], actionIds: [openAction.id] })]), [activeGoal], [openAction]).cta.kind).toBe("action");
    expect(selectAIStartGuidance(review([recommendation("goal", "now", { goalIds: [activeGoal.id] })]), [activeGoal], []).cta.kind).toBe("goal");
    expect(selectAIStartGuidance(review([recommendation("none", "now", { goalIds: [activeGoal.id], actionIds: [openAction.id], draftAction: { goalId: activeGoal.id, title: "Krok", detail: "" } })]), [goal({ status: "paused" })], [action({ status: "completed" })]).cta.kind).toBe("none");
  });

  it("mapuje znane i nieznane sygnały", () => {
    expect(aiSignalLabel("goal:1:missing-next-action")).toBe("brak następnego Działania");
    expect(aiSignalLabel("goal:1:blocked:2")).toBe("2 blokady");
    expect(aiSignalLabel("future-signal")).toBe("sygnał z danych przestrzeni pracy");
  });

  it("skraca prezentację, zachowując pełną treść", () => {
    const summary = "Bardzo długie podsumowanie ".repeat(20).trim();
    const result = shortenAIStartSummary(summary, 80);
    expect(result.visible.length).toBeLessThanOrEqual(80);
    expect(result.visible.endsWith("…")).toBe(true);
    expect(result.full).toBe(summary);
    expect(result.truncated).toBe(true);
  });
});
