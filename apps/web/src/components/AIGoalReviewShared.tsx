import { Bot, Plus, Sparkles } from "lucide-react";
import { useId, type FormEvent } from "react";
import type { AIGoalReviewRecommendation } from "../domain/aiGoalReview";
import { Modal } from "./Modal";
import { Button } from "./ui";

export function AIGoalReviewConsentModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return <Modal open={open} title="Zanim uruchomisz Przegląd AI" onClose={onClose}><div className="ai-consent"><p>Do skonfigurowanego dostawcy AI zostaną wysłane aktywne Cele, ich kryteria, powiązane Działania, blokady i ostatnie aktualizacje postępu z 28 dni.</p><p className="muted-copy">Nie wysyłamy profilu, e-maila, całej Skrzynki, pełnej Wiedzy ani historycznych sesji Focus. AI nie może zapisywać zmian.</p><div className="modal-actions"><Button onClick={onClose}>Anuluj</Button><Button variant="primary" onClick={onConfirm}><Sparkles />Rozumiem, uruchom analizę</Button></div></div></Modal>;
}

export type AIGoalReviewDraft = NonNullable<AIGoalReviewRecommendation["draftAction"]>;

export function AIGoalReviewDraftModal({ draft, saving, error, onChange, onClose, onSubmit }: {
  draft?: AIGoalReviewDraft;
  saving: boolean;
  error: string;
  onChange: (draft: AIGoalReviewDraft) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  const titleId = useId();
  const detailId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };
  return <Modal open={Boolean(draft)} title="Sprawdź propozycję Działania" closeDisabled={saving} onClose={onClose}>{draft ? <form onSubmit={submit}><p className="ai-draft-label"><Bot />Przygotowane przez AI — zapis nastąpi dopiero po Twoim zatwierdzeniu.</p><label className="field-label" htmlFor={titleId}>Nazwa</label><input id={titleId} value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} required /><label className="field-label" htmlFor={detailId}>Opis</label><textarea id={detailId} rows={4} value={draft.detail} onChange={(event) => onChange({ ...draft, detail: event.target.value })} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" disabled={saving} onClick={onClose}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!draft.title.trim()}><Plus />Zatwierdź i dodaj</Button></div></form> : null}</Modal>;
}
