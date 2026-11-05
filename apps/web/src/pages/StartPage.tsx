import { ReturnToWork } from "../components/ReturnToWork";
import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { CurrentWeekPlanNotice } from "../components/CurrentWeekPlanNotice";
import { KnowledgeRevisitSignal } from "../components/KnowledgeRevisitSignal";
import { useWorkspaceClock } from "../hooks/useWorkspaceClock";
import { useCurrentWeekPlan } from "../hooks/useCurrentWeekPlan";
import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CalendarClock, ChevronRight, Plus } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionStatusDialog, type ProjectActionStatus } from "../components/ActionStatusControls";
import { ActionSignals } from "../components/ActionSignals";
import { useActionFeedback } from "../components/action-feedback-context";
import { Button, EmptyState, Panel } from "../components/ui";
import { deriveHomeSummary } from "../domain/homeSummary";
import type { GoalAction } from "../domain/types";
import { routeForEntity } from "../domain/routes";
import { describeActionContext, describeCompactActionContext, resolveActionContext, type ActionContext } from "../domain/actionContext";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { completeActionWithUndo } from "../components/completeActionWithUndo";
import { getFirstFlowSnapshot, recordFirstFlowStage } from "../lib/firstFlow";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId } from "../domain/navigation";
import { actionStatusLabels, polishCount } from "../domain/labels";
import { AIStartGuidance } from "../components/AIStartGuidance";
import { resolveRoutineTitle } from "../domain/actionPresentation";

function StartActionRow({ action, context, relationSummary, openStatus, onComplete, busy, error, retry, breadcrumbs, returnTo, timeZone, today, routineTitle }: {
  action: GoalAction;
  context: ActionContext;
  relationSummary: string[];
  openStatus: (actionId: string) => void;
  onComplete: (action: GoalAction) => void;
  busy: boolean;
  error?: string;
  retry?: () => Promise<boolean>;
  breadcrumbs: Array<{ label: string; to?: string }>;
  returnTo: string;
  timeZone: string;
  today: string;
  routineTitle?: string;
}) {
  const compactContext = describeCompactActionContext(context);
  return <div className={`today-action ${action.status}`} data-navigation-card-id={navigationCardId("action", action.id)} tabIndex={-1}>
    <div className="today-action-complete">{action.status !== "completed" && action.status !== "cancelled" && action.status !== "skipped" && action.status !== "blocked" ? <ActionPrimaryControls action={action} busy={busy} onToggleComplete={() => onComplete(action)} /> : null}</div>
    <div className="action-copy"><div className="action-title-row"><NavigationLink to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}><strong>{action.title}</strong></NavigationLink>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><ActionSignals action={action} timeZone={timeZone} today={today} routineTitle={routineTitle} density="compact" disabled={busy} onOpenStatus={() => openStatus(action.id)} /><small className="action-context-full">{context.to !== "/" ? <NavigationLink to={context.to} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}>{describeActionContext(context)}</NavigationLink> : describeActionContext(context)}</small><small className="action-context-compact">{context.to !== "/" ? <NavigationLink to={context.to} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}>{compactContext}</NavigationLink> : compactContext}</small>{relationSummary.length ? <small className="action-relation-summary">{relationSummary.join(" · ")}</small> : null}</div>
    {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void retry?.()}>Spróbuj ponownie</button></p> : null}
  </div>;
}

