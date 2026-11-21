import { ReturnToWork } from "../components/ReturnToWork";
import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { CurrentWeekPlanNotice } from "../components/CurrentWeekPlanNotice";
import { KnowledgeRevisitSignal } from "../components/KnowledgeRevisitSignal";
import { useWorkspaceClock } from "../hooks/useWorkspaceClock";
import { useCurrentWeekPlan } from "../hooks/useCurrentWeekPlan";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ChevronDown, Plus, ShieldAlert, Sparkles } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionStatusDialog, type ProjectActionStatus } from "../components/ActionStatusControls";
import { ActionListRow } from "../components/ActionListRow";
import { actionStatusFeedbackEvent, useActionFeedback } from "../components/action-feedback-context";
import { Button } from "../components/ui";
import { deriveHomeSummary } from "../domain/homeSummary";
import type { GoalAction } from "../domain/types";
import { resolveActionContext, type ActionContext } from "../domain/actionContext";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { completeActionWithUndo } from "../components/completeActionWithUndo";
import { getFirstFlowSnapshot, recordFirstFlowStage } from "../lib/firstFlow";
import { locationAddress } from "../domain/navigation";
import { actionStatusLabels, polishCount } from "../domain/labels";
import { AIStartGuidance } from "../components/AIStartGuidance";
import { resolveCompactRoutineTitle } from "../domain/actionPresentation";
import "./start-workspace.css";

