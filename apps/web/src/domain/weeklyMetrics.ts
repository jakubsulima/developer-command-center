import type { AppState } from "./types";
import { selectWorkspaceActivity, workspaceWeekBounds } from "./activity";

export function selectWeeklyMetrics(state: AppState, now = new Date(), source: "demo" | "supabase" = "demo") {
  const { startDate, endDate } = workspaceWeekBounds(now, state.workspaceTimezone);
  const local = selectWorkspaceActivity(state, now);
  if (source === "demo") return { available: true, activity: local };
  const summary = state.weeklySummary;
  const available = Boolean(summary && summary.periodStart === startDate && summary.periodEnd === endDate);
  return { available, activity: {
    periodStart: startDate, periodEnd: endDate,
    completedActions: available ? summary!.completedActions : 0,
    knowledgeAdded: available ? summary!.knowledgeAdded : 0,
    progressUpdates: available ? summary!.progressUpdates : 0,
  } };
}