export function StartPage() {
  const { state, mode, setActionStatus, undoActionCompletion, materializeRecurring } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const materializeOnMount = useRef(materializeRecurring);
  const [statusActionId, setStatusActionId] = useState<string>();
  const [resultActionId, setResultActionId] = useState<string>();
  const now = useWorkspaceClock();
  const planRead = useCurrentWeekPlan(now);
  const currentPlan = planRead.plan;
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const summary = useMemo(() => deriveHomeSummary(state, now, mode, currentPlan?.snapshot?.plan.selectedGoals.map((goal) => goal.id)), [state, now, mode, currentPlan]);
  const firstFlow = getFirstFlowSnapshot();
  const hasCompletedAction = state.actions.some((action) => action.status === "completed");
  const showAll = (key: string) => searchParams.get("show") === key;

  useEffect(() => { void materializeOnMount.current(currentDate); }, [currentDate]);
  useEffect(() => {
    if (summary.isPristineWorkspace) recordFirstFlowStage("empty-workspace");
    if (hasCompletedAction && firstFlow.stage !== "unknown") recordFirstFlowStage("first-action-completed");
  }, [firstFlow.stage, hasCompletedAction, summary.isPristineWorkspace]);

  const changeActionStatus = (action: GoalAction, status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => mutation.run(`start-status:${action.id}`, async () => {
    const previous = { status: action.status, blocker: action.blocker, reviewOn: action.reviewOn };
    await setActionStatus(action.id, status, blocker, action.version, reviewOn);
    notifyUndo({ message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker, action.version + 1, previous.reviewOn ?? null), action: status === "completed" && !state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result") ? { label: "Dodaj rezultat", onClick: () => setResultActionId(action.id) } : undefined });
  });
  const completeAction = (action: GoalAction) => mutation.run(`start-status:${action.id}`, () => completeActionWithUndo({
    action,
    setActionStatus,
    undoActionCompletion,
    notifyUndo,
    hasResult: state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result"),
    onAddResult: () => setResultActionId(action.id),
  }));
  const contextFor = (action: GoalAction) => resolveActionContext(action, state);
  const startBreadcrumbs = [{ label: "Start", to: "/" }];
  const startAddress = locationAddress(location);
  const renderAction = (action: GoalAction) => { const relationCount = state.knowledgeLinks.filter((link) => link.actionId === action.id).length; const relationSummary = relationCount ? [`Wiedza · ${relationCount}`] : []; return <div key={action.id} data-action-id={action.id} tabIndex={-1}><StartActionRow action={action} context={contextFor(action)} relationSummary={relationSummary} openStatus={setStatusActionId} onComplete={(item) => void completeAction(item)} busy={mutation.isBusy(`start-status:${action.id}`)} error={mutation.error(`start-status:${action.id}`)} retry={mutation.retry(`start-status:${action.id}`)} breadcrumbs={startBreadcrumbs} returnTo={startAddress} timeZone={state.workspaceTimezone} today={currentDate} routineTitle={resolveRoutineTitle(action, state.recurringActionTemplates)} /></div>; };



  const todayItems = showAll("today") ? summary.todayActions : summary.todayActions.slice(0, 5);
  const hasWork = summary.todayActions.length || summary.upcomingActions.length || summary.attentionCount;
  const showNoPlan = !summary.isPristineWorkspace && summary.recommendation.kind === "calm" && !hasWork;
  const recommendationCta = summary.recommendation.kind === "next_action" || summary.recommendation.kind === "today_action"
    ? "Otwórz Działanie"
    : summary.recommendation.kind === "goal_without_next_action" ? "Ustal następny krok" : "Przejdź do decyzji";

  return <AppShell addAction={{ label: "Dodaj Działanie", shortLabel: "Działanie", ariaLabel: "Dodaj nowe Działanie na Starcie", quickAdd: { mode: "action", scheduledFor: currentDate, draftKey: "start" } }}>
    <PageHeading className="start-page-heading" title="Start" eyebrow={new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: state.workspaceTimezone }).format(new Date())} />

    <Link className="start-capture-link" to="/capture"><span className="start-capture-icon"><Plus /></span><span><strong>Zapisz myśl lub link</strong><small>Resztę uporządkujesz później.</small></span><ChevronRight /></Link>

    <div className="today-layout start-layout">
      <div className="today-main start-main">
        <Panel className="start-today-panel" aria-labelledby="start-today-title"><div className="start-section-heading"><div><h2 id="start-today-title">Na dziś</h2></div><span className="count-chip" aria-label={`${polishCount(summary.todayActions.length, "Działanie", "Działania", "Działań")} na dziś`}>{summary.todayActions.length}</span></div>{todayItems.length ? <div className="today-list">{todayItems.map(renderAction)}</div> : <p className="muted-copy">Nic nie jest zaplanowane ani przypięte na dziś.</p>}{summary.todayActions.length > 5 ? <Link className="section-link" to={showAll("today") ? "/" : "/?show=today"}>{showAll("today") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
        {summary.isPristineWorkspace ? <Panel className="start-calm"><EmptyState icon={<CalendarClock />} title="Zacznij od jednego kroku" detail="Wykonaj pierwsze Działanie albo zapisz myśl do późniejszego uporządkowania." action={<Link className="button button-secondary" to="/capture"><Archive />Zapisz do Skrzynki</Link>} /></Panel> : null}
        {showNoPlan ? <Panel className="start-calm"><EmptyState icon={<CalendarClock />} title="Nic nie jest zaplanowane na dziś" detail="Przestrzeń pracy ma już historię. Wybierz jeden konkretny następny krok, żeby łatwo wrócić do działania." action={<Button variant="primary" onClick={() => requestAppQuickAdd({ mode: "action", scheduledFor: currentDate, draftKey: "start" })}><Plus />Ustal następny krok</Button>} /></Panel> : null}
      </div>
    </div>

    <ReturnToWork />
    {summary.recommendation.kind === "blocked" ? <p className="return-to-work"><Link to={summary.recommendation.to}>{summary.recommendation.title} — {recommendationCta}</Link></p> : null}
    {summary.overdueActions.length ? <details className="start-overdue"><summary>Zaległe Działania · {summary.overdueActions.length}</summary><Link to="/actions?view=overdue">Przejrzyj zaległe Działania</Link></details> : null}
    <CurrentWeekPlanNotice read={planRead} />
    <KnowledgeRevisitSignal now={now} />
    <details className="start-ai-help" open={searchParams.get("show") === "attention" || searchParams.get("show") === "upcoming" || undefined}><summary>Pomóż wybrać następny krok</summary><AIStartGuidance homeSummary={summary} /></details>



    {(() => { const action = state.actions.find((candidate) => candidate.id === statusActionId); const statusKey = action ? `start-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} compact busy={Boolean(statusKey && mutation.isBusy(statusKey))} error={statusKey ? mutation.error(statusKey) : undefined} onClose={() => setStatusActionId(undefined)} onChange={(status, blocker, reviewOn) => action ? changeActionStatus(action, status, blocker, reviewOn) : false} />; })()}
    <ActionResultDialog action={state.actions.find((candidate) => candidate.id === resultActionId)} open={Boolean(resultActionId)} onClose={() => setResultActionId(undefined)} />
  </AppShell>;
}
