import type { GoalAction } from "./types";

export function validateReviewOn(value: string | null | undefined) {
  if (value == null || value === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("invalid_action_review_date");
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("invalid_action_review_date");
  return value;
}

export function isWaitingAction(action: GoalAction, today: string) {
  return action.status === "blocked" && Boolean(action.reviewOn && action.reviewOn <= today);
}
