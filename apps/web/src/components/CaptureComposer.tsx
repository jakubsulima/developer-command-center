import { Link2, TextCursorInput } from "lucide-react";
import { useState } from "react";
import type { InboxKind } from "../domain/types";
import { normalizeCapture } from "../domain/capture";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { Button } from "./ui";
import { Textarea } from "./ui/textarea";

export function CaptureComposer({ draftKey, id, onSubmit, onClose, compact = false, autoFocus = false }: {
  draftKey: string;
  id: string;
  onSubmit: (content: string, kind: InboxKind) => Promise<void>;
  onClose?: () => void;
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const draft = usePersistentDraft(draftKey, "");
  const [kind, setKind] = useState<"text" | "link">("text");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const preview = (() => { try { return normalizeCapture(draft.value, kind).previewDomain; } catch { return undefined; } })();
  const submit = async () => {
    if (saving) return;
    setError(""); setSuccess(""); setSaving(true);
    try {
      const normalized = normalizeCapture(draft.value, kind);
      await onSubmit(normalized.content, normalized.kind);
      draft.clear(); setSuccess("Dodano do Wiedzy. Materiał czeka na przetworzenie.");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "capture_failed";
      setError(code === "invalid_capture_url" || code === "invalid_capture_protocol" ? "Podaj pełny adres HTTP lub HTTPS, np. https://example.com." : code === "capture_content_required" ? "Wpisz treść przechwycenia." : "Nie udało się zapisać. Spróbuj ponownie.");
    } finally { setSaving(false); }
  };
  return <div className={`capture-composer ${compact ? "capture-composer-compact" : ""}`}>
    <label className="sr-only" htmlFor={id}>Zapisz myśl, zadanie lub link</label>
    <Textarea id={id} rows={compact ? 2 : 5} placeholder="Zapisz myśl, zadanie lub link…" value={draft.value} onChange={(event) => draft.setValue(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void submit(); } }} autoFocus={autoFocus} aria-invalid={Boolean(error)} aria-describedby={`${id}-feedback`} />
    <div className="capture-mode-row"><div role="group" aria-label="Typ przechwycenia"><button type="button" aria-pressed={kind === "text"} className={kind === "text" ? "active" : ""} onClick={() => setKind("text")}><TextCursorInput />Tekst</button><button type="button" aria-pressed={kind === "link"} className={kind === "link" ? "active" : ""} onClick={() => setKind("link")}><Link2 />Link</button></div>{preview ? <span className="capture-preview">Bezpieczny link: {preview}</span> : null}</div>
    <div id={`${id}-feedback`} aria-live="polite">{draft.dirty ? <small>Draft {draft.status === "saving" ? "zapisuje się…" : draft.status === "error" ? "nie został zapisany" : "zapisany na tym urządzeniu"}</small> : null}{error ? <p className="auth-message error" role="alert">{error} <button type="button" className="back-link" onClick={() => void submit()}>Spróbuj ponownie</button></p> : null}{success ? <p className="auth-message success">{success}</p> : null}</div>
    <div className="capture-composer-actions">{onClose ? <Button type="button" onClick={onClose}>Zamknij</Button> : null}<Button type="button" variant="ghost" disabled={!draft.dirty || saving} onClick={() => { draft.discard(); setError(""); }}>Odrzuć draft</Button><Button type="button" variant="primary" loading={saving} disabled={!draft.value.trim()} onClick={() => void submit()}>Dodaj do Wiedzy</Button></div>
  </div>;
}
