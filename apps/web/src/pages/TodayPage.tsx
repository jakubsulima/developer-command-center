import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Archive, CalendarClock, CalendarDays, Check, ChevronRight, Forward, Layers3, ListChecks, Pause, Play, Plus, Repeat2, SkipForward } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { Modal } from "../components/Modal";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { describeRecurringSchedule, nextOccurrenceDates, todayActionSections } from "../domain/recurrence";
import type { GoalAction, RecurringActionTemplate } from "../domain/types";
import { useKeyedMutation } from "../hooks/useKeyedMutation";

const today = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const formatOccurrence = (date: string, timeZone: string) => new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(`${date}T12:00:00Z`));
const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };
const formatDate = (date: string, timeZone: string) => new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(`${date}T12:00:00Z`));
const recurringPresets = [
  { name: "Przegląd celów", unit: "week" as const, checklist: "Cel bez następnego kroku\nBlokady i terminy\nPilny Inbox" },
  { name: "Przegląd budżetu", unit: "week" as const, checklist: "Sprawdź saldo\nZapisz jedną decyzję" },
  { name: "Powtórka materiału", unit: "week" as const, checklist: "Otwórz materiały\nZapisz luki" },
  { name: "Backup", unit: "month" as const, checklist: "Uruchom kopię\nZweryfikuj odtworzenie" },
  { name: "Opróżnij Inbox", unit: "week" as const, checklist: "Podejmij decyzję o każdym elemencie" }
];

function TodayActionRow({ action, context, complete, reschedule, skip, togglePin, setNext, openMore, busy, error, retry }: {
  action: GoalAction;
  context: string;
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
    <div className="action-copy"><strong>{action.title}</strong><small>{context}{action.recurringTemplateId ? <> · <Repeat2 /> cykliczne</> : null}</small></div>
    {action.status === "blocked" ? <Badge tone="danger">Zablokowane</Badge> : null}
    <div className="today-row-actions">
      <Button variant="ghost" disabled={busy} loading={busy} aria-label={action.pinnedToToday ? `Odepnij od Dzisiaj: ${action.title}` : `Przypnij do Dzisiaj: ${action.title}`} onClick={() => void togglePin(action)}>{action.pinnedToToday ? "Odepnij" : "Przypnij"}</Button>
      <label className="icon-date" aria-label={`Przełóż ${action.title}`}><Forward /><input disabled={busy} type="date" value={action.scheduledFor ?? ""} onChange={(event) => void reschedule(action.id, event.target.value)} /></label>
      {action.recurringTemplateId ? <Button variant="ghost" disabled={busy} aria-label={`Pomiń: ${action.title}`} onClick={() => void skip(action)}><SkipForward /></Button> : null}
      {action.goalId ? <Link aria-label={`Otwórz Cel: ${action.title}`} to={`/goals/${action.goalId}`}><ChevronRight /></Link> : null}
    </div>
    {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void retry?.()}>Spróbuj ponownie</button></p> : null}
  </div>;
}

