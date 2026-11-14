import type { ReactNode } from "react";
import { actionGroupType, actionGroupTypeLabels } from "../domain/actionGroups";
import type { Goal, GoalAction } from "../domain/types";
import type { NavigationBreadcrumb } from "../domain/navigation";
import { NavigationLink } from "./ContextNavigation";
import "./action-groups.css";

export function GroupedProjectActions({ actions, goals, navigation, className, listAs: List = "div", renderAction }: {
  actions: GoalAction[]; goals: Goal[];
  navigation: { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string };
  className: string; listAs?: "div" | "ul"; renderAction: (action: GoalAction) => ReactNode;
}) {
  const groups = new Map<string, { group?: Goal; actions: GoalAction[] }>();
  for (const action of actions) {
    const key = action.goalId ?? "unassigned";
    let entry = groups.get(key);
    if (!entry) { entry = { group: goals.find((group) => group.id === action.goalId), actions: [] }; groups.set(key, entry); }
    entry.actions.push(action);
  }
  return <div className="project-grouped-actions">{[...groups].map(([id, { group, actions: grouped }]) => <section key={id} aria-label={group?.title ?? "Bez grupy"}>
    <h3 className="project-action-group-heading">{group ? <NavigationLink to={`/goals/${encodeURIComponent(group.id)}`} {...navigation}>{group.title}</NavigationLink> : "Bez grupy"}{group ? <small>{actionGroupTypeLabels[actionGroupType(group)]}</small> : null}<span>{grouped.length}</span></h3>
    <List className={className}>{grouped.map(renderAction)}</List>
  </section>)}</div>;
}
