import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Folder, Layers3, ListChecks, Pause, Play, Repeat2, Settings2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { routeForEntity } from "../domain/routes";
import { AppShell, PageHeading } from "../components/AppShell";
import { useActionFeedback } from "../components/action-feedback-context";
import { Button, EmptyState, Panel } from "../components/ui";
import { describeRecurringSchedule, nextOccurrenceDates } from "../domain/recurrence";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { RecurringActionForm } from "../components/RecurringActionForm";
import { polishCount } from "../domain/labels";
import "./routines-workspace.css";

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
  const filters = [
    { value: "all", label: "Wszystkie", count: activeCount + pausedCount },
    { value: "active", label: "Aktywne", count: activeCount },
    { value: "paused", label: "Wstrzymane", count: pausedCount }
  ] as const;

  useEffect(() => {
    const newRoutine = searchParams.get("newRecurring") === "1";
    const editSeries = searchParams.get("editSeries");
    if (newRoutine || editSeries) {
      if (newRoutine) requestAppQuickAdd({ mode: "routine", draftKey: "routines-list" });
      else { setEditingTemplateId(editSeries ?? undefined); setFormOpen(true); }
      const next = new URLSearchParams(searchParams);
      next.delete("newRecurring");
      next.delete("editSeries");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openNew = () => requestAppQuickAdd({ mode: "routine", draftKey: "routines-list" });
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

  return <AppShell addAction={{ label: "Nowa Rutyna", shortLabel: "Rutyna", ariaLabel: "Dodaj nową Rutynę", active: formOpen && !editingTemplateId, quickAdd: { mode: "routine", pinnedToToday: false, draftKey: "routines-list" }, onClick: openNew }}>
    <PageHeading title="Rutyny" />
    <div className="routines-workspace">
      <div className="routine-page-title" aria-hidden="true">Rutyny</div>
      <div className="routine-toolbar" role="group" aria-label="Stan Rutyn">
        {filters.map(({ value, label, count }) => <Button key={value} variant="ghost" aria-pressed={filter === value} onClick={() => setFilter(value)}>
          {label}<span className="routine-filter-count">{count}</span>
        </Button>)}
      </div>
      <p className="sr-only" role="status">{polishCount(routines.length, "rutyna", "rutyny", "rutyn")}</p>
      {routines.length ? <div className="routine-grid">{routines.map((routine) => {
        const key = `routine:${routine.id}`;
        const paused = routine.status === "paused";
        const goal = state.goals.find((item) => item.id === routine.goalId);
        const area = state.areas.find((item) => item.id === routine.areaId);
        const [nextDate, ...laterDates] = paused ? [] : nextOccurrenceDates(routine, currentDate, 3);
        const rangeLabel = `Od ${formatDate(routine.startsOn, state.workspaceTimezone)}${routine.rule.endsOn ? ` do ${formatDate(routine.rule.endsOn, state.workspaceTimezone)}` : " · bez daty końcowej"}`;
        const missedLabel = routine.missedPolicy === "skip_missed" ? "Pomiń zaległe terminy" : "Zachowaj najwyżej jeden zaległy termin";
        const checklistCount = routine.checklist.length;
        const error = mutation.error(key);
        const busy = mutation.isBusy(key);
        const statusAction = paused ? "Wznów" : "Wstrzymaj";
        const StatusIcon = paused ? Play : Pause;

        return <Panel className="routine-card" key={routine.id} data-status={routine.status}>
          <div className="routine-card-head">
            <span className="routine-card-icon"><Repeat2 aria-hidden="true" /></span>
            <div>
              <h2>{routine.title}</h2>
              <div className="routine-card-meta">
                <span>{describeRecurringSchedule(routine)}</span>
                {paused ? <span className="routine-card-status">Wstrzymana</span> : <span className="routine-next">
                  <CalendarClock aria-hidden="true" /><span className="sr-only">Najbliższy termin</span>
                  {nextDate ? <time dateTime={nextDate}>{formatDate(nextDate, state.workspaceTimezone, true)}</time> : "Brak terminów"}
                </span>}
              </div>
            </div>
          </div>

          {goal || area ? <div className="routine-assignment">
            {goal ? <><Layers3 aria-hidden="true" /><Link to={routeForEntity({ type: "goal", id: goal.id })}>{goal.title}</Link></> :
              <><Folder aria-hidden="true" /><span>{area?.name}</span></>}
          </div> : null}

          {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}
          <div className="routine-card-footer">
            <details className="routine-disclosure">
              <summary>
                <span>Szczegóły</span>
                <ChevronDown aria-hidden="true" />
                {checklistCount > 0 ? <small>{polishCount(checklistCount, "krok", "kroki", "kroków")}</small> : null}
              </summary>
              <div className="routine-disclosure-content">
                <dl className="routine-details">
                  {laterDates.length ? <div><dt>Kolejne terminy</dt><dd className="routine-later-dates">{laterDates.map((date) => <time key={date} dateTime={date}>{formatDate(date, state.workspaceTimezone, true)}</time>)}</dd></div> : null}
                  <div><dt>Zakres</dt><dd>{rangeLabel}</dd></div>
                  <div><dt>Po przerwie</dt><dd>{missedLabel}</dd></div>
                </dl>
                {checklistCount > 0 ? <div className="routine-checklist">
                  <h3><ListChecks aria-hidden="true" />Checklista</h3>
                  <ul>{routine.checklist.map((item, index) => <li key={index}>{item.title}</li>)}</ul>
                </div> : null}
              </div>
            </details>
            <div className="routine-card-actions">
              <Link className="button button-ghost" title="Ustawienia" aria-label={`Edytuj ustawienia rutyny: ${routine.title}`} to={`/routines?editSeries=${encodeURIComponent(routine.id)}`}><Settings2 aria-hidden="true" /></Link>
              <Button variant="ghost" className="routine-status-action" loading={busy} title={statusAction} aria-label={statusAction} onClick={() => void changeStatus(routine)}>
                {busy ? null : <StatusIcon aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </Panel>;
      })}</div> : <EmptyState icon={<Repeat2 />} title="Brak Rutyn w tym widoku" detail={filter === "all" ? "Użyj przycisku + w nagłówku, aby dodać pierwsze powtarzalne Działanie." : "Zmień filtr albo utwórz nową Rutynę."} />}
    </div>
    {formOpen && editingTemplateId ? <RecurringActionForm open templateId={editingTemplateId} onClose={closeForm} /> : null}
  </AppShell>;
}
