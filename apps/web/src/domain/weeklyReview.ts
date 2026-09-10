import type { AppState } from "./types";
import { isVisibleWorkspaceAction, selectWorkspaceActivity, workspaceWeekBounds } from "./activity";
import { polishCount } from "./labels";

export interface WeeklyReviewSuggestion {
  id: string;
  title: string;
  detail: string;
  to: string;
}

export interface WeeklyReviewSummary {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  completedActions: number;
  /** Historical compatibility field. Active UI and new reviews do not present Focus as current work. */
  focusMinutes: number;
  knowledgeAdded: number;
  progressUpdates: number;
  generatedSummary: string;
  suggestions: WeeklyReviewSuggestion[];
}

export const isOpenAction = (action: AppState["actions"][number]) => !["completed", "skipped", "cancelled"].includes(action.status);

export function activeGoalsWithoutNextAction(state: AppState) {
  const activeGoals = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active");
  return activeGoals.filter((goal) => !state.actions.some((action) => action.goalId === goal.id && isVisibleWorkspaceAction(state, action) && action.isNext && ["ready", "in_progress"].includes(action.status)));
}

export function blockedActions(state: AppState) {
  return state.actions.filter((action) => action.status === "blocked" && isVisibleWorkspaceAction(state, action));
}

export function overdueActions(state: AppState, today: string) {
  return state.actions.filter((action) => isOpenAction(action) && isVisibleWorkspaceAction(state, action) && Boolean(action.scheduledFor && action.scheduledFor < today));
}

export function knowledgeQueue(state: AppState) {
  return state.inbox.filter((item) => item.status === "unprocessed");
}

function actionQueueRoute(view: "blocked" | "overdue", actionId?: string) {
  const params = new URLSearchParams({ view });
  if (actionId) params.set("highlight", actionId);
  return `/actions?${params.toString()}`;
}

export function weekBounds(now = new Date(), timeZone = "Europe/Warsaw") {
  const { start, end } = workspaceWeekBounds(now, timeZone);
  return { start, end };
}

export function deriveWeeklyReview(state: AppState, now = new Date()): WeeklyReviewSummary {
  const { start, end, startDate, endDate } = workspaceWeekBounds(now, state.workspaceTimezone);
  const activity = selectWorkspaceActivity(state, now);
  const serverSummary = state.weeklySummary;
  const serverSummaryMatchesPeriod = Boolean(serverSummary && (
    (!serverSummary.periodStart && !serverSummary.periodEnd) ||
    (serverSummary.periodStart === startDate && serverSummary.periodEnd === endDate)
  ));
  const completedActions = serverSummaryMatchesPeriod ? serverSummary!.completedActions : activity.completedActions;
  const knowledgeAdded = serverSummaryMatchesPeriod ? serverSummary!.knowledgeAdded : activity.knowledgeAdded;
  const progressUpdates = serverSummaryMatchesPeriod ? serverSummary!.progressUpdates : activity.progressUpdates;
  // Keep the field for old state/export readers, but never infer a new Focus
  // measurement when no compatible server aggregate is available.
  const focusMinutes = serverSummaryMatchesPeriod ? serverSummary!.focusMinutes : 0;

  const goalsWithoutNextAction = activeGoalsWithoutNextAction(state);
  const blocked = blockedActions(state);
  const unprocessedInbox = knowledgeQueue(state);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const overdue = overdueActions(state, today);

  const suggestions: WeeklyReviewSuggestion[] = [];
  if (blocked.length) suggestions.push({
    id: "blocked",
    title: `Odblokuj ${blocked.length === 1 ? "jedno Działanie" : polishCount(blocked.length, "Działanie", "Działania", "Działań")}`,
    detail: "Najpierw podejmij decyzję albo nazwij osobę, od której zależy dalszy ruch.",
    to: actionQueueRoute("blocked", blocked.length === 1 ? blocked[0]!.id : undefined)
  });
  if (goalsWithoutNextAction.length) suggestions.push({
    id: "next-actions",
    title: `Ustal następny krok dla ${goalsWithoutNextAction.length === 1 ? "jednego Celu" : polishCount(goalsWithoutNextAction.length, "Celu", "Celów", "Celów")}`,
    detail: "Cel bez konkretnego następnego Działania będzie trudny do wznowienia.",
    to: `/goals/${goalsWithoutNextAction[0]!.id}`
  });
  if (overdue.length) suggestions.push({
    id: "overdue",
    title: `Zdecyduj o ${overdue.length === 1 ? "jednym zaległym Działaniu" : polishCount(overdue.length, "zaległym Działaniu", "zaległych Działaniach", "zaległych Działaniach")}`,
    detail: "Przełóż, ukończ lub anuluj je, zamiast przenosić cały ciężar na kolejny tydzień.",
    to: actionQueueRoute("overdue", overdue.length === 1 ? overdue[0]!.id : undefined)
  });
  if (unprocessedInbox.length) suggestions.push({
    id: "inbox",
    title: `Przejrzyj ${polishCount(unprocessedInbox.length, "element kolejki Wiedzy", "elementy kolejki Wiedzy", "elementów kolejki Wiedzy")}`,
    detail: "Zacznij od tych, które mogą zmienić plan lub blokują następny krok.",
    to: "/knowledge?section=inbox"
  });
  if (!suggestions.length) suggestions.push({
    id: "continue",
    title: "Utrzymaj obecny kierunek",
    detail: "Nie widać pilnych wyjątków. Wybierz jedno najważniejsze Działanie na początek tygodnia.",
    to: "/"
  });

  const delivery = completedActions
    ? `Ukończono ${polishCount(completedActions, "Działanie", "Działania", "Działań")}`
    : "Nie odnotowano ukończonych Działań";
  const context = knowledgeAdded || progressUpdates
    ? `Dodano ${polishCount(knowledgeAdded, "element Wiedzy", "elementy Wiedzy", "elementów Wiedzy")} i ${polishCount(progressUpdates, "aktualizację postępu", "aktualizacje postępu", "aktualizacji postępu")}.`
    : "Nie dodano nowej Wiedzy ani aktualizacji postępu.";
  const attentionCount = blocked.length + overdue.length + goalsWithoutNextAction.length + unprocessedInbox.length;
  const attention = attentionCount
    ? `Wymaga uwagi: ${polishCount(attentionCount, "sprawa", "sprawy", "spraw")}. Blokady: ${polishCount(blocked.length, "blokada", "blokady", "blokad")}; zaległe: ${polishCount(overdue.length, "Działanie", "Działania", "Działań")}; bez następnego kroku: ${polishCount(goalsWithoutNextAction.length, "Cel", "Cele", "Celów")}; Skrzynka: ${polishCount(unprocessedInbox.length, "element", "elementy", "elementów")}.`
    : "Nie ma pilnych sygnałów wymagających decyzji.";

  return {
    start,
    end,
    startDate,
    endDate,
    completedActions,
    focusMinutes,
    knowledgeAdded,
    progressUpdates,
    generatedSummary: `${delivery}. ${context} ${attention}`,
    suggestions: suggestions.slice(0, 3)
  };
}
