import { ArrowRight, BookMarked, CalendarCheck, CalendarDays, Check, CheckCircle2, Lightbulb, ListChecks, RefreshCw, Sparkles } from "lucide-react";
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { DraftStatus } from "../components/DraftStatus";
import { Badge, Button, Panel } from "../components/ui";
import { deriveWeeklyReview } from "../domain/weeklyReview";
import { blockedActions } from "../domain/weeklyReview";
import { formatWorkspaceDateRange } from "../domain/activity";
import { polishPluralForm } from "../domain/labels";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import type { ReviewRecord, WeeklyReviewSnapshot } from "../domain/types";
import { AIGoalReview } from "../components/AIGoalReview";
import { WeeklyPlanPanel, type WeeklyPlanDraft } from "../components/WeeklyPlanPanel";
import { nextWorkspaceWeek, selectedReviewGoalIds, weeklyPlanActions } from "../domain/weeklyPlan";
import type { WeeklyActivityDetail, WeeklyActivityKind } from "../data/workspaceRepository";
import { buildWeeklyReviewMarkdown, weeklyReviewTrendPoints, type WeeklyTrendMetric } from "../domain/weeklyReviewTrends";

const reviewFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const reviewTabs = [
  { id: "summary", label: "Tydzień", icon: CalendarCheck, title: "Podsumowanie tygodnia" },
  { id: "plan", label: "Plan", icon: CalendarDays, title: "Plan na kolejny tydzień" },
  { id: "ai", label: "AI", icon: Sparkles, title: "Przegląd Celów z AI" },
  { id: "history", label: "Historia", icon: RefreshCw, title: "Historia i stan przestrzeni" }
] as const;
type ReviewTab = typeof reviewTabs[number]["id"];
const isReviewTab = (value: string | null): value is ReviewTab => reviewTabs.some((tab) => tab.id === value);

interface WeeklyReviewNoteDraft { note: string; pendingRevisionId?: string }

