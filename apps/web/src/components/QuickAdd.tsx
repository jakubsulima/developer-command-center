import { BookMarked, CalendarClock, ChevronDown, Flag, FolderKanban, Library, ListPlus, Plus, Repeat2, SlidersHorizontal, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useStore } from "../app/useStore";
import { normalizeQuickAddMode, parseQuickAddCommand, quickAddModes, splitQuickAddContent, type QuickAddMode } from "../domain/quickAdd";
import { captureErrorMessage, normalizeCapture } from "../domain/capture";
import { normalizeHttpUrl } from "../domain/http-url";
import { knowledgeDefaultRelationMeaning } from "../domain/labels";
import { knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useActionFeedback } from "./action-feedback-context";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { finishPerformanceTiming } from "../lib/performanceMetrics";
import { KnowledgeKindPicker } from "./KnowledgeKindPicker";
import { MultiCombobox } from "./MultiCombobox";

export type QuickAddRequest = {
  mode?: QuickAddMode;
  goalId?: string;
  areaId?: string;
  scheduledFor?: string;
  pinnedToToday?: boolean;
  /** Distinguishes drafts belonging to contextual entry points. */
  draftKey?: string;
};

type QuickAddDraft = { mode: QuickAddMode; content: string; context: string; scheduledFor: string; pinnedToToday: boolean; libraryKind: CreatableKnowledgeKind; sourceUrl: string; goalIds: string[]; routineUnit: "day" | "week" | "month"; routineInterval: string; routineStartsOn: string; routineWeekdays: number[] };
const emptyDraft: QuickAddDraft = { mode: "action", content: "", context: "", scheduledFor: "", pinnedToToday: true, libraryKind: "note", sourceUrl: "", goalIds: [], routineUnit: "week", routineInterval: "1", routineStartsOn: "", routineWeekdays: [] };
const isQuickAddDraft = (value: unknown): value is QuickAddDraft => Boolean(value && typeof value === "object" && typeof (value as QuickAddDraft).content === "string" && typeof (value as QuickAddDraft).context === "string" && (quickAddModes as readonly string[]).includes((value as QuickAddDraft).mode) && (value as QuickAddDraft).libraryKind in { note: true, resource: true, decision: true } && typeof (value as QuickAddDraft).sourceUrl === "string" && Array.isArray((value as QuickAddDraft).goalIds) && (value as QuickAddDraft).routineUnit in { day: true, week: true, month: true } && typeof (value as QuickAddDraft).routineInterval === "string" && typeof (value as QuickAddDraft).routineStartsOn === "string" && Array.isArray((value as QuickAddDraft).routineWeekdays));
function migrateQuickAddDraft(value: unknown, initialDraft: QuickAddDraft): QuickAddDraft | undefined {
  if (typeof value === "string") return { ...initialDraft, content: value, mode: "inbox" };
  if (!value || typeof value !== "object") return undefined;
  const legacy = value as Partial<QuickAddDraft> & { mode?: QuickAddMode };
  return typeof legacy.content === "string" ? { ...initialDraft, ...emptyDraft, ...legacy, mode: normalizeQuickAddMode(legacy.mode ?? "action"), sourceUrl: legacy.sourceUrl ?? "", goalIds: legacy.goalIds ?? [], routineUnit: legacy.routineUnit ?? initialDraft.routineUnit, routineInterval: legacy.routineInterval ?? initialDraft.routineInterval, routineStartsOn: legacy.routineStartsOn ?? initialDraft.routineStartsOn, routineWeekdays: legacy.routineWeekdays ?? initialDraft.routineWeekdays } : undefined;
}

const modes = [
  { id: "action" as const, label: "Działanie", command: "/dzialanie", icon: ListPlus },
  { id: "goal" as const, label: "Cel", command: "/cel", icon: Flag },
  { id: "project" as const, label: "Projekt", command: "/projekt", icon: FolderKanban },
  { id: "routine" as const, label: "Rutyna", command: "/rutyna", icon: Repeat2 },
  { id: "inbox" as const, label: "Skrzynka", command: "/skrzynka", icon: BookMarked },
  { id: "library" as const, label: "Biblioteka", command: "/wiedza", icon: Library }
] satisfies Array<{ id: QuickAddMode; label: string; command: string; icon: typeof ListPlus }>;

