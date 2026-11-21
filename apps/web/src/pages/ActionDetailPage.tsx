import { actionGroupAssignment } from "../domain/actionGroups";
import { AIContextExport } from "../components/AIContextExport";
import { KnowledgeSuggestions } from "../components/KnowledgeSuggestions";
import "./focus-detail.css";
import { CalendarDays, Flag, FolderKanban, Pin, PinOff, LockKeyhole, MoreHorizontal, Pencil } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { actionStatusFeedbackEvent, useActionFeedback } from "../components/action-feedback-context";
import { Button, EmptyState } from "../components/ui";
import { actionStatusLabels } from "../domain/labels";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { resolveActionContext } from "../domain/actionContext";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { completeActionWithUndo } from "../components/completeActionWithUndo";
import { ActionKnowledgeRelations } from "../components/ActionKnowledgeRelations";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, readNavigationBreadcrumbs, readNavigationState, type NavigationBreadcrumb } from "../domain/navigation";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { ActionStatusDialog, type ProjectActionStatus } from "../components/ActionStatusControls";
import { ActionSignals } from "../components/ActionSignals";
import { ActionEditDialog, type ActionEditValue } from "../components/ActionEditDialog";
import { localDateForTimeZone } from "../domain/activity";
import { resolveRoutineTitle } from "../domain/actionPresentation";

