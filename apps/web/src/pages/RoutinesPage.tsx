import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarDays, Layers3, ListChecks, Pause, Play, Repeat2, Settings2, ShieldCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { routeForEntity } from "../domain/routes";
import { AppShell, PageHeading } from "../components/AppShell";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { describeRecurringSchedule, nextOccurrenceDates } from "../domain/recurrence";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { RecurringActionForm } from "../components/RecurringActionForm";

const localDate = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const formatDate = (date: string, timeZone: string, weekday = false) => new Intl.DateTimeFormat("pl-PL", { weekday: weekday ? "short" : undefined, day: "numeric", month: "short", year: weekday ? undefined : "numeric", timeZone }).format(new Date(`${date}T12:00:00Z`));

export function RoutinesPage() {
  const { state, setRecurringStatus } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string>();
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const currentDate = localDate(state.workspaceTimezone);
  const routines = useMemo(() => state.recurringActionTemplates
    .filter((item) => item.status !== "archived" && (filter === "all" || item.status === filter))
    .sort((a, b) => a.title.localeCompare(b.title, "pl")), [filter, state.recurringActionTemplates]);
  const activeCount = state.recurringActionTemplates.filter((item) => item.status === "active").length;
  const pausedCount = state.recurringActionTemplates.filter((item) => item.status === "paused").length;

  useEffect(() => {
    const newRoutine = searchParams.get("newRecurring") === "1";
    const editSeries = searchParams.get("editSeries");
    if (newRoutine || editSeries) {
      setEditingTemplateId(editSeries ?? undefined);
      setFormOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("newRecurring");
      next.delete("editSeries");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openNew = () => { setEditingTemplateId(undefined); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditingTemplateId(undefined); };

  const changeStatus = async (routine: typeof state.recurringActionTemplates[number]) => {
    const nextStatus = routine.status === "active" ? "paused" : "active";
    await mutation.run(`routine:${routine.id}`, async () => {
      await setRecurringStatus(routine.id, nextStatus);
      notifyUndo({
        message: nextStatus === "paused" ? "Rutynę wstrzymano." : "Rutynę wznowiono.",
        undo: () => setRecurringStatus(routine.id, routine.status)
      });
    });
  };

  return <AppShell addAction={{ label: "Nowa Rutyna", shortLabel: "Rutyna", ariaLabel: "Dodaj nową Rutynę", active: formOpen && !editingTemplateId, onClick: openNew }}>
    <PageHeading title="Rutyny" eyebrow="Wszystkie powtarzalne działania w jednym miejscu" />
    <div className="routine-overview" aria-label="Podsumowanie Rutyn">
      <div><Repeat2 /><span><strong>{activeCount}</strong><small>aktywne</small></span></div>
      <div><Pause /><span><strong>{pausedCount}</strong><small>wstrzymane</small></span></div>
      <div><CalendarClock /><span><strong>{state.recurringActionTemplates.filter((item) => item.status !== "archived").length}</strong><small>wszystkich</small></span></div>
    </div>
    <div className="routine-toolbar"><div className="filter-pills" role="group" aria-label="Stan Rutyn">{([{"value":"all","label":"Wszystkie"},{"value":"active","label":"Aktywne"},{"value":"paused","label":"Wstrzymane"}] as const).map((option) => <Button key={option.value} variant={filter === option.value ? "primary" : "ghost"} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</Button>)}</div><span>{routines.length} {routines.length === 1 ? "rutyna" : "rutyn"}</span></div>
    {routines.length ? <div className="routine-grid">{routines.map((routine) => {
      const key = `routine:${routine.id}`;
      const goal = state.goals.find((item) => item.id === routine.goalId);
      const area = state.areas.find((item) => item.id === routine.areaId);
      const occurrences = routine.status === "active" ? nextOccurrenceDates(routine, currentDate, 3) : [];
      return <Panel className="routine-card" key={routine.id}>
        <div className="routine-card-head"><span className="routine-card-icon"><Repeat2 /></span><div><h2>{routine.title}</h2><p>{describeRecurringSchedule(routine)}</p></div><Badge tone={routine.status === "active" ? "success" : "warning"}>{routine.status === "active" ? "Aktywna" : "Wstrzymana"}</Badge></div>
        <div className="routine-next"><span><CalendarClock />Najbliższe wykonania</span>{occurrences.length ? <div>{occurrences.map((date, index) => <time key={date} dateTime={date} className={index === 0 ? "next" : ""}>{formatDate(date, state.workspaceTimezone, true)}</time>)}</div> : <p>Rutyna nie tworzy nowych wystąpień do czasu wznowienia.</p>}</div>
        <dl className="routine-details">
          <div><dt><Layers3 />Przypisanie</dt><dd>{goal ? <Link to={routeForEntity({ type: "goal", id: goal.id })}>{goal.title}</Link> : area?.name ?? "Samodzielna rutyna"}</dd></div>
          <div><dt><CalendarDays />Zakres</dt><dd>Od {formatDate(routine.startsOn, state.workspaceTimezone)}{routine.rule.endsOn ? ` do ${formatDate(routine.rule.endsOn, state.workspaceTimezone)}` : " · bez daty końcowej"}</dd></div>
          <div><dt><ShieldCheck />Po przerwie</dt><dd>{routine.missedPolicy === "skip_missed" ? "Pomiń stare terminy" : "Zachowaj jedno zaległe"}</dd></div>
        </dl>
        {routine.checklist.length ? <div className="routine-checklist"><span><ListChecks />Checklista ({routine.checklist.length})</span><ul>{routine.checklist.slice(0, 3).map((item) => <li key={item.title}>{item.title}</li>)}</ul></div> : null}
        {mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
        <div className="routine-card-actions"><Link className="button button-secondary" to={`/routines?editSeries=${encodeURIComponent(routine.id)}`}><Settings2 />Edytuj ustawienia</Link><Button loading={mutation.isBusy(key)} onClick={() => void changeStatus(routine)}>{routine.status === "active" ? <><Pause />Wstrzymaj</> : <><Play />Wznów</>}</Button></div>
      </Panel>;
    })}</div> : <EmptyState icon={<Repeat2 />} title="Brak Rutyn w tym widoku" detail={filter === "all" ? "Użyj przycisku Dodaj na dole, aby dodać pierwsze powtarzalne Działanie." : "Zmień filtr albo utwórz nową Rutynę."} />}
    <RecurringActionForm open={formOpen} templateId={editingTemplateId} onClose={closeForm} />
  </AppShell>;
}
