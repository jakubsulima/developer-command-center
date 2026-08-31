import type { AppState, GoalAction, KnowledgeItem, Project, RecurringActionTemplate } from "./types";

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
