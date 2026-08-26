export const AI_GOAL_REVIEW_SCHEMA_VERSION = 1 as const;

export type AIGoalStatus = "on_track" | "attention" | "stuck" | "insufficient_data";
export type AIReviewHorizon = "now" | "this_week" | "later";
export type AIReviewConfidence = "low" | "medium" | "high";

export interface AIGoalReviewRecommendation {
  id: string;
  title: string;
  reason: string;
  suggestedNextStep: string;
  horizon: AIReviewHorizon;
  confidence: AIReviewConfidence;
  goalIds: string[];
  actionIds: string[];
  signalKeys: string[];
  draftAction?: { goalId: string; title: string; detail: string };
}

export interface AIGoalReviewCheck {
  id: string;
  question: string;
  whyItMatters: string;
  goalIds: string[];
  signalKeys: string[];
}

export interface AIGoalAssessment {
  goalId: string;
  status: AIGoalStatus;
  rationale: string;
  nextStep: string | null;
  signalKeys: string[];
}

export interface AIGoalReviewContent {
  schemaVersion: typeof AI_GOAL_REVIEW_SCHEMA_VERSION;
  headline: string;
  summary: string;
  overallStatus: AIGoalStatus;
  recommendations: AIGoalReviewRecommendation[];
  checks: AIGoalReviewCheck[];
  goalAssessments: AIGoalAssessment[];
}

export interface AIGoalReview {
  reviewId: string;
  status: "ready";
  cached: boolean;
  stale?: boolean;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  provider: string;
  model: string;
  analyzedGoalIds: string[];
  omittedGoalIds: string[];
  review: AIGoalReviewContent;
}

export type AIGoalReviewFeedbackRating = "helpful" | "not_helpful";

export class AIGoalReviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AIGoalReviewError";
  }
}

const statuses = ["on_track", "attention", "stuck", "insufficient_data"] as const;
const horizons = ["now", "this_week", "later"] as const;
const confidences = ["low", "medium", "high"] as const;

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", `${label}: oczekiwano obiektu.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", `${label}: niedozwolone pola: ${extras.join(", ")}.`);
}

function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", `${label}: nieprawidłowy tekst.`);
  return value.trim();
}

function nullableText(value: unknown, label: string, max: number) {
  return value === null ? null : text(value, label, max);
}

function stringArray(value: unknown, label: string, max: number) {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== "string")) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", `${label}: oczekiwano listy tekstów.`);
  const result = value as string[];
  if (new Set(result).size !== result.length) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", `${label}: duplikaty nie są dozwolone.`);
  return result;
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", `${label}: nieznana wartość.`);
  return value as T;
}

