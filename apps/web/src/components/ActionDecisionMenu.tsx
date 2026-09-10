import { Ban, CalendarDays, Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { GoalAction } from "../domain/types";
import { Button } from "./ui";
import { Modal } from "./Modal";

export function ActionDecisionMenu({ action, open, busy, today, tomorrow, error, onClose, onComplete, onReschedule, onCancel, onUnblock, onRetry }: {
  action?: GoalAction;
  open: boolean;
  busy: boolean;
  today: string;
  tomorrow: string;
  error?: string;
  onClose: () => void;
  onComplete: () => Promise<boolean> | boolean;
  onReschedule: (scheduledFor: string | null) => Promise<boolean> | boolean;
  onCancel: () => Promise<boolean> | boolean;
  onUnblock: () => Promise<boolean> | boolean;
  onRetry?: () => Promise<boolean> | boolean;
}) {
  const [customDate, setCustomDate] = useState("");

  useEffect(() => {
    if (open) setCustomDate(action?.scheduledFor ?? "");
  }, [action, open]);

  if (!action) return null;
  const decide = async (operation: () => Promise<boolean> | boolean) => {
    if (await operation()) onClose();
  };
  return <Modal open={open} closeDisabled={busy} title="Działanie — decyzje" onClose={onClose}>
    <p className="modal-intro"><strong>{action.title}</strong></p>
    {action.status === "blocked" ? <div className="form-warning"><strong>Powód blokady</strong><p>{action.blocker ?? "Nie podano powodu."}</p><Button loading={busy} onClick={() => void decide(onUnblock)}><RotateCcw />Odblokuj</Button></div> : null}
    {action.status !== "completed" ? <>
      <div className="guided-section">
        <span className="field-label">Decyzja o terminie</span>
        <div className="quick-choice-row">
          <Button disabled={busy} onClick={() => void decide(() => onReschedule(today))}><CalendarDays />Dzisiaj</Button>
          <Button disabled={busy} onClick={() => void decide(() => onReschedule(tomorrow))}><CalendarDays />Jutro</Button>
          <Button disabled={busy} onClick={() => void decide(() => onReschedule(null))}>Bez terminu</Button>
        </div>
        <label className="field-label" htmlFor={`action-decision-date-${action.id}`}>Wybierz datę</label>
        <div className="button-row"><input id={`action-decision-date-${action.id}`} type="date" value={customDate} disabled={busy} onChange={(event) => setCustomDate(event.target.value)} /><Button disabled={busy || !customDate} onClick={() => void decide(() => onReschedule(customDate))}>Przełóż</Button></div>
        {action.pinnedToToday ? <p className="muted-copy">Przełożenie zmieni tylko termin. Działanie pozostanie przypięte na dziś.</p> : null}
      </div>
      <div className="modal-actions">
        <Button variant="primary" loading={busy} onClick={() => void decide(onComplete)}><Check />Ukończ</Button>
        <Button variant="danger" loading={busy} onClick={() => void decide(onCancel)}><Ban />Anuluj Działanie</Button>
      </div>
    </> : null}
    {error ? <p className="inline-mutation-error" role="alert">{error} {onRetry ? <button type="button" onClick={() => void decide(onRetry)}>Spróbuj ponownie</button> : null}</p> : null}
  </Modal>;
}
