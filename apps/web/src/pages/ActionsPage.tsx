import { ChevronDown, Filter, ListTodo, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionStatusDialog, type ProjectActionStatus } from "../components/ActionStatusControls";
import { ActionSignals } from "../components/ActionSignals";
import { NavigationLink } from "../components/ContextNavigation";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { actionListViewLabels, isActionListView, matchesActionListFilter, type ActionListFilter, type ActionListView } from "../domain/actionsList";
import { actionStatusLabels, polishCount } from "../domain/labels";
import { resolveActionContext } from "../domain/actionContext";
import { locationAddress, navigationCardId } from "../domain/navigation";
import { localDateForTimeZone } from "../domain/activity";
import type { GoalAction } from "../domain/types";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { resolveRoutineTitle } from "../domain/actionPresentation";

const actionStatusViews = ["open", "ready", "in_progress", "testing", "blocked", "completed", "cancelled", "skipped"] as const satisfies readonly ActionListView[];
const actionScheduleViews = ["open", "today", "overdue", "unscheduled"] as const satisfies readonly ActionListView[];
type ActionStatusView = typeof actionStatusViews[number];
type ActionScheduleView = typeof actionScheduleViews[number];

const actionScheduleViewLabels: Record<ActionScheduleView, string> = {
  open: "Wszystkie",
  today: "Na dziś",
  overdue: "Zaległe",
  unscheduled: "Bez terminu",
};

function isActionScheduleView(view: ActionListView): view is ActionScheduleView {
  return actionScheduleViews.includes(view as ActionScheduleView);
}

function filterLabel(value: string, kind: "project" | "goal", state: ReturnType<typeof useStore>["state"]) {
  if (kind === "project") return state.areas.find((area) => area.id === value)?.name ?? "Nieaktualny Projekt";
  return state.goals.find((goal) => goal.id === value)?.title ?? "Nieaktualny Cel";
}

function compactContextLabel(context: ReturnType<typeof resolveActionContext>) {
  if (context.kind === "goal") return context.name ? `Cel: ${context.name}` : "Cel";
  if (context.kind === "project") return context.name ? `Projekt: ${context.name}` : "Projekt";
  if (context.kind === "missing-project") return "Projekt niedostępny";
  return "Samodzielne działanie";
}

function resultCountLabel(count: number, view: ActionListView) {
  if (view === "open") return polishCount(count, "otwarte działanie", "otwarte działania", "otwartych działań");
  if (view === "ready") return polishCount(count, "działanie do zrobienia", "działania do zrobienia", "działań do zrobienia");
  if (view === "in_progress") return polishCount(count, "działanie w toku", "działania w toku", "działań w toku");
  if (view === "testing") return polishCount(count, "testowane działanie", "testowane działania", "testowanych działań");
  if (view === "today") return polishCount(count, "działanie na dziś", "działania na dziś", "działań na dziś");
  if (view === "overdue") return polishCount(count, "zaległe działanie", "zaległe działania", "zaległych działań");
  if (view === "unscheduled") return polishCount(count, "działanie bez terminu", "działania bez terminu", "działań bez terminu");
  if (view === "blocked") return polishCount(count, "zablokowane działanie", "zablokowane działania", "zablokowanych działań");
  if (view === "completed") return polishCount(count, "ukończone działanie", "ukończone działania", "ukończonych działań");
  if (view === "cancelled") return polishCount(count, "anulowane działanie", "anulowane działania", "anulowanych działań");
  return polishCount(count, "pominięte działanie", "pominięte działania", "pominiętych działań");
}

type ActionsGroup = { key: string; label?: string; items: GoalAction[] };

function groupOpenActions(items: GoalAction[], view: ActionListView, today: string): ActionsGroup[] {
  if (view !== "open") return [{ key: view, items }];
  const groups = [
    { key: "overdue", label: "Zaległe", items: items.filter((action) => Boolean(action.scheduledFor && action.scheduledFor < today)) },
    { key: "today", label: "Dzisiaj", items: items.filter((action) => action.scheduledFor === today || (!action.scheduledFor && action.pinnedToToday)) },
    { key: "upcoming", label: "Nadchodzące", items: items.filter((action) => Boolean(action.scheduledFor && action.scheduledFor > today)) },
    { key: "unscheduled", label: "Bez terminu", items: items.filter((action) => !action.scheduledFor && !action.pinnedToToday) },
  ];
  return groups.filter((group) => group.items.length > 0);
}

