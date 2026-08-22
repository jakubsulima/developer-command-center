import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Archive, CalendarClock, CalendarDays, Check, ChevronRight, CircleAlert, Forward, Layers3, Plus, Repeat2, SkipForward, Sparkles, TrendingUp } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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

const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };
const formatDate = (date: string, timeZone: string) => new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(`${date}T12:00:00Z`));

function StartActionRow({ action, context, complete, reschedule, skip, togglePin, setNext, openMore, busy, error, retry }: {
  action: GoalAction;
  context: ActionContext;
  complete: (actionId: string) => Promise<void>;
  reschedule: (actionId: string, scheduledFor: string) => Promise<void>;
  skip: (action: GoalAction) => Promise<void>;
  togglePin: (action: GoalAction) => Promise<void>;
  setNext: (action: GoalAction) => Promise<void>;
  openMore: (actionId: string) => void;
  busy: boolean;
  error?: string;
  retry?: () => Promise<void>;
}) {
  return <div className="today-action">
    <ActionPrimaryControls action={action} busy={busy} onToggleComplete={() => void complete(action.id)} onSetNext={() => void setNext(action)} onMore={() => openMore(action.id)} />
    <div className="action-copy"><strong>{action.title}</strong><small>{context.to !== "/" ? <Link to={context.to}>{describeActionContext(context)}</Link> : describeActionContext(context)}{action.recurringTemplateId ? <> · <Repeat2 /> cykliczne</> : null}</small></div>
    {action.status === "blocked" ? <Badge tone="danger">Zablokowane</Badge> : null}
    <div className="today-row-actions">
      <Button variant="ghost" disabled={busy} loading={busy} aria-label={action.pinnedToToday ? `Odepnij od Start: ${action.title}` : `Przypnij do Start: ${action.title}`} onClick={() => void togglePin(action)}>{action.pinnedToToday ? "Odepnij" : "Przypnij"}</Button>
      <label className="icon-date" aria-label={`Przełóż ${action.title}`}><Forward /><input disabled={busy} type="date" value={action.scheduledFor ?? ""} onChange={(event) => void reschedule(action.id, event.target.value)} /></label>
      {action.recurringTemplateId ? <Button variant="ghost" disabled={busy} aria-label={`Pomiń: ${action.title}`} onClick={() => void skip(action)}><SkipForward /></Button> : null}
      {action.goalId ? <Link aria-label={`Otwórz Działanie: ${action.title}`} to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })}><ChevronRight /></Link> : null}
    </div>
    {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void retry?.()}>Spróbuj ponownie</button></p> : null}
  </div>;
}