export function decodeAIGoalReviewContent(payload: unknown): AIGoalReviewContent {
  const root = object(payload, "review");
  exactKeys(root, ["schemaVersion", "headline", "summary", "overallStatus", "recommendations", "checks", "goalAssessments"], "review");
  if (root.schemaVersion !== AI_GOAL_REVIEW_SCHEMA_VERSION) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "review.schemaVersion: nieobsługiwana wersja.");
  if (!Array.isArray(root.recommendations) || root.recommendations.length > 5) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "review.recommendations: maksymalnie 5 elementów.");
  if (!Array.isArray(root.checks) || root.checks.length > 5) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "review.checks: maksymalnie 5 elementów.");
  if (!Array.isArray(root.goalAssessments) || root.goalAssessments.length > 50) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "review.goalAssessments: nieprawidłowa lista.");

  const recommendations = root.recommendations.map((item, index) => {
    const value = object(item, `recommendations[${index}]`);
    exactKeys(value, ["id", "title", "reason", "suggestedNextStep", "horizon", "confidence", "goalIds", "actionIds", "signalKeys", "draftAction"], `recommendations[${index}]`);
    let draftAction: AIGoalReviewRecommendation["draftAction"];
    if (value.draftAction !== undefined) {
      const draft = object(value.draftAction, `recommendations[${index}].draftAction`);
      exactKeys(draft, ["goalId", "title", "detail"], `recommendations[${index}].draftAction`);
      draftAction = { goalId: text(draft.goalId, "draftAction.goalId", 80), title: text(draft.title, "draftAction.title", 300), detail: typeof draft.detail === "string" && draft.detail.length <= 1000 ? draft.detail.trim() : "" };
    }
    return {
      id: text(value.id, "recommendation.id", 80),
      title: text(value.title, "recommendation.title", 160),
      reason: text(value.reason, "recommendation.reason", 800),
      suggestedNextStep: text(value.suggestedNextStep, "recommendation.suggestedNextStep", 500),
      horizon: enumeration(value.horizon, horizons, "recommendation.horizon"),
      confidence: enumeration(value.confidence, confidences, "recommendation.confidence"),
      goalIds: stringArray(value.goalIds, "recommendation.goalIds", 50),
      actionIds: stringArray(value.actionIds, "recommendation.actionIds", 100),
      signalKeys: stringArray(value.signalKeys, "recommendation.signalKeys", 100),
      draftAction
    };
  });

  const checks = root.checks.map((item, index) => {
    const value = object(item, `checks[${index}]`);
    exactKeys(value, ["id", "question", "whyItMatters", "goalIds", "signalKeys"], `checks[${index}]`);
    return { id: text(value.id, "check.id", 80), question: text(value.question, "check.question", 500), whyItMatters: text(value.whyItMatters, "check.whyItMatters", 800), goalIds: stringArray(value.goalIds, "check.goalIds", 50), signalKeys: stringArray(value.signalKeys, "check.signalKeys", 100) };
  });

  const goalAssessments = root.goalAssessments.map((item, index) => {
    const value = object(item, `goalAssessments[${index}]`);
    exactKeys(value, ["goalId", "status", "rationale", "nextStep", "signalKeys"], `goalAssessments[${index}]`);
    return { goalId: text(value.goalId, "assessment.goalId", 80), status: enumeration(value.status, statuses, "assessment.status"), rationale: text(value.rationale, "assessment.rationale", 800), nextStep: nullableText(value.nextStep, "assessment.nextStep", 500), signalKeys: stringArray(value.signalKeys, "assessment.signalKeys", 100) };
  });
  if (new Set(recommendations.map((item) => item.id)).size !== recommendations.length || new Set(checks.map((item) => item.id)).size !== checks.length || new Set(goalAssessments.map((item) => item.goalId)).size !== goalAssessments.length) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "Wynik zawiera duplikaty.");

  return { schemaVersion: AI_GOAL_REVIEW_SCHEMA_VERSION, headline: text(root.headline, "review.headline", 180), summary: text(root.summary, "review.summary", 1600), overallStatus: enumeration(root.overallStatus, statuses, "review.overallStatus"), recommendations, checks, goalAssessments };
}

export function decodeAIGoalReview(payload: unknown): AIGoalReview {
  const root = object(payload, "AIGoalReview");
  exactKeys(root, ["reviewId", "status", "cached", "stale", "generatedAt", "periodStart", "periodEnd", "provider", "model", "analyzedGoalIds", "omittedGoalIds", "review"], "AIGoalReview");
  if (root.status !== "ready" || typeof root.cached !== "boolean") throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "Nieprawidłowy status przeglądu.");
  return {
    reviewId: text(root.reviewId, "reviewId", 80), status: "ready", cached: root.cached,
    stale: typeof root.stale === "boolean" ? root.stale : undefined,
    generatedAt: text(root.generatedAt, "generatedAt", 40), periodStart: text(root.periodStart, "periodStart", 40), periodEnd: text(root.periodEnd, "periodEnd", 40),
    provider: text(root.provider, "provider", 80), model: text(root.model, "model", 200),
    analyzedGoalIds: stringArray(root.analyzedGoalIds, "analyzedGoalIds", 50), omittedGoalIds: stringArray(root.omittedGoalIds, "omittedGoalIds", 1000),
    review: decodeAIGoalReviewContent(root.review)
  };
}
