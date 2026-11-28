import { ArrowRight, BookOpen, ChevronRight, Layers, ListChecks } from "lucide-react";
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
import { Button } from "./ui";

type ProjectNavigation = { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string };

export function ProjectOverviewActions({ actions, highlightedActionId, renderAction, filter, filters, onFilter }: {
  actions: GoalAction[];
  highlightedActionId?: string;
  renderAction: (action: GoalAction) => ReactNode;
  filter: string;
  filters: { value: string; label: string; count: number }[];
  onFilter: (value: string) => void;
}) {
  const { state } = useStore();
  const visible = actions.filter((action) => isActionVisibleInList(state, action));
  const highlightedAction = visible.find((action) => action.id === highlightedActionId);
  const ordered = visible.filter((action) => action !== highlightedAction)
    .sort((a, b) => Number(b.isNext) - Number(a.isNext) || (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999") || a.position - b.position);
  return <section className="project-overview-card-section project-overview-actions" aria-labelledby="project-current-actions-title">
    <div className="project-overview-section-heading">
      <h2 id="project-current-actions-title"><span className="project-overview-icon"><ListChecks aria-hidden="true" /></span>Działania Projektu</h2>
      <label className="project-overview-filter"><span className="sr-only">Filtr Działań</span><select value={filter} onChange={(event) => onFilter(event.target.value)}>{filters.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}</select></label>
    </div>
    {highlightedAction ? <ul className="workspace-list" role="list">{renderAction(highlightedAction)}</ul> : null}
    {ordered.length ? <GroupedProjectActions actions={ordered} className="workspace-list" listAs="ul" renderAction={renderAction} /> : null}
    {!visible.length ? <p className="project-overview-empty">{filter === "open" ? "Nie ma otwartych Działań. Dodaj konkretny krok w tym Projekcie." : "Brak Działań dla wybranego filtra."}</p> : null}
  </section>;
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
  return <aside className="project-overview-context" aria-label="Kontekst Projektu">
    <section className="project-overview-card-section" aria-labelledby="project-current-goals-title">
      <div className="project-overview-section-heading">
        <h2 id="project-current-goals-title"><span className="project-overview-icon"><Layers aria-hidden="true" /></span>Bieżące grupy</h2>
      </div>
      {goals.length ? <ul className="project-overview-context-list" role="list">{goals.slice(0, 5).map((goal) => {
        const cardId = `overview-${navigationCardId("goal", goal.id)}`;
        return <li key={goal.id} data-navigation-card-id={cardId} tabIndex={-1}>
          <NavigationLink to={`/goals/${encodeURIComponent(goal.id)}`} {...navigation} sourceCardId={cardId}>
            <span className="project-overview-context-copy">
              <strong>{goal.title}</strong>
              <small>{actionGroupTypeLabels[actionGroupType(goal)]}{goal.status === "active" ? null : ` · ${goalStatusLabels[goal.status]}`}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </NavigationLink>
        </li>;
      })}</ul> : <p className="project-overview-empty">Brak bieżących grup.</p>}
      {goals.length > 5 ? <Button className="project-overview-more" variant="ghost" onClick={onShowGoals}>Wszystkie grupy<ArrowRight aria-hidden="true" /></Button> : null}
    </section>
    <section className="project-overview-card-section" aria-labelledby="project-recent-knowledge-title">
      <div className="project-overview-section-heading">
        <h2 id="project-recent-knowledge-title"><span className="project-overview-icon"><BookOpen aria-hidden="true" /></span>{reading ? "Książki i Wiedza" : "Ostatnia Wiedza"}</h2>
      </div>
      {knowledgeLoading && !knowledge.length ? <p className="project-overview-empty" role="status">Ładowanie Wiedzy Projektu…</p> : null}
      {knowledgeError ? <p className="inline-mutation-error" role="alert">Nie udało się odświeżyć Wiedzy. <button type="button" onClick={onRetryKnowledge}>Spróbuj ponownie</button></p> : null}
      {knowledge.length ? <ul className="project-overview-context-list" role="list">{knowledge.slice(0, 6).map((item) => {
        const cardId = `overview-${navigationCardId("knowledge", item.id)}`;
        return <li key={item.id} data-navigation-card-id={cardId} tabIndex={-1}>
          <NavigationLink to={`/knowledge/${encodeURIComponent(item.id)}`} {...navigation} sourceCardId={cardId}>
            <span className="project-overview-context-copy">
              <strong>{item.title}</strong>
              <span className="project-overview-knowledge-meta"><KnowledgeKindBadge kind={item.type} />{item.resourceAuthor ? <small>{item.resourceAuthor}</small> : null}</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </NavigationLink>
        </li>;
      })}</ul> : !knowledgeLoading && !knowledgeError ? <p className="project-overview-empty">Nie ma jeszcze powiązanej Wiedzy.</p> : null}
      {knowledge.length > 6 ? <Button className="project-overview-more" variant="ghost" onClick={onShowKnowledge}>Cała Wiedza Projektu<ArrowRight aria-hidden="true" /></Button> : null}
    </section>
  </aside>;
}
