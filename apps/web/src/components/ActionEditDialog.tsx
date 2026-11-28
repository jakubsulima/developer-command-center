import { Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useStore } from "../app/useStore";
import { actionProjectId } from "../domain/actionGroups";
import type { GoalAction } from "../domain/types";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";
import "./action-form-dialog.css";

export type ActionEditValue = Pick<GoalAction, "title" | "detail" | "checklist"> & {
  scheduledFor: string;
  areaId: string;
  goalId: string;
};

function isActionEditValue(value: unknown): value is ActionEditValue {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ActionEditValue>;
  return typeof draft.title === "string" && typeof draft.detail === "string" && typeof draft.scheduledFor === "string"
    && Array.isArray(draft.checklist) && typeof draft.areaId === "string" && typeof draft.goalId === "string";
}

export function ActionEditDialog({ action, open, busy, error, onClose, onSave }: {
  action?: GoalAction;
  open: boolean;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSave: (value: ActionEditValue, expectedVersion?: number) => Promise<boolean> | boolean;
}) {
  const { state } = useStore();
  const projectId = action ? actionProjectId(state, action) ?? "" : "";
  const initialValue = useMemo<ActionEditValue>(() => ({
    areaId: projectId,
    goalId: action?.goalId ?? "",
    title: action?.title ?? "",
    detail: action?.detail ?? "",
    scheduledFor: action?.scheduledFor ?? "",
    checklist: action?.checklist ?? []
  }), [action, projectId]);
  const migrate = useCallback((value: unknown) => {
    if (!value || typeof value !== "object") return undefined;
    const migrated = { ...initialValue, ...value };
    return isActionEditValue(migrated) ? migrated : undefined;
  }, [initialValue]);
  const draft = usePersistentDraft<ActionEditValue>("goal-action-edit", initialValue, 450, {
    targetId: action?.id ?? "new",
    baseVersion: action?.version,
    enabled: Boolean(action),
    validate: isActionEditValue,
    migrate
  });
  const [touchedTitle, setTouchedTitle] = useState(false);
  if (!action || !open) return null;
  const titleInvalid = (touchedTitle || draft.dirty) && !draft.value.title.trim();
  const { areaId, goalId } = draft.value;
  const originalGroupId = action.goalId ?? "";
  const projects = state.areas.filter((project) => project.id === projectId || project.visibility === "active");
  const groups = state.goals.filter((group) => (
    group.id === originalGroupId && areaId === projectId
  ) || (
    group.visibility === "active" && group.status === "active" && (group.areaId ?? "") === areaId
  ));
  const projectMissing = Boolean(areaId && !projects.some((project) => project.id === areaId));
  const groupMissing = Boolean(goalId && !groups.some((group) => group.id === goalId));
  const invalidContext = (projectMissing && areaId !== projectId) || (groupMissing && (areaId !== projectId || goalId !== originalGroupId));
  const removesNext = action.isNext && goalId !== originalGroupId;
  const close = () => { if (!busy) onClose(); };
  const save = async () => {
    if (busy || invalidContext || !draft.value.title.trim()) return;
    const value = {
      ...draft.value,
      title: draft.value.title.trim(),
      detail: draft.value.detail.trim(),
      checklist: draft.value.checklist.map((entry) => ({ ...entry, title: entry.title.trim() })).filter((entry) => entry.title)
    };
    if (await onSave(value, typeof draft.baseVersion === "number" ? draft.baseVersion : action.version)) {
      draft.clear(value);
      onClose();
    }
  };
  return <Modal open closeDisabled={busy} className="action-form-dialog" title="Edytuj Działanie" onClose={close} initialFocus="input"><form className="action-edit-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
    <div className="action-form-body" data-modal-scroll-body>
    <label className="field-label" htmlFor={`edit-action-name-${action.id}`}>Nazwa</label><input id={`edit-action-name-${action.id}`} value={draft.value.title} disabled={busy} onChange={(event) => { setTouchedTitle(true); draft.setValue((current) => ({ ...current, title: event.target.value })); }} aria-invalid={titleInvalid || undefined} aria-describedby={titleInvalid ? "edit-action-title-error" : undefined} required />
    {titleInvalid && <p className="inline-mutation-error" id="edit-action-title-error" role="alert">Podaj nazwę Działania.</p>}
    <label className="field-label" htmlFor={`edit-action-detail-${action.id}`}>Opis</label><textarea id={`edit-action-detail-${action.id}`} value={draft.value.detail} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, detail: event.target.value }))} />
    <label className="field-label" htmlFor={`edit-action-date-${action.id}`}>Termin</label><input id={`edit-action-date-${action.id}`} type="date" value={draft.value.scheduledFor} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} />
    <span className="field-label">Checklista</span><div className="checklist-editor">{draft.value.checklist.map((entry) => <div key={entry.id}><input aria-label="Nazwa punktu checklisty" value={entry.title} disabled={busy} onChange={(event) => draft.setValue((current) => ({ ...current, checklist: current.checklist.map((candidate) => candidate.id === entry.id ? { ...candidate, title: event.target.value } : candidate) }))} /><Button type="button" variant="ghost" disabled={busy} aria-label={`Usuń punkt: ${entry.title || "bez nazwy"}`} onClick={() => draft.setValue((current) => ({ ...current, checklist: current.checklist.filter((candidate) => candidate.id !== entry.id) }))}>×</Button></div>)}</div>
    <Button type="button" variant="ghost" disabled={busy} onClick={() => draft.setValue((current) => ({ ...current, checklist: [...current.checklist, { id: crypto.randomUUID(), title: "", completed: false }] }))}><Plus />Dodaj punkt</Button>
    <label className="field-label" htmlFor="edit-action-project">Projekt</label>
    <select id="edit-action-project" disabled={busy} value={areaId} onChange={(event) => {
      const nextAreaId = event.target.value;
      draft.setValue((current) => ({ ...current, areaId: nextAreaId, goalId: "" }));
    }}>
      <option value="">Bez Projektu</option>
      {projectMissing ? <option value={areaId}>Projekt niedostępny</option> : null}
      {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
    </select>
    <label className="field-label" htmlFor="edit-action-group">Grupa działań</label>
    <select id="edit-action-group" disabled={busy} value={goalId} onChange={(event) => {
      const nextGoalId = event.target.value;
      draft.setValue((current) => ({ ...current, goalId: nextGoalId }));
    }}>
      <option value="">Bez grupy</option>
      {groupMissing ? <option value={goalId}>Grupa niedostępna</option> : null}
      {groups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}
    </select>
    <p className="action-edit-context-notice">Wybierz Projekt, aby zobaczyć jego grupy. Przypisanie do grupy zachowuje jej Projekt.</p>
    {invalidContext ? <p className="action-edit-context-notice" role="status">Wybierz dostępny Projekt i grupę lub usuń przypisanie.</p> : null}
    {removesNext ? <p className="action-edit-context-notice" role="status">Zmiana grupy usunie oznaczenie „Następne” z tego Działania.</p> : null}
    <DraftStatus status={draft.status} errorMessage={draft.errorMessage} onRetry={() => void draft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${draft.value.title}\n${draft.value.detail}`)} />
    {draft.dirty ? <Button type="button" variant="ghost" disabled={busy} onClick={draft.discard}>Odrzuć szkic</Button> : null}
    {error ? <p className="auth-message error" role="alert">{error}</p> : null}
    </div>
    <div className="modal-actions"><Button type="button" disabled={busy} onClick={close}>Anuluj</Button><Button type="submit" variant="primary" loading={busy} disabled={!draft.value.title.trim() || invalidContext}>Zapisz zmiany</Button></div>
  </form></Modal>;
}
