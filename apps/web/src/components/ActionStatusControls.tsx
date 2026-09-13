import "./ActionStatusControls.css";
import { useState } from "react";
import { ChevronDown, Circle, CircleCheck, CircleX, LoaderCircle, OctagonAlert, SkipForward, type LucideIcon } from "lucide-react";
import { actionStatusLabels } from "../domain/labels";
import type { ActionStatus, GoalAction } from "../domain/types";
import { Modal } from "./Modal";
import { Button } from "./ui";

export type ProjectActionStatus = Exclude<ActionStatus, "skipped">;

const statusOptions: ProjectActionStatus[] = ["ready", "in_progress", "blocked", "completed", "cancelled"];
const statusIcons = {
  ready: Circle,
  in_progress: LoaderCircle,
  blocked: OctagonAlert,
  completed: CircleCheck,
  skipped: SkipForward,
  cancelled: CircleX
} satisfies Record<ActionStatus, LucideIcon>;
const statusHints: Record<ProjectActionStatus, string> = {
  ready: "Można rozpocząć",
  in_progress: "Praca trwa",
  blocked: "Wymaga usunięcia przeszkody",
  completed: "Działanie wykonane",
  cancelled: "Nie będzie realizowane"
};

export function ActionStatusTrigger({ action, disabled = false, className = "", onClick }: { action: GoalAction; disabled?: boolean; className?: string; onClick: () => void }) {
  const Icon = statusIcons[action.status];
  return <button type="button" className={`action-status-trigger ${action.status}${className ? ` ${className}` : ""}`} disabled={disabled} aria-label={`Zmień status: ${actionStatusLabels[action.status]} — ${action.title}`} onClick={onClick}><Icon aria-hidden="true" /><span>{actionStatusLabels[action.status]}</span><ChevronDown className="action-status-trigger-chevron" aria-hidden="true" /></button>;
}

export function ActionStatusIconTrigger({ action, disabled = false, onClick }: { action: GoalAction; disabled?: boolean; onClick: () => void }) {
  const Icon = statusIcons[action.status];
  return <button type="button" className={`action-status-icon-trigger ${action.status}`} disabled={disabled} aria-label={`Zmień status: ${actionStatusLabels[action.status]} — ${action.title}`} title={`Status: ${actionStatusLabels[action.status]}`} onClick={onClick}><Icon aria-hidden="true" /></button>;
}

export function ActionStatusDialog({ action, open, busy, error, compact = false, onClose, onChange }: {
  action?: GoalAction;
  open: boolean;
  busy: boolean;
  error?: string;
  compact?: boolean;
  onClose: () => void;
  onChange: (status: ProjectActionStatus, blocker?: string) => Promise<boolean> | boolean;
}) {
  if (!action || !open) return null;
  return <ActionStatusDialogContent action={action} busy={busy} error={error} compact={compact} onClose={onClose} onChange={onChange} />;
}

function ActionStatusDialogContent({ action, busy, error, compact, onClose, onChange }: {
  action: GoalAction;
  busy: boolean;
  error?: string;
  compact: boolean;
  onClose: () => void;
  onChange: (status: ProjectActionStatus, blocker?: string) => Promise<boolean> | boolean;
}) {
  const [editingBlocker, setEditingBlocker] = useState(false);
  const [blocker, setBlocker] = useState(action.blocker ?? "");
  const decide = async (status: ProjectActionStatus, nextBlocker?: string) => {
    if (await onChange(status, nextBlocker)) onClose();
  };

  return <Modal open closeDisabled={busy} className={`action-status-dialog${compact ? " compact" : ""}`} title="Zmień status Działania" onClose={onClose}>
    <p className="modal-intro"><strong>{action.title}</strong></p>
    <div className="action-status-options" role="group" aria-label="Nowy status Działania">{statusOptions.map((status) => {
      const Icon = statusIcons[status];
      const current = action.status === status;
      return <button type="button" className={`action-status-option ${status}`} aria-pressed={current} disabled={busy || (current && status !== "blocked")} key={status} onClick={() => status === "blocked" ? setEditingBlocker(true) : void decide(status)}><Icon aria-hidden="true" /><span><strong>{actionStatusLabels[status]}</strong><small>{statusHints[status]}</small></span>{current ? <em>Aktualny</em> : null}</button>;
    })}</div>
    {editingBlocker ? <div className="action-status-blocker"><label className="field-label" htmlFor={`action-status-blocker-${action.id}`}>Co blokuje to Działanie?</label><textarea id={`action-status-blocker-${action.id}`} rows={3} value={blocker} onChange={(event) => setBlocker(event.target.value)} placeholder="Np. czekam na decyzję lub dostęp" required /><div className="modal-actions"><Button disabled={busy} onClick={() => setEditingBlocker(false)}>Wróć</Button><Button variant="primary" loading={busy} disabled={!blocker.trim()} onClick={() => void decide("blocked", blocker.trim())}>Zapisz blokadę</Button></div></div> : null}
    {error ? <p className="inline-mutation-error" role="alert">{error}</p> : null}
  </Modal>;
}