function StartActionRow({ action, context, knowledgeCount, openStatus, onComplete, busy, error, retry, breadcrumbs, returnTo, timeZone, today, routineTitle }: {
  action: GoalAction;
  context: ActionContext;
  knowledgeCount: number;
  openStatus: () => void;
  onComplete: () => void;
  busy: boolean;
  error?: string;
  retry?: () => Promise<boolean>;
  breadcrumbs: Array<{ label: string; to?: string }>;
  returnTo: string;
  timeZone: string;
  today: string;
  routineTitle?: string;
}) {
  const navigation = { breadcrumbs, returnTo, returnLabel: "Start" };
  return <ActionListRow action={action} navigation={navigation}
    timeZone={timeZone} today={today} routineTitle={routineTitle} showUnscheduled={false}
    busy={busy} onOpenStatus={openStatus}
    context={context.kind === "standalone" ? undefined : { label: context.name ?? context.label, to: context.to === "/" ? undefined : context.to }}
    description={knowledgeCount ? `Wiedza: ${knowledgeCount}` : undefined}
    indicator={action.isNext ? <span className="action-next-badge">Następne</span> : null}
    tools={<ActionPrimaryControls action={action} busy={busy} appearance="check" onToggleComplete={onComplete} />}>
    {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void retry?.()}>Spróbuj ponownie</button></p> : null}
  </ActionListRow>;
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
    notifyUndo({ event: actionStatusFeedbackEvent(status), message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker, action.version + 1, previous.reviewOn ?? null), action: status === "completed" && !state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result") ? { label: "Dodaj rezultat", onClick: () => setResultActionId(action.id) } : undefined });
  });
  const completeAction = (action: GoalAction) => mutation.run(`start-status:${action.id}`, () => completeActionWithUndo({
    action,
    setActionStatus,
    undoActionCompletion,
    notifyUndo,
    hasResult: state.knowledgeLinks.some((link) => link.actionId === action.id && link.meaning === "result"),
    onAddResult: () => setResultActionId(action.id),
  }));
  const startBreadcrumbs = [{ label: "Start", to: "/" }];
  const startAddress = locationAddress(location);
  const renderAction = (action: GoalAction) => {
    const statusKey = `start-status:${action.id}`;
    return <StartActionRow key={action.id} action={action} context={resolveActionContext(action, state)}
      knowledgeCount={state.knowledgeLinks.filter((link) => link.actionId === action.id).length}
      openStatus={() => setStatusActionId(action.id)} onComplete={() => void completeAction(action)}
      busy={mutation.isBusy(statusKey)} error={mutation.error(statusKey)} retry={mutation.retry(statusKey)}
      breadcrumbs={startBreadcrumbs} returnTo={startAddress} timeZone={state.workspaceTimezone} today={currentDate}
      routineTitle={resolveCompactRoutineTitle(action, state.recurringActionTemplates)} />;
  };

  const todayItems = showAll("today") ? summary.todayActions : summary.todayActions.slice(0, 5);
  const hasWork = summary.todayActions.length || summary.upcomingActions.length || summary.attentionCount;
  const showNoPlan = !summary.isPristineWorkspace && summary.recommendation.kind === "calm" && !hasWork;

  return <AppShell addAction={{ label: "Dodaj Działanie", shortLabel: "Działanie", ariaLabel: "Dodaj nowe Działanie na Starcie", quickAdd: { mode: "action", scheduledFor: currentDate, draftKey: "start" } }}>
    <PageHeading className="start-page-heading" title="Start" mobileBrand eyebrow={new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: state.workspaceTimezone }).format(now)} />

    <div className="start-workspace">
      <Link className="start-capture-link" to="/capture">
        <span className="start-capture-icon"><Plus aria-hidden="true" /></span>
        <strong>{summary.isPristineWorkspace ? "Zapisz do Skrzynki" : "Zapisz myśl lub link"}</strong>
      </Link>

      <section className="start-layout" aria-labelledby="start-today-title">
        <header className="start-section-heading">
          <h2 id="start-today-title">Na dziś</h2>
          <span className="start-today-count" aria-label={`${polishCount(summary.todayActions.length, "Działanie", "Działania", "Działań")} na dziś`}>{summary.todayActions.length}</span>
        </header>
        {todayItems.length ? <ul className="workspace-list" role="list">{todayItems.map(renderAction)}</ul> : <div className="start-today-empty">
          <p>{summary.isPristineWorkspace ? "Zacznij od jednego kroku" : "Nic nie jest zaplanowane ani przypięte na dziś."}</p>
          {summary.isPristineWorkspace || showNoPlan ? <Button variant="secondary" onClick={() => requestAppQuickAdd({ mode: "action", scheduledFor: currentDate, draftKey: "start" })}><Plus aria-hidden="true" />{summary.isPristineWorkspace ? "Dodaj Działanie" : "Ustal następny krok"}</Button> : null}
        </div>}
        {summary.todayActions.length > 5 ? <Link className="section-link" to={showAll("today") ? "/" : "/?show=today"}>{showAll("today") ? "Zwiń listę" : "Zobacz wszystkie"}</Link> : null}
      </section>

      <div className="start-context">
        <ReturnToWork />
        {summary.recommendation.kind === "blocked" ? <Link className="start-context-link" to={summary.recommendation.to}><ShieldAlert aria-hidden="true" /><span>{summary.recommendation.title}</span></Link> : null}
        {summary.overdueActions.length ? <Link className="start-context-link" to="/actions?view=overdue"><CalendarClock aria-hidden="true" /><span>Zaległe Działania <small>{summary.overdueActions.length}</small></span></Link> : null}
        <CurrentWeekPlanNotice read={planRead} />
        <KnowledgeRevisitSignal now={now} />
        <details className="start-ai-help" open={searchParams.get("show") === "attention" || searchParams.get("show") === "upcoming" || undefined}>
          <summary><Sparkles aria-hidden="true" /><span>Pomóż wybrać następny krok</span><ChevronDown aria-hidden="true" /></summary>
          <AIStartGuidance homeSummary={summary} renderUpcomingAction={renderAction} />
        </details>
      </div>
    </div>
    {(() => { const action = state.actions.find((candidate) => candidate.id === statusActionId); const statusKey = action ? `start-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} compact busy={Boolean(statusKey && mutation.isBusy(statusKey))} error={statusKey ? mutation.error(statusKey) : undefined} onClose={() => setStatusActionId(undefined)} onChange={(status, blocker, reviewOn) => action ? changeActionStatus(action, status, blocker, reviewOn) : false} />; })()}
    <ActionResultDialog action={state.actions.find((candidate) => candidate.id === resultActionId)} open={Boolean(resultActionId)} onClose={() => setResultActionId(undefined)} />
  </AppShell>;
}
