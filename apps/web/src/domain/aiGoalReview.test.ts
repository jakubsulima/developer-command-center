import { describe, expect, it } from "vitest";
import { AIGoalReviewError, decodeAIGoalReview, decodeAIGoalReviewContent } from "./aiGoalReview";

const validContent = {
  schemaVersion: 1,
  headline: "Jeden Cel wymaga uwagi",
  summary: "Najpierw usuń blokadę.",
  overallStatus: "attention",
  recommendations: [{ id: "rec-1", title: "Usuń blokadę", reason: "Działanie jest zablokowane.", suggestedNextStep: "Podejmij decyzję.", horizon: "now", confidence: "high", goalIds: ["goal-1"], actionIds: ["action-1"], signalKeys: ["goal:goal-1:blocked:1"] }],
  checks: [{ id: "check-1", question: "Czy termin jest aktualny?", whyItMatters: "Zmienia kolejność pracy.", goalIds: ["goal-1"], signalKeys: [] }],
  goalAssessments: [{ goalId: "goal-1", status: "attention", rationale: "Jest blokada.", nextStep: "Podejmij decyzję.", signalKeys: ["goal:goal-1:blocked:1"] }]
};

describe("AI Goal Review contract", () => {
  it("dekoduje pełny, typowany wynik", () => {
    expect(decodeAIGoalReview({ reviewId: "review-1", status: "ready", cached: false, generatedAt: "2026-08-25T10:00:00Z", periodStart: "2026-07-28", periodEnd: "2026-08-25", provider: "nvidia", model: "model", analyzedGoalIds: ["goal-1"], omittedGoalIds: [], review: validContent }).review.headline).toBe(validContent.headline);
  });

  it.each([
    { ...validContent, extra: true },
    { ...validContent, overallStatus: "great" },
    { ...validContent, headline: "x".repeat(181) },
    { ...validContent, recommendations: [...validContent.recommendations, { ...validContent.recommendations[0] }] }
  ])("odrzuca nieufny payload: %#", (payload) => {
    expect(() => decodeAIGoalReviewContent(payload)).toThrow(AIGoalReviewError);
  });
});
