import { isActionListView, type ActionListView } from "./actionsList";
export interface SavedActionFilters { view: ActionListView; schedule?: "today" | "overdue" | "unscheduled"; projectId?: string; goalId?: string }
export interface SavedActionView { id: string; name: string; filters: SavedActionFilters; filterVersion: 1; position: number; version: number; createdAt: string; updatedAt: string }
export function savedActionFilters(params: URLSearchParams): SavedActionFilters {
  const view = params.get("view");
  return { view: isActionListView(view) ? view : "open", ...(["today", "overdue", "unscheduled"].includes(params.get("schedule") ?? "") ? { schedule: params.get("schedule") as SavedActionFilters["schedule"] } : {}), ...(params.get("project") ? { projectId: params.get("project")! } : {}), ...(params.get("goal") ? { goalId: params.get("goal")! } : {}) };
}
export function savedActionParams(filters: SavedActionFilters) {
  const params = new URLSearchParams();
  if (filters.view !== "open") params.set("view", filters.view);
  if (filters.schedule) params.set("schedule", filters.schedule);
  if (filters.projectId) params.set("project", filters.projectId);
  if (filters.goalId) params.set("goal", filters.goalId);
  return params;
}
export function validateSavedActionView(view: SavedActionView) {
  if (!view.name.trim() || view.name.trim().length > 60) throw new Error("Nazwa widoku musi mieć od 1 do 60 znaków.");
  if (view.filterVersion !== 1 || !isActionListView(view.filters.view) || Object.keys(view.filters).some((key) => !["view", "schedule", "projectId", "goalId"].includes(key))) throw new Error("Nieobsługiwane filtry widoku.");
  if (view.filters.schedule !== undefined && !["today", "overdue", "unscheduled"].includes(view.filters.schedule)) throw new Error("Nieobsługiwany termin widoku.");
  for (const key of ["projectId", "goalId"] as const) if (view.filters[key] !== undefined && (typeof view.filters[key] !== "string" || !view.filters[key])) throw new Error("Nieprawidłowy kontekst widoku.");
}
