import type { InboxStatus } from "./types";

export type EntityRoute =
  | { type: "goal"; id: string }
  | { type: "action"; id: string; goalId?: string }
  | { type: "knowledge"; id: string }
  | { type: "inbox"; id: string; status: InboxStatus };

export function routeForEntity(entity: EntityRoute) {
  const id = encodeURIComponent(entity.id);
  if (entity.type === "goal") return `/goals/${id}`;
  if (entity.type === "action") return entity.goalId ? `/goals/${encodeURIComponent(entity.goalId)}?action=${id}` : `/actions/${id}`;
  if (entity.type === "knowledge") return `/knowledge/${id}`;
  return `/inbox?view=${entity.status}&item=${id}`;
}

export function goalActionRoute(goalId: string, actionId: string) {
  return routeForEntity({ type: "action", id: actionId, goalId });
}
