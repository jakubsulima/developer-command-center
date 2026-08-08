import { ArrowLeft, CalendarDays, Check, Pin, PinOff } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { actionStatusLabels } from "../domain/labels";
import { useKeyedMutation } from "../hooks/useKeyedMutation";

export function ActionDetailPage() {
  const { actionId } = useParams();
  const { state, updateAction, setActionStatus } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const action = state.actions.find((candidate) => candidate.id === actionId && !candidate.goalId);
  if (!action) return <AppShell><EmptyState icon={<CalendarDays />} title="Działanie jest niedostępne" detail="Mogło zostać usunięte, przeniesione do Celu albo należy do innego Workspace'u." action={<Link className="button button-primary" to="/">Wróć do Dzisiaj</Link>} /></AppShell>;
  const changePin = async () => {
    const previous = action.pinnedToToday;
    await mutation.run(`action-detail:${action.id}`, async () => {
      await updateAction(action.id, { pinnedToToday: !previous });
      notifyUndo({ message: previous ? "Działanie odpięte od Dzisiaj." : "Działanie przypięte do Dzisiaj.", undo: () => updateAction(action.id, { pinnedToToday: previous }) });
    });
  };
  const complete = async () => {
    const previous = { status: action.status, blocker: action.blocker };
    await mutation.run(`action-detail:${action.id}`, async () => {
      await setActionStatus(action.id, "completed");
      notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(action.id, previous.status, previous.blocker) });
    });
  };
  const key = `action-detail:${action.id}`;
  return <AppShell><Link className="back-link" to="/"><ArrowLeft />Dzisiaj</Link><PageHeading title={action.title} eyebrow="Samodzielne Działanie" /><Panel className="detail-section" aria-busy={mutation.isBusy(key)}><div className="section-heading"><h2>Szczegóły</h2><Badge tone={action.status === "completed" ? "success" : action.status === "blocked" ? "danger" : "info"}>{actionStatusLabels[action.status]}</Badge></div><p>{action.detail || "Bez dodatkowego opisu."}</p>{action.scheduledFor ? <p><strong>Termin:</strong> {new Date(`${action.scheduledFor}T12:00:00Z`).toLocaleDateString("pl-PL")}</p> : null}<div className="modal-actions"><Button loading={mutation.isBusy(key)} onClick={() => void changePin()}>{action.pinnedToToday ? <PinOff /> : <Pin />}{action.pinnedToToday ? "Odepnij od Dzisiaj" : "Przypnij do Dzisiaj"}</Button>{action.status !== "completed" ? <Button variant="primary" loading={mutation.isBusy(key)} onClick={() => void complete()}><Check />Ukończ</Button> : null}</div>{mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</Panel></AppShell>;
}