export function TodayPage() {
  const { state, createAction, setActionStatus, setNextAction, updateAction, createRecurringAction, updateRecurringAction, materializeRecurring, setRecurringStatus, addProgress, linkKnowledge, unlinkKnowledge } = useStore();
  const { notifyUndo } = useActionFeedback();
  const actionMutation = useKeyedMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const materializeOnMount = useRef(materializeRecurring);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMenuId, setActionMenuId] = useState<string>();
  const [actionForm, setActionForm] = useState({ title: "", detail: "", goalId: "", areaId: "", scheduledFor: "", pinnedToToday: true });
  const currentDate = today(state.workspaceTimezone);
  const [form, setForm] = useState({ title: "", detail: "", unit: "week" as "day" | "week" | "month", interval: "1", startsOn: currentDate, endsOn: "", weekdays: [new Date(`${currentDate}T12:00:00Z`).getUTCDay()], goalId: "", areaId: "", missedPolicy: "skip_missed" as "skip_missed" | "carry_one", checklist: "", updateFuture: true });
  const [editingTemplateId, setEditingTemplateId] = useState<string>();
  const [recurringSaving, setRecurringSaving] = useState(false);
  const [recurringError, setRecurringError] = useState("");
  useEffect(() => { void materializeOnMount.current(currentDate); }, [currentDate]);
  useEffect(() => {
    const actionId = searchParams.get("action");
    const seriesId = searchParams.get("series");
    const editSeriesId = searchParams.get("editSeries");
    if (searchParams.get("newRecurring") === "1") {
      setEditingTemplateId(undefined);
      setRecurringOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("newRecurring");
      setSearchParams(next, { replace: true });
      return;
    }
    if (editSeriesId) {
      const item = state.recurringActionTemplates.find((candidate) => candidate.id === editSeriesId);
      if (item) {
        setEditingTemplateId(item.id);
        setForm({ title: item.title, detail: item.detail, unit: item.rule.unit, interval: String(item.rule.interval), startsOn: item.startsOn, endsOn: item.rule.endsOn ?? "", weekdays: item.rule.weekdays ?? [], goalId: item.goalId ?? "", areaId: item.areaId ?? "", missedPolicy: item.missedPolicy, checklist: item.checklist.map((entry) => entry.title).join("\n"), updateFuture: true });
        setRecurringOpen(true);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("editSeries");
      setSearchParams(next, { replace: true });
      return;
    }
    if (actionId) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-action-id="${CSS.escape(actionId)}"]`)?.focus());
    else if (seriesId) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-series-id="${CSS.escape(seriesId)}"]`)?.focus());
  }, [searchParams, setSearchParams, state.actions, state.recurringActionTemplates]);
  const sections = useMemo(() => todayActionSections(state, currentDate), [currentDate, state]);
  const reviewAction = sections.today.find((action) => action.title.toLocaleLowerCase("pl").includes("przegląd celów"));
  const reviewSignals = useMemo(() => [
    ...state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active" && !state.actions.some((action) => action.goalId === goal.id && action.isNext && ["ready", "in_progress"].includes(action.status))).map((goal) => ({ id: `next-${goal.id}`, goalId: goal.id, reason: "Brak następnego Działania", title: goal.title })),
    ...state.actions.filter((action) => action.status === "blocked" && action.goalId).map((action) => ({ id: `blocked-${action.id}`, goalId: action.goalId!, reason: action.blocker ?? "Blokada", title: action.title })),
    ...sections.overdue.filter((action) => action.goalId).map((action) => ({ id: `overdue-${action.id}`, goalId: action.goalId!, reason: `Termin minął ${action.scheduledFor}`, title: action.title }))
  ].slice(0, 8), [sections.overdue, state.actions, state.goals]);
  const previewTemplate = useMemo(() => ({
    id: "preview", title: form.title || "Działanie", detail: "", timezone: state.workspaceTimezone, startsOn: form.startsOn,
    rule: { unit: form.unit, interval: Math.max(1, Number(form.interval) || 1), weekdays: form.unit === "week" ? form.weekdays : undefined, dayOfMonth: form.unit === "month" ? Number(form.startsOn.slice(8, 10)) : undefined, endsOn: form.endsOn || undefined },
    missedPolicy: form.missedPolicy, status: "active", checklist: [], skippedOccurrenceCount: 0, createdAt: "", updatedAt: ""
  } as RecurringActionTemplate), [form, state.workspaceTimezone]);
  const preview = useMemo(() => nextOccurrenceDates(previewTemplate, currentDate, 3), [currentDate, previewTemplate]);
  const actionContext = state.goals.find((goal) => goal.id === actionForm.goalId)?.title ?? state.areas.find((area) => area.id === actionForm.areaId)?.name ?? "Samodzielne Działanie";
  const recurringContext = state.goals.find((goal) => goal.id === form.goalId)?.title ?? state.areas.find((area) => area.id === form.areaId)?.name ?? "Samodzielna seria";
  const actionDateLabel = actionForm.scheduledFor ? formatDate(actionForm.scheduledFor, state.workspaceTimezone) : "Bez terminu";

  const complete = async (actionId: string) => {
    const action = state.actions.find((candidate) => candidate.id === actionId);
    if (!action) return;
    await actionMutation.run(`today:${actionId}`, async () => {
      await setActionStatus(actionId, "completed");
      if (action.goalId && action.title.toLocaleLowerCase("pl").includes("przegląd celów")) await addProgress(action.goalId, "result", `Przegląd Celów ukończony. Rozpatrzone sygnały: ${reviewSignals.length}.`);
      notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(actionId, action.status, action.blocker) });
    });
  };
  const submitRecurring = async (event: FormEvent) => {
    event.preventDefault();
    if (recurringSaving) return;
    setRecurringSaving(true);
    setRecurringError("");
    const input = {
      title: form.title,
      detail: form.detail,
      startsOn: form.startsOn,
      goalId: form.goalId || undefined,
      areaId: form.areaId || undefined,
      rule: { unit: form.unit, interval: Math.max(1, Number(form.interval) || 1), weekdays: form.unit === "week" ? form.weekdays : undefined, dayOfMonth: form.unit === "month" ? Number(form.startsOn.slice(8, 10)) : undefined, endsOn: form.endsOn || undefined },
      missedPolicy: form.missedPolicy,
      checklist: form.checklist.split("\n").map((item) => item.trim()).filter(Boolean)
    };
    try {
      if (editingTemplateId) await updateRecurringAction(editingTemplateId, input, form.updateFuture);
      else await createRecurringAction(input);
      setEditingTemplateId(undefined);
      setRecurringOpen(false);
      await materializeRecurring(currentDate);
    } catch (caught) {
      setRecurringError(caught instanceof Error ? caught.message : "Nie udało się zapisać serii.");
    } finally {
      setRecurringSaving(false);
    }
  };

  const contextFor = (action: GoalAction) => state.goals.find((goal) => goal.id === action.goalId)?.title ?? state.areas.find((area) => area.id === action.areaId)?.name ?? "Samodzielne Działanie";
  const reschedule = (actionId: string, scheduledFor: string) => actionMutation.run(`today:${actionId}`, () => updateAction(actionId, { scheduledFor }));
  const togglePin = (action: GoalAction) => actionMutation.run(`today:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !action.pinnedToToday }); notifyUndo({ message: action.pinnedToToday ? "Odpięto od Dzisiaj." : "Przypięto do Dzisiaj.", undo: () => updateAction(action.id, { pinnedToToday: action.pinnedToToday }) }); });
  const setNext = (action: GoalAction) => action.goalId ? actionMutation.run(`today:${action.id}`, () => setNextAction(action.goalId!, action.id)) : Promise.resolve();
  const skip = (action: GoalAction) => actionMutation.run(`today:${action.id}`, async () => { await setActionStatus(action.id, "skipped"); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, action.status, action.blocker) }); });
  const changeSeriesStatus = (template: typeof state.recurringActionTemplates[number], status: "active" | "paused" | "archived") => actionMutation.run(`series:${template.id}`, async () => {
    const previous = template.status;
    await setRecurringStatus(template.id, status);
    notifyUndo({
      message: status === "archived" ? "Serię przeniesiono do Archiwum." : status === "paused" ? "Serię wstrzymano." : "Serię wznowiono.",
      undo: () => setRecurringStatus(template.id, previous)
    });
  });
  const renderTodayAction = (action: GoalAction) => <TodayActionRow action={action} context={contextFor(action)} complete={complete} reschedule={reschedule} skip={skip} togglePin={togglePin} setNext={setNext} openMore={setActionMenuId} busy={actionMutation.isBusy(`today:${action.id}`)} error={actionMutation.error(`today:${action.id}`)} retry={actionMutation.retry(`today:${action.id}`)} />;
  const submitAction = async (event: FormEvent) => { event.preventDefault(); if (actionSaving) return; setActionSaving(true); setActionError(""); try { await createAction({ ...actionForm, detail: actionForm.detail || undefined, goalId: actionForm.goalId || undefined, areaId: actionForm.areaId || undefined, scheduledFor: actionForm.scheduledFor || undefined }); setActionForm({ title: "", detail: "", goalId: "", areaId: "", scheduledFor: "", pinnedToToday: true }); setActionOpen(false); } catch (caught) { setActionError(caught instanceof Error ? caught.message : "Nie udało się dodać Działania."); } finally { setActionSaving(false); } };

  return <AppShell>
    <PageHeading title="Dzisiaj" eyebrow={new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(new Date())} action={<div className="button-row"><Button variant="primary" onClick={() => setActionOpen(true)}><Plus />Dodaj Działanie</Button><Button onClick={() => setRecurringOpen(true)}><Repeat2 />Nowe cykliczne</Button></div>} />
    {sections.today.length || sections.overdue.length ? <div className="today-layout">
      <div className="today-main">
        <Panel><div className="section-heading"><h2>Na dziś</h2><span>{sections.today.length} do zrobienia</span></div><div className="today-list">{sections.today.map((action) => <div key={action.id} data-action-id={action.id} tabIndex={-1}>{renderTodayAction(action)}</div>)}{!sections.today.length && <p className="muted-copy">Nic nie jest zaplanowane ani przypięte na dziś.</p>}</div></Panel>
        {reviewAction && <Panel className="review-signals"><div className="section-heading"><h2>Sygnały do przeglądu</h2><span>{reviewSignals.length + state.inbox.filter((item) => item.status === "unprocessed").length} spraw</span></div>{reviewSignals.map((signal) => <Link key={signal.id} to={`/goals/${signal.goalId}`}><span><strong>{signal.title}</strong><small>{signal.reason}</small></span><ChevronRight /></Link>)}{state.inbox.filter((item) => item.status === "unprocessed").slice(0, 3).map((item) => <Link key={item.id} to="/inbox"><span><strong>{item.content}</strong><small>Pilny Inbox</small></span><ChevronRight /></Link>)}{!reviewSignals.length && !state.inbox.some((item) => item.status === "unprocessed") && <p className="muted-copy">Brak sygnałów — możesz po prostu ukończyć przegląd.</p>}</Panel>}
        {sections.overdue.length > 0 && <Panel><div className="section-heading"><h2>Zaległe</h2><span>Wymagają świadomej decyzji</span></div><div className="today-list">{sections.overdue.map((action) => <div key={action.id}>{renderTodayAction(action)}</div>)}</div></Panel>}
      </div>
      <aside className="today-aside">
        <Panel><h2>Nadchodzące</h2>{sections.upcoming.map((action) => <div className="upcoming-row" key={action.id}><time dateTime={action.scheduledFor}>{formatDate(action.scheduledFor!, state.workspaceTimezone)}</time><span>{action.title}</span></div>)}{!sections.upcoming.length && <p className="muted-copy">Brak zaplanowanych Działań.</p>}</Panel>
        <Panel className="series-panel"><div className="section-heading"><h2>Serie</h2><span>{state.recurringActionTemplates.filter((item) => item.status !== "archived").length}</span></div>
          {state.recurringActionTemplates.filter((item) => item.status !== "archived").map((item) => {
            const links = state.knowledgeLinks.filter((link) => link.recurringTemplateId === item.id);
            const key = `series:${item.id}`;
            const nextDate = item.status === "active" ? nextOccurrenceDates(item, currentDate, 1)[0] : undefined;
            const context = state.goals.find((goal) => goal.id === item.goalId)?.title ?? state.areas.find((area) => area.id === item.areaId)?.name ?? "Samodzielna seria";
            return <div className="series-row series-card" key={item.id} data-series-id={item.id} tabIndex={-1}>
              <div className="series-card-head"><span className="series-icon"><Repeat2 /></span><span><strong>{item.title}</strong><small>{describeRecurringSchedule(item)}</small></span><Badge tone={item.status === "paused" ? "warning" : "success"}>{item.status === "paused" ? "Wstrzymana" : "Aktywna"}</Badge></div>
              <dl className="series-meta">
                <div><dt><CalendarClock />Następne</dt><dd>{nextDate ? formatOccurrence(nextDate, state.workspaceTimezone) : "Po wznowieniu"}</dd></div>
                <div><dt><CalendarDays />Start</dt><dd>{formatDate(item.startsOn, state.workspaceTimezone)}</dd></div>
                <div><dt><Layers3 />Kontekst</dt><dd>{context}</dd></div>
              </dl>
              {item.checklist.length || item.skippedOccurrenceCount ? <div className="series-signals">{item.checklist.length ? <span><ListChecks />{item.checklist.length} {item.checklist.length === 1 ? "punkt" : "punkty"}</span> : null}{item.skippedOccurrenceCount ? <span>Pominięte: {item.skippedOccurrenceCount}</span> : null}</div> : null}
              <div className="series-resources"><label htmlFor={`series-material-${item.id}`}>Materiały {links.length ? `(${links.length})` : ""}</label><select id={`series-material-${item.id}`} disabled={actionMutation.isBusy(key)} aria-label={`Dodaj materiał do serii ${item.title}`} defaultValue="" onChange={(event) => { const knowledgeId = event.target.value; if (knowledgeId) void actionMutation.run(key, () => linkKnowledge(knowledgeId, { recurringTemplateId: item.id }, "material")); event.target.value = ""; }}><option value="">Dodaj materiał…</option>{state.knowledge.filter((knowledge) => !links.some((link) => link.knowledgeItemId === knowledge.id)).map((knowledge) => <option key={knowledge.id} value={knowledge.id}>{knowledge.title}</option>)}</select>{links.map((link) => <button type="button" className="back-link" disabled={actionMutation.isBusy(key)} key={link.id} onClick={() => void actionMutation.run(key, () => unlinkKnowledge(link.id))}>Odłącz {state.knowledge.find((knowledge) => knowledge.id === link.knowledgeItemId)?.title}</button>)}</div>
              {actionMutation.error(key) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(key)} <button type="button" onClick={() => void actionMutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
              <div className="series-card-actions"><Button variant="ghost" disabled={actionMutation.isBusy(key)} onClick={() => { setEditingTemplateId(item.id); setForm({ title: item.title, detail: item.detail, unit: item.rule.unit, interval: String(item.rule.interval), startsOn: item.startsOn, endsOn: item.rule.endsOn ?? "", weekdays: item.rule.weekdays ?? [], goalId: item.goalId ?? "", areaId: item.areaId ?? "", missedPolicy: item.missedPolicy, checklist: item.checklist.map((entry) => entry.title).join("\n"), updateFuture: true }); setRecurringOpen(true); }}>Edytuj</Button><Button variant="ghost" loading={actionMutation.isBusy(key)} onClick={() => void changeSeriesStatus(item, item.status === "active" ? "paused" : "active")}>{item.status === "active" ? <><Pause />Wstrzymaj</> : <><Play />Wznów</>}</Button><Button variant="ghost" loading={actionMutation.isBusy(key)} aria-label={`Archiwizuj serię ${item.title}`} onClick={() => void changeSeriesStatus(item, "archived")}><Archive />Archiwizuj</Button></div>
            </div>;
          })}
        </Panel>
      </aside>
    </div> : <EmptyState icon={<CalendarClock />} title="Dzisiaj jest spokojnie" detail="Dodaj zwykłe Działanie albo utwórz lekką serię cykliczną — bez timera i bez presji." action={<div className="button-row"><Button variant="primary" onClick={() => setActionOpen(true)}><Plus />Dodaj Działanie</Button><Button onClick={() => setRecurringOpen(true)}><Repeat2 />Nowe cykliczne</Button></div>} />}

    <Modal open={actionOpen} closeDisabled={actionSaving} title="Dodaj Działanie" onClose={() => setActionOpen(false)}>
      <form className="guided-form" onSubmit={submitAction}>
        <p className="modal-intro">Najpierw nazwij konkretny krok, potem wybierz kiedy i gdzie ma się pojawić.</p>
        <section className="guided-section"><div className="guided-section-title"><span>1</span><div><strong>Co chcesz zrobić?</strong><small>Krótko i konkretnie — najlepiej zacznij od czasownika.</small></div></div><label className="field-label" htmlFor="today-action-title">Nazwa Działania</label><input id="today-action-title" placeholder="Np. Spisać trzy pytania do rozmowy" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} autoFocus required /></section>
        <section className="guided-section"><div className="guided-section-title"><span>2</span><div><strong>Kiedy ma się pojawić?</strong><small>Możesz użyć szybkiego wyboru albo podać dokładną datę.</small></div></div>
          <div className="quick-choice-row" role="group" aria-label="Szybki termin"><button type="button" aria-pressed={actionForm.scheduledFor === currentDate} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: currentDate, pinnedToToday: true }))}>Dzisiaj</button><button type="button" aria-pressed={actionForm.scheduledFor === shiftDate(currentDate, 1)} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: shiftDate(currentDate, 1), pinnedToToday: false }))}>Jutro</button><button type="button" aria-pressed={!actionForm.scheduledFor} onClick={() => setActionForm((current) => ({ ...current, scheduledFor: "", pinnedToToday: false }))}>Bez terminu</button></div>
          <label className="field-label" htmlFor="today-action-date">Dokładna data</label><input id="today-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} />
          <label className="switch-card"><input type="checkbox" checked={actionForm.pinnedToToday} onChange={(event) => setActionForm((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż także na liście Dzisiaj</strong><small>Działanie będzie widoczne od razu, niezależnie od terminu.</small></span></label>
        </section>
        <section className="guided-section"><div className="guided-section-title"><span>3</span><div><strong>Gdzie to należy?</strong><small>Powiązanie z Celem ułatwi późniejsze odnalezienie postępu.</small></div></div><label className="field-label" htmlFor="today-action-context">Cel lub Obszar</label><select id="today-action-context" value={actionForm.goalId || (actionForm.areaId ? `area:${actionForm.areaId}` : "")} onChange={(event) => { const value = event.target.value; setActionForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Samodzielne Działanie</option><optgroup label="Cele">{state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Obszary">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select></section>
        <details className="advanced-fields"><summary>Dodaj opis</summary><div><label className="field-label" htmlFor="today-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="today-action-detail" rows={3} placeholder="Dodaj potrzebny kontekst, link lub definicję ukończenia" value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /></div></details>
        <div className="creation-summary" aria-live="polite"><span className="creation-summary-icon"><Check /></span><div><small>Tak zapiszesz Działanie</small><strong>{actionForm.title.trim() || "Nowe Działanie"}</strong><p><CalendarClock />{actionDateLabel}{actionForm.pinnedToToday ? " · na liście Dzisiaj" : ""}</p><p><Layers3 />{actionContext}</p></div></div>
        {actionError ? <p className="auth-message error" role="alert">{actionError}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setActionOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={actionSaving} disabled={!actionForm.title.trim()}>Dodaj Działanie</Button></div>
      </form>
    </Modal>

    <Modal open={Boolean(actionMenuId)} closeDisabled={Boolean(actionMenuId && actionMutation.isBusy(`today:${actionMenuId}`))} title="Działanie — więcej opcji" onClose={() => setActionMenuId(undefined)}>{(() => {
      const action = state.actions.find((candidate) => candidate.id === actionMenuId);
      if (!action) return null;
      const key = `today:${action.id}`;
      return <div className="mobile-action-sheet">
        <Button loading={actionMutation.isBusy(key)} onClick={() => void togglePin(action).then(() => setActionMenuId(undefined))}>{action.pinnedToToday ? "Odepnij od Dzisiaj" : "Przypnij do Dzisiaj"}</Button>
        <label className="field-label" htmlFor={`today-more-date-${action.id}`}>Przełóż Działanie</label>
        <input id={`today-more-date-${action.id}`} disabled={actionMutation.isBusy(key)} type="date" value={action.scheduledFor ?? ""} onChange={(event) => void reschedule(action.id, event.target.value).then(() => setActionMenuId(undefined))} />
        {action.recurringTemplateId ? <Button loading={actionMutation.isBusy(key)} onClick={() => void skip(action).then(() => setActionMenuId(undefined))}><SkipForward />Pomiń wystąpienie</Button> : null}
        {action.goalId ? <Link className="button button-secondary" to={`/goals/${action.goalId}`} onClick={() => setActionMenuId(undefined)}>Otwórz Cel</Link> : null}
        {actionMutation.error(key) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(key)} <button type="button" onClick={() => void actionMutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
      </div>;
    })()}</Modal>

    <Modal open={recurringOpen} closeDisabled={recurringSaving} title={editingTemplateId ? "Edytuj serię cykliczną" : "Nowe Działanie cykliczne"} onClose={() => { setRecurringOpen(false); setEditingTemplateId(undefined); }}>
      <form className="guided-form" onSubmit={submitRecurring}>
        <p className="modal-intro">Zbuduj rytm krok po kroku. Podsumowanie od razu pokaże, jak seria trafi na listę.</p>
        <div className="preset-library"><span>Zacznij od gotowej propozycji</span><div>{recurringPresets.map((preset) => <button type="button" aria-pressed={form.title === preset.name} key={preset.name} onClick={() => setForm((current) => ({ ...current, title: preset.name, unit: preset.unit, checklist: preset.checklist }))}>{preset.name}</button>)}</div>{state.recurringActionTemplates.length > 0 && <><span>Albo użyj ponownie własnych ustawień</span><div>{state.recurringActionTemplates.map((template) => <button type="button" key={template.id} onClick={() => setForm((current) => ({ ...current, title: template.title, unit: template.rule.unit, interval: String(template.rule.interval), weekdays: template.rule.weekdays ?? current.weekdays, checklist: template.checklist.map((item) => item.title).join("\n"), goalId: template.goalId ?? "", areaId: template.areaId ?? "", missedPolicy: template.missedPolicy }))}>{template.title}</button>)}</div></>}</div>
        <section className="guided-section"><div className="guided-section-title"><span>1</span><div><strong>Co ma wracać?</strong><small>Nazwa powinna opisywać pojedyncze wykonanie.</small></div></div><label className="field-label" htmlFor="recurring-title">Nazwa</label><input id="recurring-title" placeholder="Np. Przegląd planu na tydzień" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /></section>
        <section className="guided-section"><div className="guided-section-title"><span>2</span><div><strong>Jak często?</strong><small>Wybierz rytm, a potem doprecyzuj interwał i dni.</small></div></div>
          <fieldset className="frequency-picker"><legend className="sr-only">Powtarzaj</legend>{([{"value":"day","label":"Codziennie","hint":"Rytm dzienny"},{"value":"week","label":"Co tydzień","hint":"Wybrane dni"},{"value":"month","label":"Co miesiąc","hint":"Ten sam dzień"}] as const).map((option) => <button type="button" key={option.value} aria-pressed={form.unit === option.value} onClick={() => setForm((current) => ({ ...current, unit: option.value }))}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</fieldset>
          <label className="field-label" htmlFor="recurring-interval">Powtarzaj co ile {form.unit === "day" ? "dni" : form.unit === "week" ? "tygodni" : "miesięcy"}?</label><input className="interval-input" id="recurring-interval" type="number" min="1" max="99" value={form.interval} onChange={(event) => setForm((current) => ({ ...current, interval: event.target.value }))} />
          {form.unit === "week" && <fieldset className="weekday-picker"><legend>Dni tygodnia</legend>{["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"].map((label, value) => <label key={label}><input type="checkbox" checked={form.weekdays.includes(value)} onChange={(event) => setForm((current) => ({ ...current, weekdays: event.target.checked ? [...current.weekdays, value].sort() : current.weekdays.filter((day) => day !== value) }))} />{label}</label>)}</fieldset>}
        </section>
        <section className="guided-section"><div className="guided-section-title"><span>3</span><div><strong>Od kiedy i w jakim kontekście?</strong><small>Seria może wspierać konkretny Cel albo działać samodzielnie.</small></div></div>
          <div className="quick-choice-row" role="group" aria-label="Szybki początek"><button type="button" aria-pressed={form.startsOn === currentDate} onClick={() => setForm((current) => ({ ...current, startsOn: currentDate }))}>Od dzisiaj</button><button type="button" aria-pressed={form.startsOn === shiftDate(currentDate, 1)} onClick={() => setForm((current) => ({ ...current, startsOn: shiftDate(currentDate, 1) }))}>Od jutra</button></div>
          <label className="field-label" htmlFor="recurring-start">Początek</label><input id="recurring-start" type="date" value={form.startsOn} onChange={(event) => setForm((current) => ({ ...current, startsOn: event.target.value }))} required />
          <label className="field-label" htmlFor="recurring-goal">Cel lub Obszar <span className="optional-label">opcjonalnie</span></label><select id="recurring-goal" value={form.goalId || (form.areaId ? `area:${form.areaId}` : "")} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Samodzielne</option><optgroup label="Cele">{state.goals.filter((goal) => goal.visibility === "active" && goal.status === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Obszary">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select>
        </section>
        <details className="advanced-fields"><summary>Więcej opcji</summary><div>
          <label className="field-label" htmlFor="recurring-detail">Opis</label><textarea id="recurring-detail" rows={2} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
          <label className="field-label" htmlFor="recurring-end">Koniec <span className="optional-label">opcjonalnie</span></label><input id="recurring-end" type="date" min={form.startsOn} value={form.endsOn} onChange={(event) => setForm((current) => ({ ...current, endsOn: event.target.value }))} />
          <label className="field-label" htmlFor="missed-policy">Po dłuższej przerwie</label><select id="missed-policy" value={form.missedPolicy} onChange={(event) => setForm((current) => ({ ...current, missedPolicy: event.target.value as typeof current.missedPolicy }))}><option value="skip_missed">Pomiń stare terminy (zalecane)</option><option value="carry_one">Zachowaj najwyżej jeden zaległy</option></select>
          <label className="field-label" htmlFor="recurring-checklist">Checklista <span className="optional-label">jeden punkt w linii</span></label><textarea id="recurring-checklist" rows={3} value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} />
          {editingTemplateId ? <label className="checkbox-row"><input type="checkbox" checked={form.updateFuture} onChange={(event) => setForm((current) => ({ ...current, updateFuture: event.target.checked }))} />Zastosuj nazwę, opis, checklistę i powiązania także do nieukończonych przyszłych wystąpień</label> : null}
        </div></details>
        <div className="creation-summary recurring-summary" aria-live="polite"><span className="creation-summary-icon"><Repeat2 /></span><div><small>Tak zapiszesz serię</small><strong>{form.title.trim() || "Nowe Działanie cykliczne"}</strong><p><CalendarClock />{describeRecurringSchedule(previewTemplate)}</p><p><Layers3 />{recurringContext}</p>{form.checklist.trim() ? <p><ListChecks />{form.checklist.split("\n").filter((item) => item.trim()).length} punktów checklisty</p> : null}</div></div>
        <p className="occurrence-preview"><CalendarClock /><span>Najbliższe: {preview.length ? preview.map((date, index) => <span key={date}>{index ? ", " : ""}<time dateTime={date}>{formatOccurrence(date, state.workspaceTimezone)}</time></span>) : "brak w wybranym zakresie"}</span></p>
        {recurringError ? <p className="auth-message error" role="alert">{recurringError}</p> : null}<div className="modal-actions"><Button type="button" disabled={recurringSaving} onClick={() => { setRecurringOpen(false); setEditingTemplateId(undefined); }}>Anuluj</Button><Button type="submit" variant="primary" loading={recurringSaving} disabled={!form.title.trim() || (form.unit === "week" && !form.weekdays.length)}><Check />{editingTemplateId ? "Zapisz serię" : "Utwórz serię"}</Button></div>
      </form>
    </Modal>
  </AppShell>;
}
