import { localDateForTimeZone } from "./activity";
import type { GoalAction, RecurringActionTemplate } from "./types";

export type ActionDateStyle = "compact" | "detail";

function calendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatActionDate(value: string, timeZone: string, options: { style?: ActionDateStyle; today?: string } = {}) {
  const style = options.style ?? "compact";
  const today = options.today ?? localDateForTimeZone(new Date(), timeZone);
  const includeYear = style === "detail" || value.slice(0, 4) !== today.slice(0, 4);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: style === "detail" ? "long" : "short",
    year: includeYear ? "numeric" : undefined,
    timeZone
  }).format(calendarDate(value));
}

export function shiftActionDate(value: string, amount: number) {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function describeActionSchedule(action: Pick<GoalAction, "scheduledFor" | "pinnedToToday">, today: string, timeZone: string, style: ActionDateStyle = "compact") {
  if (!action.scheduledFor) return action.pinnedToToday ? "Na dziś" : "Bez terminu";
  if (action.scheduledFor === today) return "Dzisiaj";
  if (action.scheduledFor === shiftActionDate(today, 1)) return "Jutro";
  const formatted = formatActionDate(action.scheduledFor, timeZone, { style, today });
  return action.scheduledFor < today ? `Zaległe · ${formatted}` : formatted;
}

export function resolveRoutineTitle(action: Pick<GoalAction, "recurringTemplateId">, templates: readonly Pick<RecurringActionTemplate, "id" | "title">[]) {
  if (!action.recurringTemplateId) return undefined;
  const title = templates.find((template) => template.id === action.recurringTemplateId)?.title.trim();
  return title ? `Rutyna: ${title}` : "Z Rutyny";
}
