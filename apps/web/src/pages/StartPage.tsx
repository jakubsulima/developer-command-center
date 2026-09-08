import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Archive, CalendarClock, CalendarDays, Check, ChevronDown, ChevronRight, CircleAlert, Layers3, ListPlus, Plus, Repeat2, SkipForward, Sparkles, TrendingUp } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { Modal } from "../components/Modal";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { deriveHomeSummary } from "../domain/homeSummary";
import type { GoalAction } from "../domain/types";
import { routeForEntity } from "../domain/routes";
import { describeActionContext, resolveActionContext, type ActionContext } from "../domain/actionContext";
import { formatWorkspaceDateRange } from "../domain/activity";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { getFirstFlowSnapshot, recordFirstFlowStage } from "../lib/firstFlow";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId } from "../domain/navigation";
import { polishCount, polishPluralForm } from "../domain/labels";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { DraftStatus } from "../components/DraftStatus";

const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };
const formatDate = (date: string, timeZone: string) => new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(`${date}T12:00:00Z`));

function StartActionRow({ action, context, relationSummary, complete, openMore, busy, error, retry, breadcrumbs, returnTo }: {
  action: GoalAction;
  context: ActionContext;
  relationSummary: string[];
  complete: (actionId: string) => Promise<void>;
  openMore: (actionId: string) => void;
  busy: boolean;
  error?: string;
  retry?: () => Promise<void>;
  breadcrumbs: Array<{ label: string; to?: string }>;
  returnTo: string;
}) {
  return <div className="today-action" data-navigation-card-id={navigationCardId("action", action.id)} tabIndex={-1}>
    <ActionPrimaryControls action={action} busy={busy} onToggleComplete={() => void complete(action.id)} onMore={() => openMore(action.id)} />
    <div className="action-copy"><div className="action-title-row"><NavigationLink to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}><strong>{action.title}</strong>{action.recurringTemplateId ? <span className="action-recurring-marker">cykliczne</span> : null}</NavigationLink>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><small>{context.to !== "/" ? <NavigationLink to={context.to} breadcrumbs={breadcrumbs} returnTo={returnTo} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}>{describeActionContext(context)}</NavigationLink> : describeActionContext(context)}</small>{relationSummary.length ? <small className="action-relation-summary">{relationSummary.join(" · ")}</small> : null}</div>
    {action.status === "blocked" ? <Badge tone="danger">Zablokowane</Badge> : null}
    {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void retry?.()}>Spróbuj ponownie</button></p> : null}
  </div>;
}

