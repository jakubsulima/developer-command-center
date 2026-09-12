import { CalendarDays, Check, Circle, Flag, FolderKanban, Pin, PinOff, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { useActionFeedback } from "../components/action-feedback-context";
import { Button, EmptyState } from "../components/ui";
import { actionStatusLabels } from "../domain/labels";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { resolveActionContext } from "../domain/actionContext";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { ActionKnowledgeRelations } from "../components/ActionKnowledgeRelations";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, readNavigationState, type NavigationBreadcrumb } from "../domain/navigation";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";

export function ActionDetailPage() {
  const { actionId } = useParams();
  const location = useLocation();
  const { state, mode, loading, updateAction, setActionStatus } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [resultOpen, setResultOpen] = useState(false);
  const actionQuery = useQuery({
    queryKey: ["workspace-action", mode, state.workspaceId, actionId],
    enabled: mode === "supabase" && !loading && Boolean(actionId) && !state.actions.some((candidate) => candidate.id === actionId),
    queryFn: () => createSupabaseWorkspaceRepository().loadAction(actionId!),
  });
  const action = state.actions.find((candidate) => candidate.id === actionId) ?? actionQuery.data;
  if (!action && actionQuery.isPending) return <AppShell><div role="status" className="app-loading">Ładowanie Działania…</div></AppShell>;
  if (!action) return <AppShell><EmptyState icon={<CalendarDays />} title="Działanie jest niedostępne" detail="Mogło zostać usunięte, przeniesione do Celu albo należy do innej przestrzeni pracy." action={<Link className="button button-primary" to="/">Wróć do Startu</Link>} /></AppShell>;
  const changePin = async () => {
    const previous = action.pinnedToToday;
    await mutation.run(`action-detail:${action.id}`, async () => {
      await updateAction(action.id, { pinnedToToday: !previous });
      notifyUndo({ message: previous ? "Działanie odpięte od Startu." : "Działanie przypięte do Startu.", undo: () => updateAction(action.id, { pinnedToToday: previous }) });
    });
  };
  const complete = async () => {
    const previous = { status: action.status, blocker: action.blocker };
    await mutation.run(`action-detail:${action.id}`, async () => {
      await setActionStatus(action.id, "completed");
      if (!state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result")) notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(action.id, previous.status, previous.blocker), action: { label: "Dodaj rezultat", onClick: () => setResultOpen(true) } });
    });
  };
  const key = `action-detail:${action.id}`;
  const scheduledFor = action.scheduledFor
    ? new Date(`${action.scheduledFor}T12:00:00Z`).toLocaleDateString("pl-PL")
    : null;

  const context = resolveActionContext(action, state);
  const incomingNavigation = readNavigationState(location.state);
  const project = action.areaId ? state.areas.find((candidate) => candidate.id === action.areaId) : state.areas.find((candidate) => incomingNavigation?.returnTo.startsWith(`/projects/${encodeURIComponent(candidate.id)}`));
  const projectName = project?.name ?? (incomingNavigation?.returnLabel.startsWith("Projekt:") ? incomingNavigation.returnLabel.slice("Projekt:".length).trim() : undefined);
  const fallbackBreadcrumbs: NavigationBreadcrumb[] = context.kind === "goal"
    ? [{ label: "Cele", to: "/goals" }, ...(projectName ? [{ label: projectName, to: project ? `/projects/${encodeURIComponent(project.id)}` : incomingNavigation?.returnTo }] : []), { label: `Cel: ${context.name}`, to: context.to }]
    : context.kind === "project" && projectName ? [{ label: "Projekty", to: "/projects" }, { label: projectName, to: context.to }]
      : [{ label: "Start", to: "/" }];
  const actionRoute = `/actions/${encodeURIComponent(action.id)}`;
  const currentBreadcrumb = { label: `Działanie: ${action.title}`, to: actionRoute };
  const breadcrumbs = breadcrumbsForPage(location.state, fallbackBreadcrumbs, currentBreadcrumb);
  const parentLabel = context.kind === "goal" ? "Cel" : context.kind === "project" ? "Projekt" : undefined;
  const parentIcon = context.kind === "goal" ? <Flag /> : <FolderKanban />;
  return <AppShell appearance="focus-detail"><div className="action-detail-page">
    <ContextNavigation current={currentBreadcrumb} fallbackBreadcrumbs={fallbackBreadcrumbs.slice(0, -1).length ? fallbackBreadcrumbs : [{ label: "Start", to: "/" }]} fallbackReturnTo={context.to} fallbackReturnLabel={context.kind === "project" ? `Projekt: ${context.name}` : context.kind === "goal" ? `Cel: ${context.name}` : "Start"} />
    <header className="detail-title-block"><h1>{action.title}</h1><div className="action-status-row"><span className={`action-status-icon ${action.status}`}>{action.status === "completed" ? <Check /> : <Circle />}</span><strong>{actionStatusLabels[action.status]}</strong>{scheduledFor ? <span className="action-date"><CalendarDays />{scheduledFor}</span> : null}</div></header>
    <div className="action-detail-layout">
    {parentLabel && context.name ? <NavigationLink className="action-parent-row" to={context.to} breadcrumbs={breadcrumbs} returnTo={locationAddress(location)} returnLabel={`Działanie: ${action.title}`}><small>Powiązany {parentLabel}</small><span className="action-parent-icon">{parentIcon}</span><strong>{context.name}</strong><ChevronRight /></NavigationLink> : context.kind === "missing-project" ? <p className="muted-copy action-missing-parent" role="status">Projekt tego Działania jest niedostępny. Działanie nie jest samodzielne.</p> : null}
    <section className="action-description-block"><span className="detail-kicker">Opis</span><p className={action.detail ? "" : "action-detail-empty"}>{action.detail || "Bez dodatkowego opisu."}</p></section>
    {mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
    <ActionKnowledgeRelations action={action} variant="detail" onAddResult={() => setResultOpen(true)} navigation={{ breadcrumbs, returnTo: locationAddress(location), returnLabel: `Działanie: ${action.title}` }} />
    <div className="action-detail-actions">
      {state.actions.some((candidate) => candidate.id === action.id) ? <Button loading={mutation.isBusy(key)} onClick={() => void changePin()}>{action.pinnedToToday ? <PinOff /> : <Pin />}{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button> : null}
      {action.status !== "completed" ? <Button variant="primary" loading={mutation.isBusy(key)} onClick={() => void complete()}><Check />Ukończ działanie</Button> : null}
    </div>
    </div>
  </div><ActionResultDialog action={action} open={resultOpen} onClose={() => setResultOpen(false)} /></AppShell>;
}
