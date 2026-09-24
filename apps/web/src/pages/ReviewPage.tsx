import { ArrowRight, BookMarked, CalendarCheck, CalendarDays, Check, CheckCircle2, Lightbulb, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { DraftStatus } from "../components/DraftStatus";
import { Badge, Button, Panel } from "../components/ui";
import { deriveWeeklyReview } from "../domain/weeklyReview";
import { blockedActions } from "../domain/weeklyReview";
import { formatWorkspaceDateRange } from "../domain/activity";
import { polishCount, polishPluralForm } from "../domain/labels";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import type { ReviewRecord } from "../domain/types";
import { AIGoalReview } from "../components/AIGoalReview";
import { WeeklyPlanPanel, type WeeklyPlanDraft } from "../components/WeeklyPlanPanel";
import { nextWorkspaceWeek, selectedReviewGoalIds } from "../domain/weeklyPlan";

const reviewFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const reviewTabs = [
  { id: "summary", label: "Tydzień", icon: CalendarCheck, title: "Podsumowanie tygodnia" },
  { id: "plan", label: "Plan", icon: CalendarDays, title: "Plan na kolejny tydzień" },
  { id: "suggestions", label: "Sugestie", icon: Lightbulb, title: "Sugestie na kolejny tydzień" },
  { id: "ai", label: "AI", icon: Sparkles, title: "Przegląd Celów z AI" },
  { id: "history", label: "Historia", icon: RefreshCw, title: "Historia i stan przestrzeni" }
] as const;
type ReviewTab = typeof reviewTabs[number]["id"];

export function ReviewPage() {
  const { state, completeReview, updateAction, createAction } = useStore();
  const reviewsPage = useWorkspaceInfinitePage<ReviewRecord>("reviews", 20);
  const draft = usePersistentDraft("weekly-review-note", { note: "" });
  const weekly = useMemo(() => deriveWeeklyReview(state), [state]);
  const nextWeek = nextWorkspaceWeek(new Date(), state.workspaceTimezone);
  const [activeTab, setActiveTab] = useState<ReviewTab>("summary");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const latestThisWeek = state.reviews.filter((review) => review.type === "weekly" && new Date(review.completedAt) >= weekly.start && new Date(review.completedAt) < weekly.end).sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const completedThisWeek = Boolean(latestThisWeek);
  const planDraft = usePersistentDraft<WeeklyPlanDraft>(`weekly-plan-${nextWeek.startDate}`, { selectedGoalIds: selectedReviewGoalIds(latestThisWeek?.answers ?? {}), includeStandalone: false, changes: {} });
  const activeGoalCount = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").length;
  const blockedCount = blockedActions(state).length;
  const inboxCount = state.inbox.filter((item) => item.status === "unprocessed").length;
  const reviewHistory = mergePagedItems(state.reviews, reviewsPage.data?.items ?? [])
    .filter((review) => review.type === "weekly")
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const nextIndex = event.key === "ArrowRight"
      ? (currentIndex + 1) % reviewTabs.length
      : event.key === "ArrowLeft"
        ? (currentIndex - 1 + reviewTabs.length) % reviewTabs.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? reviewTabs.length - 1
            : undefined;
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextTab = reviewTabs[nextIndex]!;
    setActiveTab(nextTab.id);
    document.getElementById(`weekly-review-tab-${nextTab.id}`)?.focus();
  };

  const complete = async () => {
    if (saving) return;
    if (Object.keys(planDraft.value.changes).length) { setError("Najpierw zapisz lub cofnij przygotowane zmiany terminów."); return; }
    setSaving(true);
    setError("");
    const note = draft.value.note.trim();
    const summary = note ? `${weekly.generatedSummary}\n\nDecyzja na kolejny tydzień: ${note}` : weekly.generatedSummary;
    const saved = await completeReview(summary, "weekly", {
      completedActions: String(weekly.completedActions),
      knowledgeAdded: String(weekly.knowledgeAdded),
      progressUpdates: String(weekly.progressUpdates),
      selectedGoalIds: planDraft.value.selectedGoalIds.filter((id) => state.goals.some((goal) => goal.id === id && goal.status === "active" && goal.visibility === "active")).slice(0, 3)
    }, 2);
    if (saved) draft.clear();
    else setError("Nie udało się zapisać podsumowania. Twoja notatka pozostała zachowana.");
    setSaving(false);
  };

  return (
    <AppShell>
      <PageHeading
        className="weekly-review-page-heading"
        title="Podsumowanie tygodnia"
        eyebrow={`${formatWorkspaceDateRange(weekly.startDate, weekly.endDate)} · aktualizuje się automatycznie`}
        action={completedThisWeek ? <Badge tone="success"><Check />Zapisane</Badge> : <Badge tone="neutral"><RefreshCw />Na żywo</Badge>}
      />
      <div className="weekly-review-workspace">
        <div className="weekly-review-tablist" role="tablist" aria-label="Widoki podsumowania tygodnia">
          {reviewTabs.map((tab, index) => {
            const Icon = tab.icon;
            return <button
              key={tab.id}
              id={`weekly-review-tab-${tab.id}`}
              className="weekly-review-tab"
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`weekly-review-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            ><Icon /><span>{tab.label}</span></button>;
          })}
        </div>

        <div className="weekly-review-tabpanels">
          <div id="weekly-review-panel-summary" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-summary" hidden={activeTab !== "summary"} tabIndex={0}>
            <Panel className="review-main weekly-summary-card">
              <div className="review-intro"><span className="review-intro-icon"><Sparkles /></span><span><small>Podsumowanie systemowe</small><h2>Ten tydzień w skrócie</h2><p>{weekly.generatedSummary}</p></span></div>
              <div className="weekly-metrics" aria-label="Wyniki tygodnia">
                <div><CheckCircle2 /><span><strong>{weekly.completedActions}</strong><small>{polishPluralForm(weekly.completedActions, "ukończone Działanie", "ukończone Działania", "ukończonych Działań")}</small></span></div>
                <div><BookMarked /><span><strong>{weekly.knowledgeAdded}</strong><small>{polishPluralForm(weekly.knowledgeAdded, "dodany element Wiedzy", "dodane elementy Wiedzy", "dodanych elementów Wiedzy")}</small></span></div>
                <div><ListChecks /><span><strong>{weekly.progressUpdates}</strong><small>{polishPluralForm(weekly.progressUpdates, "aktualizacja postępu", "aktualizacje postępu", "aktualizacji postępu")}</small></span></div>
              </div>
              <details className="weekly-summary-mobile-details"><summary>Pełny opis tygodnia</summary><p>{weekly.generatedSummary}</p></details>
            </Panel>

            <Panel className="weekly-decision">
              <div className="section-heading"><div><span className="section-kicker"><CalendarCheck />Twoja decyzja</span><h2>Ustaw kierunek na kolejny tydzień</h2></div></div>
              <p>Podsumowanie jest gotowe. Dopisz tylko jedną decyzję, jeśli chcesz — nie musisz wypełniać checklisty.</p>
              <label className="field-label" htmlFor="review-note">Najważniejsza decyzja <span className="optional-label">opcjonalnie</span></label>
              <textarea id="review-note" rows={2} placeholder="Np. Najpierw odblokowuję budżet, pozostałe Cele czekają." value={draft.value.note} onChange={(event) => draft.setValue({ note: event.target.value })} />
              <div className="weekly-decision-footer"><div><DraftStatus status={draft.status} />{draft.dirty ? <Button variant="ghost" onClick={draft.discard}>Wyczyść</Button> : null}</div></div>
            </Panel>
          </div>

          <div id="weekly-review-panel-plan" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-plan" hidden={activeTab !== "plan"} tabIndex={0}>
            <WeeklyPlanPanel state={state} week={nextWeek} value={planDraft.value} onChange={planDraft.setValue} updateAction={updateAction} createAction={createAction} />
          </div>

          <div id="weekly-review-panel-suggestions" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-suggestions" hidden={activeTab !== "suggestions"} tabIndex={0}>
            <Panel className="weekly-suggestions">
              <div className="section-heading"><div><span className="section-kicker"><Lightbulb />Sugestie</span><h2>Co warto zrobić dalej</h2></div><span>{polishCount(weekly.suggestions.length, "priorytet", "priorytety", "priorytetów")}</span></div>
              <div className="weekly-suggestion-list">
                {weekly.suggestions.map((suggestion, index) => <Link key={suggestion.id} to={suggestion.to}>
                  <span className="suggestion-number">{index + 1}</span>
                  <span><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></span>
                  <ArrowRight />
                </Link>)}
              </div>
            </Panel>
          </div>

          <div id="weekly-review-panel-ai" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-ai" hidden={activeTab !== "ai"} tabIndex={0}>
            <AIGoalReview />
          </div>

          <div id="weekly-review-panel-history" className="weekly-review-tabpanel weekly-history-grid" role="tabpanel" aria-labelledby="weekly-review-tab-history" hidden={activeTab !== "history"} tabIndex={0}>
            <Panel>
              <h2>Historia tygodni</h2>
              {reviewsPage.isPending ? <p className="muted-copy">Ładowanie historii…</p> : reviewHistory.length ? reviewHistory.map((review) => <div className="review-history-item" key={review.id}><strong>Podsumowanie zapisane</strong><small>{reviewFormatter.format(new Date(review.completedAt))}</small><p>{review.summary || "Bez dodatkowej decyzji."}</p>{selectedReviewGoalIds(review.answers).length ? <small>Kierunek: {selectedReviewGoalIds(review.answers).map((id) => state.goals.find((goal) => goal.id === id)?.title ?? "Cel niedostępny").join(", ")}</small> : null}</div>) : <p className="muted-copy">Pierwsze zapisane podsumowanie pojawi się tutaj.</p>}
              {reviewsPage.isError ? <div className="inline-mutation-error" role="alert">Nie udało się pobrać {reviewHistory.length ? "dalszej historii" : "historii tygodni"}. <Button variant="ghost" onClick={() => void reviewsPage.refetch()}>Spróbuj ponownie</Button></div> : null}
              {reviewHistory.length && reviewsPage.hasNextPage ? <Button loading={reviewsPage.isFetchingNextPage} onClick={() => void reviewsPage.fetchNextPage()}>Załaduj starsze</Button> : null}
            </Panel>
            <Panel>
              <h2><RefreshCw />Stan na teraz</h2>
              <div className="review-state-list"><p><strong>{activeGoalCount}</strong><span>{polishPluralForm(activeGoalCount, "aktywny Cel", "aktywne Cele", "aktywnych Celów")}</span></p><p><strong>{blockedCount}</strong><span>{polishPluralForm(blockedCount, "blokada", "blokady", "blokad")}</span></p><p><strong>{inboxCount}</strong><span>{polishPluralForm(inboxCount, "element w Skrzynce", "elementy w Skrzynce", "elementów w Skrzynce")}</span></p></div>
            </Panel>
          </div>
        </div>

        <div className="weekly-review-submit">
          <p className="muted-copy">Zapisz podsumowanie i wybór Celów na kolejny tydzień.</p>
          {error ? <p className="auth-message error" role="alert">{error}</p> : null}
          <Button variant="primary" loading={saving} onClick={() => void complete()}><Check />{completedThisWeek ? "Zapisz ponownie" : "Zamknij tydzień"}</Button>
        </div>
      </div>
    </AppShell>
  );
}