export function ActionDetailPage() {
  const { actionId } = useParams();
  const location = useLocation();
  const { state, mode, loading, updateAction, setActionStatus, undoActionCompletion } = useStore();
  const { notifyUndo, notifySuccess } = useActionFeedback();
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
  if (!action) return <AppShell><EmptyState icon={<CalendarDays />} title="Działanie jest niedostępne" detail="Mogło zostać usunięte, przeniesione do grupy albo należy do innej przestrzeni pracy." action={<Link className="button button-primary" to="/">Wróć do Startu</Link>} /></AppShell>;
  const pinKey = `action-detail:${action.id}`;
  const changePin = async () => {
    const previous = action.pinnedToToday;
    await mutation.run(pinKey, async () => {
      await updateAction(action.id, { pinnedToToday: !previous });
      notifyUndo({ message: previous ? "Działanie odpięte od Startu." : "Działanie przypięte do Startu.", undo: () => updateAction(action.id, { pinnedToToday: previous }) });
    });
  };
  const statusKey = `action-detail-status:${action.id}`;
  const changeStatus = (status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => mutation.run(statusKey, async () => {
    if (status === "completed") {
      await completeActionWithUndo({
        action,
        setActionStatus,
        undoActionCompletion,
        notifyUndo,
        hasResult: state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result"),
        onAddResult: () => setResultOpen(true),
      });
      return;
    }
    const previous = { status: action.status, blocker: action.blocker, reviewOn: action.reviewOn };
    await setActionStatus(action.id, status, blocker, action.version, reviewOn);
    notifyUndo({ event: actionStatusFeedbackEvent(status), message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker, action.version + 1, previous.reviewOn ?? null) });
  });
  const editKey = `action-detail-edit:${action.id}`;
  const saveEdit = (value: ActionEditValue, expectedVersion?: number) => mutation.run(editKey, async () => {
    await updateAction(action.id, { ...actionGroupAssignment(state, action, value.goalId), title: value.title, detail: value.detail, scheduledFor: value.scheduledFor || null, checklist: value.checklist }, expectedVersion);
    notifySuccess("Zapisano zmiany w Działaniu.");
  });
  const today = localDateForTimeZone(new Date(), state.workspaceTimezone);

  const context = resolveActionContext(action, state);
  const incomingNavigation = readNavigationState(location.state);
  const project = action.areaId ? state.areas.find((candidate) => candidate.id === action.areaId) : state.areas.find((candidate) => incomingNavigation?.returnTo.startsWith(`/projects/${encodeURIComponent(candidate.id)}`));
  const projectName = project?.name ?? (incomingNavigation?.returnLabel.startsWith("Projekt:") ? incomingNavigation.returnLabel.slice("Projekt:".length).trim() : undefined);
  const fallbackBreadcrumbs: NavigationBreadcrumb[] = context.kind === "goal"
    ? [{ label: "Grupy działań", to: "/goals" }, ...(projectName ? [{ label: projectName, to: project ? `/projects/${encodeURIComponent(project.id)}` : incomingNavigation?.returnTo }] : []), { label: `Grupa: ${context.name}`, to: context.to }]
    : context.kind === "project" && projectName ? [{ label: "Projekty", to: "/projects" }, { label: projectName, to: context.to }]
      : [{ label: "Start", to: "/" }];
  const actionRoute = `/actions/${encodeURIComponent(action.id)}`;
  const currentBreadcrumb = { label: `Działanie: ${action.title}`, to: actionRoute };
  const breadcrumbs = breadcrumbsForPage(location.state, fallbackBreadcrumbs, currentBreadcrumb);
  const parentLabel = context.kind === "goal" ? "Grupa działań" : context.kind === "project" ? "Projekt" : undefined;
  const returnTo = incomingNavigation?.returnTo ?? readNavigationBreadcrumbs(location.state)?.at(-2)?.to ?? context.to;
  const returningToParent = returnTo.split(/[?#]/, 1)[0] === context.to;
  const parentInBreadcrumbs = breadcrumbs.slice(-4, -1).some((breadcrumb) => breadcrumb.to?.split(/[?#]/, 1)[0] === context.to);
  const blocked = action.status === "blocked";
  const openEditor = () => setEditOpen(true);

  return <AppShell appearance="focus-detail">
    <div className="action-detail-page">
      <div className="action-detail-toolbar">
        <ContextNavigation current={currentBreadcrumb} fallbackBreadcrumbs={fallbackBreadcrumbs} fallbackReturnTo={context.to} fallbackReturnLabel={parentLabel && context.name ? context.name : "Start"} showBack />
        <div className="action-heading-tools">
          <Button variant="ghost" onClick={openEditor}><Pencil aria-hidden="true" />Edytuj</Button>
          <details className="detail-tools-menu">
            <summary aria-label="Więcej opcji Działania"><MoreHorizontal aria-hidden="true" /></summary>
            <div>
              {state.actions.some((candidate) => candidate.id === action.id) ? <Button variant="ghost" disabled={mutation.isBusy(pinKey)} onClick={(event) => {
                const menu = event.currentTarget.closest("details");
                if (menu) {
                  menu.open = false;
                  menu.querySelector("summary")?.focus();
                }
                void changePin();
              }}>
                {action.pinnedToToday ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                {action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}
              </Button> : null}
              <AIContextExport target={{ type: "action", id: action.id }} />
            </div>
          </details>
        </div>
      </div>
      <header className="action-detail-header">
        <h1>{action.title}</h1>
        {parentLabel && context.name && !(returningToParent && parentInBreadcrumbs) ? <NavigationLink aria-label={`${parentLabel}: ${context.name}`} className="action-parent-link" data-hide-mobile={returningToParent || undefined} data-hide-desktop={parentInBreadcrumbs || undefined} to={context.to} breadcrumbs={breadcrumbs} returnTo={locationAddress(location)} returnLabel={currentBreadcrumb.label}>
          {context.kind === "goal" ? <Flag aria-hidden="true" /> : <FolderKanban aria-hidden="true" />}
          <span>{context.name}</span>
        </NavigationLink> : null}
        {context.kind === "missing-project" ? <p className="muted-copy action-missing-parent" role="status">Projekt tego Działania jest niedostępny.</p> : null}
        <ActionSignals action={action} timeZone={state.workspaceTimezone} today={today} routineTitle={resolveRoutineTitle(action, state.recurringActionTemplates)} density="detail" disabled={mutation.isBusy(statusKey)} onOpenStatus={() => setStatusView("statuses")} />
      </header>
      <div className="action-detail-layout">
        <div className="action-detail-main">
          {blocked ? <section className="action-blocker-card" aria-labelledby="action-blocker-title">
            <div className="action-blocker-card-heading">
              <LockKeyhole aria-hidden="true" />
              <h2 id="action-blocker-title">Powód blokady</h2>
              <Button variant="ghost" aria-label="Edytuj blokadę" onClick={() => setStatusView("blocker")}><Pencil aria-hidden="true" />Edytuj</Button>
            </div>
            <p>{action.blocker || "Nie podano powodu."}</p>
          </section> : null}
          {mutation.error(pinKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(pinKey)} <button type="button" onClick={() => void mutation.retry(pinKey)?.()}>Spróbuj ponownie</button></p> : null}
          <section className="action-description-block" aria-labelledby="action-description-title">
            <h2 id="action-description-title">Opis</h2>
            {action.detail ? <p>{action.detail}</p> : <Button variant="ghost" onClick={openEditor}>Dodaj opis</Button>}
          </section>
        </div>
        <aside className="action-detail-aside">
          <ActionKnowledgeRelations action={action} variant="detail" onAddResult={() => setResultOpen(true)} navigation={{ breadcrumbs, returnTo: locationAddress(location), returnLabel: currentBreadcrumb.label }} />
          <KnowledgeSuggestions projectId={action.areaId ?? state.goals.find((goal) => goal.id === action.goalId)?.areaId} target={{ actionId: action.id }} />
        </aside>
      </div>
    </div>
    <ActionStatusDialog action={action} open={Boolean(statusView)} initialView={statusView} busy={mutation.isBusy(statusKey)} error={mutation.error(statusKey)} onClose={() => setStatusView(undefined)} onChange={changeStatus} />
    <ActionEditDialog action={action} open={editOpen} busy={mutation.isBusy(editKey)} error={mutation.error(editKey)} onClose={() => setEditOpen(false)} onSave={saveEdit} />
    <ActionResultDialog action={action} open={resultOpen} onClose={() => setResultOpen(false)} />
  </AppShell>;
}