const copy = {
  action: { label: "Co chcesz zrobić?", placeholder: "Np. Spisać trzy pytania do rozmowy\nSzczegóły dopisz niżej", submit: "Dodaj Działanie", detail: "Działanie zapisze się w bieżącym kontekście" },
  goal: { label: "Co chcesz osiągnąć?", placeholder: "Np. Zbudować spokojny budżet domowy\nOpisz rezultat niżej", submit: "Utwórz Cel", detail: "Cel zapisze się w bieżącym kontekście" },
  project: { label: "Jaki Projekt utworzyć?", placeholder: "Np. Finanse osobiste\nDodaj krótki opis, jeśli potrzebujesz", submit: "Utwórz Projekt", detail: "Projekt stanie się stałym miejscem dla pracy" },
  routine: { label: "Co ma się powtarzać?", placeholder: "Np. Cotygodniowy przegląd\nOpis i szczegóły dopisz niżej", submit: "Utwórz Rutynę", detail: "Domyślnie co tydzień, od dzisiaj" },
  inbox: { label: "Co chcesz zachować?", placeholder: "Wklej link albo zapisz treść\nUporządkujesz później", submit: "Zapisz do Skrzynki", detail: "Surowa treść trafi do Wiedza → Skrzynka" },
  library: { label: "Co chcesz uporządkować?", placeholder: "Np. Wzorzec repozytorium\nOpisz materiał lub wniosek niżej", submit: "Zapisz w Bibliotece", detail: "Powstanie uporządkowany element Wiedzy" },
  knowledge: { label: "Co chcesz zachować?", placeholder: "Wklej link albo zapisz treść\nUporządkujesz później", submit: "Zapisz do Skrzynki", detail: "Zgodność ze starszą komendą — surowa treść trafi do Skrzynki" }
} satisfies Record<QuickAddMode, { label: string; placeholder: string; submit: string; detail: string }>;

const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };

