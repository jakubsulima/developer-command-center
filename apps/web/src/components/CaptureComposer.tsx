import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { InboxItem, InboxKind } from "../domain/types";
import { normalizeCapture } from "../domain/capture";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { Button } from "./ui";
import { Textarea } from "./ui/textarea";
import { DraftRecovery } from "./DraftRecovery";
import { useCreationReceipt } from "./useCreationReceipt";
import { CreationBody, CreationFooter } from "./CreationForm";
import type { CreationReceipt } from "./creationDraft";

type CaptureDraft = { content: string; commandId: string; attempted: boolean; receipt?: CreationReceipt };
const newDraft = (): CaptureDraft => ({ content: "", commandId: crypto.randomUUID(), attempted: false });
const isCaptureDraft = (value: unknown): value is CaptureDraft => {
  const item = value as Partial<CaptureDraft> | null;
  return Boolean(item && typeof item.content === "string" && typeof item.commandId === "string" && item.commandId && typeof item.attempted === "boolean");
};
function migrateCaptureDraft(value: unknown): CaptureDraft | undefined {
  if (typeof value === "string") return { ...newDraft(), content: value };
  if (value && typeof value === "object" && "content" in value && typeof value.content === "string") return { ...newDraft(), content: value.content };
}

export function CaptureComposer({ draftKey, id, onSubmit, onClose, onSuccess, closeGuard, compact = false, onSavingChange, onConfirmedChange, initialContent, onContentChange, onCleanup, header }: {
  draftKey: string;
  id: string;
  onSubmit: (content: string, kind: InboxKind, commandId: string) => Promise<InboxItem | void>;
  onClose?: () => void;
  onSuccess?: (item: InboxItem | void) => void;
  compact?: boolean;
  closeGuard?: RefObject<(() => boolean) | null>;
  onSavingChange?: (saving: boolean) => void;
  onConfirmedChange?: (confirmed: boolean) => void;
  initialContent?: string;
  onContentChange?: (value: string) => void;
  onCleanup?: () => boolean;
  header?: ReactNode;
}) {
  const [initial] = useState(() => ({ ...newDraft(), content: initialContent ?? "" }));
  const draft = usePersistentDraft("creation:capture", initial, 250, { validate: isCaptureDraft, migrate: migrateCaptureDraft, migrateFrom: [...new Set([draftKey, "quick-capture", "knowledge-capture"])].map((kind) => ({ kind })) });
  const completion = useCreationReceipt(draft.storageKey, { value: draft.value.receipt, save: (receipt) => { draft.setValue((current) => ({ ...current, receipt })); return draft.flush(); } });
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [cleanupFailed, setCleanupFailed] = useState(Boolean(completion.receipt));
  const cleanupPending = cleanupFailed || Boolean(completion.receipt);
  useEffect(() => { onConfirmedChange?.(cleanupPending); }, [cleanupPending, onConfirmedChange]);
  const receiptRef = useRef<InboxItem | void>(undefined);
  const contentChangeRef = useRef(onContentChange);
  contentChangeRef.current = onContentChange;
  const [incomingHandled, setIncomingHandled] = useState(false);
  const incomingConflict = Boolean(initial.content.trim() && draft.restored && initial.content !== draft.value.content && !incomingHandled);
  const preserveIncoming = () => {
    if (draft.preserveAlternative(initial)) setIncomingHandled(true);
  };
  const preserveIncomingRef = useRef(preserveIncoming);
  preserveIncomingRef.current = preserveIncoming;
  useEffect(() => { if (incomingConflict) preserveIncomingRef.current(); }, [incomingConflict]);
  useEffect(() => { if (!incomingConflict) contentChangeRef.current?.(draft.value.content); }, [draft.value.content, incomingConflict]);
  const clearConfirmed = () => (onCleanup?.() ?? true) && draft.clear(newDraft());
  const flushDraft = draft.flush;
  useEffect(() => {
    if (!closeGuard) return;
    closeGuard.current = () => {
      if (locked.current) return false;
      if (flushDraft()) return true;
      setError("Zachowaj lub skopiuj treść przed zamknięciem.");
      return false;
    };
    return () => { closeGuard.current = null; };
  }, [closeGuard, saving, flushDraft]);
  const submit = async () => {
    if (locked.current || !draft.value.content.trim() || cleanupPending) return;
    const normalized = normalizeCapture(draft.value.content);
    draft.setValue((current) => ({ ...current, attempted: true }));
    if (!draft.flush()) { draft.setValue((current) => ({ ...current, attempted: false })); setError("Nie udało się zachować szkicu. Skopiuj treść lub ponów zapis."); return; }
    locked.current = true;
    setSaving(true); onSavingChange?.(true); setError(""); setSaved(false);
    try {
      const receipt = await onSubmit(normalized.content, normalized.kind, draft.value.commandId);
      receiptRef.current = receipt;
      completion.remember({ id: receipt?.id ?? draft.value.commandId, url: receipt ? `/knowledge?section=inbox&status=${receipt.status}&item=${receipt.id}` : "/knowledge?section=inbox", message: "Zapisano w Skrzynce." });
      setSaved(true);
      if (!completion.finish(clearConfirmed)) {
        setCleanupFailed(true);
        setError("Wpis zapisano, ale szkic pozostał na urządzeniu. Usuń zapisany szkic poniżej.");
      } else onSuccess?.(receipt);
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("capture_payload_conflict")) {
        draft.setValue((current) => ({ ...current, commandId: crypto.randomUUID(), attempted: false }));
        draft.flush();
        setError("Ten szkic zmienił się w innym oknie. Twoja treść pozostała w polu — zapisz ją ponownie jako osobny wpis.");
      } else setError("Nie potwierdzono zapisu. Treść pozostała na tym urządzeniu. Ponów tę samą próbę, aby uniknąć duplikatu.");
    } finally { locked.current = false; setSaving(false); onSavingChange?.(false); }
  };
  return <div className={`capture-composer ${compact ? "capture-composer-compact" : ""}`}>
    <CreationBody>
    {header}
    {incomingConflict ? <p role="alert">Masz dwie różne treści. Nowa treść pozostaje w poprzednim formularzu. <Button type="button" onClick={preserveIncoming}>Zachowaj obie wersje</Button></p> : null}
    <label className="field-label" htmlFor={id}>Co chcesz zapamiętać lub zrobić?</label>
    <Textarea id={id} rows={compact ? 3 : 5} placeholder="Zapisz myśl, zadanie albo wklej link…" value={draft.value.content} readOnly={draft.value.attempted || saving || cleanupPending} onChange={(event) => { setSaved(false); draft.setValue((current) => ({ ...current, content: event.target.value })); }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(); } }} aria-invalid={Boolean(error)} aria-describedby={`${id}-feedback`} />
    <div id={`${id}-feedback`} aria-live="polite">
      {draft.restored && !saved ? <small>Przywrócono szkic z tego urządzenia.</small> : null}
      {draft.status === "error" ? <p role="alert">Nie udało się zachować szkicu na urządzeniu.</p> : null}
      {error ? <p className="auth-message error" role="alert">{error}</p> : null}
      {saved ? <p className="auth-message success">Zapisano.</p> : null}
      {completion.receipt ? <p>Zapis jest potwierdzony. <a href={completion.receipt.url}>Otwórz zapis</a></p> : null}
    </div>
    <DraftRecovery alternatives={draft.alternatives} recover={draft.recover} disabled={saving || cleanupPending} />
    {draft.dirty ? <details className="capture-draft-options"><summary>Opcje szkicu</summary><Button disabled={saving} variant="ghost" onClick={() => void (navigator.clipboard ? navigator.clipboard.writeText(draft.value.content) : Promise.reject(new Error("clipboard_unavailable"))).catch(() => setError("Nie udało się skopiować. Zaznacz tekst w polu."))}>Kopiuj treść</Button>{!draft.value.attempted ? <Button disabled={saving || cleanupPending} variant="ghost" onClick={() => { if (draft.clear(newDraft())) setError(""); }}>Odrzuć szkic</Button> : null}</details> : null}
    </CreationBody><CreationFooter><div className="capture-composer-actions">
      {onClose ? <Button type="button" disabled={saving} onClick={() => { if (draft.flush()) onClose(); else setError("Zachowaj lub skopiuj treść przed zamknięciem."); }}>Zamknij</Button> : null}
      {cleanupPending ? <Button onClick={() => { if (completion.finish(clearConfirmed)) { setCleanupFailed(false); setError(""); onSuccess?.(receiptRef.current); } }}>Usuń zapisany szkic</Button> : <Button type="button" variant="primary" loading={saving} disabled={!draft.value.content.trim()} onClick={() => void submit()}>{draft.value.attempted ? "Ponów zapis" : "Zapisz"}</Button>}
    </div></CreationFooter>

  </div>;
}
