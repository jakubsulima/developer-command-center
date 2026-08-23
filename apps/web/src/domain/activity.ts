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

export function selectWorkspaceActivity(state: AppState, now = new Date()): WorkspaceActivityCounts {
  const { start, end, startDate, endDate } = workspaceWeekBounds(now, state.workspaceTimezone);
  return {
    completedActions: state.actions.filter((action) => action.status === "completed" && withinDateRange(action.completedAt ?? action.updatedAt, start, end)).length,
    progressUpdates: state.progressEntries.filter((entry: ProgressEntry) => withinDateRange(entry.createdAt, start, end)).length,
    knowledgeAdded: state.knowledge.filter((item: KnowledgeItem) => withinDateRange(item.createdAt, start, end)).length,
    periodStart: startDate,
    periodEnd: endDate
  };
}

export function formatWorkspaceDateRange(startDate: string, endDateExclusive: string) {
  const endDate = shiftDate(endDateExclusive, -1);
  const formatter = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${formatter.format(new Date(`${startDate}T12:00:00Z`))}–${formatter.format(new Date(`${endDate}T12:00:00Z`))}`;
}
