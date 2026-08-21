import type { AppState, Goal, GoalAction, InboxItem, KnowledgeItem, ProgressEntry } from "./types";
import { activeGoalsWithoutNextAction, blockedActions, isOpenAction, knowledgeQueue, overdueActions, withinDateRange } from "./weeklyReview";

export type HomeAttentionKind = "blocked" | "overdue" | "goal_without_next_action" | "knowledge_queue";
export type HomeRecommendationKind = HomeAttentionKind | "today_action" | "calm";

export interface HomeAttentionSignal {
  id: string;
  kind: HomeAttentionKind;
  title: string;
  detail: string;
  to: string;
  actionId?: string;
  goalId?: string;
  inboxItemId?: string;
}

export interface HomeRecommendation {
  kind: HomeRecommendationKind;
  title: string;
  detail: string;
  to: string;
}

export interface HomeActivitySummary {
  completedActions: number;
  progressUpdates: number;
  knowledgeAdded: number;
}

export interface HomeSummary {
  today: string;
  todayActions: GoalAction[];
  overdueActions: GoalAction[];
  upcomingActions: GoalAction[];
  attentionSignals: HomeAttentionSignal[];
  attentionCount: number;
  recommendation: HomeRecommendation;
  activity: HomeActivitySummary;
  goalsWithoutNextAction: Goal[];
  knowledgeQueue: InboxItem[];
}

export function localDateForTimeZone(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftDate(value: string, amount: number) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

function zonedStartOfDay(value: string, timeZone: string) {
  const guess = new Date(`${value}T00:00:00.000Z`);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(guess);
  const numeric = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const represented = Date.UTC(numeric.year, numeric.month - 1, numeric.day, numeric.hour, numeric.minute, numeric.second);
  return new Date(guess.getTime() - (represented - guess.getTime()));
}

function localDayBounds(now: Date, timeZone: string) {
  const today = localDateForTimeZone(now, timeZone);
  const start = zonedStartOfDay(shiftDate(today, -6), timeZone);
  const end = zonedStartOfDay(shiftDate(today, 1), timeZone);
  return { today, start, end };
}

function sortByAge<T extends { id: string; createdAt?: string; scheduledFor?: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aDate = a.scheduledFor ?? a.createdAt ?? "9999-12-31";
    const bDate = b.scheduledFor ?? b.createdAt ?? "9999-12-31";
    return aDate.localeCompare(bDate) || a.id.localeCompare(b.id);
  });
}

function actionRoute(action: GoalAction) {
  return action.goalId ? `/goals/${encodeURIComponent(action.goalId)}?action=${encodeURIComponent(action.id)}` : `/actions/${encodeURIComponent(action.id)}`;
}

function signalForAction(kind: "blocked" | "overdue", action: GoalAction): HomeAttentionSignal {
  return {
    id: `${kind}-${action.id}`,
    kind,
    title: action.title,
    detail: kind === "blocked" ? action.blocker ?? "Wymaga decyzji, aby ruszyć dalej." : `Zaległe od ${action.scheduledFor}.`,
    to: actionRoute(action),
    actionId: action.id,
    goalId: action.goalId
  };
}

