import { contextAllowlists, type GoalReviewContext } from "./goal-review-context.ts";

const statusValues = ["on_track", "attention", "stuck", "insufficient_data"] as const;
const horizonValues = ["now", "this_week", "later"] as const;
const confidenceValues = ["low", "medium", "high"] as const;

export const goalPortfolioReviewJsonSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "headline", "summary", "overallStatus", "recommendations", "checks", "goalAssessments"],
  properties: {
    schemaVersion: { const: 1 },
    headline: { type: "string", minLength: 1, maxLength: 180 },
    summary: { type: "string", minLength: 1, maxLength: 1600 },
    overallStatus: { enum: statusValues },
    recommendations: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["title", "reason", "suggestedNextStep", "horizon", "confidence", "goalIds", "actionIds", "signalKeys"], properties: {
      title: { type: "string", minLength: 1, maxLength: 160 }, reason: { type: "string", minLength: 1, maxLength: 800 }, suggestedNextStep: { type: "string", minLength: 1, maxLength: 500 }, horizon: { enum: horizonValues }, confidence: { enum: confidenceValues },
      goalIds: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string" } }, actionIds: { type: "array", uniqueItems: true, items: { type: "string" } }, signalKeys: { type: "array", uniqueItems: true, items: { type: "string" } },
      draftAction: { type: "object", additionalProperties: false, required: ["goalId", "title", "detail"], properties: { goalId: { type: "string" }, title: { type: "string", minLength: 1, maxLength: 300 }, detail: { type: "string", maxLength: 1000 } } },
    } } },
    checks: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["question", "whyItMatters", "goalIds", "signalKeys"], properties: { question: { type: "string", minLength: 1, maxLength: 500 }, whyItMatters: { type: "string", minLength: 1, maxLength: 800 }, goalIds: { type: "array", uniqueItems: true, items: { type: "string" } }, signalKeys: { type: "array", uniqueItems: true, items: { type: "string" } } } } },
    goalAssessments: { type: "array", maxItems: 50, items: { type: "object", additionalProperties: false, required: ["goalId", "status", "rationale", "nextStep", "signalKeys"], properties: { goalId: { type: "string" }, status: { enum: statusValues }, rationale: { type: "string", minLength: 1, maxLength: 800 }, nextStep: { type: ["string", "null"], maxLength: 500 }, signalKeys: { type: "array", uniqueItems: true, items: { type: "string" } } } } },
  },
};

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:object`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[], label: string) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error(`${label}:extra_field`);
}
function text(value: unknown, label: string, max: number, empty = false) {
  if (typeof value !== "string" || value.length > max || (!empty && !value.trim())) throw new Error(`${label}:text`);
  return value.trim();
}
function list(value: unknown, label: string, max: number) {
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== "string") || new Set(value).size !== value.length) throw new Error(`${label}:list`);
  return value as string[];
}
function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new Error(`${label}:enum`);
  return value as T;
}

export function parseProviderJson(content: string) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned) as unknown; } catch { throw new Error("invalid_json"); }
}

export function validateAndFinalizeGoalReview(payload: unknown, context: GoalReviewContext) {
  const allow = contextAllowlists(context);
  const root = object(payload, "review");
  exact(root, ["schemaVersion", "headline", "summary", "overallStatus", "recommendations", "checks", "goalAssessments"], "review");
  if (root.schemaVersion !== 1 || !Array.isArray(root.recommendations) || root.recommendations.length > 5 || !Array.isArray(root.checks) || root.checks.length > 5 || !Array.isArray(root.goalAssessments) || root.goalAssessments.length > 50) throw new Error("shape");
  const assertRefs = (goalIds: string[], actionIds: string[], signalKeys: string[]) => {
    if (goalIds.some((id) => !allow.goalIds.has(id)) || actionIds.some((id) => !allow.actionGoal.has(id)) || signalKeys.some((key) => !allow.signalKeys.has(key))) throw new Error("foreign_reference");
    if (actionIds.some((id) => !goalIds.includes(allow.actionGoal.get(id)!))) throw new Error("action_goal_mismatch");
  };
  const recommendations = root.recommendations.map((item, index) => {
    const value = object(item, `recommendation:${index}`);
    exact(value, ["title", "reason", "suggestedNextStep", "horizon", "confidence", "goalIds", "actionIds", "signalKeys", "draftAction"], `recommendation:${index}`);
    const goalIds = list(value.goalIds, "goalIds", 50); const actionIds = list(value.actionIds, "actionIds", 100); const signalKeys = list(value.signalKeys, "signalKeys", 100);
    if (!goalIds.length) throw new Error("recommendation_without_goal");
    assertRefs(goalIds, actionIds, signalKeys);
    let draftAction: { goalId: string; title: string; detail: string } | undefined;
    if (value.draftAction !== undefined) {
      const draft = object(value.draftAction, "draftAction"); exact(draft, ["goalId", "title", "detail"], "draftAction");
      const goalId = text(draft.goalId, "draftAction.goalId", 80);
      if (!allow.goalIds.has(goalId) || !goalIds.includes(goalId)) throw new Error("draft_goal_mismatch");
      draftAction = { goalId, title: text(draft.title, "draftAction.title", 300), detail: text(draft.detail, "draftAction.detail", 1000, true) };
    }
    return { id: crypto.randomUUID(), title: text(value.title, "title", 160), reason: text(value.reason, "reason", 800), suggestedNextStep: text(value.suggestedNextStep, "next", 500), horizon: enumValue(value.horizon, horizonValues, "horizon"), confidence: enumValue(value.confidence, confidenceValues, "confidence"), goalIds, actionIds, signalKeys, ...(draftAction ? { draftAction } : {}) };
  });
  const checks = root.checks.map((item, index) => {
    const value = object(item, `check:${index}`); exact(value, ["question", "whyItMatters", "goalIds", "signalKeys"], `check:${index}`);
    const goalIds = list(value.goalIds, "check.goalIds", 50); const signalKeys = list(value.signalKeys, "check.signalKeys", 100); assertRefs(goalIds, [], signalKeys);
    return { id: crypto.randomUUID(), question: text(value.question, "question", 500), whyItMatters: text(value.whyItMatters, "why", 800), goalIds, signalKeys };
  });
  const assessments = root.goalAssessments.map((item, index) => {
    const value = object(item, `assessment:${index}`); exact(value, ["goalId", "status", "rationale", "nextStep", "signalKeys"], `assessment:${index}`);
    const goalId = text(value.goalId, "assessment.goalId", 80); const signalKeys = list(value.signalKeys, "assessment.signalKeys", 100); assertRefs([goalId], [], signalKeys);
    return { goalId, status: enumValue(value.status, statusValues, "status"), rationale: text(value.rationale, "rationale", 800), nextStep: value.nextStep === null ? null : text(value.nextStep, "nextStep", 500), signalKeys };
  });
  if (new Set(assessments.map((item) => item.goalId)).size !== assessments.length) throw new Error("duplicate_assessment");
  return { schemaVersion: 1 as const, headline: text(root.headline, "headline", 180), summary: text(root.summary, "summary", 1600), overallStatus: enumValue(root.overallStatus, statusValues, "overallStatus"), recommendations, checks, goalAssessments: assessments };
}
