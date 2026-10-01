import { Bot, Plus, Sparkles } from "lucide-react";
import { useId, type FormEvent } from "react";
import type { AIGoalReviewRecommendation } from "../domain/aiGoalReview";
import { Modal } from "./Modal";
import { Button } from "./ui";

export function AIGoalReviewConsentModal({ open, onClose, onConfirm, windowDays = 28 }: { open: boolean; onClose: () => void; onConfirm: () => void; windowDays?: number }) {
  return <Modal open={open} title="Zanim uruchomisz Przegląd AI" onClose={onClose}><div className="ai-consent"><p>Do skonfigurowanego dostawcy AI zostaną wysłane aktywne Cele, ich kryteria, powiązane Działania, blokady i aktualizacje postępu z ostatnich {windowDays} dni.</p><p className="muted-copy">Nie wysyłamy profilu, e-maila, całej Skrzynki, pełnej Wiedzy ani historycznych sesji Focus. AI nie może zapisywać zmian.</p><div className="modal-actions"><Button onClick={onClose}>Anuluj</Button><Button variant="primary" onClick={onConfirm}><Sparkles />Rozumiem, uruchom analizę</Button></div></div></Modal>;
}

export type AIGoalReviewDraft = NonNullable<AIGoalReviewRecommendation["draftAction"]> & {
  scheduledFor?: string;
  idempotencyKey?: string;
  sourceRecommendationId?: string;
  actionId?: string;
  actionVersion?: number;
};

const planDayFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function AIGoalReviewDraftModal({ draft, saving, error, onChange, onClose, onSubmit, planDates }: {
  draft?: AIGoalReviewDraft;
  saving: boolean;
  error: string;
  onChange: (draft: AIGoalReviewDraft) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  planDates?: string[];
}) {
  const titleId = useId();
  const detailId = useId();
  const retryLocked = Boolean(error && draft?.idempotencyKey);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };
  return <Modal open={Boolean(draft)} title={planDates ? "Zatwierdź krok AI w Planie" : "Sprawdź propozycję Działania"} closeDisabled={saving} onClose={onClose}>{draft ? <form onSubmit={submit}><p className="ai-draft-label"><Bot />Przygotowane przez AI — zapis nastąpi dopiero po Twoim zatwierdzeniu.</p><label className="field-label" htmlFor={titleId}>Nazwa</label><input id={titleId} value={draft.title} readOnly={Boolean(draft.actionId || retryLocked)} onChange={(event) => onChange({ ...draft, title: event.target.value })} required /><label className="field-label" htmlFor={detailId}>Opis</label><textarea id={detailId} rows={4} value={draft.detail} readOnly={Boolean(draft.actionId || retryLocked)} onChange={(event) => onChange({ ...draft, detail: event.target.value })} />{planDates ? <label className="field-label" htmlFor={`${detailId}-day`}>Dzień w Planie <select id={`${detailId}-day`} aria-label="Dzień w Planie" value={draft.scheduledFor ?? ""} disabled={saving || retryLocked} onChange={(event) => onChange({ ...draft, scheduledFor: event.target.value || undefined })}><option value="">Bez dnia</option>{planDates.map((date) => <option key={date} value={date}>{planDayFormatter.format(new Date(`${date}T12:00:00Z`))}</option>)}</select></label> : null}{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" disabled={saving} onClick={onClose}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!draft.title.trim()}><Plus />{planDates ? draft.actionId ? "Zapisz w Planie" : "Zatwierdź i dodaj do Planu" : "Zatwierdź i dodaj"}</Button></div></form> : null}</Modal>;
}
