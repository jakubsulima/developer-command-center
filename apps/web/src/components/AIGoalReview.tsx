import { Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, Clock3, ListTodo, Plus, RefreshCw, Sparkles, Target, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Modal } from "./Modal";
import { useStore } from "../app/useStore";
import { aiGoalReviewErrorCopy as errorCopy, aiGoalReviewFreshnessCopy, aiGoalStatusLabels as statusLabel, aiReviewHorizonLabels as horizonLabel, aiSignalLabel as signalLabel } from "../domain/aiStartGuidance";
import { humanizeEntityReferences } from "../domain/humanizeAIText";
import { formatInclusiveDateRange } from "../domain/activity";
import { Badge, Button, Panel } from "./ui";
import { useActionFeedback } from "./action-feedback-context";
import { AIGoalReviewConsentModal, AIGoalReviewDraftModal, type AIGoalReviewDraft } from "./AIGoalReviewShared";

const generatedFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
export function AIGoalReview() {
  const { state, mode, aiGoalReview, aiGoalReviewStatus, aiGoalReviewError, aiGoalReviewFreshness, aiGoalReviewCheckedAt, aiGoalReviewReadStatus, aiGoalReviewReadError, refreshLatestGoalReview, requestGoalReview, submitGoalReviewFeedback, createAction } = useStore();
  const { notifySuccess } = useActionFeedback();
  const [consentOpen, setConsentOpen] = useState(false);
  const [forceConfirmationOpen, setForceConfirmationOpen] = useState(false);
  const [draft, setDraft] = useState<AIGoalReviewDraft>();
  const [draftSaving, setDraftSaving] = useState(false);
  const draftSavingRef = useRef(false);
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
    if (aiGoalReview) void requestGoalReview(false);
    else setConsentOpen(true);
  };
  const confirmConsent = () => {
    setConsentOpen(false);
    void requestGoalReview(false);
  };
  const rate = async (recommendationId: string, rating: "helpful" | "not_helpful") => {
    const previous = ratings[recommendationId];
    setFeedbackError("");
    setRatings((current) => ({ ...current, [recommendationId]: rating }));
    try { await submitGoalReviewFeedback(recommendationId, rating); }
    catch { setRatings((current) => ({ ...current, [recommendationId]: previous })); setFeedbackError("Nie udało się zapisać oceny."); }
  };
  const saveDraft = async () => {
    if (!draft || draftSavingRef.current) return;
    draftSavingRef.current = true;
    setDraftSaving(true); setDraftError("");
    try {
      const goal = state.goals.find((candidate) => candidate.id === draft.goalId);
      if (!goal || goal.status !== "active" || goal.visibility !== "active") throw new Error("Cel tej propozycji nie jest już aktywny. Odśwież analizę.");
      await createAction({ goalId: draft.goalId, title: draft.title, detail: draft.detail, pinnedToToday: true });
      notifySuccess("Działanie dodane po Twoim zatwierdzeniu.");
      setDraft(undefined);
    } catch (error) { setDraftError(error instanceof Error ? error.message : "Nie udało się zapisać Działania."); }
    finally { draftSavingRef.current = false; setDraftSaving(false); }
  };

  return <>
    <Panel className="ai-goal-review" aria-labelledby="ai-goal-review-title">
      <div className="section-heading ai-review-heading">
        <div><span className="section-kicker"><Bot />Przegląd AI {mode === "demo" ? <Badge tone="neutral">Symulacja</Badge> : null}</span><h2 id="ai-goal-review-title">Przegląd Celów z AI</h2></div>
        <div className="ai-review-actions"><Button variant={aiGoalReview ? "secondary" : "primary"} loading={busy} disabled={busy || !state.goals.some((goal) => goal.status === "active" && goal.visibility === "active")} onClick={begin}>{aiGoalReview ? <RefreshCw /> : <Sparkles />}{aiGoalReview ? "Aktualizuj analizę" : "Przeanalizuj moje Cele"}</Button>{aiGoalReview ? <Button variant="ghost" disabled={busy} onClick={() => setForceConfirmationOpen(true)}>Wygeneruj ponownie</Button> : null}</div>
      </div>
      {!aiGoalReview && aiGoalReviewReadStatus === "checking" ? <div className="ai-review-loading" role="status"><span className="ai-review-pulse"><Bot /></span><div><strong>Sprawdzam zapisaną analizę…</strong><small>Odczyt statusu nie uruchamia modelu.</small></div></div> : null}
      {!aiGoalReview && !busy && aiGoalReviewReadStatus === "checked" && aiGoalReviewFreshness === "none" ? <div className="ai-review-empty"><p>Brak zapisanej analizy. Uruchomisz ją ręcznie; AI nie zmienia danych ani nie wykonuje Działań.</p></div> : null}
      {aiGoalReviewReadError ? <div className="ai-review-error" role="alert"><AlertTriangle /><div><strong>Nie udało się sprawdzić aktualności.</strong><small>{aiGoalReviewReadError}</small></div><Button variant="ghost" onClick={() => void refreshLatestGoalReview()}>Ponów odczyt</Button></div> : null}
      {busy ? <div className="ai-review-loading" role="status"><span className="ai-review-pulse"><Bot /></span><div><strong>{aiGoalReviewStatus === "refreshing" ? "Odświeżam analizę…" : "Analizuję aktywne Cele…"}</strong><small>Możesz nadal korzystać z pozostałej części aplikacji.</small></div></div> : null}
      {aiGoalReviewError ? <div className="ai-review-error" role="alert"><AlertTriangle /><div><strong>{errorCopy(aiGoalReviewError.code)}</strong><small>{aiGoalReviewError.message}</small></div>{aiGoalReviewError.code === "AI_GENERATION_IN_PROGRESS" ? <Button variant="ghost" onClick={() => void refreshLatestGoalReview()}>Sprawdź status</Button> : aiGoalReviewError.code !== "AI_NOT_CONFIGURED" && aiGoalReviewError.code !== "NO_ACTIVE_GOALS" ? <Button variant="ghost" disabled={busy} onClick={() => void requestGoalReview(false)}>Spróbuj ponownie</Button> : null}</div> : null}
      {aiGoalReview ? <div className={aiGoalReview.stale || aiGoalReviewFreshness !== "current" ? "ai-review-result is-stale" : "ai-review-result"}>
        {aiGoalReview.stale || aiGoalReviewFreshness !== "current" ? <div className="ai-review-stale"><Clock3 /><span><strong>Poprzednia analiza</strong><small>{aiGoalReviewFreshnessCopy(aiGoalReviewFreshness)}{aiGoalReviewCheckedAt ? ` Sprawdzono ${generatedFormatter.format(new Date(aiGoalReviewCheckedAt))}.` : ""}</small></span><Button variant="ghost" onClick={() => void refreshLatestGoalReview()}>Sprawdź aktualność</Button></div> : null}
        <div className="ai-review-period"><span>Przegląd Celów · ostatnie {aiGoalReview.windowDays} dni</span><Link to="/settings">Ustawienia</Link><small>{formatInclusiveDateRange(aiGoalReview.periodStart, aiGoalReview.periodEnd)} · Wygenerowano {generatedFormatter.format(new Date(aiGoalReview.generatedAt))}{aiGoalReviewCheckedAt ? ` · Sprawdzono ${generatedFormatter.format(new Date(aiGoalReviewCheckedAt))}` : ""}</small></div>
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
          {recommendation.draftAction ? <div className="ai-recommendation-actions"><Button variant="ghost" onClick={() => setDraft({ ...recommendation.draftAction! })}><Plus />Dodaj Działanie</Button></div> : null}
          <div className="ai-feedback" role="group" aria-label={`Oceń zalecenie: ${humanize(recommendation.title)}`}><span>Czy to pomocne?</span><button type="button" aria-pressed={ratings[recommendation.id] === "helpful"} aria-label="Przydatne" onClick={() => void rate(recommendation.id, "helpful")}><ThumbsUp /></button><button type="button" aria-pressed={ratings[recommendation.id] === "not_helpful"} aria-label="Nieprzydatne" onClick={() => void rate(recommendation.id, "not_helpful")}><ThumbsDown /></button></div>
          </div></article>)}</div>{feedbackError ? <p className="inline-mutation-error" role="alert">{feedbackError}</p> : null}</section>
        {aiGoalReview.review.checks.length ? <section className="ai-review-checks"><h3>Co sprawdzić</h3>{aiGoalReview.review.checks.map((check) => <div key={check.id}><strong>{humanize(check.question)}</strong><p>{humanize(check.whyItMatters)}</p>{check.goalIds.map((id) => goalsById.has(id) ? <Link key={id} to={`/goals/${id}`}>Cel: {goalsById.get(id)!.title}</Link> : null)}</div>)}</section> : null}
        <section className="ai-review-assessments"><h3>Cele wymagające uwagi</h3>{aiGoalReview.review.goalAssessments.filter((assessment) => assessment.status !== "on_track").length ? aiGoalReview.review.goalAssessments.filter((assessment) => assessment.status !== "on_track").map((assessment) => <Link key={assessment.goalId} to={`/goals/${assessment.goalId}`}><span><Badge tone={assessment.status === "stuck" ? "danger" : "warning"}>{statusLabel[assessment.status]}</Badge><strong>{goalsById.get(assessment.goalId)?.title ?? "Cel"}</strong><small>{humanize(assessment.rationale)}</small></span><ArrowRight /></Link>) : <p className="muted-copy"><CheckCircle2 /> Żaden Cel nie wymaga pilnej uwagi.</p>}</section>
        <footer className="ai-review-scope"><strong>Zakres analizy</strong><span>{aiGoalReview.analyzedGoalIds.length} Celów · {aiGoalReview.periodStart}–{aiGoalReview.periodEnd}</span><span>{generatedFormatter.format(new Date(aiGoalReview.generatedAt))} · {aiGoalReview.model}{aiGoalReview.cached ? " · wynik z cache" : ""}</span>{aiGoalReview.omittedGoalIds.length ? <span className="ai-review-omitted">Pominięto jawnie {aiGoalReview.omittedGoalIds.length} Celów poza zakresem tej analizy.</span> : null}</footer>
      </div> : null}
    </Panel>
    <AIGoalReviewConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} onConfirm={confirmConsent} windowDays={state.aiReviewSettings?.windowDays} />
    <Modal open={forceConfirmationOpen} title="Wygenerować nowy Przegląd AI?" onClose={() => setForceConfirmationOpen(false)}>
      <div className="ai-consent"><p>To działanie pomija zapisany wynik i zawsze próbuje uruchomić nową analizę. Może powstać nowy koszt; obowiązują limit i pięciominutowa przerwa między wymuszonymi próbami.</p><div className="modal-actions"><Button onClick={() => setForceConfirmationOpen(false)}>Anuluj</Button><Button variant="primary" disabled={busy} onClick={() => { setForceConfirmationOpen(false); void requestGoalReview(true); }}><Sparkles />Wygeneruj nowy wynik</Button></div></div>
    </Modal>
    <AIGoalReviewDraftModal draft={draft} saving={draftSaving} error={draftError} onChange={setDraft} onClose={() => setDraft(undefined)} onSubmit={saveDraft} />
  </>;
}
