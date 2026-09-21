import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { GoalAction } from "../domain/types";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";

export type ActionEditValue = Pick<GoalAction, "title" | "detail" | "checklist"> & { scheduledFor: string };

export function ActionEditDialog({ action, open, busy, error, onClose, onSave }: {
  action?: GoalAction;
  open: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (value: ActionEditValue, expectedVersion?: number) => Promise<boolean> | boolean;
}) {
  const initialValue = useMemo<ActionEditValue>(() => action
    ? { title: action.title, detail: action.detail, scheduledFor: action.scheduledFor ?? "", checklist: structuredClone(action.checklist) }
    : { title: "", detail: "", scheduledFor: "", checklist: [] }, [action]);
  const validate = useCallback((value: unknown): value is ActionEditValue => Boolean(value && typeof value === "object" && typeof (value as ActionEditValue).title === "string" && typeof (value as ActionEditValue).detail === "string" && typeof (value as ActionEditValue).scheduledFor === "string" && Array.isArray((value as ActionEditValue).checklist)), []);
  const migrate = useCallback((value: unknown) => value && typeof value === "object" ? { ...initialValue, ...(value as Partial<ActionEditValue>) } : undefined, [initialValue]);
  const draft = usePersistentDraft<ActionEditValue>("goal-action-edit", initialValue, 450, {
    targetId: action?.id ?? "new",
    baseVersion: action?.version,
    enabled: Boolean(action),
    validate,
    migrate
  });
  if (!action || !open) return null;
  const close = () => { if (!busy) onClose(); };
  const save = async () => {
    const value = {
      ...draft.value,
      title: draft.value.title.trim(),
      detail: draft.value.detail.trim(),
      checklist: draft.value.checklist.map((entry) => ({ ...entry, title: entry.title.trim() })).filter((entry) => entry.title)
    };
    if (await onSave(value, typeof draft.baseVersion === "number" ? draft.baseVersion : action.version)) {
      draft.clear();
      onClose();
    }
  };
  return <Modal open closeDisabled={busy} title="Edytuj Działanie" onClose={close} initialFocus="input"><form onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <label className="field-label" htmlFor={`edit-action-name-${action.id}`}>Nazwa</label><input id={`edit-action-name-${action.id}`} value={draft.value.title} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, title: event.target.value }))} required />
    <label className="field-label" htmlFor={`edit-action-detail-${action.id}`}>Opis</label><textarea id={`edit-action-detail-${action.id}`} value={draft.value.detail} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, detail: event.target.value }))} />
    <label className="field-label" htmlFor={`edit-action-date-${action.id}`}>Termin</label><input id={`edit-action-date-${action.id}`} type="date" value={draft.value.scheduledFor} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} />
    <span className="field-label">Checklista</span><div className="checklist-editor">{draft.value.checklist.map((entry) => <div key={entry.id}><input aria-label="Nazwa punktu checklisty" value={entry.title} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, checklist: current.checklist.map((candidate) => candidate.id === entry.id ? { ...candidate, title: event.target.value } : candidate) }))} /><Button type="button" variant="ghost" disabled={busy} aria-label={`Usuń punkt: ${entry.title || "bez nazwy"}`} onClick={() => draft.setValue((current) => ({ ...current, checklist: current.checklist.filter((candidate) => candidate.id !== entry.id) }))}>×</Button></div>)}</div>
    <Button type="button" variant="ghost" disabled={busy} onClick={() => draft.setValue((current) => ({ ...current, checklist: [...current.checklist, { id: crypto.randomUUID(), title: "", completed: false }] }))}><Plus />Dodaj punkt</Button>
    {error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><DraftStatus status={draft.status} errorMessage={draft.errorMessage} onRetry={() => void draft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${draft.value.title}\n${draft.value.detail}`)} />{draft.dirty ? <Button type="button" variant="ghost" disabled={busy} onClick={draft.discard}>Odrzuć szkic</Button> : null}<Button type="button" disabled={busy} onClick={close}>Anuluj</Button><Button type="submit" variant="primary" loading={busy} disabled={!draft.value.title.trim()}>Zapisz zmiany</Button></div>
  </form></Modal>;
}
