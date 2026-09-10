import { CalendarClock, CircleCheck, Filter, ListTodo, RefreshCw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { ActionDecisionMenu } from "../components/ActionDecisionMenu";
import { NavigationLink } from "../components/ContextNavigation";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { actionListViewLabels, actionListViews, isActionListView, matchesActionListFilter, type ActionListFilter, type ActionListView } from "../domain/actionsList";
import { actionStatusLabels } from "../domain/labels";
import { resolveActionContext } from "../domain/actionContext";
import { locationAddress, navigationCardId } from "../domain/navigation";
import { localDateForTimeZone } from "../domain/activity";
import type { GoalAction } from "../domain/types";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";

function formatScheduledDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(`${value}T12:00:00Z`));
}

function shiftDate(value: string, amount: number) {
  const result = new Date(`${value}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

function formatCompletedDate(action: GoalAction, timeZone: string) {
  const value = action.completedAt ?? action.updatedAt;
  if (!value) return "Ukończone";
  return `Ukończone ${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(value))}`;
}

function filterLabel(value: string, kind: "project" | "goal", state: ReturnType<typeof useStore>["state"]) {
  if (kind === "project") return state.areas.find((area) => area.id === value)?.name ?? "Nieaktualny Projekt";
  return state.goals.find((goal) => goal.id === value)?.title ?? "Nieaktualny Cel";
}

export function ActionsPage() {
  const { state, mode, loading, setActionStatus, updateAction } = useStore();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [actionMenuId, setActionMenuId] = useState<string>();
  const [focusRequestId, setFocusRequestId] = useState<string>();
  const [focusEmpty, setFocusEmpty] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const focusAfterMutation = useRef<{ actionId: string; index: number } | undefined>(undefined);
  const rawView = params.get("view");
  const view: ActionListView = isActionListView(rawView) ? rawView : "open";
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
  const hasFilters = view !== "open" || Boolean(projectId || goalId);

  useEffect(() => {
    if (!highlightId) return;
    setFocusRequestId(highlightId);
    setFocusEmpty(false);
  }, [highlightId]);

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

  const setView = (nextView: ActionListView) => {
    const next = new URLSearchParams(params);
    if (nextView === "open") next.delete("view"); else next.set("view", nextView);
    setParams(next);
  };

  const clearFilters = () => setParams({ view: "open" });

  const refreshActions = () => queryClient.resetQueries({ queryKey: ["workspace-page", "actions"] });
  const rememberFocus = (action: GoalAction) => {
    focusAfterMutation.current = { actionId: action.id, index: Math.max(0, items.findIndex((item) => item.id === action.id)) };
  };

  const complete = async (action: GoalAction) => {
    if (action.status === "completed") return false;
    const previous = { status: action.status, blocker: action.blocker };
    rememberFocus(action);
    return mutation.run(`actions-list:${action.id}`, async () => {
      await setActionStatus(action.id, "completed", undefined, action.version);
      await refreshActions();
      notifyUndo({ message: "Działanie ukończone.", undo: async () => {
        await setActionStatus(action.id, previous.status, previous.blocker, action.version + 1);
        await refreshActions();
        setFocusRequestId(action.id);
      }});
    });
  };

  const reschedule = async (action: GoalAction, scheduledFor: string | null) => {
    const previousScheduledFor = action.scheduledFor;
    rememberFocus(action);
    return mutation.run(`actions-list:${action.id}`, async () => {
      await updateAction(action.id, { scheduledFor }, action.version);
      await refreshActions();
      const message = scheduledFor
        ? action.pinnedToToday ? `Działanie przełożono. Nadal przypięte na dziś.` : "Działanie przełożono."
        : action.pinnedToToday ? "Usunięto termin. Nadal przypięte na dziś." : "Usunięto termin Działania.";
      notifyUndo({ message, undo: async () => {
        await updateAction(action.id, { scheduledFor: previousScheduledFor ?? null }, action.version + 1);
        await refreshActions();
        setFocusRequestId(action.id);
      }});
    });
  };

  const cancel = async (action: GoalAction) => {
    const previous = { status: action.status, blocker: action.blocker };
    rememberFocus(action);
    return mutation.run(`actions-list:${action.id}`, async () => {
      await setActionStatus(action.id, "cancelled", undefined, action.version);
      await refreshActions();
      notifyUndo({ message: "Działanie anulowano. Rekord zachowano.", undo: async () => {
        await setActionStatus(action.id, previous.status, previous.blocker, action.version + 1);
        await refreshActions();
        setFocusRequestId(action.id);
      }});
    });
  };

  const unblock = async (action: GoalAction) => {
    const previous = { status: action.status, blocker: action.blocker };
    rememberFocus(action);
    return mutation.run(`actions-list:${action.id}`, async () => {
      await setActionStatus(action.id, "ready", undefined, action.version);
      await refreshActions();
      notifyUndo({ message: "Działanie odblokowano.", undo: async () => {
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
        <div className="actions-view-tabs" role="tablist" aria-label="Widoki Działań">
          {actionListViews.map((option) => (
            <button key={option} type="button" role="tab" aria-selected={view === option} onClick={() => setView(option)}>
              {actionListViewLabels[option]}
            </button>
          ))}
        </div>
        <div className="knowledge-filter-fields">
          <label><span>Projekt</span><select aria-label="Filtr Projektu" value={projectId ?? ""} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set("project", event.target.value); else next.delete("project"); setParams(next); }}><option value="">Każdy Projekt</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <label><span>Cel</span><select aria-label="Filtr Celu" value={goalId ?? ""} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set("goal", event.target.value); else next.delete("goal"); setParams(next); }}><option value="">Każdy Cel</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
        </div>
        {hasFilters ? <div className="actions-active-filters" aria-label="Aktywne filtry"><Filter />{view !== "open" ? <Badge>{actionListViewLabels[view]}</Badge> : null}{projectId ? <Badge>{filterLabel(projectId, "project", state)}</Badge> : null}{goalId ? <Badge>{filterLabel(goalId, "goal", state)}</Badge> : null}<Button variant="ghost" onClick={clearFilters}><X />Wyczyść</Button></div> : null}
      </section>

      <div className="actions-results-summary" aria-live="polite"><span>{items.length} załadowanych {items.length === 1 ? "Działanie" : "Działań"}</span>{projectId || goalId ? <small>Filtry łączą się przez AND.</small> : <small>Pokazywane są tylko aktywnie widoczne konteksty.</small>}</div>
      {loading || actionsPage.isPending ? <ListSkeleton rows={5} label="Ładowanie Działań" /> : null}
      {actionsPage.isError ? <Panel className="actions-error" role="alert"><RefreshCw /><div><strong>Nie udało się pobrać Działań.</strong><p>Spróbuj ponownie; bieżące filtry pozostaną zachowane.</p></div><Button onClick={retry}>Spróbuj ponownie</Button></Panel> : null}
      {!actionsPage.isPending && !actionsPage.isError && items.length === 0 ? <div data-actions-empty tabIndex={-1}><EmptyState icon={<ListTodo />} title={view === "overdue" ? "Brak zaległych Działań" : view === "blocked" ? "Brak zablokowanych Działań" : hasFilters ? "Brak Działań w tym widoku" : "Brak otwartych Działań"} detail={hasFilters ? "Spróbuj innego widoku albo wyczyść filtry. Sprzeczne i nieaktualne filtry nie są pomijane." : "Dodaj pierwszy konkretny krok, aby pojawił się na tej liście."} action={view === "overdue" || view === "blocked" ? <Button onClick={clearFilters}>Przejdź do otwartych</Button> : hasFilters ? <Button onClick={clearFilters}><X />Wyczyść filtry</Button> : undefined} /></div> : null}
      {items.length ? <div className="actions-list" aria-label={`Lista: ${actionListViewLabels[view]}`}>
        {items.map((action) => {
          const context = resolveActionContext(action, state);
          const mutationKey = `actions-list:${action.id}`;
          const date = view === "completed" ? formatCompletedDate(action, state.workspaceTimezone) : action.scheduledFor ? `Termin: ${formatScheduledDate(action.scheduledFor, state.workspaceTimezone)}` : action.pinnedToToday ? "Przypięte na dziś" : "Bez terminu";
          return <section ref={(node) => { if (node) rowRefs.current.set(action.id, node); else rowRefs.current.delete(action.id); }} className={`panel actions-list-row ${action.status === "completed" ? "completed" : ""} ${highlightId === action.id ? "navigation-card-highlight" : ""}`} key={action.id} data-navigation-card-id={navigationCardId("action", action.id)} data-highlighted={highlightId === action.id || undefined} tabIndex={-1}>
            {action.status === "completed" ? <button className="action-check actions-list-check" type="button" disabled aria-label={`Ukończone Działanie: ${action.title}`}><CircleCheck /></button> : <ActionPrimaryControls action={action} busy={mutation.isBusy(mutationKey)} ariaLabelPrefix="Ukończ Działanie" onToggleComplete={() => void complete(action)} onMore={() => setActionMenuId(action.id)} />}
            <span className="actions-list-copy" style={{ gridColumn: 2 }}><NavigationLink className="actions-list-title" to={`/actions/${encodeURIComponent(action.id)}`} breadcrumbs={[{ label: "Działania", to: locationAddress(location) }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Działania" sourceCardId={navigationCardId("action", action.id)}><strong>{action.title}</strong></NavigationLink><small className="actions-list-context"><NavigationLink to={context.to} breadcrumbs={[{ label: "Działania", to: locationAddress(location) }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Działania" sourceCardId={navigationCardId("action", action.id)}>{context.name ? `${context.label.replace("Działanie w ", "")} · ${context.name}` : context.label}</NavigationLink></small><small className="actions-list-meta"><CalendarClock />{date}{action.status !== "completed" ? <><span aria-hidden="true">·</span>{actionStatusLabels[action.status]}</> : null}</small>{action.detail ? <small className="actions-list-detail">{action.detail}</small> : null}{mutation.error(mutationKey) ? <span className="inline-mutation-error" role="alert">{mutation.error(mutationKey)} <button type="button" onClick={() => void mutation.retry(mutationKey)?.()}>Spróbuj ponownie</button></span> : null}</span>
            <Badge tone={action.status === "blocked" ? "danger" : action.status === "completed" ? "success" : "info"}>{actionStatusLabels[action.status]}</Badge>
          </section>;
        })}
      </div> : null}
      {items.length && actionsPage.hasNextPage ? <div className="list-pagination"><Button loading={actionsPage.isFetchingNextPage} onClick={() => void actionsPage.fetchNextPage()}>Pokaż więcej</Button></div> : null}
      {items.length && !actionsPage.hasNextPage && !actionsPage.isFetching ? <p className="muted-copy list-end">To wszystkie Działania w tym widoku.</p> : null}
      <ActionDecisionMenu action={items.find((action) => action.id === actionMenuId)} open={Boolean(actionMenuId)} busy={Boolean(actionMenuId && mutation.isBusy(`actions-list:${actionMenuId}`))} today={today} tomorrow={shiftDate(today, 1)} error={actionMenuId ? mutation.error(`actions-list:${actionMenuId}`) : undefined} onClose={() => setActionMenuId(undefined)} onComplete={() => { const action = items.find((candidate) => candidate.id === actionMenuId); return action ? complete(action) : false; }} onReschedule={(scheduledFor) => { const action = items.find((candidate) => candidate.id === actionMenuId); return action ? reschedule(action, scheduledFor) : false; }} onCancel={() => { const action = items.find((candidate) => candidate.id === actionMenuId); return action ? cancel(action) : false; }} onUnblock={() => { const action = items.find((candidate) => candidate.id === actionMenuId); return action ? unblock(action) : false; }} onRetry={() => actionMenuId ? mutation.retry(`actions-list:${actionMenuId}`)?.() ?? false : false} />
    </AppShell>
  );
}
