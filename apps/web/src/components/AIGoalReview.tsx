import { Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, Clock3, ListTodo, Plus, RefreshCw, Sparkles, Target, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import type { AIGoalReviewRecommendation } from "../domain/aiGoalReview";
import { humanizeEntityReferences } from "../domain/humanizeAIText";
import { Modal } from "./Modal";
import { Badge, Button, Panel } from "./ui";
import { useActionFeedback } from "./action-feedback-context";

const generatedFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const horizonLabel = { now: "teraz", this_week: "w tym tygodniu", later: "później" } as const;
const statusLabel = { on_track: "na dobrej drodze", attention: "wymaga uwagi", stuck: "zablokowany", insufficient_data: "brak danych" } as const;

function signalLabel(key: string) {
  if (key.includes(":missing-next-action")) return "brak następnego Działania";
  if (key.includes(":missing-criteria")) return "brak kryteriów sukcesu";
  if (key.includes(":blocked:")) return `${key.split(":").at(-1)} blokady`;
  if (key.includes(":overdue-actions:")) return `${key.split(":").at(-1)} zaległe Działania`;
  if (key.endsWith(":overdue-goal")) return "przekroczony termin Celu";
  if (key.endsWith(":due-soon")) return "bliski termin";
  if (key.includes(":inactive:")) return `brak aktywności od ${key.split(":").at(-1)} dni`;
  if (key.includes(":too-many-open-actions:")) return `${key.split(":").at(-1)} otwartych Działań`;
  return "sygnał z danych Workspace";
}

function errorCopy(code?: string) {
  if (code === "AI_NOT_CONFIGURED") return "Przegląd AI nie jest jeszcze skonfigurowany. Podsumowanie systemowe pozostaje dostępne.";
  if (code === "AI_RATE_LIMITED") return "Limit analiz został osiągnięty. Spróbuj ponownie później.";
  if (code === "NO_ACTIVE_GOALS") return "Dodaj aktywny Cel, aby uruchomić analizę.";
  if (code === "CONTEXT_TOO_LARGE") return "Zakres jest zbyt duży do pojedynczej analizy. Żaden Cel nie został pominięty po cichu.";
  return "Nie udało się odświeżyć analizy. Poprzedni wynik i podsumowanie systemowe nadal są dostępne.";
}

export function AIGoalReview() {
  const { state, mode, aiGoalReview, aiGoalReviewStatus, aiGoalReviewError, requestGoalReview, submitGoalReviewFeedback, createAction } = useStore();
  const { notifySuccess } = useActionFeedback();
  const [consentOpen, setConsentOpen] = useState(false);
  const [draft, setDraft] = useState<AIGoalReviewRecommendation["draftAction"]>();
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [ratings, setRatings] = useState<Record<string, "helpful" | "not_helpful">>({});
  const [feedbackError, setFeedbackError] = useState("");
  const goalsById = useMemo(() => new Map(state.goals.map((goal) => [goal.id, goal])), [state.goals]);
  const actionsById = useMemo(() => new Map(state.actions.map((action) => [action.id, action])), [state.actions]);
  const entityLabels = useMemo<Array<[string, string]>>(() => [
    ...state.goals.map((goal): [string, string] => [goal.id, goal.title]),
    ...state.actions.map((action): [string, string] => [action.id, action.title]),
  ].sort(([left], [right]) => right.length - left.length), [state.actions, state.goals]);
  const humanize = (text: string) => humanizeEntityReferences(text, entityLabels);
  const busy = aiGoalReviewStatus === "loading" || aiGoalReviewStatus === "refreshing";

  const begin = () => {
    if (aiGoalReview) void requestGoalReview(true);
    else setConsentOpen(true);
  };
  const confirmConsent = () => {
    setConsentOpen(false);
    void requestGoalReview(false);
  };
  const rate = async (recommendationId: string, rating: "helpful" | "not_helpful") => {
    setFeedbackError("");
    setRatings((current) => ({ ...current, [recommendationId]: rating }));
    try { await submitGoalReviewFeedback(recommendationId, rating); }
    catch { setFeedbackError("Nie udało się zapisać oceny."); }
  };
  const saveDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft || draftSaving) return;
    setDraftSaving(true); setDraftError("");
    try {
      await createAction({ goalId: draft.goalId, title: draft.title, detail: draft.detail, pinnedToToday: true });
      notifySuccess("Działanie dodane po Twoim zatwierdzeniu.");
      setDraft(undefined);
    } catch (error) { setDraftError(error instanceof Error ? error.message : "Nie udało się zapisać Działania."); }
    finally { setDraftSaving(false); }
  };

  return <>
    <Panel className="ai-goal-review" aria-labelledby="ai-goal-review-title">
      <div className="section-heading ai-review-heading">
        <div><span className="section-kicker"><Bot />Przegląd AI {mode === "demo" ? <Badge tone="neutral">Symulacja</Badge> : null}</span><h2 id="ai-goal-review-title">Przegląd Celów z AI</h2></div>
        <Button variant={aiGoalReview ? "secondary" : "primary"} loading={busy} disabled={busy || !state.goals.some((goal) => goal.status === "active" && goal.visibility === "active")} onClick={begin}>{aiGoalReview ? <RefreshCw /> : <Sparkles />}{aiGoalReview ? "Odśwież analizę" : "Przeanalizuj moje Cele"}</Button>
      </div>
      {!aiGoalReview && !busy ? <div className="ai-review-empty"><p>Uruchamiasz analizę ręcznie. AI nie zmienia żadnych danych i nie wykonuje Działań.</p><small>Podsumowanie systemowe powyżej działa niezależnie od tej funkcji.</small></div> : null}
      {busy ? <div className="ai-review-loading" role="status"><span className="ai-review-pulse"><Bot /></span><div><strong>{aiGoalReviewStatus === "refreshing" ? "Odświeżam analizę…" : "Analizuję aktywne Cele…"}</strong><small>Możesz nadal korzystać z pozostałej części aplikacji.</small></div></div> : null}
      {aiGoalReviewError ? <div className="ai-review-error" role="alert"><AlertTriangle /><div><strong>{errorCopy(aiGoalReviewError.code)}</strong><small>{aiGoalReviewError.message}</small></div>{aiGoalReviewError.code !== "AI_NOT_CONFIGURED" && aiGoalReviewError.code !== "NO_ACTIVE_GOALS" ? <Button variant="ghost" disabled={busy} onClick={() => void requestGoalReview(false)}>Spróbuj ponownie</Button> : null}</div> : null}
      {aiGoalReview ? <div className={aiGoalReview.stale ? "ai-review-result is-stale" : "ai-review-result"}>
        {aiGoalReview.stale ? <div className="ai-review-stale"><Clock3 />Dane Celów zmieniły się od tej analizy. Wynik pozostaje widoczny do ręcznego odświeżenia.</div> : null}
        <section className="ai-review-direction"><div className="ai-review-direction-status"><Badge tone={aiGoalReview.review.overallStatus === "on_track" ? "success" : aiGoalReview.review.overallStatus === "stuck" ? "danger" : "warning"}>{statusLabel[aiGoalReview.review.overallStatus]}</Badge><span>{aiGoalReview.analyzedGoalIds.length} przeanalizowanych Celów</span></div><h3>{humanize(aiGoalReview.review.headline)}</h3><p>{humanize(aiGoalReview.review.summary)}</p></section>
        <section className="ai-review-recommendations-section"><div className="ai-review-section-title"><div><span>Plan działania</span><h3>Najważniejsze zalecenia</h3></div><small>{aiGoalReview.review.recommendations.length} {aiGoalReview.review.recommendations.length === 1 ? "zalecenie" : "zalecenia"}</small></div><div className="ai-recommendations">{aiGoalReview.review.recommendations.map((recommendation, index) => <article key={recommendation.id}>
          <div className="ai-recommendation-topline"><span className="ai-recommendation-number">{index + 1}</span><Badge tone={recommendation.horizon === "now" ? "danger" : "neutral"}>{horizonLabel[recommendation.horizon]}</Badge></div>
          <div className="ai-recommendation-copy">
          <div className="ai-recommendation-targets" aria-label="Dotyczy"><span className="ai-targets-label"><Target />Dotyczy</span><div>{recommendation.goalIds.map((id) => {
            const goal = goalsById.get(id);
            return goal ? <Link className="ai-entity-link is-goal" key={id} to={`/goals/${id}`}><Target /><span><small>Cel</small><strong>{goal.title}</strong></span><ArrowRight /></Link> : <span className="ai-entity-link is-missing" key={id}><Target /><span><small>Cel</small><strong>Niedostępny Cel</strong></span></span>;
          })}{recommendation.actionIds.map((id) => {
            const action = actionsById.get(id);
            return action ? <Link className="ai-entity-link is-action" key={id} to={`/actions/${id}`}><ListTodo /><span><small>Działanie</small><strong>{action.title}</strong></span><ArrowRight /></Link> : null;
          })}</div></div>
          <h4>{humanize(recommendation.title)}</h4>
          <div className="ai-recommendation-reason"><span>Dlaczego</span><p>{humanize(recommendation.reason)}</p></div>
          <div className="ai-next-step"><span><ArrowRight />Następny krok</span><strong>{humanize(recommendation.suggestedNextStep)}</strong></div>
          {recommendation.signalKeys.length ? <div className="ai-evidence" aria-label="Sygnały z danych"><span className="ai-evidence-label"><Activity />Sygnały</span>{recommendation.signalKeys.map((key) => <span key={key}>{signalLabel(key)}</span>)}</div> : null}
          <div className="ai-recommendation-actions">{recommendation.goalIds.map((id) => goalsById.has(id) ? <Link key={id} to={`/goals/${id}`}>Przejdź do Celu <ArrowRight /></Link> : null)}{recommendation.draftAction ? <Button variant="ghost" onClick={() => setDraft({ ...recommendation.draftAction! })}><Plus />Dodaj Działanie</Button> : null}</div>
          <div className="ai-feedback" role="group" aria-label={`Oceń zalecenie: ${humanize(recommendation.title)}`}><span>Czy to pomocne?</span><button type="button" aria-pressed={ratings[recommendation.id] === "helpful"} aria-label="Przydatne" onClick={() => void rate(recommendation.id, "helpful")}><ThumbsUp /></button><button type="button" aria-pressed={ratings[recommendation.id] === "not_helpful"} aria-label="Nieprzydatne" onClick={() => void rate(recommendation.id, "not_helpful")}><ThumbsDown /></button></div>
          </div></article>)}</div>{feedbackError ? <p className="inline-mutation-error" role="alert">{feedbackError}</p> : null}</section>
        {aiGoalReview.review.checks.length ? <section className="ai-review-checks"><h3>Co sprawdzić</h3>{aiGoalReview.review.checks.map((check) => <div key={check.id}><strong>{humanize(check.question)}</strong><p>{humanize(check.whyItMatters)}</p>{check.goalIds.map((id) => goalsById.has(id) ? <Link key={id} to={`/goals/${id}`}>Cel: {goalsById.get(id)!.title}</Link> : null)}</div>)}</section> : null}
        <section className="ai-review-assessments"><h3>Cele wymagające uwagi</h3>{aiGoalReview.review.goalAssessments.filter((assessment) => assessment.status !== "on_track").length ? aiGoalReview.review.goalAssessments.filter((assessment) => assessment.status !== "on_track").map((assessment) => <Link key={assessment.goalId} to={`/goals/${assessment.goalId}`}><span><Badge tone={assessment.status === "stuck" ? "danger" : "warning"}>{statusLabel[assessment.status]}</Badge><strong>{goalsById.get(assessment.goalId)?.title ?? "Cel"}</strong><small>{humanize(assessment.rationale)}</small></span><ArrowRight /></Link>) : <p className="muted-copy"><CheckCircle2 /> Żaden Cel nie wymaga pilnej uwagi.</p>}</section>
        <footer className="ai-review-scope"><strong>Zakres analizy</strong><span>{aiGoalReview.analyzedGoalIds.length} Celów · {aiGoalReview.periodStart}–{aiGoalReview.periodEnd}</span><span>{generatedFormatter.format(new Date(aiGoalReview.generatedAt))} · {aiGoalReview.model}{aiGoalReview.cached ? " · wynik z cache" : ""}</span>{aiGoalReview.omittedGoalIds.length ? <span className="ai-review-omitted">Pominięto jawnie {aiGoalReview.omittedGoalIds.length} Celów ponad limit 50.</span> : null}</footer>
      </div> : null}
    </Panel>
    <Modal open={consentOpen} title="Zanim uruchomisz Przegląd AI" onClose={() => setConsentOpen(false)}><div className="ai-consent"><p>Do skonfigurowanego dostawcy AI zostaną wysłane aktywne Cele, ich kryteria, powiązane Działania, blokady i ostatnie aktualizacje postępu z 28 dni.</p><p className="muted-copy">Nie wysyłamy profilu, e-maila, całej Skrzynki, pełnej Wiedzy ani historycznych sesji Focus. AI nie może zapisywać zmian.</p><div className="modal-actions"><Button onClick={() => setConsentOpen(false)}>Anuluj</Button><Button variant="primary" onClick={confirmConsent}><Sparkles />Rozumiem, uruchom analizę</Button></div></div></Modal>
    <Modal open={Boolean(draft)} title="Sprawdź propozycję Działania" closeDisabled={draftSaving} onClose={() => setDraft(undefined)}>{draft ? <form onSubmit={(event) => void saveDraft(event)}><p className="ai-draft-label"><Bot />Przygotowane przez AI — zapis nastąpi dopiero po Twoim zatwierdzeniu.</p><label className="field-label" htmlFor="ai-draft-title">Nazwa</label><input id="ai-draft-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required autoFocus /><label className="field-label" htmlFor="ai-draft-detail">Opis</label><textarea id="ai-draft-detail" rows={4} value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} />{draftError ? <p className="auth-message error" role="alert">{draftError}</p> : null}<div className="modal-actions"><Button type="button" disabled={draftSaving} onClick={() => setDraft(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={draftSaving} disabled={!draft.title.trim()}><Plus />Zatwierdź i dodaj</Button></div></form> : null}</Modal>
  </>;
}
