import { workspaceWeekBounds } from "./activity";
import type { ReviewRecord, WeeklyReviewSnapshot } from "./types";

export type WeeklyTrendMetric = keyof WeeklyReviewSnapshot["metrics"];

export interface WeeklyTrendPoint {
  startDate: string;
  endDateExclusive: string;
  revision?: number;
  timeZone?: string;
  metrics?: WeeklyReviewSnapshot["metrics"];
  partial: boolean;
  missing: boolean;
  differentTimeZone: boolean;
}

function shiftDate(value: string, days: number) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function recordPeriod(review: ReviewRecord) {
  return {
    startDate: review.periodStart ?? review.snapshot?.period.startDate,
    endDateExclusive: review.periodEndExclusive ?? review.snapshot?.period.endDateExclusive,
    timeZone: review.workspaceTimezone ?? review.snapshot?.period.timeZone
  };
}

export function weeklyReviewTrendPoints(reviews: ReviewRecord[], weeks: 4 | 8 | 12, timeZone: string, now = new Date()): WeeklyTrendPoint[] {
  const currentWeekStart = workspaceWeekBounds(now, timeZone).startDate;
  const starts = Array.from({ length: weeks }, (_, index) => shiftDate(currentWeekStart, -(weeks - index - 1) * 7));
  return starts.map((startDate) => {
    const endDateExclusive = shiftDate(startDate, 7);
    const sameDates = reviews.filter((review) => {
      const period = recordPeriod(review);
      return review.type === "weekly" && period.startDate === startDate && period.endDateExclusive === endDateExclusive;
    });
    const inTimeZone = sameDates.filter((review) => recordPeriod(review).timeZone === timeZone && review.snapshot);
    const review = [...inTimeZone].sort((left, right) => (right.revision ?? 1) - (left.revision ?? 1) || right.completedAt.localeCompare(left.completedAt))[0];
    const period = review ? recordPeriod(review) : undefined;
    return {
      startDate,
      endDateExclusive,
      revision: review?.revision ?? (review?.snapshot ? 1 : undefined),
      timeZone: period?.timeZone ?? (sameDates.length ? recordPeriod(sameDates[0]!).timeZone : undefined),
      metrics: review?.snapshot?.metrics,
      partial: startDate >= currentWeekStart,
      missing: !review,
      differentTimeZone: !review && sameDates.length > 0
    };
  });
}

export function weeklyReviewTrendValue(review: ReviewRecord, metric: WeeklyTrendMetric): number | undefined {
  return review.snapshot?.metrics[metric];
}

export interface WeeklyReviewMarkdownOptions {
  includeDecision: boolean;
  includePlan: boolean;
}

const actionStatusLabel: Record<WeeklyReviewSnapshot["plan"]["actions"][number]["status"], string> = {
  ready: "Gotowe",
  in_progress: "W toku",
  testing: "Do sprawdzenia",
  blocked: "Zablokowane",
  completed: "Ukończone",
  skipped: "Pominięte",
  cancelled: "Anulowane"
};

export function buildWeeklyReviewMarkdown(review: ReviewRecord, options: WeeklyReviewMarkdownOptions): string {
  const snapshot = review.snapshot;
  if (!snapshot) throw new Error("weekly_review_snapshot_missing");
  const startDate = review.periodStart ?? snapshot.period.startDate;
  const endDateExclusive = review.periodEndExclusive ?? snapshot.period.endDateExclusive;
  const timeZone = review.workspaceTimezone ?? snapshot.period.timeZone;
  const lines = [
    `# Podsumowanie tygodnia ${startDate} – ${shiftDate(endDateExclusive, -1)}`,
    "",
    `- Strefa: ${timeZone}`,
    `- Rewizja: ${review.revision ?? 1}`,
    `- Zapisano: ${review.completedAt}`,
    "",
    "## Wyniki",
    "",
    `- Ukończone Działania: ${snapshot.metrics.completedActions}`,
    `- Dodana Wiedza: ${snapshot.metrics.knowledgeAdded}`,
    `- Aktualizacje postępu: ${snapshot.metrics.progressUpdates}`,
    "",
    "## Podsumowanie",
    "",
    snapshot.summary || "Brak zapisanego podsumowania."
  ];
  if (options.includeDecision && snapshot.note.trim()) lines.push("", "## Decyzja", "", snapshot.note.trim());
  if (options.includePlan) {
    lines.push("", "## Plan na kolejny tydzień", "");
    if (snapshot.plan.selectedGoals.length) lines.push("Priorytetowe Cele:", ...snapshot.plan.selectedGoals.map((goal) => `- ${goal.title}`), "");
    lines.push("Działania:");
    if (snapshot.plan.actions.length) lines.push(...snapshot.plan.actions.map((action) => `- ${action.title}${action.scheduledFor ? ` — ${action.scheduledFor}` : " — bez terminu"} (${actionStatusLabel[action.status]})`));
    else lines.push("- Brak zapisanych Działań.");
  }
  lines.push("", "---", "Eksport z migawki tygodniowej. Treść Przeglądu AI nie jest częścią tego zapisu.");
  return `${lines.join("\n")}\n`;
}
