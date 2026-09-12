import { BookMarked, CalendarClock, ChevronDown, Flag, FolderKanban, Library, ListPlus, Plus, Repeat2, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useStore } from "../app/useStore";
import { normalizeQuickAddContext, normalizeQuickAddMode, parseQuickAddCommand, quickAddModes, splitQuickAddContent, type QuickAddMode } from "../domain/quickAdd";
import { captureErrorMessage, normalizeCapture } from "../domain/capture";
import { normalizeHttpUrl } from "../domain/http-url";
import { knowledgeDefaultRelationMeaning } from "../domain/labels";
import { knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useActionFeedback } from "./action-feedback-context";
import { FormTransition } from "./FormTransition";
import { DraftStatus } from "./DraftStatus";
import { Modal } from "./Modal";
import { Button } from "./ui";
import { finishPerformanceTiming } from "../lib/performanceMetrics";
import { KnowledgeKindPicker } from "./KnowledgeKindPicker";
import { MultiCombobox } from "./MultiCombobox";
import { nextOccurrenceDates } from "../domain/recurrence";
import type { RecurringActionTemplate } from "../domain/types";

export type QuickAddRequest = {
  mode?: QuickAddMode;
  goalId?: string;
  areaId?: string;
  scheduledFor?: string;
  pinnedToToday?: boolean;
  /** Distinguishes drafts belonging to contextual entry points. */
  draftKey?: string;
};

