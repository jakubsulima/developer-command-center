import type { AIGoalReview, AIGoalReviewRecommendation, AIGoalStatus, AIReviewHorizon } from "./aiGoalReview";
import type { Goal, GoalAction } from "./types";

export const aiReviewHorizonLabels: Record<AIReviewHorizon, string> = {
  now: "teraz",
  this_week: "w tym tygodniu",
  later: "później"
};

export const aiGoalStatusLabels: Record<AIGoalStatus, string> = {
  on_track: "na dobrej drodze",
  attention: "wymaga uwagi",
  stuck: "zablokowany",
  insufficient_data: "brak danych"
};

export function aiGoalReviewErrorCopy(code?: string) {
  if (code === "AI_NOT_CONFIGURED") return "Przegląd AI nie jest jeszcze skonfigurowany. Podsumowanie systemowe pozostaje dostępne.";
  if (code === "AI_RATE_LIMITED") return "Limit analiz został osiągnięty. Spróbuj ponownie później.";
  if (code === "NO_ACTIVE_GOALS") return "Dodaj aktywny Cel, aby uruchomić analizę.";
  if (code === "CONTEXT_TOO_LARGE") return "Zakres jest zbyt duży do pojedynczej analizy. Żaden Cel nie został pominięty po cichu.";
  return "Nie udało się odświeżyć analizy. Poprzedni wynik i podsumowanie systemowe nadal są dostępne.";
}

export function aiSignalLabel(key: string) {
  if (key.includes(":missing-next-action")) return "brak następnego Działania";
  if (key.includes(":missing-criteria")) return "brak kryteriów sukcesu";
  if (key.includes(":blocked:")) return `${key.split(":").at(-1)} blokady`;
  if (key.includes(":overdue-actions:")) return `${key.split(":").at(-1)} zaległe Działania`;
  if (key.endsWith(":overdue-goal")) return "przekroczony termin Celu";
  if (key.endsWith(":due-soon")) return "bliski termin";
  if (key.includes(":inactive:")) return `brak aktywności od ${key.split(":").at(-1)} dni`;
  if (key.includes(":too-many-open-actions:")) return `${key.split(":").at(-1)} otwartych Działań`;
  return "sygnał z danych przestrzeni pracy";
}

export function selectPrimaryAIRecommendation(recommendations: AIGoalReviewRecommendation[]) {
  return recommendations.find((item) => item.horizon === "now")
    ?? recommendations.find((item) => item.horizon === "this_week")
    ?? recommendations[0];
}

export type AIStartGuidanceCTA =
  | { kind: "draft"; draft: NonNullable<AIGoalReviewRecommendation["draftAction"]> }
  | { kind: "action"; action: GoalAction; to: string }
  | { kind: "goal"; goal: Goal; to: string }
  | { kind: "none" };

export interface AIStartGuidanceSelection {
  recommendation?: AIGoalReviewRecommendation;
  cta: AIStartGuidanceCTA;
  signalLabels: string[];
}

const actionIsAvailable = (action: GoalAction) => !["completed", "cancelled", "skipped"].includes(action.status);
const goalIsAvailable = (goal: Goal) => goal.status === "active" && goal.visibility === "active";

export function selectAIStartGuidance(review: AIGoalReview, goals: Goal[], actions: GoalAction[]): AIStartGuidanceSelection {
  const recommendation = selectPrimaryAIRecommendation(review.review.recommendations);
  if (!recommendation) return { cta: { kind: "none" }, signalLabels: [] };

  const activeDraftGoal = recommendation.draftAction
    ? goals.find((goal) => goal.id === recommendation.draftAction?.goalId && goalIsAvailable(goal))
    : undefined;
  const action = recommendation.actionIds
    .map((id) => actions.find((candidate) => candidate.id === id))
    .find((candidate): candidate is GoalAction => Boolean(candidate && actionIsAvailable(candidate)));
  const goal = recommendation.goalIds
    .map((id) => goals.find((candidate) => candidate.id === id))
    .find((candidate): candidate is Goal => Boolean(candidate && goalIsAvailable(candidate)));

  const cta: AIStartGuidanceCTA = recommendation.draftAction && activeDraftGoal
    ? { kind: "draft", draft: recommendation.draftAction }
    : action
      ? { kind: "action", action, to: `/actions/${encodeURIComponent(action.id)}` }
      : goal
        ? { kind: "goal", goal, to: `/goals/${encodeURIComponent(goal.id)}` }
        : { kind: "none" };

  return {
    recommendation,
    cta,
    signalLabels: recommendation.signalKeys.slice(0, 3).map(aiSignalLabel)
  };
}

export function shortenAIStartSummary(summary: string, maxLength = 280) {
  if (summary.length <= maxLength) return { visible: summary, full: summary, truncated: false };
  const candidate = summary.slice(0, Math.max(0, maxLength - 1));
  const boundary = candidate.lastIndexOf(" ");
  const visible = `${candidate.slice(0, boundary > maxLength * 0.65 ? boundary : candidate.length).trimEnd()}…`;
  return { visible, full: summary, truncated: true };
}
