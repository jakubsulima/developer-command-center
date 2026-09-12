import type { Area, Goal } from "./types";

export type QuickAddMode = "action" | "goal" | "project" | "routine" | "inbox" | "library" | "knowledge";

/** `knowledge` is retained only for old persisted drafts and old callers. */
export const quickAddModes = ["action", "goal", "project", "routine", "inbox", "library"] as const satisfies readonly QuickAddMode[];

const commands: Record<string, QuickAddMode> = {
  zadanie: "action",
  dzialanie: "action",
  działanie: "action",
  task: "action",
  cel: "goal",
  goal: "goal",
  projekt: "project",
  project: "project",
  rutyna: "routine",
  routine: "routine",
  biblioteka: "library",
  library: "library",
  wiedza: "library",
  notatka: "library",
  materiał: "library",
  material: "library",
  decyzja: "library",
  decision: "library",
  knowledge: "inbox",
  inbox: "inbox",
  skrzynka: "inbox"
};

export function normalizeQuickAddMode(mode: QuickAddMode): Exclude<QuickAddMode, "knowledge"> {
  return mode === "knowledge" ? "inbox" : mode;
}

export function parseQuickAddCommand(value: string): { mode: QuickAddMode; content: string } | undefined {
  const match = value.match(/^\/(\S+)\s+/u);
  if (!match) return undefined;
  const mode = commands[match[1]!.toLocaleLowerCase("pl")];
  if (!mode) return undefined;
  return { mode: normalizeQuickAddMode(mode), content: value.slice(match[0].length) };
}

export function splitQuickAddContent(content: string) {
  const [firstLine = "", ...rest] = content.split("\n");
  return { title: firstLine.trim(), detail: rest.join("\n").trim() };
}

export type QuickAddContextInput = {
  mode: QuickAddMode;
  goalId?: string;
  areaId?: string;
  goalIds?: string[];
  activeGoals: readonly Pick<Goal, "id" | "areaId" | "title" | "visibility" | "status">[];
  activeAreas: readonly Pick<Area, "id" | "name" | "visibility">[];
};

export type NormalizedQuickAddContext = {
  mode: Exclude<QuickAddMode, "knowledge">;
  goalId?: string;
  areaId?: string;
  goalIds: string[];
  unavailable?: { kind: "goal" | "area"; id: string; label: string };
};

/**
 * Resolve the context once for the form, summary and command payload.
 * A Goal owns its Project for action-like records; goal creation only accepts
 * a Project, and project/inbox creation never carries a parent relation.
 */
export function normalizeQuickAddContext(input: QuickAddContextInput): NormalizedQuickAddContext {
  const mode = normalizeQuickAddMode(input.mode);
  const goals = input.activeGoals.filter((goal) => goal.visibility === "active" && goal.status === "active");
  const areas = input.activeAreas.filter((area) => area.visibility === "active");
  const requestedGoal = input.goalId ? goals.find((goal) => goal.id === input.goalId) : undefined;
  const requestedArea = input.areaId ? areas.find((area) => area.id === input.areaId) : undefined;
  const unavailableGoal = input.goalId && !requestedGoal ? { kind: "goal" as const, id: input.goalId, label: "Nieaktualny Cel" } : undefined;
  const unavailableArea = input.areaId && !requestedArea ? { kind: "area" as const, id: input.areaId, label: "Nieaktualny Projekt" } : undefined;

  const inheritedAreaId = requestedArea?.id ?? requestedGoal?.areaId;
  const unavailableParent = inheritedAreaId && !areas.some((area) => area.id === inheritedAreaId)
    ? { kind: "area" as const, id: inheritedAreaId, label: "Projekt Celu jest niedostępny" } : undefined;
  if (mode === "goal") return { mode, areaId: inheritedAreaId, goalIds: [], unavailable: unavailableGoal ?? unavailableArea ?? unavailableParent };
  if (mode === "project" || mode === "inbox") return { mode, goalIds: [] };
  if (mode === "library") {
    const goalIds = Array.from(new Set([...(input.goalIds ?? []), ...(requestedGoal ? [requestedGoal.id] : [])]))
      .filter((id) => goals.some((goal) => goal.id === id));
    const missingGoalId = input.goalIds?.find((id) => !goals.some((goal) => goal.id === id));
    return { mode, areaId: inheritedAreaId, goalIds, unavailable: unavailableGoal ?? unavailableArea ?? unavailableParent ?? (missingGoalId ? { kind: "goal", id: missingGoalId, label: "Nieaktualny powiązany Cel" } : undefined) };
  }

  if (requestedGoal) {
    return { mode, goalId: requestedGoal.id, areaId: requestedGoal.areaId, goalIds: [], unavailable: requestedGoal.areaId && !areas.some((area) => area.id === requestedGoal.areaId) ? { kind: "area", id: requestedGoal.areaId, label: "Projekt Celu jest niedostępny" } : undefined };
  }
  return { mode, areaId: requestedArea?.id, goalIds: [], unavailable: unavailableGoal ?? unavailableArea };
}
