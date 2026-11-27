import { workspaceWeekBounds } from "./activity";
import { isVisibleWorkspaceAction } from "./activity";
import type { AppState, GoalAction } from "./types";
import { isOpenAction } from "./weeklyReview";

function shiftDate(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + days));
  return value.toISOString().slice(0, 10);
}

function workspacePlanWeek(now: Date, timeZone: string, offsetDays: number) {
  const { startDate } = workspaceWeekBounds(now, timeZone);
  const dates = Array.from({ length: 7 }, (_, index) => shiftDate(startDate, index + offsetDays));
  return { startDate: dates[0]!, endDate: dates[6]!, endDateExclusive: shiftDate(startDate, offsetDays + 7), dates };
}

export function currentWorkspaceWeek(now: Date, timeZone: string) {
  return workspacePlanWeek(now, timeZone, 0);
}

export function nextWorkspaceWeek(now: Date, timeZone: string) {
  return workspacePlanWeek(now, timeZone, 7);
}

export function weeklyPlanActions(state: AppState, selectedGoalIds: string[], includeStandalone: boolean, weekDates?: readonly string[], options: { plannedActionIds?: readonly string[]; includeUndated?: boolean } = {}): GoalAction[] {
  const selected = new Set(selectedGoalIds);
  const planned = new Set(options.plannedActionIds);
  const weekStart = weekDates?.[0];
  const weekEnd = weekDates?.[weekDates.length - 1];
  return state.actions
    .filter((action) => isOpenAction(action) && isVisibleWorkspaceAction(state, action))
    .filter((action) => {
      const inWeek = Boolean(action.scheduledFor && weekStart && weekEnd && action.scheduledFor >= weekStart && action.scheduledFor <= weekEnd);
      const inSelectedScope = action.goalId ? selected.has(action.goalId) : includeStandalone;
      return inWeek || inSelectedScope || planned.has(action.id) || (options.includeUndated && !action.scheduledFor);
    })
    .sort((left, right) => (left.scheduledFor ?? "9999-12-31").localeCompare(right.scheduledFor ?? "9999-12-31") || left.title.localeCompare(right.title, "pl"));
}

export function selectedReviewGoalIds(answers: Record<string, string | string[]>): string[] {
  const value = answers.selectedGoalIds;
  if (Array.isArray(value)) return value.filter((id): id is string => typeof id === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
