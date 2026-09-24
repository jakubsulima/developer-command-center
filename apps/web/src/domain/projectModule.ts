import type { AppState, GoalAction, KnowledgeItem, Project, RecurringActionTemplate } from "./types";
import { isActionInTodayProjection, isVisibleWorkspaceAction, localDateForTimeZone } from "./activity";
import { isOpenAction } from "./weeklyReview";
import { actionStatusLabels } from "./labels";

export type ProjectSignalKind = "blocked" | "overdue" | "today" | "next" | "available" | "testing" | "scheduled" | "empty";

export interface ProjectSignalCounts {
  currentGoals: number;
  openActions: number;
  blockedActions: number;
  overdueActions: number;
  todayActions: number;
}

export interface ProjectSignal {
  kind: ProjectSignalKind;
  actionId?: string;
  title: string;
  description: string;
  label: string;
  statusLabel?: string;
  scheduledFor?: string;
  counts: ProjectSignalCounts;
}

function formatSignalDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00.000Z`));
}

function compareActions(left: GoalAction, right: GoalAction) {
  const leftDate = left.scheduledFor ?? "9999-12-31";
  const rightDate = right.scheduledFor ?? "9999-12-31";
  if (leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
  if (left.position !== right.position) return left.position - right.position;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function statusDescription(action: GoalAction) {
  return action.status === "testing" ? "Do sprawdzenia" : actionStatusLabels[action.status];
}

/**
 * Projects one stable, current signal for a Project from the shared workspace state.
 * The optional clock keeps selection deterministic in views and tests.
 */
export function projectSignal(state: AppState, projectId: string, now = new Date()): ProjectSignal | undefined {
  const project = state.areas.find((area) => area.id === projectId && area.visibility === "active");
  if (!project) return undefined;

  const today = localDateForTimeZone(now, state.workspaceTimezone);
  const currentGoals = state.goals.filter((goal) =>
    goal.areaId === projectId && goal.visibility === "active" && !["achieved", "abandoned"].includes(goal.status)
  );
  const currentGoalIds = new Set(currentGoals.map((goal) => goal.id));
  const actions = [...new Map(state.actions
    .filter((action) => action.areaId === projectId || Boolean(action.goalId && currentGoalIds.has(action.goalId)))
    .filter((action) => isOpenAction(action) && isVisibleWorkspaceAction(state, action))
    .map((action) => [action.id, action])).values()]
    .sort(compareActions);

  const overdueActions = actions.filter((action) => action.status !== "blocked" && Boolean(action.scheduledFor && action.scheduledFor < today));
  const todayActions = actions.filter((action) => action.status !== "blocked" && isActionInTodayProjection(action, today));
  const blockedActions = actions.filter((action) => action.status === "blocked");
  const counts: ProjectSignalCounts = {
    currentGoals: currentGoals.length,
    openActions: actions.length,
    blockedActions: blockedActions.length,
    overdueActions: overdueActions.length,
    todayActions: todayActions.length
  };
  const signal = (kind: ProjectSignalKind, action: GoalAction | undefined, label: string, description: string): ProjectSignal => {
    const goalTitle = action?.goalId ? currentGoals.find((goal) => goal.id === action.goalId)?.title : undefined;
    return {
      kind,
      actionId: action?.id,
      title: action?.title ?? (currentGoals.length ? "Dodaj następne Działanie" : "Ustal pierwszy Cel"),
      description: goalTitle ? `${description} Cel: ${goalTitle}.` : description,
      label,
      statusLabel: action ? statusDescription(action) : undefined,
      scheduledFor: action?.scheduledFor,
      counts
    };
  };

  const blocked = blockedActions[0];
  if (blocked) {
    const reason = blocked.blocker?.trim() || "To Działanie czeka na odblokowanie.";
    const review = blocked.reviewOn ? ` Wróć do niego ${formatSignalDate(blocked.reviewOn)}.` : "";
    return signal("blocked", blocked, "Do odblokowania", `${reason}${review}`);
  }

  const overdue = overdueActions[0];
  if (overdue) return signal("overdue", overdue, "Wymaga decyzji", `${statusDescription(overdue)} · termin minął ${formatSignalDate(overdue.scheduledFor!)}.`);

  const todayAction = todayActions[0];
  if (todayAction) {
    const stateLabel = todayAction.status === "testing" ? "Do sprawdzenia" : statusDescription(todayAction);
    return signal("today", todayAction, "Na dziś", `${stateLabel}${todayAction.scheduledFor ? ` · termin: ${formatSignalDate(todayAction.scheduledFor)}.` : " · przypięte na dziś."}`);
  }

  const next = actions.find((action) => action.isNext && ["ready", "in_progress"].includes(action.status));
  if (next) {
    const timing = next.scheduledFor && next.scheduledFor > today ? ` · zaplanowane na ${formatSignalDate(next.scheduledFor)}.` : ".";
    return signal("next", next, "Następny krok", `${statusDescription(next)}${timing}`);
  }

  const available = actions.find((action) => ["ready", "in_progress"].includes(action.status) && !action.scheduledFor);
  if (available) return signal("available", available, "Możesz zrobić teraz", `${statusDescription(available)} · bez wyznaczonego terminu.`);

  const testing = actions.find((action) => action.status === "testing");
  if (testing) {
    const timing = testing.scheduledFor ? ` · termin: ${formatSignalDate(testing.scheduledFor)}.` : ".";
    return signal("testing", testing, "Do sprawdzenia", `${statusDescription(testing)}${timing}`);
  }

  const scheduled = actions.find((action) => Boolean(action.scheduledFor && action.scheduledFor > today));
  if (scheduled) return signal("scheduled", scheduled, `Najbliższy termin ${formatSignalDate(scheduled.scheduledFor!)}`, `${statusDescription(scheduled)} · zaplanowane na ${formatSignalDate(scheduled.scheduledFor!)}.`);

  return signal("empty", undefined, currentGoals.length ? "Brak następnego kroku" : "Brak pierwszego Celu", currentGoals.length
    ? `Masz ${currentGoals.length} ${currentGoals.length === 1 ? "bieżący Cel" : "bieżące Cele"}, ale żaden nie ma otwartego Działania.`
    : "Projekt potrzebuje pierwszego konkretnego rezultatu.");
}

function activeRelatedActions(state: AppState, projectId: string) {
  const goals = state.goals.filter((goal) => goal.areaId === projectId);
  const goalIds = new Set(goals.map((goal) => goal.id));
  return state.actions.filter((action) => action.areaId === projectId || (action.goalId !== undefined && goalIds.has(action.goalId)));
}

function activeRelatedRecurringActions(state: AppState, projectId: string) {
  const goals = new Set(state.goals.filter((goal) => goal.areaId === projectId).map((goal) => goal.id));
  return state.recurringActionTemplates.filter((template) => template.areaId === projectId || (template.goalId !== undefined && goals.has(template.goalId)));
}

function relatedKnowledge(state: AppState, projectId: string, actions: GoalAction[], recurring: RecurringActionTemplate[]) {
  const goals = new Set(state.goals.filter((goal) => goal.areaId === projectId).map((goal) => goal.id));
  const actionIds = new Set(actions.map((action) => action.id));
  const recurringIds = new Set(recurring.map((template) => template.id));
  const knowledgeIds = new Set(state.knowledgeLinks
    .filter((link) => link.areaId === projectId || (link.goalId !== undefined && goals.has(link.goalId)) || (link.actionId !== undefined && actionIds.has(link.actionId)) || (link.recurringTemplateId !== undefined && recurringIds.has(link.recurringTemplateId)))
    .map((link) => link.knowledgeItemId));
  return state.knowledge
    .filter((item) => knowledgeIds.has(item.id))
    .sort((left, right) => (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? "") || left.id.localeCompare(right.id));
}

/** Builds the active Project projection from the single current Project source: areas. */
export function projectProjection(state: AppState, projectId: string): Project | undefined {
  const area = state.areas.find((candidate) => candidate.id === projectId);
  if (!area) return undefined;
  const goals = state.goals.filter((goal) => goal.areaId === projectId);
  const actions = activeRelatedActions(state, projectId);
  const recurringActionTemplates = activeRelatedRecurringActions(state, projectId);
  return {
    ...area,
    goals,
    actions,
    recurringActionTemplates,
    knowledge: relatedKnowledge(state, projectId, actions, recurringActionTemplates)
  };
}

/** Returns current Project contexts in stable name/id order; historical records are excluded. */
export function projectProjections(state: AppState, visibility?: Project["visibility"]) {
  return state.areas
    .filter((area) => visibility === undefined || area.visibility === visibility)
    .map((area) => projectProjection(state, area.id))
    .filter((project): project is Project => project !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function projectKnowledgeIds(state: AppState, projectId: string) {
  return new Set(projectProjection(state, projectId)?.knowledge.map((item: KnowledgeItem) => item.id) ?? []);
}
