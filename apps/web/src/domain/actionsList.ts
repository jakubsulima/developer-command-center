import type { AppState, GoalAction } from "./types";
import { isActionInTodayProjection, localDateForTimeZone } from "./activity";

export const actionListViews = ["open", "today", "overdue", "unscheduled", "blocked", "completed"] as const;
export type ActionListView = typeof actionListViews[number];

export interface ActionListFilter {
  view: ActionListView;
  projectId?: string;
  goalId?: string;
  today?: string;
}

export const actionListViewLabels: Record<ActionListView, string> = {
  open: "Otwarte",
  today: "Na dziś",
  overdue: "Zaległe",
  unscheduled: "Bez terminu",
  blocked: "Zablokowane",
  completed: "Ukończone"
};

export const actionListViewValues = actionListViews;

export function isActionListView(value: string | null | undefined): value is ActionListView {
  return Boolean(value && actionListViews.includes(value as ActionListView));
}

export function actionListFilterFromState(state: AppState, filter: Omit<ActionListFilter, "today"> & { today?: string }): ActionListFilter {
  return { ...filter, today: filter.today ?? localDateForTimeZone(new Date(), state.workspaceTimezone) };
}

export function isActionVisibleInList(state: AppState, action: GoalAction) {
  const goal = action.goalId ? state.goals.find((candidate) => candidate.id === action.goalId) : undefined;
  const actionProject = action.areaId ? state.areas.find((candidate) => candidate.id === action.areaId) : undefined;
  const goalProject = goal?.areaId ? state.areas.find((candidate) => candidate.id === goal.areaId) : undefined;
  return (!action.goalId || Boolean(goal && goal.visibility === "active"))
    && (!action.areaId || Boolean(actionProject && actionProject.visibility === "active"))
    && (!goal?.areaId || Boolean(goalProject && goalProject.visibility === "active"));
}

export function actionBelongsToProject(state: AppState, action: GoalAction, projectId: string) {
  const goal = action.goalId ? state.goals.find((candidate) => candidate.id === action.goalId) : undefined;
  return action.areaId === projectId || goal?.areaId === projectId;
}

export function matchesActionListFilter(state: AppState, action: GoalAction, filter: ActionListFilter) {
  if (!isActionVisibleInList(state, action)) return false;
  if (filter.goalId && action.goalId !== filter.goalId) return false;
  if (filter.projectId && !actionBelongsToProject(state, action, filter.projectId)) return false;
  const today = filter.today ?? localDateForTimeZone(new Date(), state.workspaceTimezone);
  const open = ["ready", "in_progress", "blocked"].includes(action.status);
  if (filter.view === "completed") return action.status === "completed";
  if (!open) return false;
  if (filter.view === "today") return isActionInTodayProjection(action, today);
  if (filter.view === "overdue") return Boolean(action.scheduledFor && action.scheduledFor < today);
  if (filter.view === "unscheduled") return !action.scheduledFor;
  if (filter.view === "blocked") return action.status === "blocked";
  return true;
}

export function actionListSortValue(action: GoalAction, view: ActionListView) {
  if (view === "completed") return action.completedAt ?? action.updatedAt ?? "0000-01-01T00:00:00.000Z";
  return action.scheduledFor ?? "9999-12-31";
}

export function actionListSortDirection(view: ActionListView): "asc" | "desc" {
  return view === "completed" ? "desc" : "asc";
}
