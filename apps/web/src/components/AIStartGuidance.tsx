import { Activity, AlertTriangle, ArrowRight, Bot, CalendarClock, ChevronDown, ChevronRight, CircleAlert, Plus, RefreshCw, Repeat2, Sparkles, ThumbsDown, ThumbsUp, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { formatWorkspaceDateRange } from "../domain/activity";
import { aiGoalReviewErrorCopy, aiGoalStatusLabels, aiReviewHorizonLabels, selectAIStartGuidance, shortenAIStartSummary } from "../domain/aiStartGuidance";
import type { HomeSummary } from "../domain/homeSummary";
import { humanizeEntityReferences } from "../domain/humanizeAIText";
import { polishCount, polishPluralForm } from "../domain/labels";
import { locationAddress, navigationCardId } from "../domain/navigation";
import { routeForEntity } from "../domain/routes";
import { NavigationLink } from "./ContextNavigation";
import { AIGoalReviewConsentModal, AIGoalReviewDraftModal, type AIGoalReviewDraft } from "./AIGoalReviewShared";
import { useActionFeedback } from "./action-feedback-context";
import { Badge, Button, Panel } from "./ui";

const generatedFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const terminalErrors = new Set(["AI_NOT_CONFIGURED", "NO_ACTIVE_GOALS"]);

const formatDate = (date: string, timeZone: string) => new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(`${date}T12:00:00Z`));

