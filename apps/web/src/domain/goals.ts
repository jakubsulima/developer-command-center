import type {
  ActionStatus,
  AppState,
  Goal,
  GoalAction,
  GoalCriterion,
  GoalStatus,
  LearningGoal,
  LegacyProjectRecord,
  Visibility,
  WorkItem
} from "./types";

function visibilityOf(item: { archivedAt?: string; trashedAt?: string }): Visibility {
  if (item.trashedAt) return "trashed";
  if (item.archivedAt) return "archived";
  return "active";
}

function projectStatus(project: LegacyProjectRecord): GoalStatus {
  if (project.domainStatus === "completed" || project.commitmentStatus === "fulfilled") return "achieved";
  if (project.domainStatus === "abandoned" || project.commitmentStatus === "released") return "abandoned";
  if (project.commitmentStatus === "paused") return "paused";
  return "active";
}

function learningStatus(goal: LearningGoal): GoalStatus {
  if (goal.status === "achieved") return "achieved";
  if (goal.status === "abandoned") return "abandoned";
  if (goal.status === "draft") return "paused";
  return "active";
}

function actionStatus(workItem: WorkItem): ActionStatus {
  if (workItem.status === "completed" || workItem.completed) return "completed";
  if (workItem.status === "cancelled") return "cancelled";
  if (workItem.status === "blocked") return "blocked";
  if (workItem.status === "in_progress") return "in_progress";
  return "ready";
}

function projectGoal(project: LegacyProjectRecord): Goal {
  return {
    id: project.id,
    title: project.name,
    outcome: project.outcome,
    kind: "project",
    status: projectStatus(project),
    visibility: visibilityOf(project),
    priority: project.primary ? "high" : "normal",
    legacySource: "project",
    areaId: project.id
  };
}

function projectArea(project: LegacyProjectRecord) {
  const timestamp = new Date(0).toISOString();
  return {
    id: project.id,
    name: project.name,
    description: project.outcome,
    visibility: visibilityOf(project),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function learningGoal(goal: LearningGoal): Goal {
  return {
    id: goal.id,
    title: goal.title,
    outcome: goal.criterion,
    kind: "learning",
    status: learningStatus(goal),
    visibility: "active",
    priority: "normal",
    legacySource: "learning_goal"
  };
}

function projectActions(project: LegacyProjectRecord): GoalAction[] {
  return project.workItems.map((item, position) => ({
    id: item.id,
    version: 1,
    goalId: project.id,
    title: item.title,
    detail: item.detail,
    status: actionStatus(item),
    blocker: item.blocker,
    position,
    isNext: item.id === project.workItems.find((candidate) => !candidate.completed && candidate.status !== "completed")?.id,
    pinnedToToday: false,
    completedAt: item.completed || item.status === "completed" ? new Date(0).toISOString() : undefined,
    checklist: [],
    legacySourceId: item.id
  }));
}

function projectCriteria(project: LegacyProjectRecord): GoalCriterion[] {
  return project.requirements.map((criterion) => ({
    id: criterion.id,
    goalId: project.id,
    title: criterion.title,
    completed: criterion.status === "validated",
    legacySourceId: criterion.id
  }));
}

function mergeById<T extends { id: string }>(current: T[] | undefined, projected: T[]) {
  const ids = new Set((current ?? []).map((item) => item.id));
  return [...(current ?? []), ...projected.filter((item) => !ids.has(item.id))];
}

/** Hydrates the goal-centric read model without overwriting user-owned records. */
export function ensureGoalModel(state: AppState): AppState {
  const projectedAreas = state.projects.map(projectArea);
  const projectedGoals = [
    ...state.projects.map(projectGoal),
    ...state.learningGoals.map(learningGoal)
  ];
  const projectedActions = state.projects.flatMap(projectActions);
  const projectedCriteria = [
    ...state.projects.flatMap(projectCriteria),
    ...state.learningGoals.map((goal) => ({
      id: `${goal.id}-criterion`,
      goalId: goal.id,
      title: goal.criterion,
      completed: goal.status === "achieved",
      legacySourceId: goal.id
    }))
  ];

  return {
    ...state,
    areas: mergeById(state.areas, projectedAreas),
    goalTemplates: state.goalTemplates ?? [],
    goals: mergeById(state.goals, projectedGoals),
    goalCriteria: mergeById(state.goalCriteria, projectedCriteria),
    actions: mergeById(state.actions, projectedActions).map((action) => ({ ...action, version: action.version ?? 1 })),
    progressEntries: state.progressEntries ?? [],
    recurringActionTemplates: state.recurringActionTemplates ?? [],
    knowledgeLinks: state.knowledgeLinks ?? []
  };
}

/**
 * Converts a previously hydrated snapshot to the current read boundary once.
 * Project aggregates and their derived goal/action records remain available in
 * `projects` for history/export, but they must not be reintroduced into the
 * active Project context on every hydration.
 */
export function migrateLegacyWorkspaceState(state: AppState): AppState {
  const legacyIds = new Set(state.projects.map((project) => project.id));
  const projectedTimestamp = new Date(0).toISOString();
  return {
    ...state,
    areas: state.areas.filter((area) => !(legacyIds.has(area.id) && area.createdAt === projectedTimestamp)),
    goals: state.goals.filter((goal) => !goal.legacySource),
    actions: state.actions.filter((action) => !action.legacySourceId),
    goalCriteria: state.goalCriteria.filter((criterion) => !criterion.legacySourceId)
  };
}
