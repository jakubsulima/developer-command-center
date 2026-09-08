import type { AppState, GoalAction } from "./types";
import { routeForEntity } from "./routes";

export type ActionContextKind = "goal" | "project" | "standalone" | "missing-project";

export interface ActionContext {
  kind: ActionContextKind;
  label: string;
  name?: string;
  to: string;
}

export function resolveActionContext(action: GoalAction, state: AppState): ActionContext {
  if (action.goalId) {
    const goal = state.goals.find((candidate) => candidate.id === action.goalId);
    if (goal) return { kind: "goal", label: "Działanie w Celu", name: goal.title, to: routeForEntity({ type: "goal", id: goal.id }) };
  }

  if (action.areaId) {
    const project = state.areas.find((candidate) => candidate.id === action.areaId);
    if (project) return { kind: "project", label: "Działanie w Projekcie", name: project.name, to: `/projects/${encodeURIComponent(project.id)}` };
    return { kind: "missing-project", label: "Projekt niedostępny", name: "Niedostępny Projekt", to: "/" };
  }

  return { kind: "standalone", label: "Samodzielne Działanie", to: "/" };
}

export function describeActionContext(context: ActionContext) {
  return context.name ? `${context.label} · ${context.name}` : context.label;
}

export function describeCompactActionContext(context: ActionContext) {
  if (context.kind === "goal") return context.name ? `Cel · ${context.name}` : "Cel";
  if (context.kind === "project") return context.name ? `Projekt · ${context.name}` : "Projekt";
  if (context.kind === "missing-project") return "Projekt niedostępny";
  return "Samodzielne";
}
