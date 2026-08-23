import { ArrowLeft, CalendarDays, Check, Pin, PinOff } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { actionStatusLabels } from "../domain/labels";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { resolveActionContext } from "../domain/actionContext";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { ActionKnowledgeRelations } from "../components/ActionKnowledgeRelations";

export function ActionDetailPage() {
  const { actionId } = useParams();
  const { state, updateAction, setActionStatus } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [resultOpen, setResultOpen] = useState(false);
  const action = state.actions.find((candidate) => candidate.id === actionId);
  if (!action) return <AppShell><EmptyState icon={<CalendarDays />} title="Działanie jest niedostępne" detail="Mogło zostać usunięte, przeniesione do Celu albo należy do innego Workspace'u." action={<Link className="button button-primary" to="/">Wróć do Startu</Link>} /></AppShell>;
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
  return <AppShell><div className="action-detail-page">
    <Link className="back-link" to={context.to}><ArrowLeft />{context.kind === "project" ? `Projekt: ${context.name}` : context.kind === "goal" ? `Cel: ${context.name}` : "Start"}</Link>
    <PageHeading title={action.title} eyebrow={context.name ? `${context.label} · ${context.name}` : context.label} />
    <Panel className="detail-section" aria-busy={mutation.isBusy(key)}>
      <div className="section-heading">
        <h2>Szczegóły</h2>
        <Badge tone={action.status === "completed" ? "success" : action.status === "blocked" ? "danger" : "info"}>{actionStatusLabels[action.status]}</Badge>
      </div>
      {context.kind === "missing-project" ? <p className="muted-copy" role="status">Projekt tego Działania jest niedostępny. Działanie nie jest samodzielne.</p> : null}
      <div className="action-detail-content">
        <div>
          <span className="action-detail-label">Opis</span>
          <p className={action.detail ? "" : "action-detail-empty"}>{action.detail || "Bez dodatkowego opisu."}</p>
        </div>
        {scheduledFor ? <div className="action-detail-date"><CalendarDays /><span><small>Termin</small><strong>{scheduledFor}</strong></span></div> : null}
      </div>
      {mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
      <div className="action-detail-actions">
        <Button loading={mutation.isBusy(key)} onClick={() => void changePin()}>{action.pinnedToToday ? <PinOff /> : <Pin />}{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button>
        {action.status !== "completed" ? <Button variant="primary" loading={mutation.isBusy(key)} onClick={() => void complete()}><Check />Ukończ</Button> : null}
      </div>
    </Panel><ActionKnowledgeRelations action={action} />
  </div><ActionResultDialog action={action} open={resultOpen} onClose={() => setResultOpen(false)} /></AppShell>;
}
