import { CalendarClock, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { Area, Goal } from "../domain/types";
import type { QuickAddDraft } from "./creationDraft";

type ScheduleChoice = "today" | "tomorrow" | "unscheduled" | "custom";

type Props = {
  draft: { value: QuickAddDraft; setValue: (next: QuickAddDraft | ((current: QuickAddDraft) => QuickAddDraft)) => void };
  saving: boolean;
  currentDate: string;
  tomorrowDate: string;
  scheduledFor: string;
  scheduleChoice: ScheduleChoice;
  setScheduleChoiceOverride: (value: ScheduleChoice) => void;
  contextExpanded: boolean;
  setContextExpanded: (next: (value: boolean) => boolean) => void;
  activeAreas: Area[];
  activeGoals: Goal[];
};

const dates = [["today", "Dzisiaj"], ["tomorrow", "Jutro"], ["unscheduled", "Bez terminu"], ["custom", "Inna data"]] as const;

export function ActionCreationFields({ draft, saving, currentDate, tomorrowDate, scheduledFor, scheduleChoice, setScheduleChoiceOverride, contextExpanded, setContextExpanded, activeAreas, activeGoals }: Props) {
  const context = draft.value.context;
  const goalId = context.startsWith("goal:") ? context.slice(5) : "";
  const areaId = context.startsWith("area:") ? context.slice(5) : (activeGoals.find((goal) => goal.id === goalId)?.areaId ?? "");
  const groups = activeGoals.filter((goal) => (goal.areaId ?? "") === areaId);
  const setContext = (value: string) => draft.setValue((current) => ({ ...current, context: value }));

  const setDate = (choice: ScheduleChoice) => {
    setScheduleChoiceOverride(choice);
    if (choice === "custom") return;
    const date = choice === "today" ? currentDate : choice === "tomorrow" ? tomorrowDate : "";
    draft.setValue((current) => ({ ...current, scheduledFor: date }));
  };

  return <>
    <span className="field-label" id="quick-add-schedule-label">Kiedy?</span>
    <div className="quick-add-date-choices" role="radiogroup" aria-labelledby="quick-add-schedule-label">
      {dates.map(([value, label]) => <label key={value}>
        <input type="radio" name="quick-add-schedule" value={value} disabled={saving} checked={scheduleChoice === value} onChange={() => setDate(value)} />
        {label}
      </label>)}
    </div>
    {scheduleChoice === "custom" && <>
      <label className="field-label" htmlFor="quick-add-date"><CalendarClock aria-hidden="true" />Dokładna data</label>
      <input id="quick-add-date" type="date" disabled={saving} value={scheduledFor} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} />
    </>}
    <details className="quick-add-options quick-add-action-options" open={contextExpanded}>
      <summary aria-expanded={contextExpanded} onClick={(event) => { event.preventDefault(); setContextExpanded((expanded) => !expanded); }}>
        <span className="quick-add-options-leading">
          <span className="quick-add-options-icon"><SlidersHorizontal aria-hidden="true" /></span>
          <span><strong>Projekt, grupa i przypięcie</strong><small>Opcjonalnie</small></span>
        </span>
        <ChevronDown className="quick-add-options-chevron" aria-hidden="true" />
      </summary>
      <div className="quick-add-options-panel">
        <label className="field-label" htmlFor="quick-add-action-project">Projekt</label>
        <select id="quick-add-action-project" disabled={saving} value={areaId} onChange={(event) => setContext(event.target.value ? `area:${event.target.value}` : "")}>
          <option value="">Bez Projektu</option>
          {areaId && !activeAreas.some((area) => area.id === areaId) && <option value={areaId}>Projekt niedostępny</option>}
          {activeAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
        </select>
        <label className="field-label" htmlFor="quick-add-action-group">Grupa działań</label>
        <select id="quick-add-action-group" disabled={saving} value={goalId} onChange={(event) => setContext(event.target.value ? `goal:${event.target.value}` : areaId ? `area:${areaId}` : "")}>
          <option value="">Bez grupy</option>
          {goalId && !groups.some((goal) => goal.id === goalId) && <option value={goalId}>Grupa niedostępna</option>}
          {groups.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
        </select>
        <p className="muted-copy">Wybierz Projekt, aby zobaczyć jego grupy. Przypisanie do grupy zachowuje jej Projekt.</p>
        <label className="switch-card quick-add-today">
          <input type="checkbox" disabled={saving} checked={draft.value.pinnedToToday} onChange={(event) => draft.setValue((current) => ({ ...current, pinnedToToday: event.target.checked }))} />
          <span><strong>Przypnij do Startu</strong><small>Pokaż na Starcie niezależnie od terminu.</small></span>
        </label>
      </div>
    </details>
  </>;
}
