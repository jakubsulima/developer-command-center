import { Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Ellipsis, ListTodo, LoaderCircle, Plus, RefreshCw, Settings, Sparkles, Target, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AIReviewSettingsForm } from "./AIReviewSettingsForm";
import { Modal } from "./Modal";
import { useStore } from "../app/useStore";
import { aiGoalReviewErrorCopy as errorCopy, aiGoalReviewFreshnessCopy, aiGoalStatusLabels as statusLabel, aiReviewHorizonLabels as horizonLabel, aiSignalLabel as signalLabel } from "../domain/aiStartGuidance";
import { humanizeEntityReferences } from "../domain/humanizeAIText";
import { formatInclusiveDateRange } from "../domain/activity";
import { Badge, Button, Panel } from "./ui";
import { useActionFeedback } from "./action-feedback-context";
import { AIGoalReviewConsentModal, AIGoalReviewDraftModal, type AIGoalReviewDraft } from "./AIGoalReviewShared";
import { nextWorkspaceWeek } from "../domain/weeklyPlan";
import { polishPluralForm } from "../domain/labels";

const generatedFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
export function AIGoalReview() {
  const { state, mode, aiGoalReview, aiGoalReviewStatus, aiGoalReviewError, aiGoalReviewFreshness, aiGoalReviewCheckedAt, aiGoalReviewReadStatus, aiGoalReviewReadError, refreshLatestGoalReview, requestGoalReview, submitGoalReviewFeedback, createAction, updateAction } = useStore();
  const { notifySuccess } = useActionFeedback();
  const navigate = useNavigate();
  const [consentOpen, setConsentOpen] = useState(false);
  const [forceConfirmationOpen, setForceConfirmationOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<AIGoalReviewDraft>();
  const [draftSaving, setDraftSaving] = useState(false);
  const draftSavingRef = useRef(false);
  const optionsRef = useRef<HTMLDetailsElement>(null);
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
  const checking = aiGoalReviewReadStatus === "checking";
  const planWeek = nextWorkspaceWeek(new Date(), state.workspaceTimezone);
  const reviewStale = aiGoalReview?.stale || aiGoalReviewFreshness !== "current";
  const recommendationFresh = Boolean(aiGoalReview && !reviewStale);
  const assessments = aiGoalReview?.review.goalAssessments.filter((assessment) => assessment.status !== "on_track") ?? [];
  const reviewStatus = busy ? "Trwa analiza" : checking ? "Sprawdzam aktualność" : reviewStale ? "Może być nieaktualna" : "Analiza aktualna";

  const closeOptions = (restoreFocus = false) => {
    const options = optionsRef.current;
    if (!options?.open) return;
    if (restoreFocus) options.querySelector("summary")?.focus({ preventScroll: true });
    options.open = false;
  };

  useEffect(() => {
    const options = optionsRef.current;
    if (!options) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (options.open && event.target instanceof Node && !options.contains(event.target)) options.open = false;
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

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
      if (!recommendationFresh || !draft.sourceRecommendationId || !aiGoalReview?.review.recommendations.some((recommendation) => recommendation.id === draft.sourceRecommendationId)) throw new Error("Zalecenie jest nieaktualne. Sprawdź aktualność analizy przed zapisem.");
      const goal = state.goals.find((candidate) => candidate.id === draft.goalId);
      if (!goal || goal.status !== "active" || goal.visibility !== "active") throw new Error("Grupa tej propozycji nie jest już aktywna. Odśwież analizę.");
      const planLink = draft.scheduledFor ? { label: "Otwórz Plan tygodnia", onClick: () => navigate("/review?tab=plan") } : undefined;
      if (draft.actionId) {
        const action = state.actions.find((candidate) => candidate.id === draft.actionId);
        if (!action || action.version !== draft.actionVersion || action.goalId !== draft.goalId) throw new Error("Działanie zmieniło się od czasu otwarcia propozycji. Sprawdź je ponownie.");
        if (action.status === "blocked" || ["completed", "skipped", "cancelled"].includes(action.status)) throw new Error("To Działanie nie może zostać zaplanowane w obecnym stanie.");
        await updateAction(action.id, { scheduledFor: draft.scheduledFor ?? null }, action.version);
        notifySuccess(draft.scheduledFor ? "Istniejące Działanie dodane do Planu." : "Usunięto termin z istniejącego Działania.", planLink);
      } else {
        const idempotencyKey = draft.idempotencyKey ?? crypto.randomUUID();
        if (!draft.idempotencyKey) setDraft({ ...draft, idempotencyKey });
        await createAction({ goalId: draft.goalId, title: draft.title, detail: draft.detail, scheduledFor: draft.scheduledFor }, idempotencyKey);
        notifySuccess(draft.scheduledFor ? "Działanie dodane do Planu." : "Działanie dodane bez terminu.", planLink);
      }
      setDraft(undefined);
    } catch (error) { setDraftError(error instanceof Error ? error.message : "Nie udało się zapisać Działania."); }
    finally { draftSavingRef.current = false; setDraftSaving(false); }
  };

  return <>
    <div className="ai-goal-review">
      <Panel className="ai-review-panel ai-review-overview" aria-labelledby="ai-review-overview-title">
        <header className="ai-review-header">
          <h2 id="ai-review-overview-title">Podsumowanie AI</h2>
          <div className="ai-review-actions">
            <Button
              variant={aiGoalReview ? "secondary" : "primary"}
              aria-busy={busy || undefined}
              disabled={busy || checking || !state.goals.some((goal) => goal.status === "active" && goal.visibility === "active")}
              onClick={begin}
            >
              {busy ? <LoaderCircle className="spin" aria-hidden="true" /> : aiGoalReview ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {aiGoalReview ? "Aktualizuj analizę" : "Przeanalizuj moje grupy działań"}
            </Button>
            <details
              ref={optionsRef}
              className="ai-review-more-options"
              onBlur={(event) => {
                if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeOptions();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape" && event.currentTarget.open) {
                  event.stopPropagation();
                  closeOptions(true);
                }
              }}
            >
              <summary aria-label="Więcej opcji" title="Więcej opcji"><Ellipsis aria-hidden="true" /></summary>
              <div className="ai-review-options">
                {aiGoalReview ? <>
                  <Button variant="ghost" disabled={busy || checking} onClick={() => {
                    closeOptions(true);
                    void refreshLatestGoalReview();
                  }}><RefreshCw />Sprawdź aktualność</Button>
                  <Button variant="ghost" disabled={busy || checking} onClick={() => {
                    closeOptions(true);
                    setForceConfirmationOpen(true);
                  }}><Sparkles />Wygeneruj ponownie</Button>
                </> : null}
                <Button variant="ghost" onClick={() => {
                  closeOptions(true);
                  setSettingsOpen(true);
                }}><Settings />Ustawienia AI</Button>
              </div>
            </details>
          </div>
        </header>
        {aiGoalReview ? <>
          <div className="ai-review-meta">
            <div role="status"><Badge tone={busy || checking ? "neutral" : reviewStale ? "warning" : "success"}>{reviewStatus}</Badge></div>
            <span className="ai-review-date">Dane z {formatInclusiveDateRange(aiGoalReview.periodStart, aiGoalReview.periodEnd)}</span>
            {mode === "demo" ? <Badge tone="neutral">Symulacja</Badge> : null}
          </div>
          <div className="ai-review-direction">
            <h3>{humanize(aiGoalReview.review.headline)}</h3>
            <Badge tone={aiGoalReview.review.overallStatus === "on_track" ? "success" : aiGoalReview.review.overallStatus === "stuck" ? "danger" : "warning"}>{statusLabel[aiGoalReview.review.overallStatus]}</Badge>
            <p>{humanize(aiGoalReview.review.summary)}</p>
          </div>
        </> : <div className="ai-review-placeholder" role="status">
          <p>{busy ? "Analizuję aktywne grupy działań…" : checking ? "Sprawdzam zapisaną analizę…" : aiGoalReviewReadError ? "Status zapisanej analizy jest niedostępny." : "Brak zapisanej analizy. Uruchom ją, aby zobaczyć zalecenia dla aktywnych grup działań."}</p>
          {mode === "demo" ? <Badge tone="neutral">Symulacja</Badge> : null}
        </div>}
        {aiGoalReviewReadError ? <div className="ai-review-error" role="alert"><AlertTriangle /><div><strong>Nie udało się sprawdzić aktualności.</strong><small>{aiGoalReviewReadError}</small></div><Button variant="ghost" onClick={() => void refreshLatestGoalReview()}>Ponów odczyt</Button></div> : null}
        {aiGoalReviewError ? <div className="ai-review-error" role="alert"><AlertTriangle /><div><strong>{errorCopy(aiGoalReviewError.code)}</strong><small>{aiGoalReviewError.message}</small></div>{aiGoalReviewError.code === "AI_GENERATION_IN_PROGRESS" ? <Button variant="ghost" disabled={checking} onClick={() => void refreshLatestGoalReview()}>Sprawdź status</Button> : aiGoalReviewError.code !== "AI_NOT_CONFIGURED" && aiGoalReviewError.code !== "NO_ACTIVE_GOALS" ? <Button variant="ghost" disabled={busy || checking} onClick={() => void requestGoalReview(false)}>Spróbuj ponownie</Button> : null}</div> : null}
      </Panel>
      {aiGoalReview ? <>
        {aiGoalReview.review.recommendations.length ? <Panel className="ai-review-panel ai-review-recommendations-section" aria-labelledby="ai-review-recommendations-title"><h2 id="ai-review-recommendations-title">Zalecenia AI</h2><div className="ai-recommendations">{aiGoalReview.review.recommendations.map((recommendation) => <article key={recommendation.id}>
          <div className="ai-recommendation-topline">
            <h3>{humanize(recommendation.title)}</h3>
            <Badge tone={recommendation.horizon === "now" ? "danger" : "neutral"}>{horizonLabel[recommendation.horizon]}</Badge>
          </div>
          <div className="ai-recommendation-copy">
          <div className="ai-next-step"><span><ArrowRight />Następny krok</span><strong>{humanize(recommendation.suggestedNextStep)}</strong></div>
          {recommendation.goalIds.some((id) => goalsById.has(id)) && <div className="ai-recommendation-actions button-row">
            {recommendation.goalIds.map((id) => {
              const goal = goalsById.get(id);
              return goal ? <Link key={id} className="button button-secondary" to={`/goals/${encodeURIComponent(id)}`} aria-label={`Otwórz grupę: ${goal.title}`}>{recommendation.goalIds.length === 1 ? "Otwórz grupę" : goal.title}<ChevronRight aria-hidden="true" /></Link> : null;
            })}
          </div>}
          {recommendation.draftAction ? <div className="ai-recommendation-actions"><Button variant="ghost" disabled={!recommendationFresh} onClick={() => setDraft({ ...recommendation.draftAction!, sourceRecommendationId: recommendation.id, idempotencyKey: crypto.randomUUID() })}><Plus />Przejrzyj krok i zaplanuj</Button></div> : null}
          {recommendation.actionIds.map((actionId) => actionsById.get(actionId)).filter((action): action is NonNullable<typeof action> => action !== undefined && recommendation.goalIds.includes(action.goalId ?? "")).map((action) => {
            const alreadyInPlan = Boolean(action.scheduledFor && planWeek.dates.includes(action.scheduledFor));
            const eligible = !["completed", "skipped", "cancelled"].includes(action.status);
            return <div className="ai-recommendation-actions" key={`plan-${action.id}`}><Button variant="ghost" disabled={!recommendationFresh || !eligible || action.status === "blocked" || alreadyInPlan} onClick={() => setDraft({ goalId: action.goalId!, title: action.title, detail: action.detail, scheduledFor: action.scheduledFor && planWeek.dates.includes(action.scheduledFor) ? action.scheduledFor : undefined, actionId: action.id, actionVersion: action.version, sourceRecommendationId: recommendation.id })}><Plus />{alreadyInPlan ? "Działanie już jest w Planie" : action.status === "blocked" ? "Najpierw rozwiąż blokadę" : "Dodaj istniejące do Planu"}</Button></div>;
          })}
          <details className="ai-recommendation-details"><summary>Uzasadnienie, źródła i ocena<ChevronDown aria-hidden="true" /></summary><div className="ai-recommendation-details-content"><div className="ai-recommendation-targets" aria-label="Dotyczy"><span className="ai-targets-label"><Target />Dotyczy</span><div>{recommendation.goalIds.map((id) => {
            const goal = goalsById.get(id);
            return goal ? <Link className="ai-entity-link is-goal" key={id} to={`/goals/${id}`}><Target /><span><small>Grupa działań</small><strong>{goal.title}</strong></span></Link> : <span className="ai-entity-link is-missing" key={id}><Target /><span><small>Grupa działań</small><strong>Niedostępna grupa działań</strong></span></span>;
          })}{recommendation.actionIds.map((id) => {
            const action = actionsById.get(id);
            return action ? <Link className="ai-entity-link is-action" key={id} to={`/actions/${id}`}><ListTodo /><span><small>Działanie</small><strong>{action.title}</strong></span></Link> : null;
          })}</div></div><div className="ai-recommendation-reason"><span>Dlaczego</span><p>{humanize(recommendation.reason)}</p></div>
          {recommendation.signalKeys.length ? <div className="ai-evidence" aria-label="Sygnały z danych"><span className="ai-evidence-label"><Activity />Sygnały</span>{recommendation.signalKeys.map((key) => <span key={key}>{signalLabel(key)}</span>)}</div> : null}
          <div className="ai-feedback" role="group" aria-label={`Oceń zalecenie: ${humanize(recommendation.title)}`}><span>Czy to pomocne?</span><button type="button" aria-pressed={ratings[recommendation.id] === "helpful"} aria-label="Przydatne" onClick={() => void rate(recommendation.id, "helpful")}><ThumbsUp /></button><button type="button" aria-pressed={ratings[recommendation.id] === "not_helpful"} aria-label="Nieprzydatne" onClick={() => void rate(recommendation.id, "not_helpful")}><ThumbsDown /></button></div></div></details>
          </div></article>)}</div>{feedbackError ? <p className="inline-mutation-error" role="alert">{feedbackError}</p> : null}</Panel> : null}
        {aiGoalReview.review.checks.length ? <Panel className="ai-review-panel ai-review-disclosure">
          <details>
            <summary><span>Pytania do sprawdzenia ({aiGoalReview.review.checks.length})</span><ChevronDown aria-hidden="true" /></summary>
            <div className="ai-review-checks">
              {aiGoalReview.review.checks.map((check) => (
                <div key={check.id}>
                  <strong>{humanize(check.question)}</strong>
                  <p>{humanize(check.whyItMatters)}</p>
                  {check.goalIds.map((id) => goalsById.has(id) ? <Link key={id} to={`/goals/${id}`}>{goalsById.get(id)!.title}</Link> : null)}
                </div>
              ))}
            </div>
          </details>
        </Panel> : null}
        <Panel className="ai-review-panel ai-review-disclosure">
          <details>
            <summary><span>Grupy wymagające uwagi ({assessments.length})</span><ChevronDown aria-hidden="true" /></summary>
            <div className="ai-review-assessments">
              {assessments.length ? assessments.map((assessment) => (
                <Link key={assessment.goalId} to={`/goals/${assessment.goalId}`}>
                  <span>
                    <strong>{goalsById.get(assessment.goalId)?.title ?? "Grupa działań"}</strong>
                    <Badge tone={assessment.status === "stuck" ? "danger" : "warning"}>{statusLabel[assessment.status]}</Badge>
                    <small>{humanize(assessment.rationale)}</small>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </Link>
              )) : <p className="muted-copy"><CheckCircle2 /> Żadna grupa działań nie wymaga pilnej uwagi.</p>}
            </div>
          </details>
        </Panel>
        <Panel className="ai-review-panel ai-review-disclosure">
          <details>
            <summary>Zakres analizy<ChevronDown aria-hidden="true" /></summary>
            <div className="ai-review-scope-content">
              <span>{aiGoalReview.analyzedGoalIds.length} {polishPluralForm(aiGoalReview.analyzedGoalIds.length, "grupa działań", "grupy działań", "grup działań")} · {aiGoalReview.windowDays} dni</span>
              <span>Wygenerowano {generatedFormatter.format(new Date(aiGoalReview.generatedAt))} · {aiGoalReview.model}{aiGoalReview.cached ? " · wynik zapisany wcześniej" : ""}</span>
              {aiGoalReviewCheckedAt ? <span>Sprawdzono {generatedFormatter.format(new Date(aiGoalReviewCheckedAt))}</span> : null}
              {reviewStale ? <span className="ai-review-omitted">{aiGoalReviewFreshnessCopy(aiGoalReviewFreshness)}</span> : null}
              {aiGoalReview.omittedGoalIds.length ? <span className="ai-review-omitted">Poza zakresem analizy: {aiGoalReview.omittedGoalIds.length} {polishPluralForm(aiGoalReview.omittedGoalIds.length, "grupa działań", "grupy działań", "grup działań")}</span> : null}
            </div>
          </details>
        </Panel>
      </> : null}
    </div>
    <AIGoalReviewConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} onConfirm={confirmConsent} windowDays={state.aiReviewSettings?.windowDays} demo={mode === "demo"} provider={import.meta.env.VITE_AI_REVIEW_PROVIDER_LABEL} />
    <Modal open={settingsOpen} title="Ustawienia AI" className="ai-review-settings-dialog" onClose={() => setSettingsOpen(false)}>
      <AIReviewSettingsForm />
    </Modal>
    <Modal open={forceConfirmationOpen} title="Wygenerować nowy Przegląd AI?" onClose={() => setForceConfirmationOpen(false)}>
      <div className="ai-consent"><p>To działanie pomija zapisany wynik i zawsze próbuje uruchomić nową analizę. Może powstać nowy koszt; obowiązują limit i pięciominutowa przerwa między wymuszonymi próbami.</p><div className="modal-actions"><Button onClick={() => setForceConfirmationOpen(false)}>Anuluj</Button><Button variant="primary" disabled={busy} onClick={() => { setForceConfirmationOpen(false); void requestGoalReview(true); }}><Sparkles />Wygeneruj nowy wynik</Button></div></div>
    </Modal>
    <AIGoalReviewDraftModal draft={draft} saving={draftSaving} error={draftError} onChange={setDraft} onClose={() => setDraft(undefined)} onSubmit={saveDraft} planDates={planWeek.dates} />
  </>;
}
