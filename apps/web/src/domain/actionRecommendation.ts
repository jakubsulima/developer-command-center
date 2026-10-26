import type { GoalAction } from "./types";

export function blockerTiming(action: GoalAction, today: string): "due" | "future" | "undated" {
  return !action.reviewOn ? "undated" : action.reviewOn <= today ? "due" : "future";
}
export function compareRecommendedActions(left: GoalAction, right: GoalAction, priorityGoalIds: readonly string[] = []) {
  return Number(right.pinnedToToday) - Number(left.pinnedToToday)
    || Number(Boolean(right.goalId && priorityGoalIds.includes(right.goalId))) - Number(Boolean(left.goalId && priorityGoalIds.includes(left.goalId)))
    || (left.scheduledFor ?? left.createdAt ?? "9999").localeCompare(right.scheduledFor ?? right.createdAt ?? "9999")
    || left.position - right.position || left.id.localeCompare(right.id);
}
