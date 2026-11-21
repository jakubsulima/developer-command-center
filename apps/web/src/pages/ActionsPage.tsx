import { useAuth } from "../auth/useAuth";
import { ActionFilterControl } from "../components/ActionFilterControl";
import { SavedActionViews } from "../components/SavedActionViews";
import { useWorkspaceClock } from "../hooks/useWorkspaceClock";
import { Check, Filter, ListTodo, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionStatusDialog, type ActionStatusTarget, type ProjectActionStatus } from "../components/ActionStatusControls";
import { ActionListRow } from "../components/ActionListRow";
import { completeActionWithUndo } from "../components/completeActionWithUndo";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { actionStatusFeedbackEvent, useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { actionListViewLabels, matchesActionListFilter, type ActionListFilter, type ActionListView } from "../domain/actionsList";
import { actionStatusLabels, polishCount } from "../domain/labels";
import { resolveActionContext } from "../domain/actionContext";
import { locationAddress } from "../domain/navigation";
import { localDateForTimeZone } from "../domain/activity";
import type { GoalAction } from "../domain/types";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { resolveCompactRoutineTitle } from "../domain/actionPresentation";
import { ActionPreview } from "../components/ActionPreview";
import { savedActionFilters, savedActionParams } from "../domain/savedActionViews";
import "./actions-workspace.css";

const actionStatusViews = ["open", "ready", "in_progress", "testing", "waiting", "blocked", "completed", "cancelled", "skipped"] as const satisfies readonly ActionListView[];
const actionScheduleViews = ["open", "today", "overdue", "unscheduled"] as const satisfies readonly ActionListView[];
const actionQuickViews = ["open", "today", "overdue"] as const satisfies readonly ActionScheduleView[];
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

function readActionSelection(params: URLSearchParams) {
  const { view, schedule, projectId, goalId } = savedActionFilters(params);
  const status: ActionStatusView = isActionScheduleView(view) ? "open" : view;
  const date: ActionScheduleView = schedule ?? (isActionScheduleView(view) ? view : "open");
  const count = Number(status !== "open") + Number(date !== "open") + Number(Boolean(projectId)) + Number(Boolean(goalId));
  return { view, status, date, projectId, goalId, count };
}

function setScheduleParam(params: URLSearchParams, schedule: ActionScheduleView) {
  if (isActionScheduleView(savedActionFilters(params).view)) params.delete("view");
  if (schedule === "open") params.delete("schedule"); else params.set("schedule", schedule);
}

function clearFilterParams(params: URLSearchParams) {
  for (const name of ["view", "schedule", "project", "goal"]) params.delete(name);
}

function restoreActionParams(params: URLSearchParams, key: string) {
  try {
    const stored = new URLSearchParams(localStorage.getItem(key) ?? "");
    const next = new URLSearchParams(params);
    savedActionParams(savedActionFilters(stored)).forEach((value, name) => next.set(name, value));
    return next;
  } catch {
    return params;
  }
}

function filterLabel(value: string, kind: "project" | "goal", state: ReturnType<typeof useStore>["state"]) {
  if (kind === "project") return state.areas.find((area) => area.id === value)?.name ?? "Nieaktualny Projekt";
  return state.goals.find((goal) => goal.id === value)?.title ?? "Nieaktualna grupa";
}

function compactContextLabel(context: ReturnType<typeof resolveActionContext>) {
  if (context.kind === "goal") return context.name ? `Grupa: ${context.name}` : "Grupa działań";
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
  if (view === "waiting") return polishCount(count, "blokada do sprawdzenia", "blokady do sprawdzenia", "blokad do sprawdzenia");
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
  const { user } = useAuth();
  const { state, mode, loading, setActionStatus, undoActionCompletion } = useStore();
  const [createdItems, setCreatedItems] = useState<{ workspaceId: string | undefined; ids: string[] }>({ workspaceId: state.workspaceId, ids: [] });
  useEffect(() => {
    const receive = (event: Event) => {
      const { id, mode: createdMode } = (event as CustomEvent<{ id: string; mode: string }>).detail;
      if (createdMode === "action") setCreatedItems((current) => ({ workspaceId: state.workspaceId, ids: [...(current.workspaceId === state.workspaceId ? current.ids : []), id] }));
    };
    window.addEventListener("creation:succeeded", receive);
    return () => window.removeEventListener("creation:succeeded", receive);
  }, [state.workspaceId]);
  const [urlParams, setParams] = useSearchParams();
  const location = useLocation();
  const preferenceKey = user && (state.workspaceId || mode === "demo")
    ? `command-actions-filters:${user.id}:${state.workspaceId ?? "demo-workspace"}`
    : undefined;
  const restoreFilters = Boolean(preferenceKey) && !location.state?.actionsFiltersResolved
    && !["view", "schedule", "project", "goal", "highlight", "preview"].some((name) => urlParams.has(name));
  const params = useMemo(() => restoreFilters && preferenceKey ? restoreActionParams(urlParams, preferenceKey) : urlParams, [preferenceKey, restoreFilters, urlParams]);
  useEffect(() => {
    if (restoreFilters) setParams(params, { replace: true, state: { ...location.state, actionsFiltersResolved: true } });
  }, [location.state, params, restoreFilters, setParams]);
  const queryClient = useQueryClient();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [statusTarget, setStatusTarget] = useState<ActionStatusTarget>();
  const [resultActionId, setResultActionId] = useState<string>();
  const [focusRequestId, setFocusRequestId] = useState<string>();
  const [focusEmpty, setFocusEmpty] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const focusAfterMutation = useRef<{ actionId: string; index: number } | undefined>(undefined);
  const { view, status: statusView, date: scheduleView, projectId, goalId, count: filterCount } = readActionSelection(params);
  const [filterDraft, setFilterDraft] = useState<{ baseQuery: string; params: URLSearchParams }>();
  const query = params.toString();
  const draft = filterDraft?.baseQuery === query ? filterDraft.params : undefined;
  const draftSelection = readActionSelection(draft ?? params);
  const now = useWorkspaceClock();
  const today = localDateForTimeZone(now, state.workspaceTimezone);
  const actionFilter = useMemo<ActionListFilter>(() => ({ view, schedule: scheduleView === "open" ? undefined : scheduleView, projectId, goalId, today }), [goalId, projectId, today, view, scheduleView]);
  const actionsPage = useWorkspaceInfinitePage<GoalAction>("actions", 30, { actionFilter });
  const highlightId = params.get("highlight") || undefined;
  const highlightQuery = useQuery({
    queryKey: ["actions-highlight", mode, state.workspaceId, highlightId],
    enabled: !loading && Boolean(highlightId),
    queryFn: async () => mode === "demo" ? state.actions.find((action) => action.id === highlightId) : createSupabaseWorkspaceRepository().loadAction(highlightId!),
  });
  const highlightedAction = highlightId ? state.actions.find((action) => action.id === highlightId) ?? highlightQuery.data : undefined;
  const pageItems = actionsPage.data?.items ?? [];
  const justCreated = createdItems.workspaceId === state.workspaceId ? state.actions.filter((action) => createdItems.ids.includes(action.id)) : [];
  const items = [highlightedAction, ...justCreated, ...pageItems]
    .filter((item): item is GoalAction => Boolean(item))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .map((item) => state.actions.find((current) => current.id === item.id) ?? item)
    .filter((item) => matchesActionListFilter(state, item, actionFilter));
  const hasFilters = filterCount > 0;
  const groupedItems = groupOpenActions(items, view, today);
  const previewAction = items.find((action) => action.id === params.get("preview"));
  const openPreview = (action: GoalAction, trigger: HTMLElement) => {
    previewTriggerRef.current = trigger;
    const next = new URLSearchParams(params);
    next.set("preview", action.id);
    setParams(next, { replace: true, state: location.state });
  };
  const closePreview = () => {
    const next = new URLSearchParams(params);
    next.delete("preview");
    setParams(next, { replace: true, state: location.state });
    const trigger = previewTriggerRef.current?.isConnected ? previewTriggerRef.current : previewAction ? rowRefs.current.get(previewAction.id)?.querySelector<HTMLElement>(".action-list-row-title") : undefined;
    trigger?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!highlightId) return;
    setFocusRequestId(highlightId);
    setFocusEmpty(false);
  }, [highlightId]);

  useEffect(() => {
    const pending = focusAfterMutation.current;
    if (pending && !statusTarget?.menu && !items.some((item) => item.id === pending.actionId)) {
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
  }, [focusEmpty, focusRequestId, items, statusTarget?.menu]);

  const applyFilters = (next: URLSearchParams) => {
    try {
      if (preferenceKey) localStorage.setItem(preferenceKey, savedActionParams(savedActionFilters(next)).toString());
    } catch { /* The current URL still tracks the filters. */ }
    setParams(next, { state: { ...location.state, actionsFiltersResolved: true } });
  };

  const updateDraft = (update: (next: URLSearchParams) => void) => setFilterDraft((current) => {
    if (!current) return current;
    const next = new URLSearchParams(current.params);
    update(next);
    return { ...current, params: next };
  });

  const setContextFilter = (name: "project" | "goal", value: string) => updateDraft((next) => {
    if (value) next.set(name, value); else next.delete(name);
  });

  const setStatusView = (nextView: ActionStatusView) => updateDraft((next) => {
    const schedule = readActionSelection(next).date;
    if (schedule !== "open") next.set("schedule", schedule);
    if (nextView === "open") next.delete("view"); else next.set("view", nextView);
  });

  const setScheduleView = (nextView: ActionScheduleView) => {
    const next = new URLSearchParams(params);
    setScheduleParam(next, nextView);
    applyFilters(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(params);
    clearFilterParams(next);
    applyFilters(next);
  };

  const showOpenActions = () => {
    const next = new URLSearchParams(params);
    next.delete("view");
    next.delete("schedule");
    applyFilters(next);
  };

  const refreshActions = () => queryClient.invalidateQueries({ queryKey: ["workspace-page", "actions"] });
  const rememberFocus = (action: GoalAction) => {
    focusAfterMutation.current = { actionId: action.id, index: Math.max(0, items.findIndex((item) => item.id === action.id)) };
  };

  const changeActionStatus = async (action: GoalAction, status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => {
    const previous = { status: action.status, blocker: action.blocker, reviewOn: action.reviewOn };
    rememberFocus(action);
    return mutation.run(`actions-status:${action.id}`, async () => {
      await setActionStatus(action.id, status, blocker, action.version, reviewOn);
      await refreshActions();
      notifyUndo({ event: actionStatusFeedbackEvent(status), message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: async () => {
        await setActionStatus(action.id, previous.status, previous.blocker, action.version + 1, previous.reviewOn ?? null);
        await refreshActions();
        setFocusRequestId(action.id);
      }});
    });
  };
  const completeAction = (action: GoalAction) => {
    rememberFocus(action);
    const key = `actions-status:${action.id}`;
    return mutation.run(key, () => completeActionWithUndo({
      action,
      setActionStatus,
      undoActionCompletion,
      notifyUndo,
      hasResult: state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result"),
      onAddResult: () => setResultActionId(action.id),
    }));
  };

  const retry = () => void actionsPage.refetch();
  const listAddress = locationAddress(location);
  const rowNavigation = { breadcrumbs: [{ label: "Działania", to: listAddress }], returnTo: listAddress, returnLabel: "Wszystkie Działania" };

  return (
    <AppShell addAction={{ label: "Dodaj Działanie", shortLabel: "Działanie", ariaLabel: "Dodaj nowe Działanie", quickAdd: { mode: "action", pinnedToToday: false, draftKey: "actions-list" } }}>
      <PageHeading title="Działania" className="actions-page-heading" mobileBrand />
      <section className="actions-toolbar" aria-label="Filtry Działań">
        <div className="actions-toolbar-topline">
          <div className="actions-view-tabs" role="group" aria-label="Szybkie widoki Działań">
            {actionQuickViews.map((option) => (
              <button key={option} type="button" aria-pressed={scheduleView === option} onClick={() => setScheduleView(option)}>
                {option === "open" && statusView === "open" ? "Otwarte" : actionScheduleViewLabels[option]}
              </button>
            ))}
          </div>
          <SavedActionViews params={params} onApply={applyFilters} />
          <ActionFilterControl label="Filtry" ariaLabel={hasFilters ? `Filtry Działań, aktywne: ${filterCount}` : "Filtry Działań"} active={hasFilters} open={Boolean(draft)}
            onOpenChange={(open) => setFilterDraft(open ? { baseQuery: query, params } : undefined)}
            footer={<>
              <Button variant="ghost" disabled={!draftSelection.count} onClick={() => updateDraft(clearFilterParams)}>Wyczyść filtry</Button>
              <Button variant="primary" onClick={() => { if (draft && draft.toString() !== query) applyFilters(draft); setFilterDraft(undefined); }}>Gotowe</Button>
            </>}>
            <label className="actions-filter-field">
              <span>Status</span>
              <select aria-label="Status Działań" value={draftSelection.status} onChange={(event) => setStatusView(event.target.value as ActionStatusView)}>
                {actionStatusViews.map((option) => <option key={option} value={option}>{actionListViewLabels[option]}</option>)}
              </select>
            </label>
            <div className="action-filter-group" role="group" aria-label="Termin Działań">
              <h3>Termin</h3>
              <div className="action-filter-options">
                {actionScheduleViews.map((option) => <button key={option} className="action-filter-option" type="button" aria-pressed={draftSelection.date === option} onClick={() => updateDraft((next) => setScheduleParam(next, option))}>
                  <span className="action-filter-option-icon" aria-hidden="true">{draftSelection.date === option ? <Check /> : null}</span>
                  <span>{actionScheduleViewLabels[option]}</span>
                </button>)}
              </div>
            </div>
            <div className="actions-filter-context">
              <label className="actions-filter-field"><span>Projekt</span><select aria-label="Filtr Projektu" value={draftSelection.projectId ?? ""} onChange={(event) => setContextFilter("project", event.target.value)}>
                <option value="">Wszystkie projekty</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select></label>
              <label className="actions-filter-field"><span>Grupa działań</span><select aria-label="Filtr grupy" value={draftSelection.goalId ?? ""} onChange={(event) => setContextFilter("goal", event.target.value)}>
                <option value="">Wszystkie grupy</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
              </select></label>
            </div>
          </ActionFilterControl>
        </div>
        {hasFilters ? <div className="actions-active-filters" aria-label="Aktywne filtry"><Filter />{view !== "open" ? <Badge>{actionListViewLabels[view]}</Badge> : null}{scheduleView !== "open" && scheduleView !== view ? <Badge>{actionScheduleViewLabels[scheduleView]}</Badge> : null}{projectId ? <Badge>{filterLabel(projectId, "project", state)}</Badge> : null}{goalId ? <Badge>{filterLabel(goalId, "goal", state)}</Badge> : null}<Button variant="ghost" onClick={clearFilters}><X />Wyczyść filtry</Button></div> : null}
        <div className="actions-results-summary" aria-live="polite"><span>{resultCountLabel(items.length, view)}</span>{projectId && goalId ? <small>Projekt i grupa muszą pasować jednocześnie.</small> : null}</div>
      </section>

      <div className={`actions-workspace${previewAction ? " has-preview" : ""}`} onKeyDown={(event) => {
        if (event.key === "Escape" && previewAction && !document.querySelector('[aria-modal="true"]')) {
          event.preventDefault();
          closePreview();
        }
      }}>
      <div className="actions-collection">
      {items.length ? <div className="actions-list-columns" aria-hidden="true"><span /><span>Działanie</span><span>Projekt / Grupa działań</span><span>Termin</span></div> : null}
      {loading || actionsPage.isPending ? <ListSkeleton rows={5} label="Ładowanie Działań" /> : null}
      {actionsPage.isError ? <Panel className="actions-error" role="alert"><RefreshCw /><div><strong>Nie udało się pobrać Działań.</strong><p>Spróbuj ponownie; bieżące filtry pozostaną zachowane.</p></div><Button onClick={retry}>Spróbuj ponownie</Button></Panel> : null}
      {!actionsPage.isPending && !actionsPage.isError && items.length === 0 ? <div data-actions-empty tabIndex={-1}><EmptyState icon={<ListTodo />} title={view === "waiting" ? "Nic nie wymaga dziś sprawdzenia" : view === "overdue" ? "Brak zaległych Działań" : statusView !== "open" ? `Brak Działań: ${actionListViewLabels[statusView]}` : hasFilters ? "Brak Działań dla tych filtrów" : "Brak otwartych Działań"} detail={view === "waiting" ? "Zablokowane Działania bez daty nadal znajdziesz w widoku Zablokowane." : hasFilters ? "Zmień termin, Projekt lub Grupa działań albo wyczyść filtry." : statusView === "open" ? "Dodaj pierwszy konkretny krok, aby pojawił się na tej liście." : "Wybierz inny status Działań."} action={statusView !== "open" ? <Button onClick={showOpenActions}>Przejdź do otwartych</Button> : hasFilters ? <Button onClick={clearFilters}><X />Wyczyść filtry</Button> : undefined} /></div> : null}
      {items.length ? <div className="actions-groups" aria-label={`Lista: ${actionListViewLabels[view]}`}>
        {groupedItems.map((group) => <section className="actions-group" key={group.key} data-schedule-group={group.label ? group.key : undefined} aria-label={group.label}>{group.label ? <h2><span>{group.label}</span><small>{group.items.length}</small></h2> : null}<div className="actions-list workspace-list" role="list">
        {group.items.map((action) => {
          const context = resolveActionContext(action, state);
          const statusKey = `actions-status:${action.id}`;
          const mutationKey = `actions-list:${action.id}`;
          const error = mutation.error(mutationKey) ?? mutation.error(statusKey);
          return <ActionListRow as="section" role="listitem" key={action.id} action={action} navigation={rowNavigation}
            ref={(node) => { if (node) rowRefs.current.set(action.id, node); else rowRefs.current.delete(action.id); }}
            className={`actions-list-row${highlightId === action.id ? " navigation-card-highlight" : ""}`}
            data-highlighted={highlightId === action.id || undefined} data-preview-selected={previewAction?.id === action.id || undefined}
            timeZone={state.workspaceTimezone} today={today} routineTitle={resolveCompactRoutineTitle(action, state.recurringActionTemplates)}
            busy={mutation.isBusy(statusKey)} onOpenStatus={() => setStatusTarget({ action, menu: true })}
            onToggleComplete={() => void (action.status === "completed" ? changeActionStatus(action, "ready") : completeAction(action))}
            context={context.kind === "standalone" ? undefined : { label: compactContextLabel(context), to: context.to === "/" ? undefined : context.to }}
            onTitleClick={(event) => {
              if (window.matchMedia("(min-width: 1440px)").matches && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                event.preventDefault();
                openPreview(action, event.currentTarget);
              }
            }}>
            {error ? <span className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void (mutation.retry(mutationKey) ?? mutation.retry(statusKey))?.()}>Spróbuj ponownie</button></span> : null}
          </ActionListRow>;
        })}
      </div></section>)}</div> : null}
      {items.length && actionsPage.hasNextPage ? <div className="list-pagination"><Button loading={actionsPage.isFetchingNextPage} onClick={() => void actionsPage.fetchNextPage()}>Pokaż więcej</Button></div> : null}
      {items.length && !actionsPage.hasNextPage && !actionsPage.isFetching ? <p className="muted-copy list-end">To wszystkie Działania w tym widoku.</p> : null}
      </div>
      {previewAction ? <ActionPreview action={previewAction} today={today} returnTo={listAddress} busy={mutation.isBusy(`actions-status:${previewAction.id}`)} error={mutation.error(`actions-status:${previewAction.id}`)} onClose={closePreview} onOpenStatus={() => setStatusTarget({ action: previewAction })} onComplete={() => void completeAction(previewAction)} onRetry={() => void mutation.retry(`actions-status:${previewAction.id}`)?.()} /> : null}
      </div>
      {(() => { const action = items.find((candidate) => candidate.id === statusTarget?.action.id) ?? (statusTarget?.menu ? statusTarget.action : undefined); const statusKey = action ? `actions-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} menu={statusTarget?.menu} compact busy={Boolean(statusKey && mutation.isBusy(statusKey))} error={statusKey ? mutation.error(statusKey) : undefined} onClose={() => setStatusTarget(undefined)} onChange={(status, blocker, reviewOn) => action ? changeActionStatus(action, status, blocker, reviewOn) : false} />; })()}
      <ActionResultDialog action={state.actions.find((candidate) => candidate.id === resultActionId)} open={Boolean(resultActionId)} onClose={() => setResultActionId(undefined)} />
    </AppShell>
  );
}
