import { CurrentWeekPlanNotice } from "../components/CurrentWeekPlanNotice";
import { useWorkspaceClock } from "../hooks/useWorkspaceClock";
import { useCurrentWeekPlan } from "../hooks/useCurrentWeekPlan";
import { WeeklyMetricsNotice } from "../components/WeeklyMetricsNotice";
import { ArrowDown, BookMarked, CalendarCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Lightbulb, ListChecks, RefreshCw } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { DraftStatus } from "../components/DraftStatus";
import { horizontalTabIndex } from "../components/horizontalTabIndex";
import { Badge, Button, Panel } from "../components/ui";
import { blockedActions, deriveWeeklyReview } from "../domain/weeklyReview";
import { formatWorkspaceDateRange, localDateForTimeZone } from "../domain/activity";
import { polishPluralForm } from "../domain/labels";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import type { ReviewRecord, WeeklyReviewSnapshot } from "../domain/types";
import { WeeklyPlanPanel, type WeeklyPlanDraft } from "../components/WeeklyPlanPanel";
import { currentWorkspaceWeek, nextWorkspaceWeek, selectedReviewGoalIds, weeklyPlanActions } from "../domain/weeklyPlan";
import type { WeeklyActivityDetail, WeeklyActivityKind } from "../data/workspaceRepository";
import { buildWeeklyReviewMarkdown, weeklyReviewTrendPoints, type WeeklyTrendMetric } from "../domain/weeklyReviewTrends";
import "./review-workspace.css";

const reviewFormatter = new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" });
const reviewTabs = [
  { id: "summary", label: "Tydzień", icon: CalendarCheck },
  { id: "plan", label: "Plan", icon: CalendarDays },
  { id: "history", label: "Historia", icon: RefreshCw }
] as const;
type ReviewTab = typeof reviewTabs[number]["id"];
type PlanningPeriod = "current" | "next";

const activityMetrics = {
  actions: { label: "Ukończone działania", icon: CheckCircle2 },
  knowledge: { label: "Dodana wiedza", icon: BookMarked },
  progress: { label: "Aktualizacje postępu", icon: ListChecks }
} satisfies Record<WeeklyActivityKind, { label: string; icon: typeof CheckCircle2 }>;
const activityKinds = Object.keys(activityMetrics) as WeeklyActivityKind[];
const suggestionCategories: Partial<Record<string, string>> = {
  blocked: "Blokady",
  "next-actions": "Grupy bez następnego kroku",
  overdue: "Zaległe działania",
  inbox: "Skrzynka"
};

interface WeeklyReviewNoteDraft { note: string; pendingRevisionId?: string }

