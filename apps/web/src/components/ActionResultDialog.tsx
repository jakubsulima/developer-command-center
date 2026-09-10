import { useEffect, useMemo, useState } from "react";
import { CircleCheck, FilePlus2, Link2 } from "lucide-react";
import { useStore } from "../app/useStore";
import type { GoalAction } from "../domain/types";
import { knowledgeKindLabels } from "../domain/labels";
import { Button } from "./ui";
import { Modal } from "./Modal";
import { useActionFeedback } from "./action-feedback-context";

export function ActionResultDialog({ action, open, onClose }: { action?: GoalAction; open: boolean; onClose: () => void }) {
  const { state, recordActionResult } = useStore();
  const { notifySuccess } = useActionFeedback();
  const [tab, setTab] = useState<"new" | "existing">("new");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [existingId, setExistingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeArtifacts = useMemo(() => state.knowledge.filter((item) => item.type === "artifact" && !item.archivedAt && !item.trashedAt), [state.knowledge]);

  useEffect(() => {
    if (!action || !open) return;
    setTab("new");
    setTitle(`Rezultat: ${action.title}`);
    setDetail("");
    setExistingId("");
    setError("");
  }, [action, open]);

  const save = async () => {
    if (!action) return;
    setSaving(true); setError("");
    try {
      await recordActionResult(action.id, tab === "new" ? { kind: "new", title, detail } : { kind: "existing", knowledgeItemId: existingId });
      notifySuccess(`Dodano rezultat dla „${action.title}”.`);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać rezultatu.");
    } finally { setSaving(false); }
  };

  return <Modal open={open && Boolean(action)} closeDisabled={saving} title="Dodaj rezultat" onClose={onClose}>
    <p className="modal-intro">Rezultat zostanie zapisany jako kanoniczny element Wiedzy typu <strong>Rezultat</strong>. Ukończenie Działania pozostaje zapisane niezależnie od tego dialogu.</p>
    <div className="result-tabs" role="tablist" aria-label="Sposób dodania rezultatu">
      <button type="button" role="tab" aria-selected={tab === "new"} onClick={() => setTab("new")}><FilePlus2 />Nowy rezultat</button>
      <button type="button" role="tab" aria-selected={tab === "existing"} onClick={() => setTab("existing")}><Link2 />Istniejący</button>
    </div>
    {tab === "new" ? <><label className="field-label" htmlFor="action-result-title">Tytuł rezultatu</label><input id="action-result-title" value={title} onChange={(event) => setTitle(event.target.value)} /><label className="field-label" htmlFor="action-result-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="action-result-detail" rows={5} value={detail} onChange={(event) => setDetail(event.target.value)} /></> : <><label className="field-label" htmlFor="action-existing-result">Aktywny rezultat</label><select id="action-existing-result" value={existingId} onChange={(event) => setExistingId(event.target.value)}><option value="">Wybierz rezultat…</option>{activeArtifacts.map((item) => <option key={item.id} value={item.id}>{knowledgeKindLabels[item.type]} · {item.title}</option>)}</select>{!activeArtifacts.length ? <p className="muted-copy">Brak aktywnych elementów typu Rezultat.</p> : null}</>}
    {error ? <p className="auth-message error" role="alert">{error}</p> : null}
    <div className="modal-actions"><Button type="button" disabled={saving} onClick={onClose}>Anuluj</Button><Button type="button" variant="primary" loading={saving} disabled={tab === "new" ? !title.trim() : !existingId} onClick={() => void save()}><CircleCheck />Zapisz rezultat</Button></div>
  </Modal>;
}
