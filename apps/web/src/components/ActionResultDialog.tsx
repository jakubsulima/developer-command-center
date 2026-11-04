import type { CreationReceipt } from "./creationDraft";
import { useMemo, useRef, useState } from "react";
import { CircleCheck, FilePlus2, Link2 } from "lucide-react";
import { useStore } from "../app/useStore";
import type { GoalAction } from "../domain/types";
import { knowledgeKindLabels } from "../domain/labels";
import { Button } from "./ui";
import { CreationBody, CreationDialog, CreationFooter } from "./CreationForm";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useCreationReceipt } from "./useCreationReceipt";
import { DraftStatus } from "./DraftStatus";
import { useActionFeedback } from "./action-feedback-context";

export function ActionResultDialog({ action, open, onClose }: { action?: GoalAction; open: boolean; onClose: () => void }) {
  const { state, recordActionResult } = useStore();
  const { notifySuccess } = useActionFeedback();
  const draft = usePersistentDraft("action-result", { tab: "new" as "new" | "existing", title: action ? `Rezultat: ${action.title}` : "", detail: "", existingId: "", receipt: undefined as CreationReceipt | undefined }, 250, { targetId: action?.id ?? "none", enabled: open && Boolean(action) });
  const completion = useCreationReceipt(draft.storageKey, { value: draft.value.receipt, save: (receipt) => { draft.setValue((current) => ({ ...current, receipt })); return draft.flush(); } });
  const { tab, title, detail, existingId } = draft.value;
  const setTab = (tab: "new" | "existing") => draft.setValue((value) => ({ ...value, tab }));
  const setTitle = (title: string) => draft.setValue((value) => ({ ...value, title }));
  const setDetail = (detail: string) => draft.setValue((value) => ({ ...value, detail }));
  const setExistingId = (existingId: string) => draft.setValue((value) => ({ ...value, existingId }));
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeArtifacts = useMemo(() => state.knowledge.filter((item) => item.type === "artifact" && !item.archivedAt && !item.trashedAt), [state.knowledge]);

  const save = async () => {
    if (!action || locked.current || completion.receipt) return;
    if (!draft.flush()) return;
    const payload = tab === "new" ? { kind: "new" as const, title, detail } : { kind: "existing" as const, knowledgeItemId: existingId };
    locked.current = true;
    setSaving(true); setError("");
    try {
      await recordActionResult(action.id, payload);
      completion.remember({ id: action.id, url: `/actions/${action.id}`, message: "Rezultat zapisano." });
      if (!completion.finish(draft.clear)) { setError("Rezultat zapisano. Usuń zapisany szkic."); return; }
      notifySuccess(`Dodano rezultat dla „${action.title}”.`);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać rezultatu.");
    } finally { locked.current = false; setSaving(false); }
  };

  const close = () => { if (!locked.current && draft.flush()) onClose(); };
  return <CreationDialog open={open && Boolean(action)} closeDisabled={saving} title="Dodaj rezultat" onClose={close}><div className="quick-add"><CreationBody><fieldset className="creation-fields" disabled={saving || Boolean(completion.receipt)}>
    <p>Działanie: {action?.title}</p>
    <p className="modal-intro">Rezultat zostanie zapisany jako kanoniczny element Wiedzy typu <strong>Rezultat</strong>. Ukończenie Działania pozostaje zapisane niezależnie od tego dialogu.</p>
    <div className="result-tabs" role="tablist" aria-label="Sposób dodania rezultatu">
      <button type="button" role="tab" aria-selected={tab === "new"} onClick={() => setTab("new")}><FilePlus2 />Nowy rezultat</button>
      <button type="button" role="tab" aria-selected={tab === "existing"} onClick={() => setTab("existing")}><Link2 />Istniejący</button>
    </div>
    {tab === "new" ? <><label className="field-label" htmlFor="action-result-title">Tytuł rezultatu</label><input id="action-result-title" value={title} onChange={(event) => setTitle(event.target.value)} /><label className="field-label" htmlFor="action-result-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="action-result-detail" rows={5} value={detail} onChange={(event) => setDetail(event.target.value)} /></> : <><label className="field-label" htmlFor="action-existing-result">Aktywny rezultat</label><select id="action-existing-result" value={existingId} onChange={(event) => setExistingId(event.target.value)}><option value="">Wybierz rezultat…</option>{activeArtifacts.map((item) => <option key={item.id} value={item.id}>{knowledgeKindLabels[item.type]} · {item.title}</option>)}</select>{!activeArtifacts.length ? <p className="muted-copy">Brak aktywnych elementów typu Rezultat.</p> : null}</>}
    </fieldset><DraftStatus status={draft.status} restored={draft.restored} errorMessage={draft.errorMessage} onRetry={draft.retry} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}</CreationBody>
    <CreationFooter><Button type="button" disabled={saving} onClick={close}>Anuluj</Button>{completion.receipt ? <Button type="button" onClick={() => { if (completion.finish(draft.clear)) onClose(); }}>Usuń zapisany szkic</Button> : <Button type="button" variant="primary" loading={saving} disabled={tab === "new" ? !title.trim() : !existingId} onClick={() => void save()}><CircleCheck />Zapisz rezultat</Button>}</CreationFooter></div>
  </CreationDialog>;
}
