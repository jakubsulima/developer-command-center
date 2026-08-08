import type { AppState, GoalAction, RecurringActionTemplate } from "./types";

const DAY_MS = 86_400_000;

function date(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!));
}

function format(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, amount: number) {
  const result = date(value);
  result.setUTCDate(result.getUTCDate() + amount);
  return format(result);
}

const weekdayLabels = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

function plural(value: number, singular: string, few: string, many: string) {
  if (value === 1) return singular;
  const last = value % 10;
  const lastTwo = value % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? few : many;
}

export function describeRecurringSchedule(template: Pick<RecurringActionTemplate, "startsOn" | "rule">) {
  const interval = Math.max(1, template.rule.interval);
  if (template.rule.unit === "day") return interval === 1 ? "Codziennie" : `Co ${interval} ${plural(interval, "dzień", "dni", "dni")}`;
  if (template.rule.unit === "month") {
    const prefix = interval === 1 ? "Co miesiąc" : `Co ${interval} ${plural(interval, "miesiąc", "miesiące", "miesięcy")}`;
    const day = template.rule.dayOfMonth ?? Number(template.startsOn.slice(8, 10));
    return `${prefix} · ${day}. dzień miesiąca`;
  }
  const prefix = interval === 1 ? "Co tydzień" : `Co ${interval} ${plural(interval, "tydzień", "tygodnie", "tygodni")}`;
  const weekdays = template.rule.weekdays?.length
    ? [...template.rule.weekdays].sort((a, b) => a - b)
    : [date(template.startsOn).getUTCDay()];
  return `${prefix} · ${weekdays.map((day) => weekdayLabels[day]).join(", ")}`;
}

function dayDifference(from: string, to: string) {
  return Math.round((date(to).getTime() - date(from).getTime()) / DAY_MS);
}

function monthDifference(from: string, to: string) {
  const start = date(from);
  const end = date(to);
  return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
}

function lastDayOfMonth(value: string) {
  const current = date(value);
  return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();
}

export function isOccurrenceDate(template: RecurringActionTemplate, candidate: string) {
  if (candidate < template.startsOn || (template.rule.endsOn && candidate > template.rule.endsOn)) return false;
  const interval = Math.max(1, template.rule.interval);
  const days = dayDifference(template.startsOn, candidate);
  if (template.rule.unit === "day") return days % interval === 0;
  if (template.rule.unit === "week") {
    const weekdays = template.rule.weekdays?.length
      ? template.rule.weekdays
      : [date(template.startsOn).getUTCDay()];
    return Math.floor(days / 7) % interval === 0 && weekdays.includes(date(candidate).getUTCDay());
  }
  const months = monthDifference(template.startsOn, candidate);
  if (months < 0 || months % interval !== 0) return false;
  const desired = template.rule.dayOfMonth ?? date(template.startsOn).getUTCDate();
  return date(candidate).getUTCDate() === Math.min(desired, lastDayOfMonth(candidate));
}

export function occurrenceDatesBetween(template: RecurringActionTemplate, from: string, through: string, limit = 5000) {
  if (through < from) return [];
  const results: string[] = [];
  let cursor = from < template.startsOn ? template.startsOn : from;
  let checked = 0;
  while (cursor <= through && checked < limit) {
    if (isOccurrenceDate(template, cursor)) results.push(cursor);
    cursor = addDays(cursor, 1);
    checked += 1;
  }
  return results;
}

export function nextOccurrenceDates(template: RecurringActionTemplate, from: string, count = 3) {
  const results: string[] = [];
  let cursor = from < template.startsOn ? template.startsOn : from;
  let checked = 0;
  while (results.length < count && checked < 5000) {
    if (isOccurrenceDate(template, cursor)) results.push(cursor);
    cursor = addDays(cursor, 1);
    checked += 1;
  }
  return results;
}

function occurrenceAction(template: RecurringActionTemplate, occurrenceDate: string, position: number): GoalAction {
  return {
    id: `${template.id}-${occurrenceDate}`,
    version: 1,
    title: template.title,
    detail: template.detail,
    goalId: template.goalId,
    areaId: template.areaId,
    status: "ready",
    position,
    isNext: false,
    pinnedToToday: false,
    scheduledFor: occurrenceDate,
    recurringTemplateId: template.id,
    occurrenceDate,
    checklist: template.checklist.map((item, index) => ({
      id: `${template.id}-${occurrenceDate}-${index}`,
      title: item.title,
      completed: false
    })),
    createdAt: new Date(`${occurrenceDate}T00:00:00.000Z`).toISOString(),
    updatedAt: new Date(`${occurrenceDate}T00:00:00.000Z`).toISOString()
  };
}

/** Materializes a bounded set of due occurrences and records skipped backlog. */
export function materializeRecurringActions(state: AppState, today: string): AppState {
  const actions = [...state.actions];
  const templates = state.recurringActionTemplates.map((template) => {
    if (template.status !== "active" || template.startsOn > today) return template;
    const from = template.lastMaterializedOn ? addDays(template.lastMaterializedOn, 1) : template.startsOn;
    const due = occurrenceDatesBetween(template, from, today, 1000);
    if (!due.length) return template;
    const existing = new Set(actions
      .filter((action) => action.recurringTemplateId === template.id)
      .map((action) => action.occurrenceDate));
    const missing = due.filter((occurrence) => !existing.has(occurrence));
    const target = template.missedPolicy === "carry_one"
      ? missing.at(-1)
      : missing.includes(today) ? today : undefined;
    if (target) actions.push(occurrenceAction(template, target, actions.length));
    const skipped = missing.length - (target ? 1 : 0);
    return {
      ...template,
      lastMaterializedOn: today,
      skippedOccurrenceCount: template.skippedOccurrenceCount + skipped,
      updatedAt: new Date(`${today}T00:00:00.000Z`).toISOString()
    };
  });
  return { ...state, actions, recurringActionTemplates: templates };
}

export function todayActionSections(state: AppState, today: string) {
  const active = state.actions.filter((action) => !["completed", "skipped", "cancelled"].includes(action.status));
  return {
    overdue: active.filter((action) => Boolean(action.scheduledFor && action.scheduledFor < today)),
    today: active.filter((action) => action.scheduledFor === today || (!action.scheduledFor && action.pinnedToToday)),
    upcoming: active.filter((action) => Boolean(action.scheduledFor && action.scheduledFor > today)).sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!)).slice(0, 5)
  };
}