export function ReviewPage() {
  const { state, mode, completeReview, updateAction, setActionStatus, createAction } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const reviewsPage = useWorkspaceInfinitePage<ReviewRecord>("reviews", 100);
  const weekly = useMemo(() => deriveWeeklyReview(mode === "demo" ? { ...state, weeklySummary: undefined } : state), [mode, state]);
  const draft = usePersistentDraft<WeeklyReviewNoteDraft>("weekly-review-note", { note: "" }, 450, { targetId: weekly.startDate, migrateFrom: { kind: "weekly-review-note" } });
  const nextWeek = nextWorkspaceWeek(new Date(), state.workspaceTimezone);
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const activeTab: ReviewTab = isReviewTab(requestedTab) ? requestedTab : "summary";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activityKind, setActivityKind] = useState<WeeklyActivityKind | null>(null);
  const [activityProjectFilter, setActivityProjectFilter] = useState("");
  const [activityGoalFilter, setActivityGoalFilter] = useState("");
  const [historyWeekKey, setHistoryWeekKey] = useState("");
  const [historyReviewId, setHistoryReviewId] = useState("");
  const [trendWeeks, setTrendWeeks] = useState<4 | 8 | 12>(4);
  const [trendMetric, setTrendMetric] = useState<WeeklyTrendMetric>("completedActions");
  const [exportIncludePlan, setExportIncludePlan] = useState(true);
  const [exportIncludeDecision, setExportIncludeDecision] = useState(false);
  const latestThisWeek = state.reviews.filter((review) => review.type === "weekly" && (review.periodStart ? review.periodStart === weekly.startDate : new Date(review.completedAt) >= weekly.start && new Date(review.completedAt) < weekly.end)).sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const completedThisWeek = Boolean(latestThisWeek);
  const planDraft = usePersistentDraft<WeeklyPlanDraft>(`weekly-plan-${nextWeek.startDate}`, { selectedGoalIds: selectedReviewGoalIds(latestThisWeek?.answers ?? {}), includeStandalone: false, changes: {} });
  const activeGoalCount = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").length;
  const blockedCount = blockedActions(state).length;
  const inboxCount = state.inbox.filter((item) => item.status === "unprocessed").length;
  const pagedReviews = reviewsPage.data?.items ?? [];
  const reviewMap = new Map(pagedReviews.map((review) => [review.id, review]));
  for (const review of state.reviews) {
    const paged = reviewMap.get(review.id);
    reviewMap.set(review.id, review.snapshot && !paged?.snapshot ? review : paged ?? review);
  }
  const reviewHistory = [...reviewMap.values()]
    .filter((review) => review.type === "weekly")
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  const historyWeeks = [...reviewHistory.reduce((groups, review) => {
    const key = review.periodStart && review.periodEndExclusive
      ? `${review.periodStart}/${review.periodEndExclusive}/${review.workspaceTimezone ?? ""}`
      : `legacy:${review.id}`;
    const records = groups.get(key) ?? [];
    records.push(review);
    groups.set(key, records);
    return groups;
  }, new Map<string, ReviewRecord[]>())].map(([key, records]) => ({
    key,
    records: records.sort((left, right) => (right.revision ?? 1) - (left.revision ?? 1) || right.completedAt.localeCompare(left.completedAt)),
    label: records[0]?.periodStart && records[0]?.periodEndExclusive
      ? `Tydzień ${formatWorkspaceDateRange(records[0].periodStart, records[0].periodEndExclusive)} · ${records[0].workspaceTimezone ?? "strefa nie zapisana"}`
      : `Starszy zapis · ${reviewFormatter.format(new Date(records[0]!.completedAt))}`
  })).sort((left, right) => (right.records[0]?.completedAt ?? "").localeCompare(left.records[0]?.completedAt ?? ""));
  const selectedHistoryWeek = historyWeeks.find((week) => week.key === historyWeekKey) ?? historyWeeks[0];
  const selectedHistoryReview = selectedHistoryWeek?.records.find((review) => review.id === historyReviewId) ?? selectedHistoryWeek?.records[0];
  const historyTrend = weeklyReviewTrendPoints(reviewHistory, trendWeeks, state.workspaceTimezone);
  const planForThisWeek = reviewHistory
    .filter((review) => review.snapshot?.plan.startDate === weekly.startDate)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
  const executionPage = useWorkspaceInfinitePage<WeeklyActivityDetail>("weekly-activity", 100, {
    activityKind: planForThisWeek ? "actions" : undefined,
    periodStart: weekly.startDate,
    periodEndExclusive: weekly.endDate,
    periodTimeZone: state.workspaceTimezone
  });
  const activityPage = useWorkspaceInfinitePage<WeeklyActivityDetail>("weekly-activity", 100, {
    activityKind: activityKind ?? undefined,
    periodStart: weekly.startDate,
    periodEndExclusive: weekly.endDate,
    periodTimeZone: state.workspaceTimezone,
    activityProjectId: activityKind ? activityProjectFilter || undefined : undefined,
    activityGoalId: activityKind ? activityGoalFilter || undefined : undefined
  });
  const executionItems = executionPage.data?.items ?? [];
  const executionListComplete = !executionPage.hasNextPage;
  const activityItems = activityPage.data?.items ?? [];
  const completedIds = new Set(executionItems.filter((item) => item.kind === "actions").map((item) => item.id));
  const plannedActions = planForThisWeek?.snapshot?.plan.actions ?? [];
  const plannedCompleted = plannedActions.filter((action) => completedIds.has(action.id)).length;
  const additionalCompleted = Math.max(0, (executionPage.data?.totalCount ?? 0) - plannedCompleted);
  const selectedGoals = planDraft.value.selectedGoalIds
    .filter((id) => state.goals.some((goal) => goal.id === id && goal.status === "active" && goal.visibility === "active"))
    .slice(0, 3)
    .map((id) => state.goals.find((goal) => goal.id === id))
    .filter((goal): goal is (typeof state.goals)[number] => Boolean(goal));

  const tabHref = (tab: ReviewTab) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    return `${location.pathname}?${params.toString()}${location.hash}`;
  };
  const updateTab = (tab: ReviewTab) => {
    navigate(tabHref(tab), { state: location.state });
  };

  const toggleActivityDetail = (kind: WeeklyActivityKind) => {
    setActivityProjectFilter("");
    setActivityGoalFilter("");
    setActivityKind((current) => current === kind ? null : kind);
  };

  const activityRoute = (item: WeeklyActivityDetail) => item.kind === "actions"
    ? `/actions/${item.id}`
    : item.kind === "knowledge"
      ? `/knowledge/${item.id}`
      : item.goalId ? `/goals/${item.goalId}` : "/goals";

  const downloadWeeklyReview = (review: ReviewRecord) => {
    if (!review.snapshot) return;
    const contents = buildWeeklyReviewMarkdown(review, { includeDecision: exportIncludeDecision, includePlan: exportIncludePlan });
    const blobUrl = URL.createObjectURL(new Blob([contents], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `podsumowanie-tygodnia-${review.periodStart ?? review.snapshot.period.startDate}-r${review.revision ?? 1}.md`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  };

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
    updateTab(nextTab.id);
    document.getElementById(`weekly-review-tab-${nextTab.id}`)?.focus();
  };

  const complete = async () => {
    if (saving) return;
    if (Object.keys(planDraft.value.changes).length) { setError("Najpierw zapisz lub cofnij przygotowane zmiany terminów."); return; }
    setSaving(true);
    setError("");
    const note = draft.value.note.trim();
    const summary = note ? `${weekly.generatedSummary}\n\nDecyzja na kolejny tydzień: ${note}` : weekly.generatedSummary;
    const selectedGoalIds = planDraft.value.selectedGoalIds.filter((id) => state.goals.some((goal) => goal.id === id && goal.status === "active" && goal.visibility === "active")).slice(0, 3);
    const planActions = weeklyPlanActions(state, selectedGoalIds, planDraft.value.includeStandalone, nextWeek.dates);
    const snapshot: WeeklyReviewSnapshot = {
      version: 1,
      period: { startDate: weekly.startDate, endDateExclusive: weekly.endDate, timeZone: state.workspaceTimezone },
      metrics: { completedActions: weekly.completedActions, knowledgeAdded: weekly.knowledgeAdded, progressUpdates: weekly.progressUpdates },
      summary,
      note,
      plan: {
        startDate: nextWeek.startDate,
        endDateExclusive: nextWeek.endDateExclusive,
        selectedGoals: selectedGoals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          outcome: goal.outcome,
          criteria: state.goalCriteria.filter((criterion) => criterion.goalId === goal.id).map((criterion) => ({ id: criterion.id, title: criterion.title, completed: criterion.completed }))
        })),
        includeStandalone: planDraft.value.includeStandalone,
        actions: planActions.map((action) => ({ id: action.id, title: action.title, goalId: action.goalId, scheduledFor: action.scheduledFor, status: action.status, version: action.version }))
      }
    };
    const pendingRevisionId = draft.value.pendingRevisionId ?? crypto.randomUUID();
    if (!draft.value.pendingRevisionId) draft.setValue({ ...draft.value, pendingRevisionId });
    if (!draft.flush()) {
      setError("Nie udało się zachować identyfikatora zapisu na tym urządzeniu. Spróbuj ponownie.");
      setSaving(false);
      return;
    }
    const saved = await completeReview(summary, "weekly", {
      completedActions: String(weekly.completedActions),
      knowledgeAdded: String(weekly.knowledgeAdded),
      progressUpdates: String(weekly.progressUpdates),
      selectedGoalIds
    }, 3, pendingRevisionId, {
      periodStart: weekly.startDate,
      periodEndExclusive: weekly.endDate,
      workspaceTimezone: state.workspaceTimezone,
      snapshot
    });
    if (saved) draft.clear({ note: "" });
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
              onClick={() => updateTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            ><Icon /><span>{tab.label}</span></button>;
          })}
        </div>

        <div className="weekly-review-tabpanels">
          <div id="weekly-review-panel-summary" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-summary" hidden={activeTab !== "summary"} tabIndex={0}>
            <Panel className="review-main weekly-summary-card">
              <div className="review-intro"><span className="review-intro-icon"><Sparkles /></span><span><small>Podsumowanie systemowe</small><h2>Ten tydzień w skrócie</h2><p>{weekly.generatedSummary}</p></span></div>
              <div className="weekly-metrics" aria-label="Wyniki tego tygodnia">
                <div role="group" aria-label={`${weekly.completedActions} ${polishPluralForm(weekly.completedActions, "ukończone Działanie", "ukończone Działania", "ukończonych Działań")}`}><button className="weekly-metric-button" type="button" aria-expanded={activityKind === "actions"} onClick={() => toggleActivityDetail("actions")}><CheckCircle2 /><span><strong>{weekly.completedActions}</strong><small>Ukończone</small></span></button></div>
                <div role="group" aria-label={`${weekly.knowledgeAdded} ${polishPluralForm(weekly.knowledgeAdded, "dodany element Wiedzy", "dodane elementy Wiedzy", "dodanych elementów Wiedzy")}`}><button className="weekly-metric-button" type="button" aria-expanded={activityKind === "knowledge"} onClick={() => toggleActivityDetail("knowledge")}><BookMarked /><span><strong>{weekly.knowledgeAdded}</strong><small>Wiedza</small></span></button></div>
                <div role="group" aria-label={`${weekly.progressUpdates} ${polishPluralForm(weekly.progressUpdates, "aktualizacja postępu", "aktualizacje postępu", "aktualizacji postępu")}`}><button className="weekly-metric-button" type="button" aria-expanded={activityKind === "progress"} onClick={() => toggleActivityDetail("progress")}><ListChecks /><span><strong>{weekly.progressUpdates}</strong><small>Postęp</small></span></button></div>
              </div>
              {activityKind ? <section className="weekly-activity-detail" aria-label={`Szczegóły: ${activityKind === "actions" ? "ukończone Działania" : activityKind === "knowledge" ? "dodana Wiedza" : "aktualizacje postępu"}`}>
                <div className="weekly-activity-detail-heading"><div><span className="section-kicker">{formatWorkspaceDateRange(weekly.startDate, weekly.endDate)} · {state.workspaceTimezone}</span><h3>{activityKind === "actions" ? "Ukończone Działania" : activityKind === "knowledge" ? "Dodana Wiedza" : "Aktualizacje postępu"}</h3></div><Button variant="ghost" onClick={() => setActivityKind(null)}>Zamknij</Button></div>
                <div className="weekly-activity-filters">
                  <label>Projekt<select aria-label="Filtruj szczegóły po Projekcie" value={activityProjectFilter} onChange={(event) => setActivityProjectFilter(event.target.value)}><option value="">Wszystkie Projekty</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
                  <label>Cel<select aria-label="Filtruj szczegóły po Celu" value={activityGoalFilter} onChange={(event) => setActivityGoalFilter(event.target.value)}><option value="">Wszystkie Cele</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
                </div>
                {activityPage.isPending ? <p className="muted-copy">Wczytuję szczegóły tego tygodnia…</p> : null}
                {activityPage.isError ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać szczegółów. <Button variant="ghost" onClick={() => void activityPage.refetch()}>Spróbuj ponownie</Button></p> : null}
                {!activityPage.isPending && !activityPage.isError && !activityItems.length ? <p className="muted-copy">Brak pasujących wpisów w tym okresie.</p> : null}
                <ul className="weekly-activity-list">{activityItems.map((item) => <li key={item.id}><Link to={activityRoute(item)}><span><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}</span><time dateTime={item.occurredAt}>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeZone: state.workspaceTimezone }).format(new Date(item.occurredAt))}</time><ArrowRight /></Link></li>)}</ul>
                {activityPage.data ? <p className="weekly-activity-count">Wyświetlono {activityItems.length} z {activityPage.data.totalCount ?? activityItems.length} wpisów.</p> : null}
                {activityPage.hasNextPage ? <Button loading={activityPage.isFetchingNextPage} onClick={() => void activityPage.fetchNextPage()}>Pokaż kolejne</Button> : null}
              </section> : null}
              <section className="weekly-execution-summary" aria-labelledby="weekly-execution-title">
                <div><span className="section-kicker"><ListChecks />Plan kontra wykonanie</span><h3 id="weekly-execution-title">Realizacja tygodnia</h3></div>
                {!planForThisWeek ? <p>Brak zapisanego Planu na ten tydzień — nie ma podstaw do porównania.</p> : executionPage.isPending ? <p>Wczytuję wykonanie zapisanego Planu…</p> : executionPage.isError ? <p role="alert">Nie udało się pobrać wykonania Planu. <Button variant="ghost" onClick={() => void executionPage.refetch()}>Spróbuj ponownie</Button></p> : !executionListComplete ? <><p>Do dokładnego porównania potrzebuję wczytać wszystkie ukończone Działania.</p><Button variant="secondary" loading={executionPage.isFetchingNextPage} onClick={() => void executionPage.fetchNextPage()}>Wczytaj dalsze Działania</Button></> : plannedActions.length ? <>
                  <div className="weekly-execution-counts"><p><strong>{plannedCompleted} z {plannedActions.length}</strong><span>zaplanowanych Działań ukończono</span></p><p><strong>{additionalCompleted}</strong><span>ukończonych poza Planem</span></p></div>
                  {plannedActions.some((action) => !completedIds.has(action.id)) ? <details className="weekly-unfinished-plan"><summary>Nierozstrzygnięte kroki ({plannedActions.filter((action) => !completedIds.has(action.id)).length})</summary><ul>{plannedActions.filter((action) => !completedIds.has(action.id)).map((planned) => {
                    const current = state.actions.find((action) => action.id === planned.id);
                    const status = current?.status === "cancelled" ? "anulowano" : current?.status === "skipped" ? "pominięto" : current?.status === "blocked" ? "zablokowane" : current?.scheduledFor && current.scheduledFor !== planned.scheduledFor ? `termin zmieniono na ${current.scheduledFor}` : "nieukończone";
                    return <li key={planned.id}>{current ? <Link to={`/actions/${planned.id}`}>{planned.title}</Link> : planned.title}<span>{status}</span></li>;
                  })}</ul></details> : null}
                </> : <p>Ten Plan nie zawierał zapisanych Działań.</p>}
              </section>
              {planForThisWeek?.snapshot?.plan.selectedGoals.length ? <section className="weekly-goal-results" aria-labelledby="weekly-goal-results-title">
                <div><span className="section-kicker">Rezultaty i kryteria</span><h3 id="weekly-goal-results-title">Cele z Planu</h3></div>
                {planForThisWeek.snapshot.plan.selectedGoals.map((savedGoal) => {
                  const currentGoal = state.goals.find((goal) => goal.id === savedGoal.id);
                  const criteria = state.goalCriteria.filter((criterion) => criterion.goalId === savedGoal.id);
                  const savedCriteria = savedGoal.criteria;
                  const completedForGoal = executionItems.filter((item) => item.goalId === savedGoal.id).length;
                  const changedCriteria = savedCriteria?.filter((before) => criteria.some((now) => now.id === before.id && now.completed !== before.completed)).length ?? 0;
                  const addedCriteria = savedCriteria ? criteria.filter((now) => !savedCriteria.some((before) => before.id === now.id)).length : 0;
                  return <article className="weekly-goal-result" key={savedGoal.id}>
                    {currentGoal ? <Link to={`/goals/${savedGoal.id}`}><strong>{savedGoal.title}</strong><span>{currentGoal.outcome || savedGoal.outcome || "Cel bez opisanego rezultatu"}</span></Link> : <><strong>{savedGoal.title}</strong><span>Cel niedostępny w bieżącej przestrzeni.</span></>}
                    <p>{executionListComplete ? `${completedForGoal} ukończonych Działań w tym tygodniu` : "Wynik Działań będzie pełny po wczytaniu wszystkich stron."}</p>
                    <details><summary>Kryteria · stan bieżący</summary>{savedCriteria === undefined ? <p>Brak historycznego zapisu kryteriów.</p> : !criteria.length && !savedCriteria.length ? <p>Nie zdefiniowano kryteriów.</p> : <><p>{changedCriteria} zmienionych · {addedCriteria} dodanych od zapisu Planu.</p><ul>{criteria.map((criterion) => <li key={criterion.id}>{criterion.completed ? "✓" : "○"} {criterion.title}{savedCriteria.find((before) => before.id === criterion.id)?.completed !== undefined && savedCriteria.find((before) => before.id === criterion.id)?.completed !== criterion.completed ? " · zmieniono" : ""}</li>)}</ul>{savedCriteria.filter((before) => !criteria.some((now) => now.id === before.id)).map((criterion) => <p key={criterion.id}>Usunięto kryterium: {criterion.title}</p>)}</>}</details>
                  </article>;
                })}
              </section> : null}
              {weekly.suggestions[0] ? <section className="weekly-primary-suggestion" aria-labelledby="weekly-attention-title">
                <div className="weekly-attention-heading"><h3 id="weekly-attention-title"><Lightbulb />Wymaga decyzji</h3><span>{weekly.suggestions.length} {polishPluralForm(weekly.suggestions.length, "kategoria", "kategorie", "kategorii")}</span></div>
                <span className="weekly-primary-suggestion-source"><Lightbulb />Sugestia na podstawie bieżących danych</span>
                <Link className="weekly-primary-suggestion-link" to={weekly.suggestions[0].to}><span><strong>{weekly.suggestions[0].title}</strong><small>{weekly.suggestions[0].detail}</small></span><ArrowRight /></Link>
                {weekly.suggestions.length > 1 ? <details className="weekly-other-suggestions">
                  <summary>Zobacz wszystkie sprawy ({weekly.suggestions.slice(1).reduce((sum, suggestion) => sum + (suggestion.count ?? 0), 0)})</summary>
                  <p className="weekly-signal-note">Suma kategorii to liczba sygnałów; to samo Działanie może pojawić się w więcej niż jednej kategorii.</p>
                  <div className="weekly-suggestion-list">{weekly.suggestions.slice(1).map((suggestion) => <div className="weekly-suggestion-group" key={suggestion.id}><Link to={suggestion.to}><span><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></span><ArrowRight /></Link>{suggestion.items?.length ? <ul>{suggestion.items.map((item) => <li key={item.id}><Link to={item.to}>{item.title}</Link></li>)}</ul> : null}</div>)}</div>
                </details> : null}
                {weekly.suggestions.length === 1 && weekly.suggestions[0].id === "continue" ? <p className="weekly-signal-note">Nie wykryto zaległości, blokad, Celów bez kroku ani nowych elementów w Skrzynce.</p> : null}
              </section> : null}
              <details className="weekly-summary-mobile-details"><summary>Pełny opis tygodnia</summary><p>{weekly.generatedSummary}</p></details>
            </Panel>

            <Panel className="weekly-decision">
              <div className="section-heading"><div><span className="section-kicker"><CalendarCheck />Twoja decyzja</span><h2>Ustaw kierunek na kolejny tydzień</h2></div></div>
              <p>Podsumowanie jest gotowe. Dopisz tylko jedną decyzję, jeśli chcesz — nie musisz wypełniać checklisty.</p>
              <label className="field-label" htmlFor="review-note">Najważniejsza decyzja <span className="optional-label">opcjonalnie</span></label>
              <textarea id="review-note" rows={2} disabled={saving} placeholder="Np. Najpierw odblokowuję budżet, pozostałe Cele czekają." value={draft.value.note} onChange={(event) => draft.setValue({ ...draft.value, note: event.target.value })} />
              <div className="weekly-decision-footer"><div><DraftStatus status={draft.status} />{draft.dirty ? <Button variant="ghost" onClick={draft.discard}>Wyczyść</Button> : null}</div></div>
              <Link className="button button-primary weekly-next-plan-link" to={tabHref("plan")}><CalendarDays />Zaplanuj kolejny tydzień<ArrowRight /></Link>
            </Panel>
            <details className="weekly-current-state">
              <summary>Stan przestrzeni na teraz</summary>
              <div className="review-state-list"><p><strong>{activeGoalCount}</strong><span>{polishPluralForm(activeGoalCount, "aktywny Cel", "aktywne Cele", "aktywnych Celów")}</span></p><p><strong>{blockedCount}</strong><span>{polishPluralForm(blockedCount, "blokada", "blokady", "blokad")}</span></p><p><strong>{inboxCount}</strong><span>{polishPluralForm(inboxCount, "element w Skrzynce", "elementy w Skrzynce", "elementów w Skrzynce")}</span></p></div>
            </details>
          </div>

          <div id="weekly-review-panel-plan" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-plan" hidden={activeTab !== "plan"} tabIndex={0}>
            <WeeklyPlanPanel state={state} week={nextWeek} value={planDraft.value} onChange={planDraft.setValue} updateAction={updateAction} setActionStatus={setActionStatus} createAction={createAction} />
            <Link className="weekly-plan-close-link" to={tabHref("summary")}>Przejdź do zamknięcia tygodnia<ArrowRight /></Link>
          </div>

          <div id="weekly-review-panel-ai" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-ai" hidden={activeTab !== "ai"} tabIndex={0}>
            <AIGoalReview />
          </div>

          <div id="weekly-review-panel-history" className="weekly-review-tabpanel weekly-history-grid" role="tabpanel" aria-labelledby="weekly-review-tab-history" hidden={activeTab !== "history"} tabIndex={0}>
            <Panel>
              <h2>Historia tygodni</h2>
              {reviewsPage.isPending ? <p className="muted-copy">Ładowanie historii…</p> : historyWeeks.length ? <>
                <div className="review-history-selectors">
                  <label>Tydzień<select aria-label="Wybierz tydzień historii" value={selectedHistoryWeek?.key ?? ""} onChange={(event) => {
                    const nextWeek = historyWeeks.find((candidate) => candidate.key === event.target.value);
                    setHistoryWeekKey(nextWeek?.key ?? "");
                    setHistoryReviewId(nextWeek?.records[0]?.id ?? "");
                  }}>{historyWeeks.map((week) => <option key={week.key} value={week.key}>{week.label}</option>)}</select></label>
                  {selectedHistoryWeek ? <label>Rewizja<select aria-label="Wybierz rewizję podsumowania" value={selectedHistoryReview?.id ?? ""} onChange={(event) => setHistoryReviewId(event.target.value)}>{selectedHistoryWeek.records.map((review) => <option key={review.id} value={review.id}>Rewizja {review.revision ?? 1} · {reviewFormatter.format(new Date(review.completedAt))}</option>)}</select></label> : null}
                </div>
                {selectedHistoryReview ? <div className="review-history-item" aria-live="polite">
                  <strong>{selectedHistoryReview.periodStart && selectedHistoryReview.periodEndExclusive ? `Tydzień ${formatWorkspaceDateRange(selectedHistoryReview.periodStart, selectedHistoryReview.periodEndExclusive)} · ${selectedHistoryReview.workspaceTimezone ?? "strefa nie zapisana"} · rewizja ${selectedHistoryReview.revision ?? 1}` : "Okres historyczny nie zapisany"}</strong>
                  <small>Zapisano {reviewFormatter.format(new Date(selectedHistoryReview.completedAt))}</small>
                  <p>{selectedHistoryReview.summary || "Bez dodatkowej decyzji."}</p>
                  {selectedHistoryReview.snapshot ? <>
                    <div className="review-history-snapshot"><strong>Stan zapisany w tej rewizji</strong><span>{selectedHistoryReview.snapshot.metrics.completedActions} ukończonych Działań · {selectedHistoryReview.snapshot.metrics.knowledgeAdded} elementów Wiedzy · {selectedHistoryReview.snapshot.metrics.progressUpdates} aktualizacji postępu</span></div>
                    {selectedHistoryReview.snapshot.note ? <p><strong>Decyzja:</strong> {selectedHistoryReview.snapshot.note}</p> : null}
                    {selectedHistoryReview.snapshot.plan.selectedGoals.length ? <small>Kierunek: {selectedHistoryReview.snapshot.plan.selectedGoals.map((goal) => goal.title).join(", ")}</small> : null}
                    {selectedHistoryReview.snapshot.plan.actions.length ? <details className="review-history-plan"><summary>Zapisany Plan ({selectedHistoryReview.snapshot.plan.actions.length})</summary><ul>{selectedHistoryReview.snapshot.plan.actions.map((action) => <li key={action.id}>{action.title}{action.scheduledFor ? ` · ${action.scheduledFor}` : " · bez terminu"}</li>)}</ul></details> : <p className="muted-copy">Ta rewizja nie zawiera kroków Planu.</p>}
                    <details className="review-export-options"><summary>Eksportuj tę rewizję do Markdown</summary>
                      <label><input type="checkbox" checked={exportIncludePlan} onChange={(event) => setExportIncludePlan(event.target.checked)} />Dołącz zapisany Plan</label>
                      <label><input type="checkbox" checked={exportIncludeDecision} onChange={(event) => setExportIncludeDecision(event.target.checked)} />Dołącz prywatną decyzję</label>
                      <p>Analiza AI nie jest częścią migawki i nie trafi do tego eksportu.</p>
                      <Button variant="secondary" onClick={() => downloadWeeklyReview(selectedHistoryReview)}>Pobierz Markdown</Button>
                    </details>
                  </> : <p className="muted-copy">Starszy format zapisu nie zawiera migawki. Zachowano tylko dostępną treść podsumowania.</p>}
                </div> : null}
                <section className="weekly-review-trends" aria-labelledby="weekly-review-trends-title">
                  <div className="weekly-review-trends-heading"><div><span className="section-kicker">Tylko zapisane migawki</span><h3 id="weekly-review-trends-title">Trendy tygodniowe</h3></div></div>
                  <div className="weekly-review-trend-filters"><label>Zakres<select aria-label="Zakres trendów tygodniowych" value={trendWeeks} onChange={(event) => setTrendWeeks(Number(event.target.value) as 4 | 8 | 12)}><option value={4}>4 tygodnie</option><option value={8}>8 tygodni</option><option value={12}>12 tygodni</option></select></label><label>Metryka<select aria-label="Metryka trendu" value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as WeeklyTrendMetric)}><option value="completedActions">Ukończone Działania</option><option value="knowledgeAdded">Dodana Wiedza</option><option value="progressUpdates">Aktualizacje postępu</option></select></label></div>
                  <div className="weekly-review-trend-chart" role="img" aria-label={`Wykres: ${trendMetric === "completedActions" ? "ukończone Działania" : trendMetric === "knowledgeAdded" ? "dodana Wiedza" : "aktualizacje postępu"} na tydzień`}>
                    {historyTrend.map((point) => {
                      const value = point.metrics?.[trendMetric];
                      const max = Math.max(1, ...historyTrend.map((entry) => entry.metrics?.[trendMetric] ?? 0));
                      return <div className={`weekly-review-trend-row${point.missing ? " is-missing" : ""}${point.partial ? " is-partial" : ""}`} key={point.startDate}><span>{point.startDate.slice(5)}</span><span className="weekly-review-trend-track"><span style={{ width: value === undefined ? "0%" : `${Math.max(value ? 4 : 0, (value / max) * 100)}%` }} /></span><strong>{value ?? "—"}</strong></div>;
                    })}
                  </div>
                  <div className="weekly-review-trend-table-wrap"><table className="weekly-review-trend-table"><thead><tr><th scope="col">Tydzień</th><th scope="col">Działania</th><th scope="col">Wiedza</th><th scope="col">Postęp</th><th scope="col">Stan</th></tr></thead><tbody>{historyTrend.map((point) => <tr key={point.startDate}><th scope="row">{formatWorkspaceDateRange(point.startDate, point.endDateExclusive)}</th><td>{point.metrics?.completedActions ?? "—"}</td><td>{point.metrics?.knowledgeAdded ?? "—"}</td><td>{point.metrics?.progressUpdates ?? "—"}</td><td>{point.differentTimeZone ? `Inna strefa${point.timeZone ? ` (${point.timeZone})` : ""}` : point.missing ? point.partial ? "W toku · brak migawki" : "Brak zapisu" : point.partial ? `W toku · rewizja ${point.revision ?? 1}` : `Pełny · rewizja ${point.revision ?? 1}`}</td></tr>)}</tbody></table></div>
                  {reviewsPage.hasNextPage ? <div className="weekly-review-trend-more"><p>Wczytano pierwszą stronę zapisów. Użyj przycisku poniżej, aby uzupełnić starsze tygodnie.</p></div> : null}
                  <p className="muted-copy">Brak zapisu i inna strefa są oznaczone oddzielnie. Liczniki opisują aktywność, nie wartość ani skuteczność pracy.</p>
                </section>
              </> : <div className="review-history-empty"><p className="muted-copy">Pierwsze zapisane podsumowanie pojawi się tutaj.</p><Link className="button button-secondary" to={tabHref("summary")}>Wróć do Tygodnia</Link></div>}
              {reviewsPage.isError ? <div className="inline-mutation-error" role="alert">Nie udało się pobrać {reviewHistory.length ? "dalszej historii" : "historii tygodni"}. <Button variant="ghost" onClick={() => void reviewsPage.refetch()}>Spróbuj ponownie</Button></div> : null}
              {reviewsPage.hasNextPage ? <Button loading={reviewsPage.isFetchingNextPage} onClick={() => void reviewsPage.fetchNextPage()}>{reviewHistory.length ? "Załaduj starsze zapisy" : "Wczytaj wcześniejsze tygodnie"}</Button> : null}
            </Panel>
          </div>
        </div>

        {activeTab === "summary" || activeTab === "plan" ? <Panel className="weekly-review-submit" aria-labelledby="weekly-review-submit-title">
          <div className="weekly-review-submit-heading"><span className="section-kicker"><CalendarCheck />Zamknięcie tygodnia</span><h2 id="weekly-review-submit-title">Co zapisze zamknięcie</h2></div>
          <details className="weekly-close-details"><summary>Podgląd zapisu</summary><div className="weekly-close-preview">
            <div><strong>Tydzień</strong><span>{formatWorkspaceDateRange(weekly.startDate, weekly.endDate)}</span></div>
            <div><strong>Podsumowanie systemowe</strong><span>{weekly.generatedSummary}</span></div>
            <div><strong>Liczniki</strong><span>{weekly.completedActions} ukończonych Działań · {weekly.knowledgeAdded} dodanych elementów Wiedzy · {weekly.progressUpdates} aktualizacji postępu</span></div>
            <div><strong>Cele na kolejny tydzień</strong><span>{selectedGoals.length ? selectedGoals.map((goal) => goal.title).join(", ") : "Nie wybrano Celów"}</span>{!selectedGoals.length ? <Link to={tabHref("plan")}>Wybierz Cele w Planie</Link> : null}</div>
            <div><strong>Twoja decyzja</strong><span>{draft.value.note.trim() || "Brak dodatkowej notatki"}</span></div>
          </div><p className="muted-copy">Treść analizy AI nie jest dopisywana do historii zamknięć.</p></details>
          {Object.keys(planDraft.value.changes).length ? <p className="muted-copy" role="status">Najpierw zapisz lub cofnij przygotowane zmiany terminów.</p> : null}
          {error ? <p className="auth-message error" role="alert">{error}</p> : null}
          <Button variant="primary" loading={saving} onClick={() => void complete()}><Check />{completedThisWeek || error ? "Zapisz nową rewizję" : "Zapisz podsumowanie"}</Button>
        </Panel> : null}
      </div>
    </AppShell>
  );
}
