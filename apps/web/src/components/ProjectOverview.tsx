import { ArrowRight, Plus } from "lucide-react";
import { useStore } from "../app/useStore";
import { isActionVisibleInList } from "../domain/actionsList";
import { resolveRoutineTitle } from "../domain/actionPresentation";
import { goalStatusLabels } from "../domain/labels";
import { navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import type { Goal, GoalAction, KnowledgeItem } from "../domain/types";
import { ActionSignals } from "./ActionSignals";
import { NavigationLink } from "./ContextNavigation";
import { KnowledgeKindBadge } from "./KnowledgeKindBadge";
import { Button, Panel } from "./ui";

type ProjectNavigation = { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string };

export function ProjectOverviewActions({ actions, today, navigation, onShowAll, onAdd, onOpenStatus, isBusy, errorFor, onRetry }: {
  actions: GoalAction[];
  today: string;
  navigation: ProjectNavigation;
  onShowAll: () => void;
  onAdd: () => void;
  onOpenStatus: (action: GoalAction) => void;
  isBusy: (id: string) => boolean;
  errorFor: (id: string) => string | undefined;
  onRetry: (id: string) => void;
}) {
  const { state } = useStore();
  const visible = actions.filter((action) => isActionVisibleInList(state, action));
  const recent = [...visible].sort((a, b) => Number(b.isNext) - Number(a.isNext) || (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999") || a.position - b.position).slice(0, 5);
  return <section className="project-desktop-actions" aria-labelledby="project-current-actions-title"><Panel>
    <div className="project-overview-section-heading"><h2 id="project-current-actions-title">Bieżące Działania <span>{visible.length}</span></h2><Button variant="ghost" onClick={onAdd}><Plus aria-hidden="true" />Dodaj Działanie</Button></div>
    {recent.length ? <ul className="project-overview-action-list">{recent.map((action) => <li key={action.id} data-navigation-card-id={`overview-${navigationCardId("action", action.id)}`} tabIndex={-1}>
      <NavigationLink className="project-overview-action-title" to={`/actions/${encodeURIComponent(action.id)}`} {...navigation} sourceCardId={`overview-${navigationCardId("action", action.id)}`}>{action.title}<ArrowRight aria-hidden="true" /></NavigationLink>
      <ActionSignals action={action} today={today} timeZone={state.workspaceTimezone} routineTitle={resolveRoutineTitle(action, state.recurringActionTemplates)} disabled={isBusy(action.id)} onOpenStatus={() => onOpenStatus(action)} />
      {errorFor(action.id) ? <p className="inline-mutation-error" role="alert">{errorFor(action.id)} <button type="button" onClick={() => onRetry(action.id)}>Spróbuj ponownie</button></p> : null}
    </li>)}</ul> : <p className="project-overview-empty">Nie ma otwartych Działań. Dodaj konkretny krok w tym Projekcie.</p>}
    {visible.length ? <Button className="project-overview-more" variant="ghost" onClick={onShowAll}>Wszystkie Działania<ArrowRight aria-hidden="true" /></Button> : null}
  </Panel></section>;
}

export function ProjectOverviewContext({ goals, knowledge, navigation, knowledgeLoading, knowledgeError, onRetryKnowledge, onShowGoals, onShowKnowledge }: {
  goals: Goal[];
  knowledge: KnowledgeItem[];
  navigation: ProjectNavigation;
  knowledgeLoading: boolean;
  knowledgeError: boolean;
  onRetryKnowledge: () => void;
  onShowGoals: () => void;
  onShowKnowledge: () => void;
}) {
  return <aside className="project-desktop-context" aria-label="Kontekst Projektu">
    <Panel><section aria-labelledby="project-current-goals-title"><div className="project-overview-section-heading"><h2 id="project-current-goals-title">Bieżące Cele <span>{goals.length}</span></h2></div>
      {goals.length ? <ul className="project-overview-context-list">{goals.slice(0, 3).map((goal) => <li key={goal.id} data-navigation-card-id={`overview-${navigationCardId("goal", goal.id)}`} tabIndex={-1}><NavigationLink to={`/goals/${encodeURIComponent(goal.id)}`} {...navigation} sourceCardId={`overview-${navigationCardId("goal", goal.id)}`}><strong>{goal.title}</strong><small>{goalStatusLabels[goal.status]}</small></NavigationLink></li>)}</ul> : <p className="project-overview-empty">Nie ma bieżących Celów. Działania mogą też należeć bezpośrednio do Projektu.</p>}
      <Button className="project-overview-more" variant="ghost" onClick={onShowGoals}>Wszystkie Cele<ArrowRight aria-hidden="true" /></Button>
    </section></Panel>
    <Panel><section aria-labelledby="project-recent-knowledge-title"><div className="project-overview-section-heading"><h2 id="project-recent-knowledge-title">Ostatnia Wiedza <span>{knowledgeLoading && !knowledge.length ? "…" : knowledge.length}</span></h2></div>
      {knowledgeLoading && !knowledge.length ? <p className="project-overview-empty" role="status">Ładowanie Wiedzy Projektu…</p> : null}
      {knowledgeError ? <p className="inline-mutation-error" role="alert">Nie udało się odświeżyć Wiedzy. <button type="button" onClick={onRetryKnowledge}>Spróbuj ponownie</button></p> : null}
      {knowledge.length ? <ul className="project-overview-context-list">{knowledge.slice(0, 3).map((item) => <li key={item.id} data-navigation-card-id={`overview-${navigationCardId("knowledge", item.id)}`} tabIndex={-1}><NavigationLink to={`/knowledge/${encodeURIComponent(item.id)}`} {...navigation} sourceCardId={`overview-${navigationCardId("knowledge", item.id)}`}><KnowledgeKindBadge kind={item.type} /><strong>{item.title}</strong>{item.resourceAuthor ? <small>{item.resourceAuthor}</small> : null}</NavigationLink></li>)}</ul> : !knowledgeLoading && !knowledgeError ? <p className="project-overview-empty">Nie ma jeszcze powiązanej Wiedzy.</p> : null}
      <Button className="project-overview-more" variant="ghost" onClick={onShowKnowledge}>Cała Wiedza Projektu<ArrowRight aria-hidden="true" /></Button>
    </section></Panel>
  </aside>;
}