export function ActionsPage() {
  const { state, mode, loading, setActionStatus } = useStore();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [statusActionId, setStatusActionId] = useState<string>();
  const [focusRequestId, setFocusRequestId] = useState<string>();
  const [focusEmpty, setFocusEmpty] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const focusAfterMutation = useRef<{ actionId: string; index: number } | undefined>(undefined);
  const rawView = params.get("view");
  const view: ActionListView = isActionListView(rawView) ? rawView : "open";
  const statusView: ActionStatusView = actionStatusViews.includes(view as ActionStatusView) ? view as ActionStatusView : "open";
  const scheduleView: ActionScheduleView = isActionScheduleView(view) ? view : "open";
  const [filtersOpen, setFiltersOpen] = useState(Boolean(params.get("project") || params.get("goal") || scheduleView !== "open"));
  const projectId = params.get("project") || undefined;
  const goalId = params.get("goal") || undefined;
  const today = localDateForTimeZone(new Date(), state.workspaceTimezone);
  const actionFilter = useMemo<ActionListFilter>(() => ({ view, projectId, goalId, today }), [goalId, projectId, today, view]);
  const actionsPage = useWorkspaceInfinitePage<GoalAction>("actions", 30, { actionFilter });
  const highlightId = params.get("highlight") || undefined;
  const highlightQuery = useQuery({
    queryKey: ["actions-highlight", mode, state.workspaceId, highlightId],
    enabled: !loading && Boolean(highlightId),
    queryFn: async () => mode === "demo" ? state.actions.find((action) => action.id === highlightId) : createSupabaseWorkspaceRepository().loadAction(highlightId!),
  });
  const highlightedAction = highlightId ? state.actions.find((action) => action.id === highlightId) ?? highlightQuery.data : undefined;
  const pageItems = actionsPage.data?.items ?? [];
  const items = [highlightedAction, ...pageItems]
    .filter((item): item is GoalAction => Boolean(item))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .map((item) => state.actions.find((current) => current.id === item.id) ?? item)
    .filter((item) => matchesActionListFilter(state, item, actionFilter));
  const hasFilters = scheduleView !== "open" || Boolean(projectId || goalId);
  const filterCount = Number(scheduleView !== "open") + Number(Boolean(projectId)) + Number(Boolean(goalId));
  const groupedItems = groupOpenActions(items, view, today);

  useEffect(() => {
    if (!highlightId) return;
    setFocusRequestId(highlightId);
    setFocusEmpty(false);
  }, [highlightId]);

  useEffect(() => {
    if (projectId || goalId) setFiltersOpen(true);
  }, [goalId, projectId]);

  useEffect(() => {
    const pending = focusAfterMutation.current;
    if (pending && !items.some((item) => item.id === pending.actionId)) {
      focusAfterMutation.current = undefined;
      const nextIndex = Math.min(pending.index, items.length - 1);
      if (items[nextIndex]) {
        setFocusRequestId(items[nextIndex].id);
        setFocusEmpty(false);
      } else {
        setFocusRequestId(undefined);
        setFocusEmpty(true);
      }
    }
    const node = focusRequestId ? rowRefs.current.get(focusRequestId) : undefined;
    if (node) {
      setFocusRequestId(undefined);
      requestAnimationFrame(() => { node.focus(); node.scrollIntoView?.({ block: "nearest" }); });
      return;
    }
    if (focusEmpty && !items.length) {
      const empty = document.querySelector<HTMLElement>("[data-actions-empty]");
      if (empty) {
        setFocusEmpty(false);
        requestAnimationFrame(() => empty.focus());
      }
    }
  }, [focusEmpty, focusRequestId, items]);

  const setStatusView = (nextView: ActionStatusView) => {
    const next = new URLSearchParams(params);
    if (nextView === "open") next.delete("view"); else next.set("view", nextView);
    setParams(next);
  };

  const setScheduleView = (nextView: ActionScheduleView) => {
    const next = new URLSearchParams(params);
    if (nextView === "open") next.delete("view"); else next.set("view", nextView);
    setParams(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    next.delete("project");
    next.delete("goal");
    if (isActionScheduleView(view)) next.delete("view");
    setParams(next);
  };

  const showOpenActions = () => {
    const next = new URLSearchParams(params);
    next.delete("view");
    setParams(next);
  };

  const refreshActions = () => queryClient.resetQueries({ queryKey: ["workspace-page", "actions"] });
  const rememberFocus = (action: GoalAction) => {
    focusAfterMutation.current = { actionId: action.id, index: Math.max(0, items.findIndex((item) => item.id === action.id)) };
  };

  const changeActionStatus = async (action: GoalAction, status: ProjectActionStatus, blocker?: string) => {
    const previous = { status: action.status, blocker: action.blocker };
    rememberFocus(action);
    return mutation.run(`actions-status:${action.id}`, async () => {
      await setActionStatus(action.id, status, blocker, action.version);
      await refreshActions();
      notifyUndo({ message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: async () => {
        await setActionStatus(action.id, previous.status, previous.blocker, action.version + 1);
        await refreshActions();
        setFocusRequestId(action.id);
      }});
    });
  };

  const retry = () => void actionsPage.refetch();

  return (
    <AppShell addAction={{ label: "Dodaj Działanie", shortLabel: "Działanie", ariaLabel: "Dodaj nowe Działanie", quickAdd: { mode: "action", pinnedToToday: false, draftKey: "actions-list" } }}>
      <PageHeading title="Działania" eyebrow="Jedna lista wszystkich bieżących kroków" />
      <section className="actions-toolbar" aria-label="Filtry Działań">
        <div className="actions-toolbar-topline">
          <div className="actions-view-tabs" role="tablist" aria-label="Status Działań">
            {actionStatusViews.map((option) => (
              <button key={option} type="button" role="tab" aria-selected={statusView === option} onClick={() => setStatusView(option)}>
                {actionListViewLabels[option]}
              </button>
            ))}
          </div>
          <Button className="actions-filter-toggle" variant="ghost" aria-expanded={filtersOpen} aria-controls="actions-context-filters" onClick={() => setFiltersOpen((open) => !open)}><Filter /><span>Filtry</span>{filterCount ? <small aria-label={`${filterCount} aktywne filtry`}>{filterCount}</small> : null}<ChevronDown className={filtersOpen ? "expanded" : ""} aria-hidden="true" /></Button>
        </div>
        {filtersOpen ? <div className="actions-filter-panel" id="actions-context-filters">
          {statusView === "open" ? <div className="actions-filter-section"><span className="actions-filter-label">Termin</span><div className="actions-date-filters" role="group" aria-label="Termin Działań">
            {actionScheduleViews.map((option) => <button key={option} type="button" aria-pressed={scheduleView === option} onClick={() => setScheduleView(option)}>{actionScheduleViewLabels[option]}</button>)}
          </div></div> : null}
          <div className="knowledge-filter-fields">
          <label><span>Projekt</span><select aria-label="Filtr Projektu" value={projectId ?? ""} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set("project", event.target.value); else next.delete("project"); setParams(next); }}><option value="">Wszystkie projekty</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <label><span>Cel</span><select aria-label="Filtr Celu" value={goalId ?? ""} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set("goal", event.target.value); else next.delete("goal"); setParams(next); }}><option value="">Wszystkie cele</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
        </div></div> : null}
        {hasFilters ? <div className="actions-active-filters" aria-label="Aktywne filtry"><Filter />{scheduleView !== "open" ? <Badge>{actionScheduleViewLabels[scheduleView]}</Badge> : null}{projectId ? <Badge>{filterLabel(projectId, "project", state)}</Badge> : null}{goalId ? <Badge>{filterLabel(goalId, "goal", state)}</Badge> : null}<Button variant="ghost" onClick={clearFilters}><X />Wyczyść filtry</Button></div> : null}
      </section>

      <div className="actions-results-summary" aria-live="polite"><span>{resultCountLabel(items.length, view)}</span>{projectId && goalId ? <small>Projekt i cel muszą pasować jednocześnie.</small> : null}</div>
      {loading || actionsPage.isPending ? <ListSkeleton rows={5} label="Ładowanie Działań" /> : null}
      {actionsPage.isError ? <Panel className="actions-error" role="alert"><RefreshCw /><div><strong>Nie udało się pobrać Działań.</strong><p>Spróbuj ponownie; bieżące filtry pozostaną zachowane.</p></div><Button onClick={retry}>Spróbuj ponownie</Button></Panel> : null}
      {!actionsPage.isPending && !actionsPage.isError && items.length === 0 ? <div data-actions-empty tabIndex={-1}><EmptyState icon={<ListTodo />} title={view === "overdue" ? "Brak zaległych Działań" : statusView !== "open" ? `Brak Działań: ${actionListViewLabels[statusView]}` : hasFilters ? "Brak Działań dla tych filtrów" : "Brak otwartych Działań"} detail={hasFilters ? "Zmień termin, Projekt lub Cel albo wyczyść filtry." : statusView === "open" ? "Dodaj pierwszy konkretny krok, aby pojawił się na tej liście." : "Wybierz inny status Działań."} action={statusView !== "open" ? <Button onClick={showOpenActions}>Przejdź do otwartych</Button> : hasFilters ? <Button onClick={clearFilters}><X />Wyczyść filtry</Button> : undefined} /></div> : null}
      {items.length ? <div className="actions-groups" aria-label={`Lista: ${actionListViewLabels[view]}`}>
        {groupedItems.map((group) => <section className="actions-group" key={group.key} aria-label={group.label}>{group.label ? <h2><span>{group.label}</span><small>{group.items.length}</small></h2> : null}<div className="actions-list" role="list">
        {group.items.map((action) => {
          const context = resolveActionContext(action, state);
          const mutationKey = `actions-list:${action.id}`;
          return <section role="listitem" ref={(node) => { if (node) rowRefs.current.set(action.id, node); else rowRefs.current.delete(action.id); }} className={`panel actions-list-row ${action.status} ${highlightId === action.id ? "navigation-card-highlight" : ""}`} key={action.id} data-navigation-card-id={navigationCardId("action", action.id)} data-highlighted={highlightId === action.id || undefined} tabIndex={-1}>
            <span className="actions-list-copy"><NavigationLink className="actions-list-title" to={`/actions/${encodeURIComponent(action.id)}`} breadcrumbs={[{ label: "Działania", to: locationAddress(location) }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Działania" sourceCardId={navigationCardId("action", action.id)}><strong>{action.title}</strong></NavigationLink><ActionSignals action={action} timeZone={state.workspaceTimezone} today={today} routineTitle={resolveRoutineTitle(action, state.recurringActionTemplates)} disabled={mutation.isBusy(`actions-status:${action.id}`)} onOpenStatus={() => setStatusActionId(action.id)} /><small className="actions-list-context"><NavigationLink to={context.to} breadcrumbs={[{ label: "Działania", to: locationAddress(location) }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Działania" sourceCardId={navigationCardId("action", action.id)}>{compactContextLabel(context)}</NavigationLink></small>{action.detail ? <small className="actions-list-detail">{action.detail}</small> : null}{mutation.error(mutationKey) || mutation.error(`actions-status:${action.id}`) ? <span className="inline-mutation-error" role="alert">{mutation.error(mutationKey) ?? mutation.error(`actions-status:${action.id}`)} <button type="button" onClick={() => void (mutation.retry(mutationKey) ?? mutation.retry(`actions-status:${action.id}`))?.()}>Spróbuj ponownie</button></span> : null}</span>
          </section>;
        })}
      </div></section>)}</div> : null}
      {items.length && actionsPage.hasNextPage ? <div className="list-pagination"><Button loading={actionsPage.isFetchingNextPage} onClick={() => void actionsPage.fetchNextPage()}>Pokaż więcej</Button></div> : null}
      {items.length && !actionsPage.hasNextPage && !actionsPage.isFetching ? <p className="muted-copy list-end">To wszystkie Działania w tym widoku.</p> : null}
      {(() => { const action = items.find((candidate) => candidate.id === statusActionId); const statusKey = action ? `actions-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} compact busy={Boolean(statusKey && mutation.isBusy(statusKey))} error={statusKey ? mutation.error(statusKey) : undefined} onClose={() => setStatusActionId(undefined)} onChange={(status, blocker) => action ? changeActionStatus(action, status, blocker) : false} />; })()}
    </AppShell>
  );
}
