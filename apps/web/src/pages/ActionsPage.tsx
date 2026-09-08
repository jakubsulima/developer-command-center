import { CalendarClock, Circle, CircleCheck, Filter, ListTodo, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { QuickAdd } from "../components/QuickAdd";
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

function formatScheduledDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(`${value}T12:00:00Z`));
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
  const { state, loading, setActionStatus } = useStore();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const rawView = params.get("view");
  const view: ActionListView = isActionListView(rawView) ? rawView : "open";
  const projectId = params.get("project") || undefined;
  const goalId = params.get("goal") || undefined;
  const today = localDateForTimeZone(new Date(), state.workspaceTimezone);
  const actionFilter = useMemo<ActionListFilter>(() => ({ view, projectId, goalId, today }), [goalId, projectId, today, view]);
  const actionsPage = useWorkspaceInfinitePage<GoalAction>("actions", 30, { actionFilter });
  const pageItems = actionsPage.data?.items ?? [];
  const items = pageItems
    .map((item) => state.actions.find((current) => current.id === item.id) ?? item)
    .filter((item) => matchesActionListFilter(state, item, actionFilter));
  const hasFilters = view !== "open" || Boolean(projectId || goalId);

  const setView = (nextView: ActionListView) => {
    const next = new URLSearchParams(params);
    if (nextView === "open") next.delete("view"); else next.set("view", nextView);
    setParams(next);
  };

  const clearFilters = () => setParams({ view: "open" });

  const complete = async (action: GoalAction) => {
    if (action.status === "completed") return;
    const previous = { status: action.status, blocker: action.blocker };
    await mutation.run(`actions-list:${action.id}`, async () => {
      await setActionStatus(action.id, "completed");
      notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(action.id, previous.status, previous.blocker) });
      await queryClient.invalidateQueries({ queryKey: ["workspace-page", "actions"] });
    });
  };

  const retry = () => void actionsPage.refetch();

  return (
    <AppShell addAction={{ label: "Dodaj Działanie", shortLabel: "Działanie", ariaLabel: "Dodaj nowe Działanie", active: quickAddOpen, onClick: () => setQuickAddOpen(true) }}>
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
      {!actionsPage.isPending && !actionsPage.isError && items.length === 0 ? <EmptyState icon={<ListTodo />} title={hasFilters ? "Brak Działań w tym widoku" : "Brak otwartych Działań"} detail={hasFilters ? "Spróbuj innego widoku albo wyczyść filtry. Sprzeczne i nieaktualne filtry nie są pomijane." : "Dodaj pierwszy konkretny krok, aby pojawił się na tej liście."} action={hasFilters ? <Button onClick={clearFilters}><X />Wyczyść filtry</Button> : undefined} /> : null}
      {items.length ? <div className="actions-list" aria-label={`Lista: ${actionListViewLabels[view]}`}>
        {items.map((action) => {
          const context = resolveActionContext(action, state);
          const mutationKey = `actions-list:${action.id}`;
          const date = view === "completed" ? formatCompletedDate(action, state.workspaceTimezone) : action.scheduledFor ? `Termin: ${formatScheduledDate(action.scheduledFor, state.workspaceTimezone)}` : action.pinnedToToday ? "Przypięte na dziś" : "Bez terminu";
          return <Panel className={`actions-list-row ${action.status === "completed" ? "completed" : ""}`} key={action.id} data-navigation-card-id={navigationCardId("action", action.id)} tabIndex={-1}>
            <button className="action-check actions-list-check" type="button" disabled={action.status === "completed" || mutation.isBusy(mutationKey)} aria-label={action.status === "completed" ? `Ukończone Działanie: ${action.title}` : `Ukończ Działanie: ${action.title}`} onClick={() => void complete(action)}>{action.status === "completed" ? <CircleCheck /> : mutation.isBusy(mutationKey) ? <RefreshCw className="spin" /> : <Circle />}</button>
            <span className="actions-list-copy"><NavigationLink className="actions-list-title" to={`/actions/${encodeURIComponent(action.id)}`} breadcrumbs={[{ label: "Działania", to: locationAddress(location) }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Działania" sourceCardId={navigationCardId("action", action.id)}><strong>{action.title}</strong></NavigationLink><small className="actions-list-context"><NavigationLink to={context.to} breadcrumbs={[{ label: "Działania", to: locationAddress(location) }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Działania" sourceCardId={navigationCardId("action", action.id)}>{context.name ? `${context.label.replace("Działanie w ", "")} · ${context.name}` : context.label}</NavigationLink></small><small className="actions-list-meta"><CalendarClock />{date}{action.status !== "completed" ? <><span aria-hidden="true">·</span>{actionStatusLabels[action.status]}</> : null}</small>{action.detail ? <small className="actions-list-detail">{action.detail}</small> : null}{mutation.error(mutationKey) ? <span className="inline-mutation-error" role="alert">{mutation.error(mutationKey)} <button type="button" onClick={() => void mutation.retry(mutationKey)?.()}>Spróbuj ponownie</button></span> : null}</span>
            <Badge tone={action.status === "blocked" ? "danger" : action.status === "completed" ? "success" : "info"}>{actionStatusLabels[action.status]}</Badge>
          </Panel>;
        })}
      </div> : null}
      {items.length && actionsPage.hasNextPage ? <div className="list-pagination"><Button loading={actionsPage.isFetchingNextPage} onClick={() => void actionsPage.fetchNextPage()}>Pokaż więcej</Button></div> : null}
      {items.length && !actionsPage.hasNextPage && !actionsPage.isFetching ? <p className="muted-copy list-end">To wszystkie Działania w tym widoku.</p> : null}
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </AppShell>
  );
}
