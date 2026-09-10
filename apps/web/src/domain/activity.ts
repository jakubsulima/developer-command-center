import type { AppState, KnowledgeItem, ProgressEntry } from "./types";

export interface WorkspaceWeekBounds {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
}

export interface WorkspaceActivityCounts {
  completedActions: number;
  progressUpdates: number;
  knowledgeAdded: number;
  periodStart: string;
  periodEnd: string;
}

export function localDateForTimeZone(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Shared projection rule for Start and the complete Działania list. */
export function isActionInTodayProjection(action: AppState["actions"][number], today: string) {
  return action.scheduledFor === today || (!action.scheduledFor && action.pinnedToToday);
}

function shiftDate(value: string, amount: number) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

export function zonedStartOfDay(value: string, timeZone: string) {
  const target = new Date(`${value}T00:00:00.000Z`);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(guess);
    const numeric = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(numeric.year, numeric.month - 1, numeric.day, numeric.hour, numeric.minute, numeric.second);
    guess = new Date(guess.getTime() + target.getTime() - represented);
  }
  return guess;
}

export function workspaceWeekBounds(now = new Date(), timeZone = "Europe/Warsaw"): WorkspaceWeekBounds {
  const today = localDateForTimeZone(now, timeZone);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const startDate = shiftDate(today, -((weekday + 6) % 7));
  const endDate = shiftDate(startDate, 7);
  return { start: zonedStartOfDay(startDate, timeZone), end: zonedStartOfDay(endDate, timeZone), startDate, endDate };
}

export function withinDateRange(value: string | undefined, start: Date, end: Date) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return timestamp >= start.getTime() && timestamp < end.getTime();
}

function hasActiveVisibility(visibility: "active" | "archived" | "trashed" | undefined) {
  return visibility === undefined || visibility === "active";
}

export function belongsToVisibleWorkspaceContext(state: AppState, item: { goalId?: string; areaId?: string }) {
  const goal = item.goalId ? state.goals.find((candidate) => candidate.id === item.goalId) : undefined;
  const area = item.areaId ? state.areas.find((candidate) => candidate.id === item.areaId) : undefined;
  return (!goal || hasActiveVisibility(goal.visibility)) && (!area || hasActiveVisibility(area.visibility));
}

export function isVisibleWorkspaceAction(state: AppState, action: AppState["actions"][number]) {
  return belongsToVisibleWorkspaceContext(state, action);
}

export function isVisibleWorkspaceProgress(state: AppState, entry: ProgressEntry) {
  const goal = state.goals.find((candidate) => candidate.id === entry.goalId);
  return !goal || hasActiveVisibility(goal.visibility);
}

export function isVisibleWorkspaceKnowledge(state: AppState, item: KnowledgeItem) {
  const project = item.projectId ? state.areas.find((candidate) => candidate.id === item.projectId) : undefined;
  return (!project || hasActiveVisibility(project.visibility)) && !item.archivedAt && !item.trashedAt;
}

export function selectWorkspaceActivity(state: AppState, now = new Date()): WorkspaceActivityCounts {
  const { start, end, startDate, endDate } = workspaceWeekBounds(now, state.workspaceTimezone);
  return {
    completedActions: state.actions.filter((action) => action.status === "completed" && isVisibleWorkspaceAction(state, action) && withinDateRange(action.completedAt ?? action.updatedAt, start, end)).length,
    progressUpdates: state.progressEntries.filter((entry: ProgressEntry) => isVisibleWorkspaceProgress(state, entry) && withinDateRange(entry.createdAt, start, end)).length,
    knowledgeAdded: state.knowledge.filter((item: KnowledgeItem) => isVisibleWorkspaceKnowledge(state, item) && withinDateRange(item.createdAt, start, end)).length,
    periodStart: startDate,
    periodEnd: endDate
  };
}

export function formatWorkspaceDateRange(startDate: string, endDateExclusive: string) {
  const endDate = shiftDate(endDateExclusive, -1);
  const formatter = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${formatter.format(new Date(`${startDate}T12:00:00Z`))}–${formatter.format(new Date(`${endDate}T12:00:00Z`))}`;
}