type QuickAddDraft = { mode: QuickAddMode; content: string; title: string; detail: string; context: string; scheduledFor: string; pinnedToToday: boolean; libraryKind: CreatableKnowledgeKind; sourceUrl: string; goalIds: string[]; routineUnit: "day" | "week" | "month"; routineInterval: string; routineStartsOn: string; routineWeekdays: number[]; contexts?: Partial<Record<QuickAddMode, string>> };
const emptyDraft: QuickAddDraft = { mode: "action", content: "", title: "", detail: "", context: "", scheduledFor: "", pinnedToToday: true, libraryKind: "note", sourceUrl: "", goalIds: [], routineUnit: "week", routineInterval: "1", routineStartsOn: "", routineWeekdays: [] };
const isQuickAddDraft = (value: unknown): value is QuickAddDraft => {
  if (!value || typeof value !== "object") return false;
  const draft = value as QuickAddDraft;
  return [draft.content, draft.title, draft.detail, draft.context, draft.scheduledFor, draft.sourceUrl, draft.routineInterval, draft.routineStartsOn].every((field) => typeof field === "string")
    && typeof draft.pinnedToToday === "boolean"
    && (quickAddModes as readonly string[]).includes(draft.mode)
    && ["note", "resource", "decision"].includes(draft.libraryKind)
    && ["day", "week", "month"].includes(draft.routineUnit)
    && Array.isArray(draft.goalIds) && draft.goalIds.every((id) => typeof id === "string")
    && Array.isArray(draft.routineWeekdays) && draft.routineWeekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && (draft.contexts === undefined || Boolean(draft.contexts && typeof draft.contexts === "object" && Object.entries(draft.contexts).every(([mode, context]) => (quickAddModes as readonly string[]).includes(mode) && typeof context === "string")));
};
function migrateQuickAddDraft(value: unknown, initialDraft: QuickAddDraft): QuickAddDraft | undefined {
  if (typeof value === "string") return { ...initialDraft, content: value, mode: "inbox" };
  if (!value || typeof value !== "object") return undefined;
  const legacy = value as Partial<QuickAddDraft>;
  if (typeof legacy.content !== "string" && typeof legacy.title !== "string") return undefined;
  const mode = legacy.mode === "knowledge" ? "inbox" : (quickAddModes as readonly unknown[]).includes(legacy.mode) ? legacy.mode! : initialDraft.mode;
  const content = typeof legacy.content === "string" ? legacy.content : legacy.title!;
  const split = splitQuickAddContent(content);
  const migrated = { ...initialDraft, mode, content, title: split.title, detail: split.detail };
  for (const field of ["title", "detail", "context", "scheduledFor", "sourceUrl", "routineInterval", "routineStartsOn"] as const) {
    if (typeof legacy[field] === "string") migrated[field] = legacy[field];
  }
  if (typeof legacy.pinnedToToday === "boolean") migrated.pinnedToToday = legacy.pinnedToToday;
  if (["note", "resource", "decision"].includes(legacy.libraryKind ?? "")) migrated.libraryKind = legacy.libraryKind!;
  if (["day", "week", "month"].includes(legacy.routineUnit ?? "")) migrated.routineUnit = legacy.routineUnit!;
  if (Array.isArray(legacy.goalIds)) migrated.goalIds = legacy.goalIds.filter((id) => typeof id === "string");
  if (Array.isArray(legacy.routineWeekdays)) migrated.routineWeekdays = legacy.routineWeekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return migrated;
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
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const typeSummaryRef = useRef<HTMLButtonElement>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const modeCopy = copy[draft.value.mode] ?? copy.inbox;
  const libraryGuidance = draft.value.mode === "library" ? knowledgeKindGuidance[draft.value.libraryKind] : undefined;
  const scheduledFor = draft.value.scheduledFor ?? "";
  const tomorrowDate = shiftDate(currentDate, 1);
  const activeGoals = useMemo(() => state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"), [state.goals]);
  const activeAreas = useMemo(() => state.areas.filter((area) => area.visibility === "active"), [state.areas]);
  const selectedGoalId = draft.value.context.startsWith("goal:") ? draft.value.context.slice(5) : undefined;
  const selectedAreaId = draft.value.context.startsWith("area:") ? draft.value.context.slice(5) : undefined;
  const normalizedContext = useMemo(() => normalizeQuickAddContext({ mode: draft.value.mode, goalId: selectedGoalId, areaId: selectedAreaId, goalIds: draft.value.goalIds, activeGoals, activeAreas }), [activeAreas, activeGoals, draft.value.goalIds, draft.value.mode, selectedAreaId, selectedGoalId]);
  const selectedGoal = normalizedContext.goalId ? activeGoals.find((goal) => goal.id === normalizedContext.goalId) : undefined;
  const effectiveAreaId = normalizedContext.areaId;
  const contextSummary = selectedGoal ? `Cel: ${selectedGoal.title}${effectiveAreaId ? ` · Projekt: ${activeAreas.find((area) => area.id === effectiveAreaId)?.name ?? "niedostępny"}` : ""}` : effectiveAreaId ? `Projekt: ${activeAreas.find((area) => area.id === effectiveAreaId)?.name ?? "niedostępny"}` : draft.value.mode === "inbox" ? "Bez powiązań" : draft.value.mode === "project" ? "Nowy samodzielny Projekt" : "Bez powiązania";
  const scheduleSummary = draft.value.mode === "action" ? `${scheduledFor || "bez terminu"} · ${draft.value.pinnedToToday ? "Na Starcie" : "nieprzypięte"}` : undefined;
  const routinePreview = useMemo(() => {
    if (draft.value.mode !== "routine") return [];
    const startsOn = draft.value.routineStartsOn || currentDate;
    const preview = { id: "quick-add-preview", title: draft.value.title || "Rutyna", detail: draft.value.detail, timezone: state.workspaceTimezone, startsOn, rule: { unit: draft.value.routineUnit, interval: Math.max(1, Number(draft.value.routineInterval) || 1), weekdays: draft.value.routineUnit === "week" ? draft.value.routineWeekdays : undefined, dayOfMonth: draft.value.routineUnit === "month" ? Number(startsOn.slice(8, 10)) : undefined }, missedPolicy: "skip_missed" as const, status: "active" as const, checklist: [], skippedOccurrenceCount: 0, createdAt: "", updatedAt: "" } satisfies RecurringActionTemplate;
    return nextOccurrenceDates(preview, currentDate, 3);
  }, [currentDate, draft.value, state.workspaceTimezone]);
  const titleForMode = ({ action: "Nowe Działanie", goal: "Nowy Cel", project: "Nowy Projekt", routine: "Nowa Rutyna", inbox: "Dodaj do Skrzynki", library: "Dodaj do Biblioteki", knowledge: "Dodaj do Skrzynki" } as Record<QuickAddMode, string>)[draft.value.mode] ?? "Dodaj";

  // Keep each type's explicit context while sharing the text and preserving
  // date, recurrence and resource settings when the user switches away.
  const changeMode = (current: QuickAddDraft, requestedMode: QuickAddMode, content?: string): QuickAddDraft => {
    const mode = normalizeQuickAddMode(requestedMode);
    const source = normalizeQuickAddContext({ mode, goalId: current.context.startsWith("goal:") ? current.context.slice(5) : undefined, areaId: current.context.startsWith("area:") ? current.context.slice(5) : undefined, goalIds: current.goalIds, activeGoals, activeAreas });
    const contexts = { ...current.contexts, [current.mode]: current.context };
    const inheritedContext = mode === "project" || mode === "inbox" ? "" : mode === "goal" || mode === "library" ? (source.areaId ? `area:${source.areaId}` : source.unavailable ? current.context : "") : current.context;
    const text = content ?? (current.mode === "inbox" ? current.content : `${current.title}${current.detail ? `\n${current.detail}` : ""}`);
    const split = splitQuickAddContent(text);
    return { ...current, mode, contexts, context: mode === current.mode ? current.context : contexts[mode] ?? inheritedContext, goalIds: mode === "library" && contexts.library === undefined ? Array.from(new Set([...current.goalIds, ...source.goalIds])) : current.goalIds, content: text, title: split.title, detail: split.detail };
  };
  const setMode = (mode: QuickAddMode) => {
    if (saving) return;
    setError(""); setTypePickerOpen(false);
    draft.setValue((current) => changeMode(current, mode));
    typeSummaryRef.current?.focus();
  };

  useEffect(() => { if (open) finishPerformanceTiming("quick-add", "quick-add-open"); }, [open]);
  useEffect(() => { if (open) setTypePickerOpen(!request?.mode); }, [open, request?.mode]);

  const close = () => {
    if (savingRef.current) return;
    if (!draft.flush()) return;
    setError(""); onClose();
  };
  const updateContent = (value: string) => {
    const command = parseQuickAddCommand(value);
    setError("");
    if (command) setTypePickerOpen(false);
    draft.setValue((current) => command ? changeMode(current, command.mode, command.content) : { ...current, content: value });
  };
  const updateStructuredField = (field: "title" | "detail", value: string) => {
    setError("");
    draft.setValue((current) => ({ ...current, [field]: value, content: field === "title" ? `${value}${current.detail ? `\n${current.detail}` : ""}` : `${current.title}${value ? `\n${value}` : ""}` }));
  };
  const updateTitleField = (value: string) => {
    const command = parseQuickAddCommand(value);
    if (!command) { updateStructuredField("title", value); return; }
    setError(""); setTypePickerOpen(false);
    draft.setValue((current) => changeMode(current, command.mode, `${command.content}${!command.content.includes("\n") && current.detail ? `\n${current.detail}` : ""}`));
  };
  const showFieldError = (message: string, id: string) => {
    setError(message);
    const field = document.getElementById(id);
    field?.closest("details")?.setAttribute("open", "");
    field?.focus();
    field?.scrollIntoView?.({ block: "nearest" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    const mode = draft.value.mode;
    const content = mode === "inbox" ? draft.value.content : `${draft.value.title.trim()}${draft.value.detail.trim() ? `\n${draft.value.detail.trim()}` : ""}`;
    const title = draft.value.title.trim();
    const detail = draft.value.detail.trim();
    const formData = { mode: normalizeQuickAddMode(mode), content, title, detail, goalId: normalizedContext.goalId, areaId: effectiveAreaId, scheduledFor, pinnedToToday: draft.value.pinnedToToday };
    if (!content.trim() || (mode !== "inbox" && !title)) return;
    if (normalizedContext.unavailable) { setError(`Wybrane powiązanie jest niedostępne: ${normalizedContext.unavailable.label}. Zmień je albo odłącz przed zapisem.`); return; }
    if (mode === "routine") {
      const interval = Number(draft.value.routineInterval);
      if (!Number.isInteger(interval) || interval < 1 || interval > 99) { showFieldError("Interwał Rutyny musi być liczbą całkowitą od 1 do 99.", "quick-add-routine-interval"); return; }
      if (!draft.value.routineStartsOn) { showFieldError("Podaj datę początku Rutyny.", "quick-add-routine-start"); return; }
      if (draft.value.routineUnit === "week" && !draft.value.routineWeekdays.length) { showFieldError("Wybierz co najmniej jeden dzień tygodnia.", "quick-add-weekday-1"); return; }
    }
    if (mode === "library") {
      if (draft.value.libraryKind === "decision" && !detail) { showFieldError("Uzasadnienie decyzji jest wymagane.", "quick-add-detail"); return; }
      if (draft.value.libraryKind === "resource") {
        try { normalizeHttpUrl(draft.value.sourceUrl); }
        catch { showFieldError("Podaj pełny adres HTTP lub HTTPS, np. https://example.com.", "quick-add-library-url"); return; }
      }
    }
    savingRef.current = true;
    setSaving(true); setError("");
    try {
      if (formData.mode === "action") { await createAction({ title: formData.title, detail: formData.detail, goalId: formData.goalId, areaId: formData.areaId, scheduledFor: formData.scheduledFor || undefined, pinnedToToday: formData.pinnedToToday }); notifySuccess(formData.pinnedToToday ? "Działanie dodane do Startu." : "Działanie dodane."); }
      else if (formData.mode === "goal") { await createGoal({ title: formData.title, outcome: formData.detail || formData.title, areaId: formData.areaId }); notifySuccess("Cel utworzony."); }
      else if (formData.mode === "project") { await createArea(formData.title, formData.detail || undefined); notifySuccess("Projekt utworzony."); }
      else if (formData.mode === "routine") {
        const interval = Number(draft.value.routineInterval);
        const startsOn = draft.value.routineStartsOn || currentDate;
        if (!Number.isInteger(interval) || interval < 1 || interval > 99) throw new Error("routine_interval_invalid");
        if (!startsOn) throw new Error("routine_start_required");
        if (draft.value.routineUnit === "week" && !draft.value.routineWeekdays.length) throw new Error("routine_weekday_required");
        await createRecurringAction({ title: formData.title, detail: formData.detail, goalId: formData.goalId, areaId: formData.areaId, timezone: state.workspaceTimezone, startsOn, rule: { unit: draft.value.routineUnit, interval, weekdays: draft.value.routineUnit === "week" ? draft.value.routineWeekdays : undefined, dayOfMonth: draft.value.routineUnit === "month" ? Number(startsOn.slice(8, 10)) : undefined } });
        notifySuccess("Rutyna utworzona.");
      }
      else if (formData.mode === "inbox") {
        const normalized = normalizeCapture(formData.content);
        await capture(normalized.content, normalized.kind);
        notifySuccess("Zapisano do Skrzynki. Element czeka w Wiedza → Skrzynka.");
      }
      else {
        const guidance = knowledgeKindGuidance[draft.value.libraryKind];
        if (guidance.detailRequired && !formData.detail) throw new Error("decision_detail_required");
        const sourceUrl = draft.value.libraryKind === "resource" ? normalizeHttpUrl(draft.value.sourceUrl) : undefined;
        const relations = [
          ...(formData.areaId ? [{ meaning: knowledgeDefaultRelationMeaning(draft.value.libraryKind), target: { areaId: formData.areaId } }] : []),
          ...normalizedContext.goalIds.map((goalId) => ({ meaning: knowledgeDefaultRelationMeaning(draft.value.libraryKind), target: { goalId } }))
        ];
        await createKnowledge({ kind: draft.value.libraryKind, title: formData.title, detail: formData.detail, sourceUrl, relations });
        notifySuccess(`${guidance.label} zapisano w Bibliotece.`);
      }
      draft.clear(); setError(""); onClose();
    } catch (caught) { setError(caught instanceof Error ? captureErrorMessage(caught.message) : "Nie udało się zapisać. Spróbuj ponownie."); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const contextOptions = <><option value="">Bez powiązania</option>{activeGoals.length ? <optgroup label="Cele">{activeGoals.map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}{goal.areaId ? " · w Projekcie" : ""}</option>)}</optgroup> : null}{activeAreas.length ? <optgroup label="Projekty">{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup> : null}</>;

  return <Modal open={open} title={titleForMode} className="creation-hub-modal" backdropClassName="quick-add-backdrop" onClose={close} closeDisabled={saving} headingAction={<button ref={typeSummaryRef} type="button" className="quick-add-change-type" disabled={saving} aria-label="Zmień typ wpisu" aria-expanded={typePickerOpen} aria-controls="quick-add-type-choices" onClick={() => setTypePickerOpen((current) => !current)}>Zmień<ChevronDown /></button>} onEscape={() => { if (!typePickerOpen) return false; setTypePickerOpen(false); typeSummaryRef.current?.focus(); return true; }}>
    <form className="quick-add" noValidate onSubmit={(event) => void submit(event)}>
      <div className="quick-add-body">
        {typePickerOpen ? <div className="quick-add-type-picker" id="quick-add-type-choices"><div className="quick-add-modes" role="group" aria-label="Co chcesz dodać?">{modes.map(({ id, label, icon: Icon }) => <button type="button" disabled={saving} aria-label={id === "inbox" ? "Do Skrzynki" : label} aria-pressed={draft.value.mode === id} key={id} onClick={() => setMode(id)}><span><Icon /></span><small>{label}</small></button>)}</div></div> : null}
        <div className="quick-add-mode-panel">
          <div className="quick-add-mode-heading"><span>{modeCopy.label}</span><small>{modeCopy.detail}</small></div>
          {draft.value.mode === "library" ? <KnowledgeKindPicker value={draft.value.libraryKind} disabled={saving} name="quick-add-library-kind" onChange={(libraryKind) => draft.setValue((current) => ({ ...current, libraryKind }))} /> : null}
          <FormTransition stateKey={`${draft.value.mode}:${draft.value.libraryKind}`} className="quick-add-form-fields">
          {draft.value.mode === "inbox" ? <label className="quick-add-field" htmlFor="quick-add-content"><span className="field-label">Treść</span><textarea ref={contentRef} id="quick-add-content" aria-label={modeCopy.label} aria-describedby={error ? "quick-add-error" : undefined} rows={5} required placeholder={modeCopy.placeholder} value={draft.value.content} disabled={saving} onChange={(event) => updateContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /></label> : <div className="quick-add-structured-fields">
            <label className="quick-add-field" htmlFor="quick-add-title"><span className="field-label">{libraryGuidance?.titleLabel ?? "Nazwa"}</span><input ref={titleRef} id="quick-add-title" required aria-label={libraryGuidance?.titleLabel ?? modeCopy.label} aria-describedby={error ? "quick-add-error" : undefined} aria-invalid={Boolean(error) && !draft.value.title.trim() || undefined} placeholder={libraryGuidance?.titlePlaceholder ?? modeCopy.placeholder.split("\n")[0]} value={draft.value.title} disabled={saving} onChange={(event) => updateTitleField(event.target.value)} /></label>
            {draft.value.mode === "library" && draft.value.libraryKind === "resource" ? <label className="quick-add-field" htmlFor="quick-add-library-url"><span className="field-label">Link HTTP/HTTPS <span className="optional-label">opcjonalnie</span></span><input id="quick-add-library-url" type="url" placeholder="https://…" disabled={saving} value={draft.value.sourceUrl} onChange={(event) => draft.setValue((current) => ({ ...current, sourceUrl: event.target.value }))} /></label> : null}
            <label className="quick-add-field" htmlFor="quick-add-detail"><span className="field-label">{draft.value.mode === "goal" ? "Rezultat" : libraryGuidance?.detailLabel ?? "Opis"} {!(draft.value.mode === "library" && draft.value.libraryKind === "decision") ? <span className="optional-label">opcjonalnie</span> : null}</span><textarea id="quick-add-detail" rows={3} required={draft.value.mode === "library" && draft.value.libraryKind === "decision"} aria-describedby={error ? "quick-add-error" : undefined} aria-invalid={Boolean(error) && draft.value.mode === "library" && draft.value.libraryKind === "decision" && !draft.value.detail.trim() || undefined} placeholder={libraryGuidance?.detailPlaceholder ?? modeCopy.placeholder.split("\n")[1] ?? "Dodaj szczegóły, jeśli są potrzebne"} value={draft.value.detail} disabled={saving} onChange={(event) => updateStructuredField("detail", event.target.value)} /></label>
          </div>}
          <p className={`quick-add-context-summary${normalizedContext.unavailable ? " is-invalid" : ""}`}><strong>Miejsce zapisu:</strong> {draft.value.mode === "inbox" ? "Bez powiązań — uporządkujesz później" : normalizedContext.unavailable ? `${normalizedContext.unavailable.label} — wybierz inne lub odłącz` : draft.value.mode === "library" && normalizedContext.goalIds.length ? `${contextSummary} · Cele: ${normalizedContext.goalIds.map((id) => activeGoals.find((goal) => goal.id === id)?.title).join(", ")}` : contextSummary}</p>
          {normalizedContext.unavailable ? <Button type="button" variant="ghost" disabled={saving} onClick={() => { setError(""); draft.setValue((current) => ({ ...current, context: "", goalIds: [], contexts: { ...current.contexts, [current.mode]: "" } })); }}>Odłącz niedostępne powiązanie</Button> : null}
          {scheduleSummary ? <p className="quick-add-context-summary"><strong>Termin:</strong> {scheduleSummary}</p> : null}
          {draft.value.mode === "routine" ? <p className="quick-add-occurrence-preview" aria-live="polite"><CalendarClock />Najbliższe: {routinePreview.length ? routinePreview.join(" · ") : "brak przy wybranym harmonogramie"}</p> : null}
          {draft.value.mode === "action" ? <details className="quick-add-options"><summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><SlidersHorizontal /></span><span><strong>Powiązania i ustawienia</strong><small>Termin, projekt i dodatkowe opcje</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary><div className="quick-add-options-panel"><span className="field-label">Kiedy?</span><div className="quick-add-date-choices" role="group" aria-label="Termin Działania"><button type="button" disabled={saving} aria-pressed={scheduledFor === currentDate} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: currentDate }))}>Dzisiaj</button><button type="button" disabled={saving} aria-pressed={scheduledFor === tomorrowDate} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: tomorrowDate }))}>Jutro</button><button type="button" disabled={saving} aria-pressed={!scheduledFor} onClick={() => draft.setValue((current) => ({ ...current, scheduledFor: "" }))}>Bez terminu</button></div><label className="field-label" htmlFor="quick-add-date"><CalendarClock /> Dokładna data</label><input id="quick-add-date" type="date" disabled={saving} value={scheduledFor} onChange={(event) => draft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} /><label className="field-label" htmlFor="quick-add-context">Cel lub Projekt</label><select id="quick-add-context" disabled={saving} value={draft.value.context} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>{contextOptions}</select><label className="switch-card quick-add-today"><input type="checkbox" disabled={saving} checked={draft.value.pinnedToToday} onChange={(event) => draft.setValue((current) => ({ ...current, pinnedToToday: event.target.checked }))} /><span><strong>Pokaż na Starcie</strong><small>To osobne ustawienie od terminu.</small></span></label></div></details> : null}
          {draft.value.mode === "goal" ? <div className="quick-add-project-field"><label className="field-label" htmlFor="quick-add-context-secondary">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-context-secondary" disabled={saving} value={effectiveAreaId ? `area:${effectiveAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select></div> : null}
          {draft.value.mode === "routine" ? <details className="quick-add-options" open><summary><span className="quick-add-options-leading"><span className="quick-add-options-icon"><Repeat2 /></span><span><strong>Harmonogram i kontekst</strong><small>Ustaw rytm przed utworzeniem Rutyny.</small></span></span><ChevronDown className="quick-add-options-chevron" /></summary><div className="quick-add-options-panel"><label className="field-label" htmlFor="quick-add-routine-unit">Powtarzaj</label><select id="quick-add-routine-unit" disabled={saving} value={draft.value.routineUnit} onChange={(event) => draft.setValue((current) => ({ ...current, routineUnit: event.target.value as QuickAddDraft["routineUnit"] }))}><option value="day">Codziennie</option><option value="week">Co tydzień</option><option value="month">Co miesiąc</option></select><label className="field-label" htmlFor="quick-add-routine-interval">Co ile?</label><input id="quick-add-routine-interval" type="number" min="1" max="99" inputMode="numeric" disabled={saving} value={draft.value.routineInterval} onChange={(event) => draft.setValue((current) => ({ ...current, routineInterval: event.target.value }))} /><label className="field-label" htmlFor="quick-add-routine-start">Początek</label><input id="quick-add-routine-start" type="date" disabled={saving} value={draft.value.routineStartsOn} onChange={(event) => draft.setValue((current) => ({ ...current, routineStartsOn: event.target.value }))} />{draft.value.routineUnit === "week" ? <fieldset className="quick-add-weekdays"><legend className="field-label">Dni tygodnia</legend><div>{[["Pn", 1], ["Wt", 2], ["Śr", 3], ["Cz", 4], ["Pt", 5], ["So", 6], ["Nd", 0]].map(([label, value]) => <label key={label as string}><input id={`quick-add-weekday-${value}`} type="checkbox" disabled={saving} checked={draft.value.routineWeekdays.includes(value as number)} onChange={(event) => draft.setValue((current) => ({ ...current, routineWeekdays: event.target.checked ? [...current.routineWeekdays, value as number].sort() : current.routineWeekdays.filter((day) => day !== value) }))} />{label}</label>)}</div></fieldset> : null}<label className="field-label" htmlFor="quick-add-context-routine">Cel lub Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-context-routine" disabled={saving} value={draft.value.context} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}>{contextOptions}</select></div></details> : null}
          {draft.value.mode === "library" ? <div className="quick-add-library-fields"><label className="field-label" htmlFor="quick-add-library-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-library-project" disabled={saving} value={effectiveAreaId ? `area:${effectiveAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select><span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span><MultiCombobox disabled={saving} label="Powiązane Cele" options={activeGoals.map((goal) => ({ id: goal.id, label: goal.title }))} value={normalizedContext.goalIds} onChange={(goalIds) => draft.setValue((current) => ({ ...current, goalIds, context: effectiveAreaId ? `area:${effectiveAreaId}` : "" }))} /></div> : null}
          </FormTransition>
        </div>
        <div className="quick-add-hint" aria-label="Dostępne komendy"><span>Możesz też zacząć od</span>{modes.map(({ id, command }) => <button type="button" disabled={saving} key={command} onClick={() => setMode(id)}><kbd>{command}</kbd></button>)}</div>
        {error ? <p id="quick-add-error" className="auth-message error" role="alert">{error}</p> : null}
      </div>
      <div className="quick-add-footer"><div className="quick-add-draft"><DraftStatus compact status={draft.status} restored={draft.restored} context={draft.value.mode === "library" && normalizedContext.goalIds.length ? `${contextSummary} · Cele: ${normalizedContext.goalIds.length}` : contextSummary} errorMessage={draft.errorMessage} onRetry={() => void draft.retry()} onCopy={() => void navigator.clipboard?.writeText(draft.value.mode === "inbox" ? draft.value.content : [draft.value.title, draft.value.detail, draft.value.sourceUrl].filter(Boolean).join("\n"))} />{draft.dirty ? <Button type="button" variant="ghost" disabled={saving} onClick={draft.discard}>Odrzuć szkic</Button> : null}</div><Button type="submit" variant="primary" loading={saving} disabled={draft.value.mode === "inbox" ? !draft.value.content.trim() : !draft.value.title.trim()}><Plus />{modeCopy.submit}</Button></div>
    </form>
  </Modal>;
}