export function deriveHomeSummary(state: AppState, now = new Date()): HomeSummary {
  const { today, start, end } = localDayBounds(now, state.workspaceTimezone);
  const blocked = sortByAge(blockedActions(state));
  const overdue = sortByAge(
    overdueActions(state, today).filter((action) => action.status !== "blocked"),
  );
  const goalsWithoutNextAction = [...activeGoalsWithoutNextAction(state)].sort((a, b) => (a.createdAt ?? "9999").localeCompare(b.createdAt ?? "9999") || a.id.localeCompare(b.id));
  const queue = [...knowledgeQueue(state)].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const todayActions = state.actions
    .filter((action) => isOpenAction(action) && (action.scheduledFor === today || (!action.scheduledFor && action.pinnedToToday)))
    .sort((a, b) => (a.scheduledFor ?? today).localeCompare(b.scheduledFor ?? today) || a.position - b.position || a.id.localeCompare(b.id));
  const scheduledTodayActions = todayActions.filter((action) => action.scheduledFor === today);
  const upcomingActions = state.actions
    .filter((action) => isOpenAction(action) && Boolean(action.scheduledFor && action.scheduledFor > today && action.scheduledFor <= shiftDate(today, 7)))
    .sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!) || a.position - b.position || a.id.localeCompare(b.id));

  const attentionSignals: HomeAttentionSignal[] = [
    ...blocked.map((action) => signalForAction("blocked", action)),
    ...overdue.map((action) => signalForAction("overdue", action)),
    ...goalsWithoutNextAction.map((goal) => ({ id: `goal-${goal.id}`, kind: "goal_without_next_action" as const, title: goal.title, detail: "Aktywny Cel nie ma gotowego następnego Działania.", to: `/goals/${encodeURIComponent(goal.id)}`, goalId: goal.id })),
    ...queue.map((item) => ({ id: `knowledge-${item.id}`, kind: "knowledge_queue" as const, title: item.content, detail: "Element kolejki Wiedzy czeka na decyzję.", to: `/knowledge?section=inbox&status=${item.status}&item=${encodeURIComponent(item.id)}`, inboxItemId: item.id }))
  ];

  let recommendation: HomeRecommendation;
  if (blocked[0]) recommendation = { kind: "blocked", title: `Odblokuj: ${blocked[0].title}`, detail: blocked[0].blocker ?? "Podejmij decyzję, która pozwoli ruszyć dalej.", to: actionRoute(blocked[0]) };
  else if (overdue[0]) recommendation = { kind: "overdue", title: `Zdecyduj o zaległym Działaniu: ${overdue[0].title}`, detail: "Ukończ, przełóż albo anuluj — nie przenoś go bez decyzji.", to: actionRoute(overdue[0]) };
  else if (scheduledTodayActions[0]) recommendation = { kind: "today_action", title: `Zacznij od: ${scheduledTodayActions[0].title}`, detail: "To najbliższe Działanie zaplanowane na dziś.", to: actionRoute(scheduledTodayActions[0]) };
  else if (goalsWithoutNextAction[0]) recommendation = { kind: "goal_without_next_action", title: `Ustal następny krok: ${goalsWithoutNextAction[0].title}`, detail: "Aktywny Cel potrzebuje jednego konkretnego ruchu.", to: `/goals/${encodeURIComponent(goalsWithoutNextAction[0].id)}` };
  else if (queue[0]) recommendation = { kind: "knowledge_queue", title: `Przejrzyj kolejkę Wiedzy: ${queue[0].content}`, detail: "Podejmij decyzję, zanim element zacznie obciążać pamięć.", to: `/knowledge?section=inbox&status=${queue[0].status}&item=${encodeURIComponent(queue[0].id)}` };
  else recommendation = { kind: "calm", title: "Wszystko jest pod kontrolą", detail: "Nie ma pilnych wyjątków. Wybierz spokojnie kolejny krok.", to: "/?show=today" };

  return {
    today,
    todayActions,
    overdueActions: overdue,
    upcomingActions,
    attentionSignals,
    attentionCount: attentionSignals.length,
    recommendation,
    activity: {
      completedActions: state.actions.filter((action) => action.status === "completed" && withinDateRange(action.completedAt ?? action.updatedAt, start, end)).length,
      progressUpdates: state.progressEntries.filter((entry: ProgressEntry) => withinDateRange(entry.createdAt, start, end)).length,
      knowledgeAdded: state.knowledge.filter((item: KnowledgeItem) => withinDateRange(item.createdAt, start, end)).length
    },
    goalsWithoutNextAction,
    knowledgeQueue: queue
  };
}
