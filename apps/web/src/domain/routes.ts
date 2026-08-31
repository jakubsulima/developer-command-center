import type { InboxStatus } from "./types";

export type EntityRoute =
  | { type: "goal"; id: string }
  | { type: "action"; id: string }
  | { type: "knowledge"; id: string }
  | { type: "inbox"; id: string; status: InboxStatus };

export function routeForEntity(entity: EntityRoute) {
  const id = encodeURIComponent(entity.id);
  if (entity.type === "goal") return `/goals/${id}`;
  if (entity.type === "action") return `/actions/${id}`;
  if (entity.type === "knowledge") return `/knowledge/${id}`;
  return `/knowledge?section=inbox&status=${entity.status}&item=${id}`;
}

export function goalActionRoute(goalId: string, actionId: string) {
  void goalId;
  return routeForEntity({ type: "action", id: actionId });
}
