import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, Check, Layers3, ListChecks, Repeat2 } from "lucide-react";
import { useStore } from "../app/useStore";
import { describeRecurringSchedule, nextOccurrenceDates } from "../domain/recurrence";
import type { RecurringActionTemplate } from "../domain/types";
import { Modal } from "./Modal";
import { Button } from "./ui";

const presets = [
  { name: "Przegląd celów", unit: "week" as const, checklist: "Cel bez następnego kroku\nBlokady i terminy\nPilny Inbox" },
  { name: "Przegląd budżetu", unit: "week" as const, checklist: "Sprawdź saldo\nZapisz jedną decyzję" },
  { name: "Powtórka materiału", unit: "week" as const, checklist: "Otwórz materiały\nZapisz luki" },
  { name: "Backup", unit: "month" as const, checklist: "Uruchom kopię\nZweryfikuj odtworzenie" },
  { name: "Opróżnij Inbox", unit: "week" as const, checklist: "Podejmij decyzję o każdym elemencie" }
];

const todayFor = (timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };
const formatOccurrence = (date: string, timeZone: string) => new Intl.DateTimeFormat("pl-PL", { weekday: "short", day: "numeric", month: "short", timeZone }).format(new Date(`${date}T12:00:00Z`));

type FormState = { title: string; detail: string; unit: "day" | "week" | "month"; interval: string; startsOn: string; endsOn: string; weekdays: number[]; goalId: string; areaId: string; missedPolicy: "skip_missed" | "carry_one"; checklist: string; updateFuture: boolean };

function defaultForm(currentDate: string): FormState {
  return { title: "", detail: "", unit: "week", interval: "1", startsOn: currentDate, endsOn: "", weekdays: [new Date(`${currentDate}T12:00:00Z`).getUTCDay()], goalId: "", areaId: "", missedPolicy: "skip_missed", checklist: "", updateFuture: true };
}

