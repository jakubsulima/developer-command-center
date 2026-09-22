import "./focus-detail.css";
import { CalendarDays, Check, Flag, FolderKanban, Pin, PinOff, ChevronRight, LockKeyhole, Pencil } from "lucide-react";
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
import { ActionStatusDialog, type ProjectActionStatus } from "../components/ActionStatusControls";
import { ActionSignals } from "../components/ActionSignals";
import { ActionEditDialog, type ActionEditValue } from "../components/ActionEditDialog";
import { localDateForTimeZone } from "../domain/activity";
import { resolveRoutineTitle } from "../domain/actionPresentation";

export function ActionDetailPage() {
  const { actionId } = useParams();
  const location = useLocation();
  const { state, mode, loading, updateAction, setActionStatus } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [resultOpen, setResultOpen] = useState(false);
  const [statusView, setStatusView] = useState<"statuses" | "blocker">();
  const [editOpen, setEditOpen] = useState(false);
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
  const statusKey = `action-detail-status:${action.id}`;
  const changeStatus = async (status: ProjectActionStatus, blocker?: string) => {
    const previous = { status: action.status, blocker: action.blocker };
    return mutation.run(statusKey, async () => {
      await setActionStatus(action.id, status, blocker);
      notifyUndo({ message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker) });
    });
  };
  const editKey = `action-detail-edit:${action.id}`;
  const saveEdit = (value: ActionEditValue, expectedVersion?: number) => mutation.run(editKey, () => updateAction(action.id, { title: value.title, detail: value.detail, scheduledFor: value.scheduledFor || null, checklist: value.checklist }, expectedVersion));
  const today = localDateForTimeZone(new Date(), state.workspaceTimezone);

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
    <header className="detail-title-block"><h1>{action.title}</h1><div className="action-status-row"><ActionSignals action={action} timeZone={state.workspaceTimezone} today={today} routineTitle={resolveRoutineTitle(action, state.recurringActionTemplates)} density="detail" disabled={mutation.isBusy(statusKey)} onOpenStatus={() => setStatusView("statuses")} /><Button variant="ghost" onClick={() => setEditOpen(true)}><Pencil />Edytuj</Button></div></header>
    <div className="action-detail-layout">
    {parentLabel && context.name ? <NavigationLink className="action-parent-row" to={context.to} breadcrumbs={breadcrumbs} returnTo={locationAddress(location)} returnLabel={`Działanie: ${action.title}`}><small>Powiązany {parentLabel}</small><span className="action-parent-icon">{parentIcon}</span><strong>{context.name}</strong><ChevronRight /></NavigationLink> : context.kind === "missing-project" ? <p className="muted-copy action-missing-parent" role="status">Projekt tego Działania jest niedostępny. Działanie nie jest samodzielne.</p> : null}
    {action.detail ? <section className="action-description-block"><span className="detail-kicker">Opis</span><p>{action.detail}</p></section> : <p className="muted-copy action-detail-empty">Brak opisu. <button type="button" onClick={() => setEditOpen(true)}>Dodaj opis</button></p>}
    {action.status === "blocked" ? <section className="action-blocker-section" aria-labelledby="action-blocker-title"><h2 className="detail-kicker" id="action-blocker-title"><LockKeyhole />Powód blokady</h2><Button variant="ghost" aria-label="Edytuj blokadę" onClick={() => setStatusView("blocker")}>Edytuj</Button><p>{action.blocker || "Nie podano powodu blokady."}</p></section> : null}
    {mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
    <ActionKnowledgeRelations action={action} variant="detail" onAddResult={() => setResultOpen(true)} navigation={{ breadcrumbs, returnTo: locationAddress(location), returnLabel: `Działanie: ${action.title}` }} />
    <div className="action-detail-actions">
      {state.actions.some((candidate) => candidate.id === action.id) ? <Button loading={mutation.isBusy(key)} onClick={() => void changePin()}>{action.pinnedToToday ? <PinOff /> : <Pin />}{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button> : null}
      {action.status !== "completed" ? <Button variant="primary" loading={mutation.isBusy(key)} onClick={() => void complete()}><Check />Ukończ działanie</Button> : null}
    </div>
    </div>
  </div><ActionStatusDialog action={action} open={Boolean(statusView)} initialView={statusView} busy={mutation.isBusy(statusKey)} error={mutation.error(statusKey)} onClose={() => setStatusView(undefined)} onChange={changeStatus} /><ActionEditDialog action={action} open={editOpen} busy={mutation.isBusy(editKey)} error={mutation.error(editKey)} onClose={() => setEditOpen(false)} onSave={saveEdit} /><ActionResultDialog action={action} open={resultOpen} onClose={() => setResultOpen(false)} /></AppShell>;
}
