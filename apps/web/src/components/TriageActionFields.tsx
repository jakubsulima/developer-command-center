import { useState } from "react";
import { useStore } from "../app/useStore";
import { localDateForTimeZone } from "../domain/activity";
import { shiftActionDate } from "../domain/actionPresentation";
import { emptyDraft } from "./creationDraft";
import { ActionCreationFields } from "./ActionCreationFields";

type Value = { title: string; detail: string; goalId: string; areaId: string; targetDate: string; pin: boolean };

export function TriageActionFields({ value, onChange }: { value: Value; onChange: (changes: Partial<Value>) => void }) {
  const { state } = useStore();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [dateChoice, setDateChoice] = useState<"today" | "tomorrow" | "unscheduled" | "custom">();
  const currentDate = localDateForTimeZone(new Date(), state.workspaceTimezone);
  const tomorrowDate = shiftActionDate(currentDate, 1);
  const draft = { ...emptyDraft, title: value.title, detail: value.detail, context: value.goalId ? `goal:${value.goalId}` : value.areaId ? `area:${value.areaId}` : "", scheduledFor: value.targetDate, pinnedToToday: value.pin };
  return <ActionCreationFields draft={{ value: draft, setValue: (next) => {
    const updated = typeof next === "function" ? next(draft) : next;
    const goalId = updated.context.startsWith("goal:") ? updated.context.slice(5) : "";
    const goal = state.goals.find((goal) => goal.id === goalId);
    onChange({ detail: updated.detail, targetDate: updated.scheduledFor, pin: updated.pinnedToToday, goalId, areaId: goal?.areaId ?? (updated.context.startsWith("area:") ? updated.context.slice(5) : "") });
  } }} saving={false} currentDate={currentDate} tomorrowDate={tomorrowDate} scheduledFor={value.targetDate} scheduleChoice={dateChoice ?? (value.targetDate === currentDate ? "today" : value.targetDate === tomorrowDate ? "tomorrow" : value.targetDate ? "custom" : "unscheduled")} setScheduleChoiceOverride={setDateChoice} detailExpanded={optionsOpen} setDetailExpanded={setOptionsOpen} detailField={<><label className="field-label" htmlFor="triage-action-detail">Opis</label><textarea id="triage-action-detail" value={value.detail} onChange={(event) => onChange({ detail: event.target.value })} /></>} contextOptions={<><option value="">Bez powiązania</option><optgroup label="Cele">{state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active" && (!value.areaId || goal.areaId === value.areaId)).map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}</option>)}</optgroup><optgroup label="Projekty">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></>} />;
}
