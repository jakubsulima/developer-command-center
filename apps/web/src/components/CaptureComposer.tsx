import { useEffect, useRef, useState, type RefObject } from "react";
import type { InboxItem, InboxKind } from "../domain/types";
import { normalizeCapture } from "../domain/capture";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { Button } from "./ui";
import { Textarea } from "./ui/textarea";

type CaptureDraft = { content: string; commandId: string; attempted: boolean };
const newDraft = (): CaptureDraft => ({ content: "", commandId: crypto.randomUUID(), attempted: false });
const isCaptureDraft = (value: unknown): value is CaptureDraft => {
  const item = value as Partial<CaptureDraft> | null;
  return Boolean(item && typeof item.content === "string" && typeof item.commandId === "string" && item.commandId && typeof item.attempted === "boolean");
};
function migrateCaptureDraft(value: unknown): CaptureDraft | undefined {
  if (typeof value === "string") return { ...newDraft(), content: value };
  if (value && typeof value === "object" && "content" in value && typeof value.content === "string") return { ...newDraft(), content: value.content };
}

export function CaptureComposer({ draftKey, id, onSubmit, onClose, onSuccess, closeGuard, compact = false }: {
  draftKey: string;
  id: string;
  onSubmit: (content: string, kind: InboxKind, commandId: string) => Promise<InboxItem | void>;
  onClose?: () => void;
  onSuccess?: (item: InboxItem | void) => void;
  compact?: boolean;
  closeGuard?: RefObject<(() => boolean) | null>;
}) {
  const [initial] = useState(newDraft);
  const draft = usePersistentDraft(draftKey, initial, 250, { validate: isCaptureDraft, migrate: migrateCaptureDraft });
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(false);
  const flushDraft = draft.flush;
  useEffect(() => {
    if (!closeGuard) return;
    closeGuard.current = () => {
      if (saving) return false;
      if (flushDraft()) return true;
      setError("Zachowaj lub skopiuj treść przed zamknięciem.");
      return false;
    };
    return () => { closeGuard.current = null; };
  }, [closeGuard, saving, flushDraft]);
  const submit = async () => {
    if (locked.current || !draft.value.content.trim() || cleanupFailed) return;
    const normalized = normalizeCapture(draft.value.content);
    draft.setValue((current) => ({ ...current, attempted: true }));
    if (!draft.flush()) { draft.setValue((current) => ({ ...current, attempted: false })); setError("Nie udało się zachować szkicu. Skopiuj treść lub ponów zapis."); return; }
    locked.current = true;
    setSaving(true); setError(""); setSaved(false);
    try {
      const receipt = await onSubmit(normalized.content, normalized.kind, draft.value.commandId);
      setSaved(true);
      if (!draft.clear(newDraft())) {
        setCleanupFailed(true);
        setError("Wpis zapisano, ale szkic pozostał na urządzeniu. Usuń zapisany szkic poniżej.");
      } else onSuccess?.(receipt);
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("capture_payload_conflict")) {
        draft.setValue((current) => ({ ...current, commandId: crypto.randomUUID(), attempted: false }));
        draft.flush();
        setError("Ten szkic zmienił się w innym oknie. Twoja treść pozostała w polu — zapisz ją ponownie jako osobny wpis.");
      } else setError("Nie potwierdzono zapisu. Treść pozostała na tym urządzeniu. Ponów tę samą próbę, aby uniknąć duplikatu.");
    } finally { locked.current = false; setSaving(false); }
  };
  return <div className={`capture-composer ${compact ? "capture-composer-compact" : ""}`}>
    <label className="field-label" htmlFor={id}>Co chcesz zapamiętać lub zrobić?</label>
    <Textarea id={id} autoFocus rows={compact ? 3 : 5} placeholder="Zapisz myśl, zadanie albo wklej link…" value={draft.value.content} readOnly={draft.value.attempted || saving} onChange={(event) => { setSaved(false); draft.setValue((current) => ({ ...current, content: event.target.value })); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} aria-invalid={Boolean(error)} aria-describedby={`${id}-feedback`} />
    <div id={`${id}-feedback`} aria-live="polite">
      {draft.restored && !saved ? <small>Przywrócono szkic z tego urządzenia.</small> : null}
      {draft.status === "error" ? <p role="alert">Nie udało się zachować szkicu na urządzeniu.</p> : null}
      {error ? <p className="auth-message error" role="alert">{error}</p> : null}
      {saved ? <p className="auth-message success">Zapisano.</p> : null}
    </div>
    <div className="capture-composer-actions">
      {onClose ? <Button type="button" disabled={saving} onClick={() => { if (draft.flush()) onClose(); else setError("Zachowaj lub skopiuj treść przed zamknięciem."); }}>Zamknij</Button> : null}
      {cleanupFailed ? <Button onClick={() => { if (draft.clear(newDraft())) { setCleanupFailed(false); setError(""); } }}>Usuń zapisany szkic</Button> : <Button type="button" variant="primary" loading={saving} disabled={!draft.value.content.trim()} onClick={() => void submit()}>{draft.value.attempted ? "Ponów zapis" : "Zapisz"}</Button>}
    </div>
    {draft.dirty ? <details className="capture-draft-options"><summary>Opcje szkicu</summary><Button variant="ghost" onClick={() => void (navigator.clipboard ? navigator.clipboard.writeText(draft.value.content) : Promise.reject(new Error("clipboard_unavailable"))).catch(() => setError("Nie udało się skopiować. Zaznacz tekst w polu."))}>Kopiuj treść</Button>{!draft.value.attempted ? <Button variant="ghost" onClick={() => { if (draft.clear(newDraft())) setError(""); }}>Odrzuć szkic</Button> : null}</details> : null}
  </div>;
}