export function StartPage() {
  const { state, createAction, setActionStatus, setNextAction, updateAction, materializeRecurring } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [searchParams] = useSearchParams();
  const materializeOnMount = useRef(materializeRecurring);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string>();
  const [actionForm, setActionForm] = useState({ title: "", detail: "", goalId: "", areaId: "", scheduledFor: "", pinnedToToday: true });
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const summary = useMemo(() => deriveHomeSummary(state), [state]);
  const showAll = (key: string) => searchParams.get("show") === key;

  useEffect(() => { void materializeOnMount.current(currentDate); }, [currentDate]);

  const complete = (actionId: string) => mutation.run(`start:${actionId}`, async () => {
    const action = state.actions.find((candidate) => candidate.id === actionId);
    if (!action) return;
    await setActionStatus(actionId, "completed");
    notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(actionId, action.status, action.blocker) });
  });
  const reschedule = (actionId: string, scheduledFor: string) => mutation.run(`start:${actionId}`, () => updateAction(actionId, { scheduledFor }));
  const togglePin = (action: GoalAction) => mutation.run(`start:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !action.pinnedToToday }); notifyUndo({ message: action.pinnedToToday ? "Odpięto od Startu." : "Przypięto do Startu.", undo: () => updateAction(action.id, { pinnedToToday: action.pinnedToToday }) }); });
  const setNext = (action: GoalAction) => action.goalId ? mutation.run(`start:${action.id}`, () => setNextAction(action.goalId!, action.id)) : Promise.resolve();
  const skip = (action: GoalAction) => mutation.run(`start:${action.id}`, async () => { await setActionStatus(action.id, "skipped"); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, action.status, action.blocker) }); });
  const contextFor = (action: GoalAction) => resolveActionContext(action, state);
  const renderAction = (action: GoalAction) => <div key={action.id} data-action-id={action.id} tabIndex={-1}><StartActionRow action={action} context={contextFor(action)} complete={complete} reschedule={reschedule} skip={skip} togglePin={togglePin} setNext={setNext} openMore={setActionMenuId} busy={mutation.isBusy(`start:${action.id}`)} error={mutation.error(`start:${action.id}`)} retry={mutation.retry(`start:${action.id}`)} /></div>;

  const submitAction = async (event: FormEvent) => {
    event.preventDefault();
    if (actionSaving) return;
    setActionSaving(true);
    setActionError("");
    try {
      await createAction({ ...actionForm, detail: actionForm.detail || undefined, goalId: actionForm.goalId || undefined, areaId: actionForm.areaId || undefined, scheduledFor: actionForm.scheduledFor || undefined });
      setActionForm({ title: "", detail: "", goalId: "", areaId: "", scheduledFor: "", pinnedToToday: true });
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
  const attentionItems = showAll("attention") ? summary.attentionSignals : summary.attentionSignals.slice(0, 5);
  const hasWork = summary.todayActions.length || summary.upcomingActions.length || summary.attentionCount;

  return <AppShell>
    <PageHeading title="Start" eyebrow={new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: state.workspaceTimezone }).format(new Date())} action={hasWork ? <Button variant="primary" onClick={() => setActionOpen(true)}><Plus />Dodaj Działanie</Button> : undefined} />

    {summary.recommendation.kind !== "calm" ? <Panel className="start-recommendation" aria-labelledby="start-recommendation-title"><div className="start-section-heading"><div><span className="eyebrow"><Sparkles />Priorytet</span><h2 id="start-recommendation-title">Najważniejsze teraz</h2></div><Badge tone="warning">Jedna decyzja</Badge></div><div className="recommendation-content"><div><strong>{summary.recommendation.title}</strong><p>{summary.recommendation.detail}</p></div><Link className="button button-primary" to={summary.recommendation.to}>Przejdź do decyzji<ChevronRight /></Link></div></Panel> : null}

    <Panel className="start-attention" aria-labelledby="start-attention-title"><div className="start-section-heading"><div><span className="eyebrow"><CircleAlert />Exception-first</span><h2 id="start-attention-title">Wymaga uwagi</h2></div><span className="count-chip" aria-label={`${summary.attentionCount} spraw wymaga uwagi`}>{summary.attentionCount}</span></div>{attentionItems.length ? <div className="attention-list">{attentionItems.map((signal) => <Link key={signal.id} to={signal.to}><span className={`attention-marker attention-${signal.kind}`} aria-hidden="true" /><span><strong>{signal.title}</strong><small>{signal.detail}</small></span><ChevronRight /></Link>)}</div> : <p className="muted-copy">Brak blokad, zaległości i decyzji czekających na Ciebie.</p>}{summary.attentionCount > 5 ? <Link className="section-link" to="/?show=attention">{showAll("attention") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>

    <div className="today-layout start-layout">
      <div className="today-main start-main">
        <Panel aria-labelledby="start-today-title"><div className="start-section-heading"><div><span className="eyebrow"><CalendarDays />Plan dnia</span><h2 id="start-today-title">Na dziś</h2></div><span className="count-chip" aria-label={`${summary.todayActions.length} działań na dziś`}>{summary.todayActions.length}</span></div>{todayItems.length ? <div className="today-list">{todayItems.map(renderAction)}</div> : <p className="muted-copy">Nic nie jest zaplanowane ani przypięte na dziś.</p>}{summary.todayActions.length > 5 ? <Link className="section-link" to="/?show=today">{showAll("today") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
        {!hasWork ? <Panel className="start-calm"><EmptyState icon={<CalendarClock />} title="Zacznij od jednego kroku" detail="Workspace jest pusty. Wykonaj pierwsze Działanie albo zapisz myśl do późniejszego uporządkowania." action={<div className="button-row"><Button variant="primary" onClick={() => setActionOpen(true)}><Plus />Dodaj Działanie</Button><Link className="button button-secondary" to="/knowledge?section=inbox&capture=true"><Archive />Zapisz do Skrzynki</Link></div>} /></Panel> : null}
      </div>
      <aside className="today-aside start-aside">
        <Panel aria-labelledby="start-upcoming-title"><div className="start-section-heading"><div><span className="eyebrow"><CalendarClock />Horyzont</span><h2 id="start-upcoming-title">Nadchodzące</h2></div><span className="count-chip" aria-label={`${summary.upcomingActions.length} nadchodzących działań`}>{summary.upcomingActions.length}</span></div>{upcomingItems.length ? upcomingItems.map((action) => <div className="upcoming-row" key={action.id}><time dateTime={action.scheduledFor}>{formatDate(action.scheduledFor!, state.workspaceTimezone)}</time><Link to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })}>{action.title}{action.recurringTemplateId ? <small><Repeat2 />cykliczne</small> : null}</Link></div>) : <p className="muted-copy">Brak zaplanowanych Działań w najbliższych 7 dniach.</p>}{summary.upcomingActions.length > 5 ? <Link className="section-link" to="/?show=upcoming">{showAll("upcoming") ? "Zwiń listę" : "Zobacz wszystkie"}<ChevronRight /></Link> : null}</Panel>
        <Panel aria-labelledby="start-activity-title"><div className="start-section-heading"><div><span className="eyebrow"><TrendingUp />Rytm pracy</span><h2 id="start-activity-title">Bieżący tydzień</h2></div></div><p className="activity-period">{formatWorkspaceDateRange(summary.activity.periodStart, summary.activity.periodEnd)}</p><div className="activity-grid"><div><strong>{summary.activity.completedActions}</strong><span>ukończonych Działań</span></div><div><strong>{summary.activity.progressUpdates}</strong><span>aktualizacji postępu</span></div><div><strong>{summary.activity.knowledgeAdded}</strong><span>dodanych elementów Wiedzy</span></div></div><p className="muted-copy">To informacja o ruchu w Workspace, nie ocena produktywności.</p></Panel>
      </aside>
    </div>

    <Modal open={actionOpen} closeDisabled={actionSaving} title="Dodaj Działanie" onClose={() => setActionOpen(false)}><form className="guided-form" onSubmit={submitAction}><p className="modal-intro">Nazwij konkretny krok, potem wybierz kiedy i gdzie ma się pojawić.</p><section className="guided-section"><div className="guided-section-title"><span>1</span><div><strong>Co chcesz zrobić?</strong><small>Krótko i konkretnie — najlepiej zacznij od czasownika.</small></div></div><label className="field-label" htmlFor="start-action-title">Nazwa Działania</label><input id="start-action-title" placeholder="Np. Spisać trzy pytania do rozmowy" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} autoFocus required /></section><section className="guided-section"><div className="guided-section-title"><span>2</span><div><strong>Kiedy ma się pojawić?</strong><small>Wybierz termin albo zostaw je bez daty.</small></div></div><div className="quick-choice-row" role="group" aria-label="Szybki termin"><button type="button" aria-pressed={actionForm.scheduledFor === currentDate} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: currentDate, pinnedToToday: true }))}>Dzisiaj</button><button type="button" aria-pressed={actionForm.scheduledFor === shiftDate(currentDate, 1)} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: shiftDate(currentDate, 1), pinnedToToday: false }))}>Jutro</button><button type="button" aria-pressed={!actionForm.scheduledFor} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: "", pinnedToToday: false }))}>Bez terminu</button></div><label className="field-label" htmlFor="start-action-date">Dokładna data</label><input id="start-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /><label className="switch-card"><input type="checkbox" checked={actionForm.pinnedToToday} onChange={(event) => setActionForm((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż także na Starcie</strong><small>Działanie będzie widoczne od razu, niezależnie od terminu.</small></span></label></section><section className="guided-section"><div className="guided-section-title"><span>3</span><div><strong>Gdzie to należy?</strong><small>Powiązanie z Celem ułatwi późniejsze odnalezienie postępu.</small></div></div><label className="field-label" htmlFor="start-action-context">Cel lub Obszar</label><select id="start-action-context" value={actionForm.goalId || (actionForm.areaId ? `area:${actionForm.areaId}` : "")} onChange={(event) => { const value = event.target.value; setActionForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Samodzielne Działanie</option><optgroup label="Cele">{state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Obszary">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select></section><details className="advanced-fields"><summary>Dodaj opis</summary><div><label className="field-label" htmlFor="start-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="start-action-detail" rows={3} placeholder="Dodaj kontekst, link lub definicję ukończenia" value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /></div></details><div className="creation-summary" aria-live="polite"><span className="creation-summary-icon"><Check /></span><div><small>Tak zapiszesz Działanie</small><strong>{actionForm.title.trim() || "Nowe Działanie"}</strong><p><CalendarClock />{actionDateLabel}{actionForm.pinnedToToday ? " · na Starcie" : ""}</p><p><Layers3 />{actionContext}</p></div></div>{actionError ? <p className="auth-message error" role="alert">{actionError}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setActionOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={actionSaving} disabled={!actionForm.title.trim()}>Dodaj Działanie</Button></div></form></Modal>

    <Modal open={Boolean(actionMenuId)} closeDisabled={Boolean(actionMenuId && mutation.isBusy(`start:${actionMenuId}`))} title="Działanie — więcej opcji" onClose={() => setActionMenuId(undefined)}>{(() => { const action = state.actions.find((candidate) => candidate.id === actionMenuId); if (!action) return null; const key = `start:${action.id}`; return <div className="mobile-action-sheet"><Button loading={mutation.isBusy(key)} onClick={() => void togglePin(action).then(() => setActionMenuId(undefined))}>{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button><label className="field-label" htmlFor={`start-more-date-${action.id}`}>Przełóż Działanie</label><input id={`start-more-date-${action.id}`} disabled={mutation.isBusy(key)} type="date" value={action.scheduledFor ?? ""} onChange={(event) => void reschedule(action.id, event.target.value).then(() => setActionMenuId(undefined))} />{action.recurringTemplateId ? <Button loading={mutation.isBusy(key)} onClick={() => void skip(action).then(() => setActionMenuId(undefined))}><SkipForward />Pomiń wystąpienie</Button> : null}{action.goalId ? <Link className="button button-secondary" to={routeForEntity({ type: "goal", id: action.goalId })} onClick={() => setActionMenuId(undefined)}>Otwórz Cel</Link> : null}{mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</div>; })()}</Modal>
  </AppShell>;
}