export function RecurringActionForm({ open, templateId, onClose }: { open: boolean; templateId?: string; onClose: () => void }) {
  const { state, createRecurringAction, updateRecurringAction, materializeRecurring } = useStore();
  const currentDate = todayFor(state.workspaceTimezone);
  const [form, setForm] = useState<FormState>(() => defaultForm(currentDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(templateId);

  useEffect(() => {
    if (!open) return;
    const template = templateId ? state.recurringActionTemplates.find((item) => item.id === templateId) : undefined;
    setForm(template ? { title: template.title, detail: template.detail, unit: template.rule.unit, interval: String(template.rule.interval), startsOn: template.startsOn, endsOn: template.rule.endsOn ?? "", weekdays: template.rule.weekdays ?? [], goalId: template.goalId ?? "", areaId: template.areaId ?? "", missedPolicy: template.missedPolicy, checklist: template.checklist.map((item) => item.title).join("\n"), updateFuture: true } : defaultForm(currentDate));
    setError("");
  }, [currentDate, open, state.recurringActionTemplates, templateId]);

  const previewTemplate = useMemo(() => ({
    id: "preview", title: form.title || "Działanie", detail: "", timezone: state.workspaceTimezone, startsOn: form.startsOn,
    rule: { unit: form.unit, interval: Math.max(1, Number(form.interval) || 1), weekdays: form.unit === "week" ? form.weekdays : undefined, dayOfMonth: form.unit === "month" ? Number(form.startsOn.slice(8, 10)) : undefined, endsOn: form.endsOn || undefined },
    missedPolicy: form.missedPolicy, status: "active", checklist: [], skippedOccurrenceCount: 0, createdAt: "", updatedAt: ""
  } as RecurringActionTemplate), [form, state.workspaceTimezone]);
  const preview = useMemo(() => nextOccurrenceDates(previewTemplate, currentDate, 3), [currentDate, previewTemplate]);
  const context = state.goals.find((goal) => goal.id === form.goalId)?.title ?? state.areas.find((area) => area.id === form.areaId)?.name ?? "Samodzielna rutyna";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const input = { title: form.title, detail: form.detail, startsOn: form.startsOn, goalId: form.goalId || undefined, areaId: form.areaId || undefined, rule: { unit: form.unit, interval: Math.max(1, Number(form.interval) || 1), weekdays: form.unit === "week" ? form.weekdays : undefined, dayOfMonth: form.unit === "month" ? Number(form.startsOn.slice(8, 10)) : undefined, endsOn: form.endsOn || undefined }, missedPolicy: form.missedPolicy, checklist: form.checklist.split("\n").map((item) => item.trim()).filter(Boolean) };
    try {
      if (templateId) await updateRecurringAction(templateId, input, form.updateFuture);
      else await createRecurringAction(input);
      await materializeRecurring(currentDate);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać Rutyny.");
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={open} closeDisabled={saving} title={editing ? "Edytuj serię cykliczną" : "Nowe Działanie cykliczne"} onClose={onClose}>
    <form className="guided-form" onSubmit={submit}>
      <p className="modal-intro">Zbuduj rytm krok po kroku. Wystąpienia Rutyny pojawią się później na Starcie jako zwykłe, cykliczne Działania.</p>
      <div className="preset-library"><span>Zacznij od gotowej propozycji</span><div>{presets.map((preset) => <button type="button" aria-pressed={form.title === preset.name} key={preset.name} onClick={() => setForm((current) => ({ ...current, title: preset.name, unit: preset.unit, checklist: preset.checklist }))}>{preset.name}</button>)}</div></div>
      <section className="guided-section"><div className="guided-section-title"><span>1</span><div><strong>Co ma wracać?</strong><small>Nazwa opisuje pojedyncze wykonanie.</small></div></div><label className="field-label" htmlFor="recurring-title">Nazwa</label><input id="recurring-title" placeholder="Np. Przegląd planu na tydzień" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /></section>
      <section className="guided-section"><div className="guided-section-title"><span>2</span><div><strong>Jak często?</strong><small>Wybierz rytm, interwał i dni.</small></div></div><fieldset className="frequency-picker"><legend className="sr-only">Powtarzaj</legend>{([{"value":"day","label":"Codziennie","hint":"Rytm dzienny"},{"value":"week","label":"Co tydzień","hint":"Wybrane dni"},{"value":"month","label":"Co miesiąc","hint":"Ten sam dzień"}] as const).map((option) => <button type="button" key={option.value} aria-pressed={form.unit === option.value} onClick={() => setForm((current) => ({ ...current, unit: option.value }))}><strong>{option.label}</strong><small>{option.hint}</small></button>)}</fieldset><label className="field-label" htmlFor="recurring-interval">Powtarzaj co ile {form.unit === "day" ? "dni" : form.unit === "week" ? "tygodni" : "miesięcy"}?</label><input className="interval-input" id="recurring-interval" type="number" min="1" max="99" value={form.interval} onChange={(event) => setForm((current) => ({ ...current, interval: event.target.value }))} />{form.unit === "week" && <fieldset className="weekday-picker"><legend>Dni tygodnia</legend>{["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"].map((label, value) => <label key={label}><input type="checkbox" checked={form.weekdays.includes(value)} onChange={(event) => setForm((current) => ({ ...current, weekdays: event.target.checked ? [...current.weekdays, value].sort() : current.weekdays.filter((day) => day !== value) }))} />{label}</label>)}</fieldset>}</section>
      <section className="guided-section"><div className="guided-section-title"><span>3</span><div><strong>Od kiedy i w jakim kontekście?</strong><small>Rutyna może wspierać Cel albo działać samodzielnie.</small></div></div><div className="quick-choice-row" role="group" aria-label="Szybki początek"><button type="button" aria-pressed={form.startsOn === currentDate} onClick={() => setForm((current) => ({ ...current, startsOn: currentDate }))}>Od dzisiaj</button><button type="button" aria-pressed={form.startsOn === shiftDate(currentDate, 1)} onClick={() => setForm((current) => ({ ...current, startsOn: shiftDate(currentDate, 1) }))}>Od jutra</button></div><label className="field-label" htmlFor="recurring-start">Początek</label><input id="recurring-start" type="date" value={form.startsOn} onChange={(event) => setForm((current) => ({ ...current, startsOn: event.target.value }))} required /></section>
      <details className="advanced-fields"><summary>Więcej opcji</summary><div><label className="field-label" htmlFor="recurring-detail">Opis</label><textarea id="recurring-detail" rows={2} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /><label className="field-label" htmlFor="recurring-goal">Cel lub Obszar <span className="optional-label">opcjonalnie</span></label><select id="recurring-goal" value={form.goalId || (form.areaId ? `area:${form.areaId}` : "")} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Samodzielne</option><optgroup label="Cele">{state.goals.filter((goal) => goal.visibility === "active" && goal.status === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Obszary">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select><label className="field-label" htmlFor="recurring-end">Koniec <span className="optional-label">opcjonalnie</span></label><input id="recurring-end" type="date" min={form.startsOn} value={form.endsOn} onChange={(event) => setForm((current) => ({ ...current, endsOn: event.target.value }))} /><label className="field-label" htmlFor="missed-policy">Po dłuższej przerwie</label><select id="missed-policy" value={form.missedPolicy} onChange={(event) => setForm((current) => ({ ...current, missedPolicy: event.target.value as FormState["missedPolicy"] }))}><option value="skip_missed">Pomiń stare terminy (zalecane)</option><option value="carry_one">Zachowaj najwyżej jeden zaległy</option></select><label className="field-label" htmlFor="recurring-checklist">Checklista <span className="optional-label">jeden punkt w linii</span></label><textarea id="recurring-checklist" rows={3} value={form.checklist} onChange={(event) => setForm((current) => ({ ...current, checklist: event.target.value }))} />{templateId ? <label className="checkbox-row"><input type="checkbox" checked={form.updateFuture} onChange={(event) => setForm((current) => ({ ...current, updateFuture: event.target.checked }))} />Zastosuj zmiany także do przyszłych wystąpień</label> : null}</div></details>
      <div className="creation-summary recurring-summary" aria-live="polite"><span className="creation-summary-icon"><Repeat2 /></span><div><small>Tak zapiszesz Rutynę</small><strong>{form.title.trim() || "Nowe Działanie cykliczne"}</strong><p><CalendarClock />{describeRecurringSchedule(previewTemplate)}</p><p><Layers3 />{context}</p>{form.checklist.trim() ? <p><ListChecks />{form.checklist.split("\n").filter((item) => item.trim()).length} punktów checklisty</p> : null}</div></div>
      <p className="occurrence-preview"><CalendarClock /><span>Najbliższe: {preview.length ? preview.map((date, index) => <span key={date}>{index ? ", " : ""}<time dateTime={date}>{formatOccurrence(date, state.workspaceTimezone)}</time></span>) : "brak w wybranym zakresie"}</span></p>
      {error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" disabled={saving} onClick={onClose}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.title.trim() || (form.unit === "week" && !form.weekdays.length)}><Check />{editing ? "Zapisz serię" : "Utwórz serię"}</Button></div>
    </form>
  </Modal>;
}
