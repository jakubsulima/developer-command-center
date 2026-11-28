import { actionStatusLabels } from "../domain/labels";
import { Fragment, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ChevronDown, Plus } from "lucide-react";
import type { AppState, GoalAction } from "../domain/types";
import { localDateForTimeZone } from "../domain/activity";
import { weeklyPlanActions } from "../domain/weeklyPlan";
import { overdueActions } from "../domain/weeklyReview";
import { useActionFeedback } from "./action-feedback-context";
import { Button, Panel } from "./ui";
import "./weekly-plan.css";

export interface WeeklyPlanDraft {
  selectedGoalIds: string[];
  includeStandalone: boolean;
  changes: Record<string, { date: string | null; version: number }>;
  newActionTitle?: string;
  newActionGoalId?: string;
  newActionDate?: string;
  newActionRequestId?: string;
}

interface WeeklyPlanPanelProps {
  state: AppState;
  week: { startDate: string; endDate: string; dates: string[] };
  period?: "current" | "next";
  plannedActionIds?: readonly string[];
  today?: string;
  value: WeeklyPlanDraft;
  onChange: (next: (current: WeeklyPlanDraft) => WeeklyPlanDraft) => void;
  updateAction: (actionId: string, changes: { scheduledFor: string | null }, expectedVersion: number) => Promise<void>;
  setActionStatus: (actionId: string, status: "cancelled" | "ready" | "in_progress" | "testing", blocker?: string, expectedVersion?: number) => Promise<void>;
  createAction: (input: { title: string; goalId?: string; areaId?: string; scheduledFor?: string }, idempotencyKey?: string) => Promise<string>;
}

const dayFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayWithYearFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function WeeklyPlanPanel({ state, week, period = "next", plannedActionIds, today = localDateForTimeZone(new Date(), state.workspaceTimezone), value, onChange, updateAction, setActionStatus, createAction }: WeeklyPlanPanelProps) {
  const currentWeek = period === "current";
  const titleId = currentWeek ? "current-week-plan-title" : "weekly-plan-title";
  const agendaId = currentWeek ? "current-week-plan-agenda" : "weekly-plan-agenda";
  const workspaceYear = today.slice(0, 4);
  const dateLabel = (date: string) => (date.startsWith(workspaceYear) ? dayFormatter : dayWithYearFormatter).format(new Date(`${date}T12:00:00Z`));
  const navigate = useNavigate();
  const { notifyUndo, notifySuccess } = useActionFeedback();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [goalSearch, setGoalSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(true);
  const [emptyPickerDismissed, setEmptyPickerDismissed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState("");
  const [selectedDay, setSelectedDay] = useState("all");
  const [selectedOverdueIds, setSelectedOverdueIds] = useState<string[]>([]);
  const [bulkDecision, setBulkDecision] = useState<"" | "leave" | "reschedule" | "cancel">("");
  const [bulkDate, setBulkDate] = useState(week.dates[0] ?? "");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({});
  const activeGoals = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active");
  const selectedGoalIds = value.selectedGoalIds.filter((id) => activeGoals.some((goal) => goal.id === id)).slice(0, 3);
  const scopeEmpty = selectedGoalIds.length === 0 && !value.includeStandalone;
  const selectedNewGoalId = selectedGoalIds.includes(value.newActionGoalId ?? "") ? value.newActionGoalId! : value.includeStandalone ? "" : selectedGoalIds[0] ?? "";
  const actions = weeklyPlanActions(state, selectedGoalIds, value.includeStandalone, week.dates, { plannedActionIds, includeUndated: currentWeek });
  const showAgenda = currentWeek || !scopeEmpty || actions.length > 0;
  const originalActionIds = new Set(plannedActionIds);
  const agendaActions = currentWeek ? actions.filter((action) => action.scheduledFor || originalActionIds.has(action.id)) : actions;
  const agendaDay = (action: GoalAction) => {
    if (action.scheduledFor && week.dates.includes(action.scheduledFor)) return action.scheduledFor;
    if (!action.scheduledFor) return "undated";
    if (!currentWeek) return "outside";
  };
  const dayCounts = new Map<string, number>();
  for (const action of actions) {
    const dayKey = agendaDay(action);
    if (dayKey) dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
  }
  const agendaOptions = [
    { value: "all", label: currentWeek ? "W planie" : "Wszystkie", count: agendaActions.length },
    ...week.dates.map((date) => ({ value: date, label: dateLabel(date), count: dayCounts.get(date) ?? 0 })),
    { value: "undated", label: "Bez terminu", count: dayCounts.get("undated") ?? 0 },
    ...(!currentWeek && dayCounts.has("outside") ? [{ value: "outside", label: "Poza tym tygodniem", count: dayCounts.get("outside") ?? 0 }] : [])
  ];
  const activeDay = agendaOptions.some((option) => option.value === selectedDay) ? selectedDay : "all";
  const visibleActions = activeDay === "all" ? agendaActions : actions.filter((action) => agendaDay(action) === activeDay);
  const overdue = currentWeek ? [] : overdueActions(state, today);
  const selectableOverdue = overdue.filter((action) => action.status !== "blocked");
  const selectedOverdue = selectedOverdueIds.map((id) => selectableOverdue.find((action) => action.id === id)).filter((action): action is GoalAction => Boolean(action));
  const pending = (currentWeek ? actions : state.actions).filter((action) => value.changes[action.id]);
  const pendingIds = new Set(pending.map((action) => action.id));
  const stagedCount = Object.keys(value.changes).length;
  const filteredGoals = activeGoals.filter((goal) => goal.title.toLocaleLowerCase("pl").includes(goalSearch.trim().toLocaleLowerCase("pl")));
  const selectedGoals = filteredGoals.filter((goal) => selectedGoalIds.includes(goal.id));
  const otherGoalGroups = useMemo(() => {
    const groups = new Map<string, typeof activeGoals>();
    for (const goal of filteredGoals.filter((candidate) => !selectedGoalIds.includes(candidate.id))) {
      const project = state.areas.find((area) => area.id === goal.areaId);
      const groupName = project?.name ?? "Bez Projektu";
      groups.set(groupName, [...(groups.get(groupName) ?? []), goal]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, "pl"));
  }, [filteredGoals, selectedGoalIds, state.areas]);
  const toggleGoal = (id: string) => onChange((current) => {
    const nextIds = current.selectedGoalIds.includes(id) ? current.selectedGoalIds.filter((candidate) => candidate !== id) : [...current.selectedGoalIds, id].slice(0, 3);
    return { ...current, selectedGoalIds: nextIds };
  });
  const toggleStandalone = () => onChange((current) => {
    const includeStandalone = !current.includeStandalone;
    return { ...current, includeStandalone };
  });
  const stageDate = (action: GoalAction, raw: string) => {
    onChange((current) => {
      const changes = { ...current.changes };
      const nextDate = raw === "none" ? null : raw;
      if (raw === "keep" || nextDate === (action.scheduledFor ?? null)) delete changes[action.id];
      else changes[action.id] = { date: nextDate, version: action.version };
      return { ...current, changes };
    });
    setErrors((current) => { const next = { ...current }; delete next[action.id]; return next; });
  };
  const saveDates = async () => {
    if (saving || !pending.length) return;
    setSaving(true);
    setErrors({});
    const saved: GoalAction[] = [];
    const failed: Record<string, string> = {};
    for (const action of pending) {
      const change = value.changes[action.id];
      if (!change) continue;
      if (action.status === "blocked") { failed[action.id] = "Najpierw odblokuj Działanie."; continue; }
      try {
        await updateAction(action.id, { scheduledFor: change.date }, change.version);
        saved.push(action);
      } catch {
        failed[action.id] = "Nie zapisano terminu. Wybierz dzień ponownie, aby odświeżyć wersję Działania.";
      }
    }
    if (saved.length) {
      const savedIds = new Set(saved.map((action) => action.id));
      onChange((current) => ({ ...current, changes: Object.fromEntries(Object.entries(current.changes).filter(([id]) => !savedIds.has(id))) }));
      const remainingUndo = new Set(saved);
      notifyUndo({ event: "saved", message: saved.length === 1 ? "Zapisano termin Działania." : `Zapisano terminy ${saved.length} Działań.`, undo: async () => {
        let failure: unknown;
        for (const action of remainingUndo) {
          try {
            await updateAction(action.id, { scheduledFor: action.scheduledFor ?? null }, action.version + 1);
            remainingUndo.delete(action);
          } catch (error) {
            failure ??= error;
          }
        }
        if (remainingUndo.size) throw failure ?? new Error("Nie udało się przywrócić terminów.");
      } });
    }
    setErrors(failed);
    setSaving(false);
  };
  const addStep = async () => {
    const newTitle = value.newActionTitle ?? "";
    if (creatingRef.current || !newTitle.trim()) return;
    creatingRef.current = true;
    const requestId = value.newActionRequestId ?? crypto.randomUUID();
    if (!value.newActionRequestId) onChange((current) => ({ ...current, newActionRequestId: requestId }));
    setCreating(true);
    setCreateError("");
    try {
      const goal = activeGoals.find((candidate) => candidate.id === selectedNewGoalId);
      const id = await createAction({ title: newTitle.trim(), goalId: goal?.id, areaId: goal?.areaId, scheduledFor: value.newActionDate || undefined }, requestId);
      onChange((current) => ({ ...current, newActionTitle: "", newActionGoalId: undefined, newActionDate: undefined, newActionRequestId: undefined }));
      notifySuccess(value.newActionDate ? "Krok dodany i zaplanowany." : "Krok dodany bez terminu.", { label: "Otwórz", onClick: () => navigate(`/actions/${id}`) });
    } catch {
      setCreateError("Nie potwierdzono zapisu. Tytuł, Grupa działań i dzień są zablokowane; ponów ten szkic, aby uniknąć duplikatu.");
    } finally {
      setCreating(false);
      creatingRef.current = false;
    }
  };

  const applyBulkDecision = async () => {
    if (bulkSaving || !selectedOverdue.length || !bulkDecision) return;
    if (bulkDecision === "reschedule" && !week.dates.includes(bulkDate)) return;
    if (bulkDecision === "leave") {
      setSelectedOverdueIds((current) => current.filter((id) => !selectedOverdue.some((action) => action.id === id)));
      notifySuccess(`Pozostawiono ${selectedOverdue.length} ${selectedOverdue.length === 1 ? "zaległe Działanie" : "zaległe Działania"} z dotychczasowym terminem.`);
      return;
    }
    setBulkSaving(true);
    setBulkErrors({});
    const saved: Array<{ action: GoalAction; decision: "reschedule" | "cancel" }> = [];
    const failed: Record<string, string> = {};
    for (const action of selectedOverdue) {
      try {
        if (action.status === "blocked") throw new Error("blocked_action_cannot_be_scheduled");
        if (bulkDecision === "reschedule") await updateAction(action.id, { scheduledFor: bulkDate }, action.version);
        else await setActionStatus(action.id, "cancelled", undefined, action.version);
        saved.push({ action, decision: bulkDecision });
      } catch {
        failed[action.id] = "Nie zapisano. Pozostaje na liście do ponowienia; sprawdź aktualny stan Działania.";
      }
    }
    if (saved.length) {
      const savedIds = new Set(saved.map(({ action }) => action.id));
      setSelectedOverdueIds((current) => current.filter((id) => !savedIds.has(id)));
      notifyUndo({ event: "saved", message: saved.length === 1 ? "Zapisano decyzję o zaległym Działaniu." : `Zapisano decyzje dla ${saved.length} Działań.`, undo: async () => {
        const undoErrors: string[] = [];
        for (const { action, decision } of saved) {
          try {
            if (decision === "reschedule") await updateAction(action.id, { scheduledFor: action.scheduledFor ?? null }, action.version + 1);
            else await setActionStatus(action.id, action.status as "ready" | "in_progress" | "testing", action.blocker, action.version + 1);
          } catch {
            undoErrors.push(action.title);
          }
        }
        if (undoErrors.length) throw new Error(`Zmieniły się wersje: ${undoErrors.join(", ")}.`);
      } });
    }
    setBulkErrors(failed);
    setBulkSaving(false);
  };

  return <section className="weekly-plan-panel" aria-labelledby={titleId}>
    <header className="weekly-plan-header">
      <div>
        <h2 id={titleId}>{currentWeek ? "Zmień terminy w tym tygodniu" : "Rozłóż kroki na kolejny tydzień"}</h2>
        <p>{dateLabel(week.startDate)} – {dateLabel(week.endDate)}</p>
      </div>
      {!currentWeek && showAgenda && <a className="weekly-plan-text-link" href={`#${agendaId}`}>
        Przejdź do dni<ArrowDown aria-hidden="true" />
      </a>}
    </header>
    <div className="weekly-plan-layout" data-period={period}>
      {!currentWeek ? <details className="weekly-plan-surface weekly-plan-goal-picker" open={scopeEmpty ? !emptyPickerDismissed : pickerOpen} onToggle={(event) => {
        const isOpen = (event.currentTarget as HTMLDetailsElement).open;
        if (scopeEmpty) setEmptyPickerDismissed(!isOpen);
        else setPickerOpen(isOpen);
      }}>
        <summary>
          <span>Wybierz priorytetowe Grupy działań</span>
          <span className="weekly-plan-selected-count">{selectedGoalIds.length}/3</span>
          <ChevronDown aria-hidden="true" />
        </summary>
        <p className="weekly-plan-help">Wybierz do 3 grup. Pozostałe terminy tygodnia nadal będą widoczne.</p>
        <label className="weekly-plan-goal-search">
          Szukaj grupy
          <input type="search" value={goalSearch} onChange={(event) => setGoalSearch(event.target.value)} placeholder="Wpisz nazwę grupy" />
        </label>
        <div className="weekly-plan-goal-groups" role="group" aria-label="Priorytetowe Grupy działań na kolejny tydzień">
          {selectedGoals.length > 0 && <div className="weekly-plan-goal-group">
            <h3>Wybrane priorytety</h3>
            <div className="weekly-plan-goals">
              {selectedGoals.map((goal) => <label key={goal.id}>
                <input type="checkbox" checked disabled={saving} onChange={() => toggleGoal(goal.id)} />
                <span>{goal.title}</span>
              </label>)}
            </div>
          </div>}
          {otherGoalGroups.map(([project, goals]) => <div className="weekly-plan-goal-group" key={project}>
            <h3>{project}</h3>
            <div className="weekly-plan-goals">
              {goals.map((goal) => <label key={goal.id}>
                <input type="checkbox" checked={selectedGoalIds.includes(goal.id)} disabled={saving || selectedGoalIds.length >= 3} onChange={() => toggleGoal(goal.id)} />
                <span>{goal.title}</span>
              </label>)}
            </div>
          </div>)}
          {!selectedGoals.length && !otherGoalGroups.length ? <p className="muted-copy">Nie znaleziono aktywnych grup.</p> : null}
          <label className="weekly-plan-standalone"><input type="checkbox" checked={value.includeStandalone} disabled={saving} onChange={toggleStandalone} /><span>Samodzielne Działania</span></label>
        </div>
      </details> : null}
      <div className="weekly-plan-content">
        {showAgenda ? <Panel id={agendaId} tabIndex={-1} className="weekly-plan-surface weekly-plan-schedule" aria-labelledby={`${agendaId}-title`}>
          <div className="weekly-plan-agenda">
            <div>
              <h3 id={`${agendaId}-title`}>{currentWeek ? "Działania na ten tydzień" : "Działania na następny tydzień"}</h3>
              <p className="weekly-plan-help">{currentWeek ? "Zmienione terminy trafiają do agendy. Podsumowanie porównuje wykonanie z pierwotnym planem." : "Pokazujemy wszystkie istniejące terminy tygodnia oraz otwarte kroki z wybranych priorytetów."}</p>
            </div>
            <nav className="weekly-plan-day-picker" aria-label="Wybór dnia agendy">
              {agendaOptions.map(({ value, label, count }) => <button type="button" key={value} aria-pressed={activeDay === value} onClick={() => setSelectedDay(value)}>{label} <span>{count}</span></button>)}
            </nav>
            <label className="weekly-plan-day-select">Dzień agendy
              <select value={activeDay} onChange={(event) => setSelectedDay(event.target.value)}>
                {agendaOptions.map(({ value, label, count }) => <option key={value} value={value}>{label} ({count})</option>)}
              </select>
            </label>
            <div className="weekly-plan-actions">
              {visibleActions.length ? visibleActions.map((action, index) => {
                const change = value.changes[action.id];
                const previous = visibleActions[index - 1];
                const group = agendaDay(action) ?? "outside";
                const previousGroup = previous ? agendaDay(previous) ?? "outside" : undefined;
                const groupLabel = group === "undated" ? "Bez terminu" : group === "outside" ? "Poza tym tygodniem" : dateLabel(group);
                return <Fragment key={action.id}>
                  {group !== previousGroup && <h4 className="weekly-plan-day-heading">{groupLabel}</h4>}
                  <div className="weekly-plan-action">
                    <div>
                      <Link to={`/actions/${encodeURIComponent(action.id)}`}>{action.title}</Link>
                      <small>{action.status === "blocked" ? `Zablokowane: ${action.blocker ?? "sprawdź powód"}` : action.recurringTemplateId ? "Wystąpienie Rutyny" : action.scheduledFor ? `Obecny termin: ${dateLabel(action.scheduledFor)}` : "Bez terminu"}</small>
                    </div>
                    <select aria-label={`Dzień dla Działania: ${action.title}`} value={change ? change.date ?? "none" : "keep"} disabled={saving || action.status === "blocked"} onChange={(event) => stageDate(action, event.target.value)}>
                      <option value="keep">Bez zmiany</option>
                      {week.dates.map((date) => <option key={date} value={date}>{dateLabel(date)}</option>)}
                      <option value="none">Usuń termin</option>
                    </select>
                  </div>
                </Fragment>;
              }) : <div className="weekly-plan-empty-actions"><strong>{currentWeek ? "Brak otwartych Działań w tym widoku" : "Nie ma jeszcze otwartych Działań"}</strong>{currentWeek ? activeDay !== "undated" && dayCounts.get("undated") ? <span>Wybierz „Bez terminu”, żeby zaplanować otwarte Działanie.</span> : null : <span>Dodaj pierwszy krok poniżej, a potem przypisz mu dzień.</span>}</div>}
            </div>
          </div>
          {!currentWeek && <div className="weekly-plan-new-step">
            <label htmlFor="weekly-plan-new-title">Nowy krok</label>
            <input id="weekly-plan-new-title" value={value.newActionTitle ?? ""} disabled={creating || Boolean(createError)} onChange={(event) => {
              const newActionTitle = event.target.value;
              const requestId = newActionTitle.trim() === (value.newActionTitle ?? "").trim() ? undefined : crypto.randomUUID();
              onChange((current) => ({
                ...current,
                newActionTitle,
                newActionRequestId: requestId ?? current.newActionRequestId
              }));
            }} placeholder="Np. przygotować szkic" />
            <div>
              <label>Grupa działań
                <select aria-label="Grupa działań nowego Działania" value={selectedNewGoalId} disabled={creating || Boolean(createError)} onChange={(event) => onChange((current) => ({ ...current, newActionGoalId: event.target.value }))}>
                  {value.includeStandalone && <option value="">Samodzielne Działanie</option>}
                  {selectedGoalIds.map((id) => {
                    const goal = activeGoals.find((candidate) => candidate.id === id);
                    return goal ? <option key={id} value={id}>{goal.title}</option> : null;
                  })}
                </select>
              </label>
              <label>Dzień
                <select aria-label="Dzień nowego kroku" value={value.newActionDate ?? ""} disabled={creating || Boolean(createError)} onChange={(event) => onChange((current) => ({ ...current, newActionDate: event.target.value || undefined }))}>
                  <option value="">Bez terminu</option>
                  {week.dates.map((date) => <option key={date} value={date}>{dateLabel(date)}</option>)}
                </select>
              </label>
            </div>
            <Button variant="secondary" disabled={!(value.newActionTitle ?? "").trim()} loading={creating} onClick={() => void addStep()}>
              <Plus aria-hidden="true" />Dodaj krok
            </Button>
            {createError && <p className="inline-mutation-error" role="alert">{createError}</p>}
          </div>}
        </Panel> : <Panel className="weekly-plan-surface weekly-plan-empty-state">
          <h3>Działania na następny tydzień</h3>
          <p className="weekly-plan-help">Zaznacz grupę lub samodzielne Działania, aby wyświetlić kroki do zaplanowania.</p>
        </Panel>}
        {stagedCount ? <div className="weekly-plan-preview weekly-plan-surface">
          <strong>Przed zapisem: {stagedCount} {stagedCount === 1 ? "zmiana terminu" : "zmiany terminów"}</strong>
          <ul>{Object.entries(value.changes).map(([actionId, change]) => {
            const action = state.actions.find((candidate) => candidate.id === actionId);
            const available = pendingIds.has(actionId);
            const error = available ? errors[actionId] : "Działanie jest już niedostępne w tym planie.";
            return <li key={actionId}>
              {action?.title ?? "Niedostępne Działanie"}: {action?.scheduledFor ? dateLabel(action.scheduledFor) : "bez terminu"} → {change.date ? dateLabel(change.date) : "bez terminu"}{action?.status === "blocked" && !error ? " · najpierw odblokuj" : ""}
              {error ? <p className="inline-mutation-error" role="alert">{error}</p> : null}
              {!available ? <Button variant="ghost" disabled={saving} onClick={() => onChange((current) => ({ ...current, changes: Object.fromEntries(Object.entries(current.changes).filter(([id]) => id !== actionId)) }))}>Odrzuć tę zmianę</Button> : null}
            </li>;
          })}</ul>
          <div className="weekly-plan-preview-actions">
            <Button variant="primary" loading={saving} disabled={!pending.length} onClick={() => void saveDates()}>Zapisz terminy</Button>
            <Button variant="ghost" disabled={saving} onClick={() => {
              onChange((current) => ({ ...current, changes: {} }));
              setErrors({});
            }}>Odrzuć zmiany</Button>
          </div>
        </div> : <p className="weekly-plan-help">Brak zmian terminów do zapisania.</p>}
        {overdue.length ? <section className="weekly-plan-overdue weekly-plan-surface" aria-labelledby="weekly-plan-overdue-title">
          <div>
            <h3 id="weekly-plan-overdue-title">Rozstrzygnij zaległe Działania</h3>
            <p className="weekly-plan-help">Wybierz tylko te, o których decyzję podejmujesz teraz. Zablokowane wymagają najpierw rozwiązania blokady.</p>
          </div>
          <div className="weekly-plan-overdue-list">
            {overdue.map((action) => <label key={action.id} className={action.status === "blocked" ? "is-blocked" : ""}>
              <input type="checkbox" checked={selectedOverdueIds.includes(action.id)} disabled={bulkSaving || action.status === "blocked"} onChange={(event) => {
                const { checked } = event.currentTarget;
                setSelectedOverdueIds((current) => checked ? [...new Set([...current, action.id])] : current.filter((id) => id !== action.id));
              }} />
              <span>
                <strong>{action.title}</strong>
                <small>{action.scheduledFor ? dateLabel(action.scheduledFor) : "Bez terminu"}{action.status === "blocked" ? ` · zablokowane: ${action.blocker ?? "sprawdź powód"}` : ` · ${actionStatusLabels[action.status]}`}</small>
              </span>
            </label>)}
          </div>
          <div className="weekly-plan-bulk-controls">
            <label>Decyzja
              <select aria-label="Decyzja dla zaznaczonych zaległych Działań" value={bulkDecision} disabled={bulkSaving} onChange={(event) => setBulkDecision(event.target.value as typeof bulkDecision)}>
                <option value="">Wybierz decyzję</option>
                <option value="reschedule">Przełóż na dzień</option>
                <option value="leave">Pozostaw bez zmian</option>
                <option value="cancel">Anuluj</option>
              </select>
            </label>
            {bulkDecision === "reschedule" && <label>Nowy dzień
              <select aria-label="Nowy dzień zaległych Działań" value={bulkDate} disabled={bulkSaving} onChange={(event) => setBulkDate(event.target.value)}>
                {week.dates.map((date) => <option key={date} value={date}>{dateLabel(date)}</option>)}
              </select>
            </label>}
            <Button variant="primary" disabled={!selectedOverdue.length || !bulkDecision || (bulkDecision === "reschedule" && !week.dates.includes(bulkDate))} loading={bulkSaving} onClick={() => void applyBulkDecision()}>
              {bulkDecision === "cancel" ? "Anuluj zaznaczone" : bulkDecision === "leave" ? "Pozostaw zaznaczone" : "Zapisz decyzje"}
            </Button>
          </div>
          {selectedOverdue.map((action) => bulkErrors[action.id] ? <p key={action.id} className="inline-mutation-error" role="alert">{action.title}: {bulkErrors[action.id]}</p> : null)}
        </section> : null}
      </div>
    </div>
  </section>;
}