export function StartPage() {
  const { state, createAction, setActionStatus, setNextAction, updateAction, materializeRecurring } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const materializeOnMount = useRef(materializeRecurring);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string>();
  const [resultActionId, setResultActionId] = useState<string>();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const actionDraft = usePersistentDraft("start-action", { title: "", detail: "", goalId: "", areaId: "", scheduledFor: "", pinnedToToday: true }, 450, { targetId: "new" });
  const actionForm = actionDraft.value;
  const setActionForm = actionDraft.setValue;
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const summary = useMemo(() => deriveHomeSummary(state), [state]);
  const firstFlow = getFirstFlowSnapshot();
  const hasCompletedAction = state.actions.some((action) => action.status === "completed");
  const showFirstFlow = !hasCompletedAction && (summary.isPristineWorkspace || firstFlow.stage !== "unknown");
  const showAll = (key: string) => searchParams.get("show") === key;

  useEffect(() => { void materializeOnMount.current(currentDate); }, [currentDate]);
  const requestedOverview = ["upcoming", "attention"].includes(searchParams.get("show") ?? "");
  useEffect(() => { if (requestedOverview) setOverviewOpen(true); }, [requestedOverview]);
  useEffect(() => {
    if (summary.isPristineWorkspace) recordFirstFlowStage("empty-workspace");
    if (hasCompletedAction && firstFlow.stage !== "unknown") recordFirstFlowStage("first-action-completed");
  }, [firstFlow.stage, hasCompletedAction, summary.isPristineWorkspace]);

  const complete = (actionId: string) => mutation.run(`start:${actionId}`, async () => {
    const action = state.actions.find((candidate) => candidate.id === actionId);
    if (!action) return;
    await setActionStatus(actionId, "completed");
    if (!state.knowledgeLinks.some((link) => link.actionId === actionId && link.meaning === "result")) notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(actionId, action.status, action.blocker), action: { label: "Dodaj rezultat", onClick: () => setResultActionId(actionId) } });
  });
  const reschedule = (actionId: string, scheduledFor: string) => mutation.run(`start:${actionId}`, () => updateAction(actionId, { scheduledFor }));
  const togglePin = (action: GoalAction) => mutation.run(`start:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !action.pinnedToToday }); notifyUndo({ message: action.pinnedToToday ? "Odpięto od Startu." : "Przypięto do Startu.", undo: () => updateAction(action.id, { pinnedToToday: action.pinnedToToday }) }); });
  const setNext = (action: GoalAction) => action.goalId ? mutation.run(`start:${action.id}`, () => setNextAction(action.goalId!, action.id)) : Promise.resolve();
  const skip = (action: GoalAction) => mutation.run(`start:${action.id}`, async () => { await setActionStatus(action.id, "skipped"); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, action.status, action.blocker) }); });
  const contextFor = (action: GoalAction) => resolveActionContext(action, state);
  const startBreadcrumbs = [{ label: "Start", to: "/" }];
  const startAddress = locationAddress(location);
  const renderAction = (action: GoalAction) => { const relationCount = state.knowledgeLinks.filter((link) => link.actionId === action.id).length; const relationSummary = relationCount ? [`Wiedza · ${relationCount}`] : []; return <div key={action.id} data-action-id={action.id} tabIndex={-1}><StartActionRow action={action} context={contextFor(action)} relationSummary={relationSummary} complete={complete} openMore={setActionMenuId} busy={mutation.isBusy(`start:${action.id}`)} error={mutation.error(`start:${action.id}`)} retry={mutation.retry(`start:${action.id}`)} breadcrumbs={startBreadcrumbs} returnTo={startAddress} /></div>; };

  const submitAction = async (event: FormEvent) => {
    event.preventDefault();
    if (actionSaving) return;
    setActionSaving(true);
    setActionError("");
    try {
      await createAction({ ...actionForm, detail: actionForm.detail || undefined, goalId: actionForm.goalId || undefined, areaId: actionForm.areaId || undefined, scheduledFor: actionForm.scheduledFor || undefined });
      if (showFirstFlow) recordFirstFlowStage("action-created");
      actionDraft.clear();
      setActionOpen(false);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Nie udało się dodać Działania.");
    } finally {
      setActionSaving(false);
    }
  };

  const actionContext = state.goals.find((goal) => goal.id === actionForm.goalId)?.title ?? state.areas.find((area) => area.id === actionForm.areaId)?.name ?? "Samodzielne Działanie";
  const actionDateLabel = actionForm.scheduledFor ? formatDate(actionForm.scheduledFor, state.workspaceTimezone) : "Bez terminu";
  const todayItems = showAll("today") ? summary.todayActions : summary.todayActions.slice(0, 5);
  const upcomingItems = showAll("upcoming") ? summary.upcomingActions : summary.upcomingActions.slice(0, 5);
  const attentionItems = showAll("attention") ? summary.attentionSignals : summary.attentionSignals.slice(0, 2);
  const hasWork = summary.todayActions.length || summary.upcomingActions.length || summary.attentionCount;
  const showNoPlan = !summary.isPristineWorkspace && summary.recommendation.kind === "calm" && !hasWork;
  const firstOpenAction = state.actions.find((action) => !["completed", "cancelled", "skipped"].includes(action.status));
  const recommendationCta = summary.recommendation.kind === "next_action" || summary.recommendation.kind === "today_action"
    ? "Otwórz Działanie"
    : summary.recommendation.kind === "goal_without_next_action" ? "Ustal następny krok" : "Przejdź do decyzji";

  return <AppShell>
    <PageHeading title="Start" eyebrow={new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: state.workspaceTimezone }).format(new Date())} />

    {showFirstFlow ? <Panel className="first-flow-panel" aria-labelledby="first-flow-title"><div className="start-section-heading"><div><span className="eyebrow"><Sparkles />Pierwsza minuta</span><h2 id="first-flow-title">Jeden użyteczny wynik</h2></div><Badge tone="neutral">bez touru modułów</Badge></div><p>Zacznij od rzeczy, którą naprawdę chcesz zrobić. Przechwyć myśl, zamień ją w jedno Działanie, zobacz je tutaj i oznacz jako ukończone.</p><ol className="first-flow-steps"><li className={summary.isPristineWorkspace ? "current" : "done"}>Przechwyć myśl</li><li className={state.inbox.length ? "current" : ""}>Utwórz Działanie</li><li className={state.actions.length ? "current" : ""}>Ukończ na Starcie</li></ol>{summary.isPristineWorkspace ? <Link className="button button-primary" to="/knowledge?section=inbox&capture=true"><Archive />Przechwyć teraz</Link> : state.inbox.some((item) => item.status === "unprocessed") ? <Link className="button button-primary" to="/knowledge?section=inbox&status=unprocessed"><ListPlus />Utwórz Działanie</Link> : firstOpenAction ? <NavigationLink className="button button-primary" to={routeForEntity({ type: "action", id: firstOpenAction.id })} breadcrumbs={startBreadcrumbs} returnTo={startAddress} returnLabel="Start" sourceCardId={navigationCardId("action", firstOpenAction.id)}>Otwórz pierwsze Działanie<ChevronRight /></NavigationLink> : null}</Panel> : null}

    {summary.recommendation.kind !== "calm" ? <Panel className={`start-recommendation ${summary.recommendation.kind === "next_action" ? "start-next-recommendation" : ""}`} aria-labelledby="start-recommendation-title"><div className="start-section-heading"><div><span className="eyebrow"><Sparkles />Najważniejsze teraz</span><h2 className="sr-only" id="start-recommendation-title">Najważniejsze teraz</h2></div><Badge tone="warning">{summary.recommendation.kind === "next_action" ? "Następne Działanie" : "Jedna decyzja"}</Badge></div><div className="recommendation-content"><div><strong>{summary.recommendation.title}</strong>{summary.recommendation.context ? <small className="recommendation-context">{summary.recommendation.context}</small> : null}<p>{summary.recommendation.detail}</p></div><Link className="button button-primary" to={summary.recommendation.to}>{recommendationCta}<ChevronRight /></Link></div></Panel> : null}

    <div className="today-layout start-layout">
      <div className="today-main start-main">
        <Panel className="start-today-panel" aria-labelledby="start-today-title"><div className="start-section-heading"><div><span className="eyebrow"><CalendarDays />Plan dnia</span><h2 id="start-today-title">Na dziś</h2></div><span className="count-chip" aria-label={`${polishCount(summary.todayActions.length, "Działanie", "Działania", "Działań")} na dziś`}>{summary.todayActions.length}</span></div>{todayItems.length ? <div className="today-list">{todayItems.map(renderAction)}</div> : <p className="muted-copy">Nic nie jest zaplanowane ani przypięte na dziś.</p>}{summary.todayActions.length > 5 ? <Link className="section-link" to="/?show=today">{showAll("today") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
        {summary.isPristineWorkspace ? <Panel className="start-calm"><EmptyState icon={<CalendarClock />} title="Zacznij od jednego kroku" detail="Wykonaj pierwsze Działanie albo zapisz myśl do późniejszego uporządkowania." action={<Link className="button button-secondary" to="/knowledge?section=inbox&capture=true"><Archive />Zapisz do Skrzynki</Link>} /></Panel> : null}
        {showNoPlan ? <Panel className="start-calm"><EmptyState icon={<CalendarClock />} title="Nic nie jest zaplanowane na dziś" detail="Przestrzeń pracy ma już historię. Wybierz jeden konkretny następny krok, żeby łatwo wrócić do działania." action={<Button variant="primary" onClick={() => setActionOpen(true)}><Plus />Ustal następny krok</Button>} /></Panel> : null}
      </div>
    </div>

    <section className="start-overview" aria-label="Dalszy plan">
      <button className="start-overview-toggle" type="button" aria-expanded={overviewOpen} aria-controls="start-overview-content" onClick={() => setOverviewOpen((current) => !current)}>
        <span><strong>Dalszy plan</strong><small>{polishCount(summary.upcomingActions.length, "nadchodzące Działanie", "nadchodzące Działania", "nadchodzących Działań")} · {polishCount(summary.attentionCount, "sprawa wymaga uwagi", "sprawy wymagają uwagi", "spraw wymaga uwagi")} · {polishCount(summary.activity.completedActions, "ukończone Działanie w tygodniu", "ukończone Działania w tygodniu", "ukończonych Działań w tygodniu")}</small></span>
        <ChevronDown aria-hidden="true" />
      </button>
      <div className="start-overview-content" id="start-overview-content" hidden={!overviewOpen}>
        <Panel aria-labelledby="start-upcoming-title"><div className="start-section-heading"><div><span className="eyebrow"><CalendarClock />Horyzont</span><h2 id="start-upcoming-title">Nadchodzące</h2></div><span className="count-chip" aria-label={polishCount(summary.upcomingActions.length, "nadchodzące Działanie", "nadchodzące Działania", "nadchodzących Działań")}>{summary.upcomingActions.length}</span></div>{upcomingItems.length ? upcomingItems.map((action) => <div className="upcoming-row" key={action.id}><time dateTime={action.scheduledFor}>{formatDate(action.scheduledFor!, state.workspaceTimezone)}</time><NavigationLink data-navigation-card-id={navigationCardId("action", action.id)} to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={startBreadcrumbs} returnTo={startAddress} returnLabel="Start" sourceCardId={navigationCardId("action", action.id)}>{action.title}{action.recurringTemplateId ? <small><Repeat2 />cykliczne</small> : null}</NavigationLink></div>) : <p className="muted-copy">Brak zaplanowanych Działań w najbliższych 7 dniach.</p>}{summary.upcomingActions.length > 5 ? <Link className="section-link" to="/?show=upcoming">{showAll("upcoming") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
        <Panel aria-labelledby="start-activity-title"><div className="start-section-heading"><div><span className="eyebrow"><TrendingUp />Rytm pracy</span><h2 id="start-activity-title">Bieżący tydzień</h2></div></div><p className="activity-period">{formatWorkspaceDateRange(summary.activity.periodStart, summary.activity.periodEnd)}</p><div className="activity-grid"><div><strong>{summary.activity.completedActions}</strong><span>{polishPluralForm(summary.activity.completedActions, "ukończone Działanie", "ukończone Działania", "ukończonych Działań")}</span></div><div><strong>{summary.activity.progressUpdates}</strong><span>{polishPluralForm(summary.activity.progressUpdates, "aktualizacja postępu", "aktualizacje postępu", "aktualizacji postępu")}</span></div><div><strong>{summary.activity.knowledgeAdded}</strong><span>{polishPluralForm(summary.activity.knowledgeAdded, "dodany element Wiedzy", "dodane elementy Wiedzy", "dodanych elementów Wiedzy")}</span></div></div></Panel>
        <Panel className="start-attention" aria-labelledby="start-attention-title"><div className="start-section-heading"><div><span className="eyebrow"><CircleAlert />Do sprawdzenia</span><h2 id="start-attention-title">Wymaga uwagi</h2></div><span className="count-chip" aria-label={polishCount(summary.attentionCount, "sprawa wymaga uwagi", "sprawy wymagają uwagi", "spraw wymaga uwagi")}>{summary.attentionCount}</span></div>{attentionItems.length ? <div className="attention-list" id="start-attention-list">{attentionItems.map((signal) => <Link key={signal.id} to={signal.to}><span className={`attention-marker attention-${signal.kind}`} aria-hidden="true" /><span><strong>{signal.title}</strong><small>{signal.detail}</small></span><ChevronRight /></Link>)}</div> : <p className="muted-copy">Brak blokad, zaległości i decyzji czekających na Ciebie.</p>}{summary.attentionCount > 2 ? <Link className="section-link" to={showAll("attention") ? "/" : "/?show=attention"} aria-expanded={showAll("attention")} aria-controls="start-attention-list">{showAll("attention") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
      </div>
    </section>

    <Modal open={actionOpen} closeDisabled={actionSaving} title="Dodaj Działanie" onClose={() => setActionOpen(false)}><form className="guided-form" onSubmit={submitAction}><p className="modal-intro">Nazwij konkretny krok, potem wybierz kiedy i gdzie ma się pojawić.</p><section className="guided-section"><div className="guided-section-title"><span>1</span><div><strong>Co chcesz zrobić?</strong><small>Krótko i konkretnie — najlepiej zacznij od czasownika.</small></div></div><label className="field-label" htmlFor="start-action-title">Nazwa Działania</label><input id="start-action-title" placeholder="Np. Spisać trzy pytania do rozmowy" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} autoFocus required /></section><section className="guided-section"><div className="guided-section-title"><span>2</span><div><strong>Kiedy ma się pojawić?</strong><small>Wybierz termin albo zostaw je bez daty.</small></div></div><div className="quick-choice-row" role="group" aria-label="Szybki termin"><button type="button" aria-pressed={actionForm.scheduledFor === currentDate} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: currentDate, pinnedToToday: true }))}>Dzisiaj</button><button type="button" aria-pressed={actionForm.scheduledFor === shiftDate(currentDate, 1)} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: shiftDate(currentDate, 1), pinnedToToday: false }))}>Jutro</button><button type="button" aria-pressed={!actionForm.scheduledFor} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: "", pinnedToToday: false }))}>Bez terminu</button></div><label className="field-label" htmlFor="start-action-date">Dokładna data</label><input id="start-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /><label className="switch-card"><input type="checkbox" checked={actionForm.pinnedToToday} onChange={(event) => setActionForm((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż także na Starcie</strong><small>Działanie będzie widoczne od razu, niezależnie od terminu.</small></span></label></section><section className="guided-section"><div className="guided-section-title"><span>3</span><div><strong>Gdzie to należy?</strong><small>Powiązanie z Celem ułatwi późniejsze odnalezienie postępu.</small></div></div><label className="field-label" htmlFor="start-action-context">Cel lub Projekt</label><select id="start-action-context" value={actionForm.goalId || (actionForm.areaId ? `area:${actionForm.areaId}` : "")} onChange={(event) => { const value = event.target.value; setActionForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Samodzielne Działanie</option><optgroup label="Cele">{state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Projekty">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select></section><details className="advanced-fields"><summary>Dodaj opis</summary><div><label className="field-label" htmlFor="start-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="start-action-detail" rows={3} placeholder="Dodaj kontekst, link lub definicję ukończenia" value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /></div></details><div className="creation-summary" aria-live="polite"><span className="creation-summary-icon"><Check /></span><div><small>Tak zapiszesz Działanie</small><strong>{actionForm.title.trim() || "Nowe Działanie"}</strong><p><CalendarClock />{actionDateLabel}{actionForm.pinnedToToday ? " · na Starcie" : ""}</p><p><Layers3 />{actionContext}</p></div></div>{actionError ? <p className="auth-message error" role="alert">{actionError}</p> : null}<div className="modal-actions"><div className="draft-footer"><DraftStatus status={actionDraft.status} errorMessage={actionDraft.errorMessage} onRetry={() => void actionDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(JSON.stringify(actionDraft.value))} />{actionDraft.dirty ? <Button type="button" variant="ghost" onClick={actionDraft.discard}>Odrzuć szkic</Button> : null}</div><Button type="button" onClick={() => setActionOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={actionSaving} disabled={!actionForm.title.trim()}>Dodaj Działanie</Button></div></form></Modal>

    <Modal open={Boolean(actionMenuId)} closeDisabled={Boolean(actionMenuId && mutation.isBusy(`start:${actionMenuId}`))} title="Działanie — więcej opcji" onClose={() => setActionMenuId(undefined)}>{(() => { const action = state.actions.find((candidate) => candidate.id === actionMenuId); if (!action) return null; const key = `start:${action.id}`; return <div className="mobile-action-sheet">{action.goalId && !action.isNext ? <Button loading={mutation.isBusy(key)} onClick={() => void setNext(action).then(() => setActionMenuId(undefined))}>Ustaw jako następne</Button> : null}<Button loading={mutation.isBusy(key)} onClick={() => void togglePin(action).then(() => setActionMenuId(undefined))}>{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button><label className="field-label" htmlFor={`start-more-date-${action.id}`}>Przełóż Działanie</label><input id={`start-more-date-${action.id}`} disabled={mutation.isBusy(key)} type="date" value={action.scheduledFor ?? ""} onChange={(event) => void reschedule(action.id, event.target.value).then(() => setActionMenuId(undefined))} />{action.recurringTemplateId ? <Button loading={mutation.isBusy(key)} onClick={() => void skip(action).then(() => setActionMenuId(undefined))}><SkipForward />Pomiń wystąpienie</Button> : null}{action.goalId ? <Link className="button button-secondary" to={routeForEntity({ type: "goal", id: action.goalId })} onClick={() => setActionMenuId(undefined)}>Otwórz Cel</Link> : null}{mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</div>; })()}</Modal>
    <ActionResultDialog action={state.actions.find((candidate) => candidate.id === resultActionId)} open={Boolean(resultActionId)} onClose={() => setResultActionId(undefined)} />
  </AppShell>;
}
