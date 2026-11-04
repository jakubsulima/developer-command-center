import type { ReactNode } from "react";
import type { QuickAddDraft } from "./creationDraft";

export function RoutineCreationFields({ value, onChange, contextOptions }: { value: QuickAddDraft; onChange: (value: QuickAddDraft) => void; contextOptions: ReactNode }) {
  const update = (changes: Partial<QuickAddDraft>) => onChange({ ...value, ...changes });
  return <div className="creation-fields">
    <details><summary>Zacznij od gotowej propozycji</summary><div className="preset-library">{[
      { title: "Przegląd celów", unit: "week" as const, checklist: "Cel bez następnego kroku\nBlokady i terminy\nPilny Inbox" },
      { title: "Przegląd budżetu", unit: "week" as const, checklist: "Sprawdź saldo\nZapisz jedną decyzję" },
      { title: "Powtórka materiału", unit: "week" as const, checklist: "Otwórz materiały\nZapisz luki" },
      { title: "Backup", unit: "month" as const, checklist: "Uruchom kopię\nZweryfikuj odtworzenie" },
      { title: "Opróżnij Inbox", unit: "week" as const, checklist: "Podejmij decyzję o każdym elemencie" }
    ].map((preset) => <button key={preset.title} type="button" onClick={() => update({ title: preset.title, routineUnit: preset.unit, routineChecklist: preset.checklist })}>{preset.title}</button>)}</div></details>
    <label className="field-label" htmlFor="quick-add-routine-unit">Powtarzaj</label><select id="quick-add-routine-unit" value={value.routineUnit} onChange={(event) => update({ routineUnit: event.target.value as QuickAddDraft["routineUnit"] })}><option value="day">Codziennie</option><option value="week">Co tydzień</option><option value="month">Co miesiąc</option></select>
    <label className="field-label" htmlFor="quick-add-routine-interval">Co ile?</label><input id="quick-add-routine-interval" type="number" min="1" max="99" value={value.routineInterval} onChange={(event) => update({ routineInterval: event.target.value })} />
    <label className="field-label" htmlFor="quick-add-routine-start">Początek</label><input id="quick-add-routine-start" type="date" value={value.routineStartsOn} onChange={(event) => update({ routineStartsOn: event.target.value })} />
    {value.routineUnit === "week" ? <fieldset className="quick-add-weekdays"><legend>Dni tygodnia</legend><div>{([["Pn", 1], ["Wt", 2], ["Śr", 3], ["Cz", 4], ["Pt", 5], ["So", 6], ["Nd", 0]] as const).map(([label, day]) => <label key={day}><input id={`quick-add-weekday-${day}`} type="checkbox" checked={value.routineWeekdays.includes(day)} onChange={(event) => update({ routineWeekdays: event.target.checked ? [...value.routineWeekdays, day].sort() : value.routineWeekdays.filter((entry) => entry !== day) })} />{label}</label>)}</div></fieldset> : null}
    <label className="field-label" htmlFor="quick-add-context-routine">Cel lub Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-context-routine" value={value.context} onChange={(event) => update({ context: event.target.value })}>{contextOptions}</select>
    <details className="advanced-options"><summary>Więcej opcji</summary><div className="creation-fields">
      <label className="field-label" htmlFor="quick-add-routine-end">Koniec <span className="optional-label">opcjonalnie</span></label><input id="quick-add-routine-end" type="date" min={value.routineStartsOn} value={value.routineEndsOn ?? ""} onChange={(event) => update({ routineEndsOn: event.target.value })} />
      <label className="field-label" htmlFor="quick-add-missed-policy">Po dłuższej przerwie</label><select id="quick-add-missed-policy" value={value.routineMissedPolicy ?? "skip_missed"} onChange={(event) => update({ routineMissedPolicy: event.target.value as QuickAddDraft["routineMissedPolicy"] })}><option value="skip_missed">Pomiń stare terminy (zalecane)</option><option value="carry_one">Zachowaj najwyżej jeden zaległy</option></select>
      <label className="field-label" htmlFor="quick-add-routine-checklist">Checklista <span className="optional-label">jeden punkt w linii</span></label><textarea id="quick-add-routine-checklist" rows={3} value={value.routineChecklist ?? ""} onChange={(event) => update({ routineChecklist: event.target.value })} />
    </div></details>
  </div>;
}
