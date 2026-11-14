import type { ActionGroupType, AppState, Goal, GoalAction } from "./types";

export const actionGroupTypeLabels: Record<ActionGroupType, string> = {
  category: "Kategoria", task: "Zadanie nadrzędne"
};

export function actionGroupType(group: Pick<Goal, "groupType">): ActionGroupType {
  return group.groupType ?? "task";
}

export function categoryConversionBlocker(state: AppState, group: Goal): string | undefined {
  if (group.status !== "active" || group.visibility !== "active") return "Kategorią może zostać tylko aktywne zadanie.";
  if (group.targetDate) return "Najpierw usuń datę docelową zadania.";
  if (state.goalCriteria.some((item) => item.goalId === group.id)) return "Zadanie ma kryteria sukcesu. Zachowaj je jako zadanie nadrzędne.";
  if (state.progressEntries.some((item) => item.goalId === group.id && ["result", "evidence"].includes(item.kind))
    || state.knowledgeLinks.some((link) => link.meaning === "result" && (link.goalId === group.id || state.actions.some((action) => action.id === link.actionId && action.goalId === group.id)))) {
    return "Zadanie ma historię rezultatów. Zachowaj je jako zadanie nadrzędne.";
  }
  return undefined;
}

export function actionGroupAssignment(state: AppState, action: GoalAction, groupId?: string) {
  if (groupId === undefined || groupId === (action.goalId ?? "")) return {};
  const group = state.goals.find((item) => item.id === groupId);
  return { goalId: groupId || null, areaId: group?.areaId ?? action.areaId ?? null };
}