export function QuickAdd({ open, request, onClose }: { open: boolean; request?: QuickAddRequest; onClose: () => void }) {
  const { state, createAction, createGoal, createArea, createRecurringAction, createKnowledge, capture } = useStore();
  const { notifySuccess } = useActionFeedback();
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const requestMode = request?.mode;
  const requestGoalId = request?.goalId;
  const requestAreaId = request?.areaId;
  const requestScheduledFor = request?.scheduledFor;
  const requestPinnedToToday = request?.pinnedToToday;
  const initialDraft = useMemo<QuickAddDraft>(() => ({ ...emptyDraft, mode: normalizeQuickAddMode(requestMode ?? "action"), context: requestGoalId ? `goal:${requestGoalId}` : requestAreaId ? `area:${requestAreaId}` : "", scheduledFor: requestScheduledFor ?? "", pinnedToToday: requestPinnedToToday ?? (requestMode === "action" ? false : true), routineStartsOn: currentDate, routineWeekdays: [new Date(`${currentDate}T12:00:00Z`).getUTCDay()] }), [currentDate, requestAreaId, requestGoalId, requestMode, requestPinnedToToday, requestScheduledFor]);
  const draftKind = request?.draftKey ? `quick-add:${request.draftKey}` : "global-quick-add";
  const migrate = useCallback((value: unknown) => migrateQuickAddDraft(value, initialDraft), [initialDraft]);
  const draft = usePersistentDraft<QuickAddDraft>(draftKind, initialDraft, 450, {
    targetId: "new",
    validate: isQuickAddDraft,
    migrate
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const modeCopy = copy[draft.value.mode] ?? copy.inbox;
  const modeLabel = modes.find((mode) => mode.id === draft.value.mode)?.label ?? "Skrzynka";
  const scheduledFor = draft.value.scheduledFor ?? "";
  const tomorrowDate = shiftDate(currentDate, 1);
  const activeGoals = useMemo(() => state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"), [state.goals]);
  const activeAreas = useMemo(() => state.areas.filter((area) => area.visibility === "active"), [state.areas]);
  const selectedGoalId = draft.value.context.startsWith("goal:") ? draft.value.context.slice(5) : undefined;
  const selectedAreaId = draft.value.context.startsWith("area:") ? draft.value.context.slice(5) : undefined;
  const selectedGoal = selectedGoalId ? activeGoals.find((goal) => goal.id === selectedGoalId) : undefined;
  const effectiveAreaId = selectedAreaId ?? selectedGoal?.areaId;
  const contextSummary = selectedGoal ? `Cel: ${selectedGoal.title}${effectiveAreaId ? ` · Projekt: ${activeAreas.find((area) => area.id === effectiveAreaId)?.name ?? "niedostępny"}` : ""}` : effectiveAreaId ? `Projekt: ${activeAreas.find((area) => area.id === effectiveAreaId)?.name ?? "niedostępny"}` : "Bez powiązania";
  const scheduleSummary = draft.value.mode === "action" ? `${scheduledFor || "bez terminu"} · ${draft.value.pinnedToToday ? "Na Starcie" : "nieprzypięte"}` : undefined;
  const titleForMode = ({ action: "Nowe Działanie", goal: "Nowy Cel", project: "Nowy Projekt", routine: "Nowa Rutyna", inbox: "Dodaj do Skrzynki", library: "Dodaj do Biblioteki", knowledge: "Dodaj do Skrzynki" } as Record<QuickAddMode, string>)[draft.value.mode] ?? "Dodaj";

  const setMode = (mode: QuickAddMode) => { setError(""); draft.setValue((current) => ({ ...current, mode })); };

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      // Do not summon the software keyboard before a touch user chooses to write.
      const isMobile = window.matchMedia?.("(max-width: 767px)").matches ?? false;
      if (!isMobile) contentRef.current?.focus();
      finishPerformanceTiming("quick-add", "quick-add-open");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const close = () => { setError(""); onClose(); };
  const updateContent = (value: string) => { const command = parseQuickAddCommand(value); setError(""); draft.setValue((current) => command ? { ...current, mode: command.mode, content: command.content } : { ...current, content: value }); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !draft.value.content.trim()) return;
    const mode = draft.value.mode;
    const content = draft.value.content.trim();
    const { title, detail } = splitQuickAddContent(content);
    const formData = { mode: normalizeQuickAddMode(mode), content, title, detail, goalId: selectedGoalId, areaId: effectiveAreaId, scheduledFor, pinnedToToday: draft.value.pinnedToToday };
    setSaving(true); setError("");
    try {
      if (formData.mode === "action") { await createAction({ title: formData.title, detail: formData.detail, goalId: formData.goalId, areaId: formData.areaId, scheduledFor: formData.scheduledFor || undefined, pinnedToToday: formData.pinnedToToday }); notifySuccess(formData.pinnedToToday ? "Działanie dodane do Startu." : "Działanie dodane."); }
      else if (formData.mode === "goal") { await createGoal({ title: formData.title, outcome: formData.detail || formData.title, areaId: formData.areaId }); notifySuccess("Cel utworzony."); }
      else if (formData.mode === "project") { await createArea(formData.title, formData.detail || undefined); notifySuccess("Projekt utworzony."); }
      else if (formData.mode === "routine") {
        const interval = Number(draft.value.routineInterval);
        const startsOn = draft.value.routineStartsOn || currentDate;
        if (!Number.isInteger(interval) || interval < 1 || interval > 99) throw new Error("Interwał Rutyny musi być liczbą całkowitą od 1 do 99.");
        if (!startsOn) throw new Error("Podaj datę początku Rutyny.");
        if (draft.value.routineUnit === "week" && !draft.value.routineWeekdays.length) throw new Error("Wybierz co najmniej jeden dzień tygodnia.");
        await createRecurringAction({ title: formData.title, detail: formData.detail, goalId: formData.goalId, areaId: formData.areaId, timezone: state.workspaceTimezone, startsOn, rule: { unit: draft.value.routineUnit, interval, weekdays: draft.value.routineUnit === "week" ? draft.value.routineWeekdays : undefined, dayOfMonth: draft.value.routineUnit === "month" ? Number(startsOn.slice(8, 10)) : undefined } });
        notifySuccess("Rutyna utworzona.");
      }
      else if (formData.mode === "inbox") {
        const normalized = normalizeCapture(formData.content, draft.value.mode === "knowledge" ? undefined : "text");
        await capture(normalized.content, normalized.kind);
        notifySuccess("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
      }
      else {
        const guidance = knowledgeKindGuidance[draft.value.libraryKind];
        if (guidance.detailRequired && !formData.detail) throw new Error("Uzasadnienie decyzji jest wymagane.");
        const sourceUrl = draft.value.libraryKind === "resource" ? normalizeHttpUrl(draft.value.sourceUrl) : undefined;
        const relations = [
          ...(formData.areaId ? [{ meaning: knowledgeDefaultRelationMeaning(draft.value.libraryKind), target: { areaId: formData.areaId } }] : []),
          ...draft.value.goalIds.map((goalId) => ({ meaning: knowledgeDefaultRelationMeaning(draft.value.libraryKind), target: { goalId } }))
        ];
        await createKnowledge({ kind: draft.value.libraryKind, title: formData.title, detail: formData.detail, sourceUrl, relations });
        notifySuccess(`${guidance.label} zapisano w Bibliotece.`);
      }
      draft.clear(); close();
    } catch (caught) { setError(caught instanceof Error ? captureErrorMessage(caught.message) : "Nie udało się zapisać. Spróbuj ponownie."); }
    finally { setSaving(false); }
  };

  const contextOptions = <><option value="">Bez powiązania</option>{activeGoals.length ? <optgroup label="Cele">{activeGoals.map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}{goal.areaId ? " · w Projekcie" : ""}</option>)}</optgroup> : null}{activeAreas.length ? <optgroup label="Projekty">{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup> : null}</>;

  return <Modal open={open} title={titleForMode} ariaLabel="Dodaj" className="creation-hub-modal" backdropClassName="quick-add-backdrop" onClose={close} closeDisabled={saving}>
    <form className="quick-add" noValidate onSubmit={(event) => void submit(event)}>
      <div className="quick-add-body">
        <div className="create-hub-intro"><span><Sparkles /></span><div><strong>Jedno miejsce do tworzenia</strong><p>Typ i miejsce zapisu są jawne. Szczegóły możesz dopisać niżej.</p></div></div>
        <div className="quick-add-choice-heading"><strong>Co chcesz dodać?</strong><small>Wybierz typ, a pokażę odpowiednie pola.</small></div>
        {request ? <details className="quick-add-type-picker"><summary><span>Typ: <strong>{modeLabel}</strong></span><span>Zmień</span></summary><div className="quick-add-modes" role="group" aria-label="Co chcesz dodać?">{modes.map(({ id, label, icon: Icon }) => <button type="button" disabled={saving} aria-label={id === "inbox" ? "Do Skrzynki" : label} aria-pressed={draft.value.mode === id} key={id} onClick={() => setMode(id)}><span><Icon /></span><small>{label}</small></button>)}</div></details> : <div className="quick-add-modes" role="group" aria-label="Co chcesz dodać?">{modes.map(({ id, label, icon: Icon }) => <button type="button" disabled={saving} aria-label={id === "inbox" ? "Do Skrzynki" : label} aria-pressed={draft.value.mode === id} key={id} onClick={() => setMode(id)}><span><Icon /></span><small>{label}</small></button>)}</div>}
        <div className="quick-add-mode-panel">
          <div className="quick-add-mode-heading"><span>{modeCopy.label}</span><small>{modeCopy.detail}</small></div>
          <div className="quick-add-composer"><textarea ref={contentRef} id="quick-add-content" aria-label={modeCopy.label} rows={3} required placeholder={modeCopy.placeholder} value={draft.value.content} disabled={saving} onChange={(event) => updateContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><span><Sparkles />{draft.value.mode === "inbox" ? " Surowa treść trafi do Skrzynki" : " Pierwsza linia staje się nazwą"}</span></div>
          <p className="quick-add-context-summary"><strong>Miejsce zapisu:</strong> {draft.value.mode === "inbox" ? "Bez powiązania — uporządkujesz później" : contextSummary}</p>
          {scheduleSummary ? <p className="quick-add-context-summary"><strong>Termin:</strong> {scheduleSummary}</p> : null}
          {draft.value.mode === "action" ? <details className="quick-add-options"><summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><SlidersHorizontal /></span><span><strong>Powiązania i ustawienia</strong><small>Termin, projekt, rodzaj i dodatkowe opcje</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary><div className="quick-add-options-panel"><span className="field-label">Kiedy?</span><div className="quick-add-date-choices" role="group" aria-label="Termin Działania"><button type="button" disabled={saving} aria-pressed={scheduledFor === currentDate} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: currentDate, pinnedToToday: true }))}>Dzisiaj</button><button type="button" disabled={saving} aria-pressed={scheduledFor === tomorrowDate} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: tomorrowDate, pinnedToToday: false }))}>Jutro</button><button type="button" disabled={saving} aria-pressed={!scheduledFor} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: "", pinnedToToday: false }))}>Bez terminu</button></div><label className="field-label" htmlFor="quick-add-date"><CalendarClock /> Dokładna data</label><input id="quick-add-date" type="date" disabled={saving} value={scheduledFor} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} /><label className="field-label" htmlFor="quick-add-context">Cel lub Projekt</label><select id="quick-add-context" disabled={saving} value={draft.value.context} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>{contextOptions}</select><label className="switch-card quick-add-today"><input type="checkbox" disabled={saving} checked={draft.value.pinnedToToday} onChange={(event) => draft.setValue((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż na Starcie</strong><small>To osobne ustawienie od terminu.</small></span></label></div></details> : null}
          {draft.value.mode === "goal" ? <details className="quick-add-options" open><summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><SlidersHorizontal /></span><span><strong>Projekt</strong><small>Nowy Cel może należeć tylko do Projektu.</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary><div className="quick-add-options-panel"><label className="field-label" htmlFor="quick-add-context-secondary">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-context-secondary" disabled={saving} value={selectedAreaId ? `area:${selectedAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select></div></details> : null}
          {draft.value.mode === "routine" ? <details className="quick-add-options" open><summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><Repeat2 /></span><span><strong>Harmonogram i kontekst</strong><small>Ustaw rytm przed utworzeniem Rutyny.</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary><div className="quick-add-options-panel"><label className="field-label" htmlFor="quick-add-routine-unit">Powtarzaj</label><select id="quick-add-routine-unit" disabled={saving} value={draft.value.routineUnit} onChange={(event) => draft.setValue((current) => ({ ...current, routineUnit: event.target.value as QuickAddDraft["routineUnit"] }))}><option value="day">Codziennie</option><option value="week">Co tydzień</option><option value="month">Co miesiąc</option></select><label className="field-label" htmlFor="quick-add-routine-interval">Co ile?</label><input id="quick-add-routine-interval" type="number" min="1" max="99" inputMode="numeric" disabled={saving} value={draft.value.routineInterval} onChange={(event) => draft.setValue((current) => ({ ...current, routineInterval: event.target.value }))} /><label className="field-label" htmlFor="quick-add-routine-start">Początek</label><input id="quick-add-routine-start" type="date" disabled={saving} value={draft.value.routineStartsOn || currentDate} onChange={(event) => draft.setValue((current) => ({ ...current, routineStartsOn: event.target.value }))} />{draft.value.routineUnit === "week" ? <fieldset className="quick-add-weekdays"><legend className="field-label">Dni tygodnia</legend><div>{[["Pn", 1], ["Wt", 2], ["Śr", 3], ["Cz", 4], ["Pt", 5], ["So", 6], ["Nd", 0]].map(([label, value]) => <label key={label as string}><input type="checkbox" disabled={saving} checked={draft.value.routineWeekdays.includes(value as number)} onChange={(event) => draft.setValue((current) => ({ ...current, routineWeekdays: event.target.checked ? [...current.routineWeekdays, value as number].sort() : current.routineWeekdays.filter((day) => day !== value) }))} />{label}</label>)}</div></fieldset> : null}<label className="field-label" htmlFor="quick-add-context-routine">Cel lub Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-context-routine" disabled={saving} value={draft.value.context} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>{contextOptions}</select></div></details> : null}
          {draft.value.mode === "library" ? <div className="quick-add-library-fields"><KnowledgeKindPicker value={draft.value.libraryKind} name="quick-add-library-kind" onChange={(libraryKind) => draft.setValue((current) => ({ ...current, libraryKind }))} />{draft.value.libraryKind === "resource" ? <><label className="field-label" htmlFor="quick-add-library-url">Link HTTP/HTTPS <span className="optional-label">opcjonalnie</span></label><input id="quick-add-library-url" type="url" disabled={saving} value={draft.value.sourceUrl} onChange={(event) => draft.setValue((current) => ({ ...current, sourceUrl: event.target.value }))} /></> : null}<label className="field-label" htmlFor="quick-add-library-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-library-project" disabled={saving} value={selectedAreaId ? `area:${selectedAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select><span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span><MultiCombobox label="Powiązane Cele" options={activeGoals.map((goal) => ({ id: goal.id, label: goal.title }))} value={draft.value.goalIds} onChange={(goalIds) => draft.setValue((current) => ({ ...current, goalIds }))} /></div> : null}
        </div>
        <div className="quick-add-hint" aria-label="Dostępne komendy"><span>Możesz też zacząć od</span>{modes.map(({ id, command }) => <button type="button" disabled={saving} key={command} onClick={() => setMode(id)}><kbd>{command}</kbd></button>)}</div>
        <button className="quick-add-recurring" type="button" disabled={saving} onClick={() => setMode("routine")}><span><Repeat2 /></span><span><strong>Działanie cykliczne</strong><small>Utwórz Rutynę bez przekierowania i utraty szkicu</small></span><Plus /></button>
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
      </div>
      <div className="quick-add-footer"><div className="quick-add-draft"><DraftStatus status={draft.status} errorMessage={draft.errorMessage} onRetry={() => void draft.retry()} onCopy={() => void navigator.clipboard?.writeText(draft.value.content)} />{draft.dirty ? <Button type="button" variant="ghost" disabled={saving} onClick={draft.discard}>Odrzuć szkic</Button> : null}</div><Button type="submit" variant="primary" loading={saving} disabled={!draft.value.content.trim()}><Plus />{modeCopy.submit}</Button></div>
    </form>
  </Modal>;
}