export function AIStartGuidance({ homeSummary }: { homeSummary: HomeSummary }) {
  const { state, mode, aiGoalReview, aiGoalReviewStatus, aiGoalReviewError, requestGoalReview, submitGoalReviewFeedback, createAction } = useStore();
  const { notifySuccess } = useActionFeedback();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [signalsOpen, setSignalsOpen] = useState(["upcoming", "attention"].includes(searchParams.get("show") ?? ""));
  const [consentOpen, setConsentOpen] = useState(false);
  const [draft, setDraft] = useState<AIGoalReviewDraft>();
  const [draftSaving, setDraftSaving] = useState(false);
  const draftSavingRef = useRef(false);
  const [draftError, setDraftError] = useState("");
  const [ratings, setRatings] = useState<Record<string, "helpful" | "not_helpful">>({});
  const [feedbackError, setFeedbackError] = useState("");
  const requestedSignals = ["upcoming", "attention"].includes(searchParams.get("show") ?? "");
  const showAll = (key: string) => searchParams.get("show") === key;
  const activeGoals = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active");
  const busy = aiGoalReviewStatus === "loading" || aiGoalReviewStatus === "refreshing";
  const selection = useMemo(() => aiGoalReview ? selectAIStartGuidance(aiGoalReview, state.goals, state.actions) : undefined, [aiGoalReview, state.actions, state.goals]);
  const entityLabels = useMemo<Array<[string, string]>>(() => [
    ...state.goals.map((goal): [string, string] => [goal.id, goal.title]),
    ...state.actions.map((action): [string, string] => [action.id, action.title])
  ].sort(([left], [right]) => right.length - left.length), [state.actions, state.goals]);
  const humanize = (text: string) => humanizeEntityReferences(text, entityLabels);
  const summary = aiGoalReview ? shortenAIStartSummary(humanize(aiGoalReview.review.summary)) : undefined;
  const upcomingItems = showAll("upcoming") ? homeSummary.upcomingActions : homeSummary.upcomingActions.slice(0, 5);
  const attentionItems = showAll("attention") ? homeSummary.attentionSignals : homeSummary.attentionSignals.slice(0, 2);
  const startBreadcrumbs = [{ label: "Start", to: "/" }];
  const startAddress = locationAddress(location);

  useEffect(() => { if (requestedSignals) setSignalsOpen(true); }, [requestedSignals]);

  const begin = () => {
    if (aiGoalReview) void requestGoalReview(true);
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
    setDraftSaving(true);
    setDraftError("");
    try {
      const goal = state.goals.find((candidate) => candidate.id === draft.goalId);
      if (!goal || goal.status !== "active" || goal.visibility !== "active") throw new Error("Cel tej propozycji nie jest już aktywny. Odśwież analizę.");
      await createAction({ goalId: draft.goalId, title: draft.title, detail: draft.detail, pinnedToToday: true });
      notifySuccess("Działanie dodane po Twoim zatwierdzeniu.");
      setDraft(undefined);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Nie udało się zapisać Działania.");
    } finally {
      draftSavingRef.current = false;
      setDraftSaving(false);
    }
  };

  const selectedDraft = selection?.cta.kind === "draft" ? selection.cta.draft : undefined;
  const primaryCTA = selectedDraft
    ? <Button className="ai-start-primary-cta" variant="primary" onClick={() => { setDraftError(""); setDraft({ ...selectedDraft }); }}><Plus />Dodaj proponowane Działanie</Button>
    : selection?.cta.kind === "action"
      ? <Link className="button button-primary ai-start-primary-cta" to={selection.cta.to}>Otwórz Działanie<ArrowRight /></Link>
      : selection?.cta.kind === "goal"
        ? <Link className="button button-primary ai-start-primary-cta" to={selection.cta.to}>Przejdź do Celu<ArrowRight /></Link>
        : null;

  return <>
    <Panel className="ai-start-guidance" aria-labelledby="ai-start-guidance-title">
      <div className="ai-start-heading">
        <div><span className="eyebrow"><Bot />Kierunek od AI {mode === "demo" ? <Badge tone="neutral">Symulacja</Badge> : null}</span><h2 id="ai-start-guidance-title" className="sr-only">Kierunek od AI</h2></div>
        {aiGoalReview ? <Button variant="ghost" loading={busy} disabled={busy} onClick={begin}><RefreshCw />Odśwież</Button> : null}
      </div>

      {!aiGoalReview && !busy ? <div className="ai-start-empty"><p>AI może podsumować aktywne Cele i wskazać następny krok.</p>{activeGoals.length ? <Button variant="primary" onClick={begin}><Sparkles />Przeanalizuj moje Cele</Button> : <><Button variant="primary" disabled><Sparkles />Przeanalizuj moje Cele</Button><Link className="section-link" to="/goals?create=true">Utwórz aktywny Cel<ChevronRight /></Link></>}</div> : null}
      {!aiGoalReview && busy ? <div className="ai-review-loading" role="status"><span className="ai-review-pulse"><Bot /></span><div><strong>Analizuję aktywne Cele…</strong><small>Możesz nadal korzystać ze Startu.</small></div></div> : null}
      {aiGoalReview && busy ? <div className="ai-start-refreshing" role="status"><RefreshCw className="spin" />Odświeżam analizę…</div> : null}
      {aiGoalReviewError ? <div className="ai-review-error" role="alert"><AlertTriangle /><div><strong>{aiGoalReviewErrorCopy(aiGoalReviewError.code)}</strong><small>{aiGoalReviewError.message}</small></div>{!terminalErrors.has(aiGoalReviewError.code) ? <Button variant="ghost" disabled={busy} onClick={() => void requestGoalReview(Boolean(aiGoalReview))}>Spróbuj ponownie</Button> : null}</div> : null}

      {aiGoalReview?.stale ? <div className="ai-start-stale-summary" role="status"><CalendarClock /><div><strong>Analiza wymaga odświeżenia</strong><span>Dane Celów zmieniły się od {generatedFormatter.format(new Date(aiGoalReview.generatedAt))}.</span><Link to="/review">Zobacz poprzedni wynik</Link></div></div> : null}
      {aiGoalReview && !aiGoalReview.stale ? <div className="ai-start-result">
        <div className="ai-start-status"><Badge tone={aiGoalReview.review.overallStatus === "on_track" ? "success" : aiGoalReview.review.overallStatus === "stuck" ? "danger" : "warning"}>{aiGoalStatusLabels[aiGoalReview.review.overallStatus]}</Badge><span>{polishCount(aiGoalReview.analyzedGoalIds.length, "przeanalizowany Cel", "przeanalizowane Cele", "przeanalizowanych Celów")}</span></div>
        <div className="ai-start-direction"><h3>{humanize(aiGoalReview.review.headline)}</h3>{summary ? <p aria-label={summary.truncated ? summary.full : undefined}>{summary.visible}</p> : null}</div>
        {selection?.recommendation ? <article className="ai-start-recommendation">
          <div className="ai-start-recommendation-heading"><span>Główna rekomendacja</span><Badge tone={selection.recommendation.horizon === "now" ? "danger" : "neutral"}>{aiReviewHorizonLabels[selection.recommendation.horizon]}</Badge></div>
          <h3>{humanize(selection.recommendation.title)}</h3>
          <div className="ai-start-next-step"><span><ArrowRight />Następny krok</span><strong>{humanize(selection.recommendation.suggestedNextStep)}</strong></div>
          {selection.signalLabels.length ? <div className="ai-start-evidence" aria-label="Sygnały z danych"><Activity />{selection.signalLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div> : null}
          <div className="ai-start-actions">{primaryCTA}<Link className="ai-start-full-link" to="/review">Zobacz pełną analizę<ChevronRight /></Link></div>
          <div className="ai-feedback" role="group" aria-label={`Oceń zalecenie: ${humanize(selection.recommendation.title)}`}><span>Czy to pomocne?</span><button type="button" aria-pressed={ratings[selection.recommendation.id] === "helpful"} aria-label="Pomocne" onClick={() => void rate(selection.recommendation!.id, "helpful")}><ThumbsUp /></button><button type="button" aria-pressed={ratings[selection.recommendation.id] === "not_helpful"} aria-label="Niepomocne" onClick={() => void rate(selection.recommendation!.id, "not_helpful")}><ThumbsDown /></button></div>
          {feedbackError ? <p className="inline-mutation-error" role="alert">{feedbackError}</p> : null}
        </article> : <div className="ai-start-actions"><Link className="ai-start-full-link" to="/review">Zobacz pełną analizę<ChevronRight /></Link></div>}
        <footer className="muted-copy">Wygenerowano {generatedFormatter.format(new Date(aiGoalReview.generatedAt))}{aiGoalReview.cached ? " · wynik z cache" : ""}</footer>
      </div> : null}

      <section className="start-overview ai-start-signals" aria-label="Sygnały i dalszy plan">
        <button className="start-overview-toggle" type="button" aria-expanded={signalsOpen} aria-controls="ai-start-signals-content" onClick={() => setSignalsOpen((current) => !current)}>
          <span><strong>Sygnały i dalszy plan</strong><small>{polishCount(homeSummary.upcomingActions.length, "nadchodzące Działanie", "nadchodzące Działania", "nadchodzących Działań")} · {polishCount(homeSummary.attentionCount, "sprawa wymaga uwagi", "sprawy wymagają uwagi", "spraw wymaga uwagi")} · {polishCount(homeSummary.activity.completedActions, "ukończone Działanie w tygodniu", "ukończone Działania w tygodniu", "ukończonych Działań w tygodniu")}</small></span>
          <ChevronDown aria-hidden="true" />
        </button>
        <div className="start-overview-content" id="ai-start-signals-content" hidden={!signalsOpen}>
          <Panel aria-labelledby="start-upcoming-title"><div className="start-section-heading"><div><span className="eyebrow"><CalendarClock />Horyzont</span><h3 id="start-upcoming-title">Nadchodzące</h3></div><span className="count-chip" aria-label={polishCount(homeSummary.upcomingActions.length, "nadchodzące Działanie", "nadchodzące Działania", "nadchodzących Działań")}>{homeSummary.upcomingActions.length}</span></div>{upcomingItems.length ? upcomingItems.map((action) => <div className="upcoming-row" key={action.id}><time dateTime={action.scheduledFor}>{formatDate(action.scheduledFor!, state.workspaceTimezone)}</time><NavigationLink data-navigation-card-id={navigationCardId("action", action.id)} to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={startBreadcrumbs} returnTo={startAddress} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}>{action.title}{action.recurringTemplateId ? <small><Repeat2 />cykliczne</small> : null}</NavigationLink></div>) : <p className="muted-copy">Brak zaplanowanych Działań w najbliższych 7 dniach.</p>}{homeSummary.upcomingActions.length > 5 ? <Link className="section-link" to="/?show=upcoming">{showAll("upcoming") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
          <Panel aria-labelledby="start-activity-title"><div className="start-section-heading"><div><span className="eyebrow"><TrendingUp />Rytm pracy</span><h3 id="start-activity-title">Bieżący tydzień</h3></div></div><p className="activity-period">{formatWorkspaceDateRange(homeSummary.activity.periodStart, homeSummary.activity.periodEnd)}</p><div className="activity-grid"><div><strong>{homeSummary.activity.completedActions}</strong><span>{polishPluralForm(homeSummary.activity.completedActions, "ukończone Działanie", "ukończone Działania", "ukończonych Działań")}</span></div><div><strong>{homeSummary.activity.progressUpdates}</strong><span>{polishPluralForm(homeSummary.activity.progressUpdates, "aktualizacja postępu", "aktualizacje postępu", "aktualizacji postępu")}</span></div><div><strong>{homeSummary.activity.knowledgeAdded}</strong><span>{polishPluralForm(homeSummary.activity.knowledgeAdded, "dodany element Wiedzy", "dodane elementy Wiedzy", "dodanych elementów Wiedzy")}</span></div></div></Panel>
          <Panel className="start-attention" aria-labelledby="start-attention-title"><div className="start-section-heading"><div><span className="eyebrow"><CircleAlert />Do sprawdzenia</span><h3 id="start-attention-title">Wymaga uwagi</h3></div><span className="count-chip" aria-label={polishCount(homeSummary.attentionCount, "sprawa wymaga uwagi", "sprawy wymagają uwagi", "spraw wymaga uwagi")}>{homeSummary.attentionCount}</span></div>{attentionItems.length ? <div className="attention-list" id="start-attention-list">{attentionItems.map((signal) => <Link key={signal.id} to={signal.to}><span className={`attention-marker attention-${signal.kind}`} aria-hidden="true" /><span><strong>{signal.title}</strong><small>{signal.detail}</small></span><ChevronRight /></Link>)}</div> : <p className="muted-copy">Brak blokad, zaległości i decyzji czekających na Ciebie.</p>}{homeSummary.attentionCount > 2 ? <Link className="section-link" to={showAll("attention") ? "/" : "/?show=attention"} aria-expanded={showAll("attention")} aria-controls="start-attention-list">{showAll("attention") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
        </div>
      </section>
    </Panel>
    <AIGoalReviewConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} onConfirm={confirmConsent} />
    <AIGoalReviewDraftModal draft={draft} saving={draftSaving} error={draftError} onChange={setDraft} onClose={() => setDraft(undefined)} onSubmit={saveDraft} />
  </>;
}
