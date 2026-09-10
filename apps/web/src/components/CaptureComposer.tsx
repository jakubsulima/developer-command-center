import { Link2, TextCursorInput } from "lucide-react";
import { useEffect, useState } from "react";
import type { InboxKind } from "../domain/types";
import { captureErrorMessage, normalizeCapture } from "../domain/capture";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { Button } from "./ui";
import { Textarea } from "./ui/textarea";
import { recordFirstFlowStage } from "../lib/firstFlow";

type CaptureDraft = { content: string; kind: "text" | "link" };
const isCaptureDraft = (value: unknown): value is CaptureDraft => Boolean(value && typeof value === "object" && typeof (value as CaptureDraft).content === "string" && ((value as CaptureDraft).kind === "text" || (value as CaptureDraft).kind === "link"));
const migrateCaptureDraft = (value: unknown): CaptureDraft | undefined => typeof value === "string" ? { content: value, kind: "text" } : undefined;

export function CaptureComposer({ draftKey, id, onSubmit, onClose, onSuccess, compact = false }: {
  draftKey: string;
  id: string;
  onSubmit: (content: string, kind: InboxKind) => Promise<void>;
  onClose?: () => void;
  onSuccess?: () => void;
  compact?: boolean;

}) {
  const draft = usePersistentDraft<CaptureDraft>(draftKey, { content: "", kind: "text" }, 450, {
    validate: isCaptureDraft,
    migrate: migrateCaptureDraft
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const preview = (() => { try { return normalizeCapture(draft.value.content, draft.value.kind).previewDomain; } catch { return undefined; } })();
  useEffect(() => { if (!compact) recordFirstFlowStage("capture-started"); }, [compact]);
  const submit = async () => {
    if (saving) return;
    setError(""); setSuccess(""); setSaving(true);
    try {
      const normalized = normalizeCapture(draft.value.content, draft.value.kind);
      await onSubmit(normalized.content, normalized.kind);
      draft.clear(); setSuccess("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
      if (!compact) recordFirstFlowStage("capture-saved");
      onSuccess?.();
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "capture_failed";
      setError(captureErrorMessage(code));
    } finally { setSaving(false); }
  };
  return <div className={`capture-composer ${compact ? "capture-composer-compact" : ""}`}>
    <label className="sr-only" htmlFor={id}>Zapisz treść lub link</label>
    <Textarea id={id} rows={compact ? 2 : 5} placeholder="Zapisz treść lub link…" value={draft.value.content} disabled={saving} onChange={(event) => draft.setValue((current) => ({ ...current, content: event.target.value }))} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void submit(); } }} aria-invalid={Boolean(error)} aria-describedby={`${id}-feedback`} />
    <div className="capture-mode-row"><div role="group" aria-label="Typ przechwycenia"><button type="button" disabled={saving} aria-pressed={draft.value.kind === "text"} className={draft.value.kind === "text" ? "active" : ""} onClick={() => draft.setValue((current) => ({ ...current, kind: "text" }))}><TextCursorInput />Tekst</button><button type="button" disabled={saving} aria-pressed={draft.value.kind === "link"} className={draft.value.kind === "link" ? "active" : ""} onClick={() => draft.setValue((current) => ({ ...current, kind: "link" }))}><Link2 />Link</button></div>{preview ? <span className="capture-preview">Rozpoznano pełny link: {preview}</span> : <small>Pełny adres HTTP/HTTPS zostanie zapisany jako link.</small>}</div>
    <div id={`${id}-feedback`} aria-live="polite">{draft.dirty ? <small>Draft {draft.status === "saving" ? "zapisuje się…" : draft.status === "error" ? "nie został zapisany" : "zapisany na tym urządzeniu"}</small> : null}{error ? <p className="auth-message error" role="alert">{error} <button type="button" className="back-link" onClick={() => void submit()}>Spróbuj ponownie</button></p> : null}{success ? <p className="auth-message success">{success}</p> : null}</div>
    <div className="capture-composer-actions">{onClose ? <Button type="button" disabled={saving} onClick={onClose}>Zamknij</Button> : null}<Button type="button" variant="ghost" disabled={!draft.dirty || saving} onClick={() => { draft.discard(); setError(""); }}>Odrzuć szkic</Button><Button type="button" variant="primary" loading={saving} disabled={!draft.value.content.trim()} onClick={() => void submit()}>Zapisz do Skrzynki</Button></div>
  </div>;
}
