import type { ReactNode } from "react";
import { actionStatusLabels } from "../domain/labels";
import type { ActionStatus, GoalAction } from "../domain/types";
import "./action-groups.css";

const statusOrder: ActionStatus[] = ["ready", "in_progress", "testing", "blocked", "completed", "skipped", "cancelled"];

export function GroupedProjectActions({ actions, className, listAs: List = "div", renderAction }: {
  actions: GoalAction[];
  className: string; listAs?: "div" | "ul"; renderAction: (action: GoalAction) => ReactNode;
}) {
  const groups = new Map<ActionStatus, GoalAction[]>();
  for (const action of actions) {
    const group = groups.get(action.status);
    if (group) group.push(action);
    else groups.set(action.status, [action]);
  }
  return <div className="project-grouped-actions">{statusOrder.map((status) => {
    const grouped = groups.get(status);
    return grouped ? <section key={status} aria-label={actionStatusLabels[status]}>
      <h3 className="project-action-group-heading">{actionStatusLabels[status]}<span>{grouped.length}</span></h3>
      <List className={className}>{grouped.map(renderAction)}</List>
    </section> : null;
  })}</div>;
}