export function ReviewPage() {
  const { state, mode, completeReview, updateAction, setActionStatus, createAction } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const reviewsPage = useWorkspaceInfinitePage<ReviewRecord>("reviews", 100);
  const now = useWorkspaceClock();
  const weekly = useMemo(() => deriveWeeklyReview(state, now, mode), [state, mode, now]);
  const planRead = useCurrentWeekPlan(now);
  const currentPlan = planRead.plan;
  const draft = usePersistentDraft<WeeklyReviewNoteDraft>("weekly-review-note", { note: "" }, 450, { targetId: weekly.startDate, migrateFrom: { kind: "weekly-review-note" } });
  const today = localDateForTimeZone(now, state.workspaceTimezone);
  const currentWeek = currentWorkspaceWeek(now, state.workspaceTimezone);
  const nextWeek = nextWorkspaceWeek(now, state.workspaceTimezone);
  const searchParams = new URLSearchParams(location.search);
  const requestedTab = searchParams.get("tab");
  const planningPeriod: PlanningPeriod = searchParams.get("week") === "current" ? "current" : "next";
  const activeTab = reviewTabs.find((tab) => tab.id === requestedTab)?.id ?? "summary";
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activityKind, setActivityKind] = useState<WeeklyActivityKind | null>(null);
  const closeHeadingRef = useRef<HTMLHeadingElement>(null);
  const [activityProjectFilter, setActivityProjectFilter] = useState("");
  const [activityGoalFilter, setActivityGoalFilter] = useState("");
  const [historyWeekKey, setHistoryWeekKey] = useState("");
  const [historyReviewId, setHistoryReviewId] = useState("");
  const [trendWeeks, setTrendWeeks] = useState<4 | 8 | 12>(4);
  const [trendMetric, setTrendMetric] = useState<WeeklyTrendMetric>("completedActions");
  const [exportIncludePlan, setExportIncludePlan] = useState(true);
  const [exportIncludeDecision, setExportIncludeDecision] = useState(false);
  const latestThisWeek = state.reviews
    .filter((review) => review.type === "weekly" && (review.periodStart ? review.periodStart === weekly.startDate : new Date(review.completedAt) >= weekly.start && new Date(review.completedAt) < weekly.end))
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt) || (right.revision ?? 0) - (left.revision ?? 0))[0];
  const completedThisWeek = Boolean(latestThisWeek);
  const planDraft = usePersistentDraft<WeeklyPlanDraft>(`weekly-plan-${nextWeek.startDate}`, { selectedGoalIds: selectedReviewGoalIds(latestThisWeek?.answers ?? {}), includeStandalone: false, changes: {} });
  const currentPlanDraft = usePersistentDraft<WeeklyPlanDraft>("current-week-plan-dates", { selectedGoalIds: [], includeStandalone: false, changes: {} }, 450, { targetId: `${state.workspaceTimezone}/${currentWeek.startDate}` });
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
  const planForThisWeek = currentPlan;
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
  const executionListComplete = executionPage.isSuccess && !executionPage.hasNextPage;
  const activityItems = activityPage.data?.items ?? [];
  const completedIds = new Set(executionItems.filter((item) => item.kind === "actions").map((item) => item.id));
  const plannedActions = planForThisWeek?.snapshot?.plan.actions ?? [];
  const plannedGoals = planForThisWeek?.snapshot?.plan.selectedGoals ?? [];
  const plannedCompleted = plannedActions.filter((action) => completedIds.has(action.id)).length;
  const unfinishedActions = plannedActions.filter((action) => !completedIds.has(action.id));
  const additionalCompleted = Math.max(0, (executionPage.data?.totalCount ?? 0) - plannedCompleted);
  const weekLabel = formatWorkspaceDateRange(weekly.startDate, weekly.endDate);
  const activityCounts = { actions: weekly.completedActions, knowledge: weekly.knowledgeAdded, progress: weekly.progressUpdates };
  const [primarySuggestion, ...otherSuggestions] = weekly.suggestions.filter((suggestion) => suggestion.id !== "continue");
  const primaryAction = primarySuggestion?.primaryAction;
  const otherPrimaryItems = primarySuggestion?.items?.slice(1) ?? [];
  const hasPendingPlanChanges = Object.keys(planDraft.value.changes).length > 0;
  const selectedGoals = planDraft.value.selectedGoalIds
    .filter((id) => state.goals.some((goal) => goal.id === id && goal.status === "active" && goal.visibility === "active"))
    .slice(0, 3)
    .map((id) => state.goals.find((goal) => goal.id === id))
    .filter((goal): goal is (typeof state.goals)[number] => Boolean(goal));

  const tabHref = (tab: ReviewTab, period?: PlanningPeriod) => {
    const params = new URLSearchParams(location.search);
    params.set("tab", tab);
    if (period === "current") params.set("week", period);
    if (period === "next") params.delete("week");
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
    const nextIndex = horizontalTabIndex(event.key, currentIndex, reviewTabs.length);
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextTab = reviewTabs[nextIndex]!;
    updateTab(nextTab.id);
    document.getElementById(`weekly-review-tab-${nextTab.id}`)?.focus({ preventScroll: true });
  };

  const complete = async () => {
    if (saving || !weekly.metricsAvailable || hasPendingPlanChanges) return;
    setError("");
    const note = draft.value.note.trim();
    const summary = note ? `${weekly.generatedSummary}\n\nDecyzja na kolejny tydzień: ${note}` : weekly.generatedSummary;
    const selectedGoalIds = selectedGoals.map((goal) => goal.id);
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
      setError("Nie udało się przygotować zapisu na tym urządzeniu. Spróbuj ponownie.");
      return;
    }
    setSaving(true);
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
    }).catch(() => false);
    if (saved) draft.clear({ note: "" });
    else setError("Nie udało się zapisać podsumowania. Twoja notatka pozostała zachowana.");
    setSaving(false);
  };

  return (
    <AppShell addAction={{ label: "Dodaj", ariaLabel: "Dodaj" }}>
      <PageHeading title="Podsumowanie tygodnia" />
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
          {activeTab !== "summary" && <CurrentWeekPlanNotice read={planRead} />}
          <div id="weekly-review-panel-summary" className="weekly-review-tabpanel weekly-overview" role="tabpanel" aria-labelledby="weekly-review-tab-summary" hidden={activeTab !== "summary"} tabIndex={0}>
            <header className="weekly-overview-heading">
              <h2>Ten tydzień w skrócie</h2>
              <p>{weekLabel}</p>
              <span className="weekly-overview-status" aria-live="polite">
                {latestThisWeek ? <Badge tone="success"><Check aria-hidden="true" />Zapisano · rew. {latestThisWeek.revision ?? 1}</Badge> : <Badge tone="neutral">Do zapisania</Badge>}
              </span>
              <Button className="weekly-overview-jump" variant="ghost" onClick={() => closeHeadingRef.current?.focus()}>
                Przejdź do zapisu<ArrowDown aria-hidden="true" />
              </Button>
            </header>
            <div className="weekly-overview-layout">
              <Panel className="weekly-overview-results">
                <WeeklyMetricsNotice available={weekly.metricsAvailable} />
                <div className="weekly-overview-metrics" role="group" aria-label="Wyniki tego tygodnia">
                  {activityKinds.map((kind) => {
                    const { label, icon: Icon } = activityMetrics[kind];
                    const count = activityCounts[kind];
                    return <button
                      key={kind}
                      id={`weekly-metric-${kind}`}
                      className="weekly-overview-metric"
                      type="button"
                      aria-label={`${label}: ${weekly.metricsAvailable ? count : "brak aktualnych danych"}`}
                      aria-controls="weekly-activity-panel"
                      aria-expanded={activityKind === kind}
                      onClick={() => toggleActivityDetail(kind)}
                    >
                      <span className="weekly-overview-metric-value"><Icon aria-hidden="true" /><strong>{weekly.metricsAvailable ? count : "—"}</strong></span>
                      <span>{label}</span>
                      <ChevronDown className="weekly-metric-chevron" aria-hidden="true" />
                    </button>;
                  })}
                </div>
                <div id="weekly-activity-panel" hidden={!activityKind}>
                  {activityKind ? <section className="weekly-activity-detail" aria-labelledby="weekly-activity-title">
                    <div className="weekly-activity-detail-heading">
                      <h3 id="weekly-activity-title">{activityMetrics[activityKind].label}</h3>
                      <Button variant="ghost" onClick={() => {
                        document.getElementById(`weekly-metric-${activityKind}`)?.focus();
                        setActivityKind(null);
                      }}>Zamknij</Button>
                    </div>
                    <div className="weekly-activity-filters">
                      <label>Projekt
                        <select aria-label="Filtruj szczegóły po Projekcie" value={activityProjectFilter} onChange={(event) => setActivityProjectFilter(event.target.value)}>
                          <option value="">Wszystkie Projekty</option>
                          {state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                        </select>
                      </label>
                      <label>Grupa działań
                        <select aria-label="Filtruj szczegóły po grupie" value={activityGoalFilter} onChange={(event) => setActivityGoalFilter(event.target.value)}>
                          <option value="">Wszystkie grupy</option>
                          {state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
                        </select>
                      </label>
                    </div>
                    {activityPage.isPending && <p className="muted-copy" role="status">Wczytuję szczegóły tego tygodnia…</p>}
                    {activityPage.isError && <p className="inline-mutation-error" role="alert">
                      Nie udało się pobrać szczegółów. <Button variant="ghost" onClick={() => void activityPage.refetch()}>Spróbuj ponownie</Button>
                    </p>}
                    {activityPage.isSuccess && activityItems.length === 0 && <p className="muted-copy">Brak pasujących wpisów w tym okresie.</p>}
                    {activityItems.length > 0 && <ul className="weekly-activity-list">
                      {activityItems.map((item) => <li key={item.id}>
                        <Link to={activityRoute(item)}>
                          <span><strong>{item.title}</strong>{item.detail && <small>{item.detail}</small>}</span>
                          <time dateTime={item.occurredAt}>{new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeZone: state.workspaceTimezone }).format(new Date(item.occurredAt))}</time>
                        </Link>
                      </li>)}
                    </ul>}
                    {activityPage.data ? <p className="weekly-activity-count">Wyświetlono {activityItems.length} z {activityPage.data.totalCount ?? activityItems.length} wpisów.</p> : null}
                    {activityPage.hasNextPage ? <Button loading={activityPage.isFetchingNextPage} onClick={() => void activityPage.fetchNextPage()}>Pokaż kolejne</Button> : null}
                  </section> : null}
                </div>
                <section className="weekly-overview-section" aria-labelledby="weekly-attention-title">
                  <h3 id="weekly-attention-title">Wymaga decyzji</h3>
                  {primarySuggestion ? <Link className="weekly-overview-row weekly-overview-primary" to={primaryAction?.to ?? primarySuggestion.to}>
                    <Lightbulb aria-hidden="true" />
                    <span><strong>{primaryAction?.title ?? primarySuggestion.title}</strong><small>{primaryAction?.reason?.trim() || primarySuggestion.detail}</small></span>
                    <ChevronRight aria-hidden="true" />
                  </Link> : <p className="muted-copy">Brak spraw wymagających decyzji.</p>}
                  {(otherSuggestions.length > 0 || otherPrimaryItems.length > 0) && <details className="weekly-overview-details">
                    <summary>Pozostałe sprawy<ChevronDown aria-hidden="true" /></summary>
                    <div className="weekly-overview-categories">
                      {otherPrimaryItems.length > 0 && primarySuggestion && <div className="weekly-overview-category">
                        <strong>{suggestionCategories[primarySuggestion.id] ?? primarySuggestion.title}</strong>
                        <ul>{otherPrimaryItems.map((item) => <li key={item.id}><Link to={item.to}>{item.title}</Link></li>)}</ul>
                      </div>}
                      {otherSuggestions.map((suggestion) => <div className="weekly-overview-category" key={suggestion.id}>
                        <Link className="weekly-overview-row" to={suggestion.to}>
                          <span><strong>{suggestionCategories[suggestion.id] ?? suggestion.title}</strong><small>{suggestion.detail}</small></span>
                          {suggestion.count !== undefined && <span className="weekly-overview-category-count">{suggestion.count}</span>}
                          <ChevronRight aria-hidden="true" />
                        </Link>
                        {suggestion.items?.length ? <ul>{suggestion.items.map((item) => <li key={item.id}><Link to={item.to}>{item.title}</Link></li>)}</ul> : null}
                      </div>)}
                    </div>
                  </details>}
                </section>
                <section className="weekly-overview-section" aria-labelledby="weekly-execution-title">
                  <h3 id="weekly-execution-title">Realizacja planu</h3>
                  <CurrentWeekPlanNotice read={planRead} />
                  {!planForThisWeek ? !planRead.pending && !planRead.error && <div className="weekly-overview-plan-empty">
                    <p className="muted-copy">Brak planu na ten tydzień.</p>
                    <Link className="weekly-overview-text-link" to={tabHref("plan", "current")}>Otwórz Plan<ChevronRight aria-hidden="true" /></Link>
                  </div> : executionPage.isPending ? <p className="muted-copy" role="status">Wczytuję wykonanie zapisanego Planu…</p>
                    : executionPage.isError ? <p className="muted-copy" role="alert">
                      Nie udało się pobrać wykonania Planu. <Button variant="ghost" onClick={() => void executionPage.refetch()}>Spróbuj ponownie</Button>
                    </p> : !executionListComplete ? <>
                      <p className="muted-copy">Do dokładnego porównania potrzebuję wczytać wszystkie ukończone Działania.</p>
                      <Button variant="secondary" loading={executionPage.isFetchingNextPage} onClick={() => void executionPage.fetchNextPage()}>Wczytaj dalsze Działania</Button>
                    </> : plannedActions.length ? <>
                    <p className="weekly-overview-comparison">
                      <span><strong>{plannedCompleted} z {plannedActions.length}</strong> zaplanowanych działań ukończono</span>
                      <span><strong>{additionalCompleted}</strong> ukończono poza planem</span>
                    </p>
                    {unfinishedActions.length > 0 && <details className="weekly-overview-details weekly-unfinished-plan">
                      <summary>Nierozstrzygnięte kroki ({unfinishedActions.length})<ChevronDown aria-hidden="true" /></summary>
                      <ul>
                        {unfinishedActions.map((planned) => {
                          const current = state.actions.find((action) => action.id === planned.id);
                          const dateChanged = current && (current.scheduledFor ?? null) !== (planned.scheduledFor ?? null);
                          const status = current?.status === "cancelled" ? "anulowano" : current?.status === "skipped" ? "pominięto" : current?.status === "blocked" ? "zablokowane" : dateChanged ? current.scheduledFor ? `termin zmieniono na ${current.scheduledFor}` : "usunięto termin" : "nieukończone";
                          return <li key={planned.id}>{current ? <Link to={`/actions/${planned.id}`}>{planned.title}</Link> : planned.title}<span>{status}</span></li>;
                        })}
                      </ul>
                    </details>}
                  </> : <p className="muted-copy">Plan nie zawierał działań. Poza planem ukończono <strong>{additionalCompleted}</strong>.</p>}
                  {plannedGoals.length > 0 && <details className="weekly-overview-details">
                    <summary>Grupy działań z planu ({plannedGoals.length})<ChevronDown aria-hidden="true" /></summary>
                    <div className="weekly-overview-goals">
                      {plannedGoals.map((savedGoal) => {
                        const currentGoal = state.goals.find((goal) => goal.id === savedGoal.id);
                        const criteria = state.goalCriteria.filter((criterion) => criterion.goalId === savedGoal.id);
                        const savedCriteria = savedGoal.criteria;
                        const completedForGoal = executionItems.filter((item) => item.goalId === savedGoal.id).length;
                        const changedCriteria = savedCriteria?.filter((before) => criteria.some((now) => now.id === before.id && now.completed !== before.completed)).length ?? 0;
                        const addedCriteria = savedCriteria ? criteria.filter((now) => !savedCriteria.some((before) => before.id === now.id)).length : 0;
                        return <article className="weekly-goal-result" key={savedGoal.id}>
                          {currentGoal ? <Link to={`/goals/${savedGoal.id}`}><strong>{savedGoal.title}</strong><span>{currentGoal.outcome || savedGoal.outcome || "Grupa działań bez opisanego rezultatu"}</span></Link> : <><strong>{savedGoal.title}</strong><span>Grupa działań niedostępna w bieżącej przestrzeni.</span></>}
                          <p>{executionListComplete ? `${completedForGoal} ${polishPluralForm(completedForGoal, "ukończone działanie", "ukończone działania", "ukończonych działań")} w tym tygodniu` : "Liczba ukończonych działań pojawi się po wczytaniu wyników."}</p>
                          <details className="weekly-overview-details"><summary>Kryteria · stan bieżący<ChevronDown aria-hidden="true" /></summary>{savedCriteria === undefined ? <p>Brak historycznego zapisu kryteriów.</p> : !criteria.length && !savedCriteria.length ? <p>Nie zdefiniowano kryteriów.</p> : <><p>{changedCriteria} zmienionych · {addedCriteria} dodanych od zapisu Planu.</p><ul>{criteria.map((criterion) => <li key={criterion.id}>{criterion.completed ? "✓" : "○"} {criterion.title}{savedCriteria.find((before) => before.id === criterion.id)?.completed !== undefined && savedCriteria.find((before) => before.id === criterion.id)?.completed !== criterion.completed ? " · zmieniono" : ""}</li>)}</ul>{savedCriteria.filter((before) => !criteria.some((now) => now.id === before.id)).map((criterion) => <p key={criterion.id}>Usunięto kryterium: {criterion.title}</p>)}</>}</details>
                        </article>;
                      })}
                    </div>
                  </details>}
                </section>
              </Panel>

              <Panel className="weekly-overview-close" aria-labelledby="weekly-review-close-title">
                <h3 id="weekly-review-close-title" ref={closeHeadingRef} tabIndex={-1}>Zamknięcie tygodnia</h3>
                <div className="weekly-overview-note">
                  <label className="field-label" htmlFor="review-note">Najważniejsza decyzja <span className="optional-label">opcjonalnie</span></label>
                  <textarea id="review-note" rows={2} disabled={saving} placeholder="Np. W poniedziałek odblokuję budżet." value={draft.value.note} onChange={(event) => draft.setValue({ ...draft.value, note: event.target.value })} />
                  {draft.status !== "idle" || draft.dirty ? <div className="weekly-overview-draft">
                    <DraftStatus status={draft.status} errorMessage={draft.errorMessage} restored={draft.restored} compact />
                    {draft.dirty && <Button variant="ghost" disabled={saving} onClick={draft.discard}>Wyczyść</Button>}
                  </div> : null}
                </div>
                <details className="weekly-overview-details weekly-overview-preview">
                  <summary>Podgląd zapisu<ChevronDown aria-hidden="true" /></summary>
                  <dl>
                    <div><dt>Tydzień</dt><dd>{weekLabel}</dd></div>
                    <div><dt>Podsumowanie systemowe</dt><dd>{weekly.metricsAvailable ? weekly.generatedSummary : "Brak aktualnych danych tygodnia."}</dd></div>
                    <div><dt>Grupy działań na kolejny tydzień</dt><dd>{selectedGoals.length ? selectedGoals.map((goal) => goal.title).join(", ") : "Nie wybrano grup działań"}</dd></div>
                    <div><dt>Twoja decyzja</dt><dd>{draft.value.note.trim() || "Brak dodatkowej notatki"}</dd></div>
                  </dl>
                  <p className="muted-copy">Treść analizy AI nie jest dopisywana do historii zamknięć.</p>
                </details>
                {hasPendingPlanChanges && <p className="muted-copy" role="status">Aby zapisać podsumowanie, zapisz lub cofnij zmiany terminów w Planie.</p>}
                {error && <p className="auth-message error" role="alert">{error}</p>}
                <div className="weekly-overview-close-actions">
                  <Button variant="primary" loading={saving} disabled={!weekly.metricsAvailable || hasPendingPlanChanges} onClick={() => void complete()}>
                    <Check aria-hidden="true" />{completedThisWeek ? "Zapisz nową rewizję" : "Zapisz podsumowanie"}
                  </Button>
                  <Link className="button button-secondary" to={tabHref("plan", "next")}><CalendarDays aria-hidden="true" />Zaplanuj kolejny tydzień</Link>
                </div>
              </Panel>
            </div>
            <details className="weekly-overview-details weekly-overview-state">
              <summary>Stan przestrzeni na teraz<ChevronDown aria-hidden="true" /></summary>
              <div className="review-state-list"><p><strong>{activeGoalCount}</strong><span>{polishPluralForm(activeGoalCount, "aktywna grupa", "aktywne grupy", "aktywnych grup")}</span></p><p><strong>{blockedCount}</strong><span>{polishPluralForm(blockedCount, "blokada", "blokady", "blokad")}</span></p><p><strong>{inboxCount}</strong><span>{polishPluralForm(inboxCount, "element w Skrzynce", "elementy w Skrzynce", "elementów w Skrzynce")}</span></p></div>
            </details>
          </div>

          <div id="weekly-review-panel-plan" className="weekly-review-tabpanel" role="tabpanel" aria-labelledby="weekly-review-tab-plan" hidden={activeTab !== "plan"} tabIndex={0}>
            <div className="weekly-plan-week-picker" role="group" aria-label="Tydzień planu">
              <button type="button" aria-pressed={planningPeriod === "current"} onClick={() => navigate(tabHref("plan", "current"), { state: location.state })}>Ten tydzień</button>
              <button type="button" aria-pressed={planningPeriod === "next"} onClick={() => navigate(tabHref("plan", "next"), { state: location.state })}>Następny</button>
            </div>
            <div hidden={planningPeriod !== "current"}>
              <WeeklyPlanPanel key={`${state.workspaceTimezone}/${currentWeek.startDate}`} state={state} week={currentWeek} period="current" plannedActionIds={plannedActions.map((action) => action.id)} today={today} value={currentPlanDraft.value} onChange={currentPlanDraft.setValue} updateAction={updateAction} setActionStatus={setActionStatus} createAction={createAction} />
            </div>
            <div hidden={planningPeriod !== "next"}>
              <WeeklyPlanPanel key={`${state.workspaceTimezone}/${nextWeek.startDate}`} state={state} week={nextWeek} today={today} value={planDraft.value} onChange={planDraft.setValue} updateAction={updateAction} setActionStatus={setActionStatus} createAction={createAction} />
            </div>
            <Link className="weekly-plan-text-link" to={tabHref("summary")}>
              Przejdź do zamknięcia tygodnia<ChevronRight aria-hidden="true" />
            </Link>
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

      </div>
    </AppShell>
  );
}
