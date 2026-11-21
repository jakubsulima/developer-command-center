import type { ReactNode } from "react";
import { GroupedProjectActions } from "./GroupedProjectActions";
import { actionGroupType, actionGroupTypeLabels } from "../domain/actionGroups";
import { useStore } from "../app/useStore";
import { isActionVisibleInList } from "../domain/actionsList";
import { goalStatusLabels } from "../domain/labels";
import { navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import type { Goal, GoalAction, KnowledgeItem } from "../domain/types";
import { NavigationLink } from "./ContextNavigation";
import { KnowledgeKindBadge } from "./KnowledgeKindBadge";
import { Button, Panel } from "./ui";

type ProjectNavigation = { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string };

export function ProjectOverviewActions({ actions, renderAction, filter, filters, onFilter }: {
  actions: GoalAction[];
  renderAction: (action: GoalAction) => ReactNode;
  filter: string;
  filters: { value: string; label: string; count: number }[];
  onFilter: (value: string) => void;
}) {
  const { state } = useStore();
  const visible = actions.filter((action) => isActionVisibleInList(state, action));
  const ordered = [...visible].sort((a, b) => Number(b.isNext) - Number(a.isNext) || (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999") || a.position - b.position);
  return <section className="project-desktop-actions" aria-labelledby="project-current-actions-title"><Panel>
    <div className="project-overview-section-heading">
      <h2 id="project-current-actions-title">Działania Projektu</h2>
      <label className="project-overview-filter"><span className="sr-only">Filtr Działań</span><select value={filter} onChange={(event) => onFilter(event.target.value)}>{filters.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select></label>
    </div>
    {ordered.length ? <GroupedProjectActions actions={ordered} className="workspace-list" listAs="ul" renderAction={renderAction} /> : <p className="project-overview-empty">{filter === "open" ? "Nie ma otwartych Działań. Dodaj konkretny krok w tym Projekcie." : "Brak Działań dla wybranego filtra."}</p>}
  </Panel></section>;
}

export function ProjectOverviewContext({ goals, knowledge, navigation, knowledgeLoading, knowledgeError, onRetryKnowledge, onShowGoals, onShowKnowledge, reading }: {
  goals: Goal[];
  knowledge: KnowledgeItem[];
  navigation: ProjectNavigation;
  knowledgeLoading: boolean;
  knowledgeError: boolean;
  onRetryKnowledge: () => void;
  onShowGoals: () => void;
  onShowKnowledge: () => void;
  reading: boolean;
}) {
  return <aside className="project-desktop-context" aria-label="Kontekst Projektu">
    <Panel className="project-context-goals"><section aria-labelledby="project-current-goals-title"><div className="project-overview-section-heading"><h2 id="project-current-goals-title">Bieżące grupy</h2></div>
      {goals.length ? <ul className="project-overview-context-list">{goals.slice(0, 5).map((goal) => <li key={goal.id} data-navigation-card-id={`overview-${navigationCardId("goal", goal.id)}`} tabIndex={-1}><NavigationLink to={`/goals/${encodeURIComponent(goal.id)}`} {...navigation} sourceCardId={`overview-${navigationCardId("goal", goal.id)}`}><strong>{goal.title}</strong><small>{actionGroupTypeLabels[actionGroupType(goal)]}{goal.status === "active" ? null : ` · ${goalStatusLabels[goal.status]}`}</small></NavigationLink></li>)}</ul> : <p className="project-overview-empty">Brak bieżących grup.</p>}
      {goals.length > 5 ? <Button className="project-overview-more" variant="ghost" onClick={onShowGoals}>Wszystkie grupy</Button> : null}
    </section></Panel>
    <Panel className="project-context-knowledge"><section aria-labelledby="project-recent-knowledge-title"><div className="project-overview-section-heading"><h2 id="project-recent-knowledge-title">{reading ? "Książki i Wiedza" : "Ostatnia Wiedza"}</h2></div>
      {knowledgeLoading && !knowledge.length ? <p className="project-overview-empty" role="status">Ładowanie Wiedzy Projektu…</p> : null}
      {knowledgeError ? <p className="inline-mutation-error" role="alert">Nie udało się odświeżyć Wiedzy. <button type="button" onClick={onRetryKnowledge}>Spróbuj ponownie</button></p> : null}
      {knowledge.length ? <ul className="project-overview-context-list">{knowledge.slice(0, 6).map((item) => <li key={item.id} data-navigation-card-id={`overview-${navigationCardId("knowledge", item.id)}`} tabIndex={-1}><NavigationLink to={`/knowledge/${encodeURIComponent(item.id)}`} {...navigation} sourceCardId={`overview-${navigationCardId("knowledge", item.id)}`}><KnowledgeKindBadge kind={item.type} /><strong>{item.title}</strong>{item.resourceAuthor ? <small>{item.resourceAuthor}</small> : null}</NavigationLink></li>)}</ul> : !knowledgeLoading && !knowledgeError ? <p className="project-overview-empty">Nie ma jeszcze powiązanej Wiedzy.</p> : null}
      {knowledge.length > 6 ? <Button className="project-overview-more" variant="ghost" onClick={onShowKnowledge}>Cała Wiedza Projektu</Button> : null}
    </section></Panel>
  </aside>;
}
