import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Plus, ListChecks, Target } from "lucide-react";
import type { AppState, GoalAction } from "../domain/types";
import { weeklyPlanActions } from "../domain/weeklyPlan";
import { useActionFeedback } from "./action-feedback-context";
import { Button, Panel } from "./ui";

export interface WeeklyPlanDraft {
  selectedGoalIds: string[];
  includeStandalone: boolean;
  changes: Record<string, { date: string | null; version: number }>;
}

interface WeeklyPlanPanelProps {
  state: AppState;
  week: { startDate: string; endDate: string; dates: string[] };
  value: WeeklyPlanDraft;
  onChange: (next: (current: WeeklyPlanDraft) => WeeklyPlanDraft) => void;
  updateAction: (actionId: string, changes: { scheduledFor: string | null }, expectedVersion: number) => Promise<void>;
  createAction: (input: { title: string; goalId?: string; areaId?: string }) => Promise<string>;
}

const dayFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dateLabel = (date: string) => dayFormatter.format(new Date(`${date}T12:00:00Z`));

export function WeeklyPlanPanel({ state, week, value, onChange, updateAction, createAction }: WeeklyPlanPanelProps) {
  const { notifyUndo, notifySuccess } = useActionFeedback();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newGoalId, setNewGoalId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState("");
  const activeGoals = state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active");
  const selectedGoalIds = value.selectedGoalIds.filter((id) => activeGoals.some((goal) => goal.id === id)).slice(0, 3);
  const selectedNewGoalId = selectedGoalIds.includes(newGoalId) ? newGoalId : value.includeStandalone ? "" : selectedGoalIds[0] ?? "";
  const actions = weeklyPlanActions(state, selectedGoalIds, value.includeStandalone);
  const pending = actions.filter((action) => value.changes[action.id]);
  const stagedCount = Object.keys(value.changes).length;
  const toggleGoal = (id: string) => onChange((current) => {
    const nextIds = current.selectedGoalIds.includes(id) ? current.selectedGoalIds.filter((candidate) => candidate !== id) : [...current.selectedGoalIds, id].slice(0, 3);
    const visibleIds = new Set(weeklyPlanActions(state, nextIds, current.includeStandalone).map((action) => action.id));
    return { ...current, selectedGoalIds: nextIds, changes: Object.fromEntries(Object.entries(current.changes).filter(([actionId]) => visibleIds.has(actionId))) };
  });
  const toggleStandalone = () => onChange((current) => {
    const includeStandalone = !current.includeStandalone;
    const visibleIds = new Set(weeklyPlanActions(state, current.selectedGoalIds, includeStandalone).map((action) => action.id));
    return { ...current, includeStandalone, changes: Object.fromEntries(Object.entries(current.changes).filter(([actionId]) => visibleIds.has(actionId))) };
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
    const saved: Array<{ action: GoalAction; date: string | null }> = [];
    const failed: Record<string, string> = {};
    for (const action of pending) {
      const change = value.changes[action.id];
      if (!change) continue;
      if (action.status === "blocked") { failed[action.id] = "Najpierw odblokuj Działanie."; continue; }
      try {
        await updateAction(action.id, { scheduledFor: change.date }, change.version);
        saved.push({ action, date: change.date });
      } catch {
        failed[action.id] = "Nie zapisano terminu. Wybierz dzień ponownie, aby odświeżyć wersję Działania.";
      }
    }
    if (saved.length) {
      const savedIds = new Set(saved.map(({ action }) => action.id));
      onChange((current) => ({ ...current, changes: Object.fromEntries(Object.entries(current.changes).filter(([id]) => !savedIds.has(id))) }));
      notifyUndo({ message: saved.length === 1 ? "Zapisano termin Działania." : `Zapisano terminy ${saved.length} Działań.`, undo: async () => {
        for (const { action } of saved) await updateAction(action.id, { scheduledFor: action.scheduledFor ?? null }, action.version + 1);
      } });
    }
    setErrors(failed);
    setSaving(false);
  };
  const addStep = async () => {
    if (creating || !newTitle.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const goal = activeGoals.find((candidate) => candidate.id === selectedNewGoalId);
      await createAction({ title: newTitle.trim(), goalId: goal?.id, areaId: goal?.areaId });
      setNewTitle("");
      notifySuccess("Działanie dodane. Możesz przypisać mu dzień.");
    } catch {
      setCreateError("Nie udało się dodać Działania. Spróbuj ponownie.");
    } finally {
      setCreating(false);
    }
  };

  return <Panel className="weekly-plan-panel" aria-labelledby="weekly-plan-title">
    <div className="weekly-plan-header">
      <div className="section-heading"><div><span className="section-kicker"><CalendarDays />Plan tygodnia</span><h2 id="weekly-plan-title">Rozłóż kroki na kolejny tydzień</h2></div></div>
      <div className="weekly-plan-week"><span className="weekly-plan-week-icon"><CalendarDays /></span><span><small>Następny tydzień</small><strong>{dateLabel(week.startDate)} – {dateLabel(week.endDate)}</strong></span></div>
    </div>
    {selectedGoalIds.length || value.includeStandalone ? <p className="weekly-plan-intro">Rozplanuj otwarte Działania, przypisując krokom konkretne dni.</p> : null}
    <details className="weekly-plan-goal-picker">
      <summary>
        <span className="weekly-plan-goal-label">
          <span className="weekly-plan-goal-icon"><Target /></span>
          <span className="weekly-plan-goal-copy"><strong>Wybierz zakres planu</strong><small>Do 3 Celów lub samodzielne Działania</small></span>
        </span>
        <span className="weekly-plan-selected-count"><strong>{selectedGoalIds.length}</strong><small>/3</small></span>
      </summary>
      <div className="weekly-plan-goals" role="group" aria-label="Cele na kolejny tydzień">
        {activeGoals.map((goal) => <label key={goal.id}><input type="checkbox" checked={selectedGoalIds.includes(goal.id)} disabled={saving || (!selectedGoalIds.includes(goal.id) && selectedGoalIds.length >= 3)} onChange={() => toggleGoal(goal.id)} /><span>{goal.title}</span></label>)}
        <label><input type="checkbox" checked={value.includeStandalone} disabled={saving} onChange={toggleStandalone} /><span>Samodzielne Działania</span></label>
      </div>
    </details>
    {selectedGoalIds.length || value.includeStandalone ? <>
      <div className="weekly-plan-actions">
        {actions.length ? actions.map((action) => {
          const change = value.changes[action.id];
          return <div className="weekly-plan-action" key={action.id}>
            <div><Link to={`/actions/${encodeURIComponent(action.id)}`}>{action.title}</Link><small>{action.status === "blocked" ? `Zablokowane: ${action.blocker ?? "sprawdź powód"}` : action.recurringTemplateId ? "Wystąpienie Rutyny" : action.scheduledFor ? `Obecny termin: ${action.scheduledFor}` : "Bez terminu"}</small></div>
            <select aria-label={`Dzień dla Działania: ${action.title}`} value={change ? change.date ?? "none" : "keep"} disabled={saving || action.status === "blocked"} onChange={(event) => stageDate(action, event.target.value)}><option value="keep">Bez zmiany</option>{week.dates.map((date) => <option key={date} value={date}>{dateLabel(date)}</option>)}<option value="none">Usuń termin</option></select>
            {errors[action.id] ? <p className="inline-mutation-error" role="alert">{errors[action.id]}</p> : null}
          </div>;
        }) : <div className="weekly-plan-empty-actions"><strong>Nie ma jeszcze otwartych Działań</strong><span>Dodaj pierwszy krok poniżej, a potem przypisz mu dzień.</span></div>}
      </div>
      <div className="weekly-plan-new-step"><label htmlFor="weekly-plan-new-title">Nowy krok</label><div><input id="weekly-plan-new-title" value={newTitle} disabled={creating} onChange={(event) => setNewTitle(event.target.value)} placeholder="Np. przygotować szkic" /><select aria-label="Cel nowego Działania" value={selectedNewGoalId} disabled={creating} onChange={(event) => setNewGoalId(event.target.value)}>{value.includeStandalone ? <option value="">Samodzielne Działanie</option> : null}{selectedGoalIds.map((id) => { const goal = activeGoals.find((candidate) => candidate.id === id); return goal ? <option key={id} value={id}>{goal.title}</option> : null; })}</select><Button variant="secondary" disabled={!newTitle.trim()} loading={creating} onClick={() => void addStep()}><Plus />Dodaj krok</Button></div>{createError ? <p className="inline-mutation-error" role="alert">{createError}</p> : null}</div>
    </> : <div className="weekly-plan-empty-state"><span className="weekly-plan-empty-icon"><ListChecks /></span><span><strong>Plan zaczyna się od wyboru zakresu</strong><small>Zaznacz do 3 Celów albo samodzielne Działania, aby wyświetlić kroki do zaplanowania.</small></span></div>}
    {stagedCount ? <div className="weekly-plan-preview"><strong>Przed zapisem: {stagedCount} {stagedCount === 1 ? "zmiana terminu" : "zmiany terminów"}</strong>{pending.length ? <ul>{pending.map((action) => <li key={action.id}>{action.title}: {action.scheduledFor ?? "bez terminu"} → {value.changes[action.id]!.date ?? "bez terminu"}</li>)}</ul> : <p className="muted-copy">Działanie z niezapisaną zmianą nie jest już widoczne. Odrzuć zmianę, aby zamknąć tydzień.</p>}<div className="weekly-plan-preview-actions"><Button variant="primary" loading={saving} disabled={!pending.length} onClick={() => void saveDates()}>Zapisz terminy</Button><Button variant="ghost" disabled={saving} onClick={() => { onChange((current) => ({ ...current, changes: {} })); setErrors({}); }}>Odrzuć zmiany</Button></div></div> : null}
  </Panel>;
}
