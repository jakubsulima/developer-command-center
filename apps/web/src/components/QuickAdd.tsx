import { KnowledgeSourceField } from "./KnowledgeSourceField";
import { KnowledgeSuggestions } from "./KnowledgeSuggestions";
import { ProjectCategoryPicker } from "./ProjectCategoryPicker";
import { ProjectPresetPicker } from "./ProjectPresetPicker";
import { BookMarked, CalendarClock, ChevronDown, Flag, FolderKanban, Library, ListPlus, Plus, Repeat2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useStore } from "../app/useStore";
import { normalizeQuickAddContext, normalizeQuickAddMode, parseQuickAddCommand, splitQuickAddContent, type QuickAddMode } from "../domain/quickAdd";
import { captureErrorMessage, normalizeCapture } from "../domain/capture";
import { normalizeHttpUrl } from "../domain/http-url";
import { knowledgeDefaultRelationMeaning } from "../domain/labels";
import { knowledgeKindGuidance } from "../domain/knowledge-kinds";
import { useActionFeedback } from "./action-feedback-context";
import { FormTransition } from "./FormTransition";
import { DraftStatus } from "./DraftStatus";
import { ActionCreationFields } from "./ActionCreationFields";
import { DraftRecovery } from "./DraftRecovery";
import { GoalCreationOptions } from "./GoalCreationOptions";
import { BookCreationFields } from "./BookCreationFields";
import { CreationDialog } from "./CreationForm";
import { useNavigate } from "react-router-dom";
import { useCreationReceipt } from "./useCreationReceipt";
import { RoutineCreationFields } from "./RoutineCreationFields";
import { CaptureComposer } from "./CaptureComposer";
import { creationScope, useCreationDraft } from "./useCreationDraft";
import { restartRejectedDraft, type CreationReceipt, type QuickAddDraft, type QuickAddRequest } from "./creationDraft";
import { isOperationRejected } from "../lib/operationFailure";
export type { QuickAddRequest } from "./creationDraft";
import { Button } from "./ui";
import { finishPerformanceTiming } from "../lib/performanceMetrics";
import { KnowledgeKindPicker } from "./KnowledgeKindPicker";
import { MultiCombobox } from "./MultiCombobox";
import { nextOccurrenceDates } from "../domain/recurrence";
import type { RecurringActionTemplate } from "../domain/types";
import { categoryPresetSuggestion } from "../domain/projectPresets";
import { describeActionSchedule } from "../domain/actionPresentation";
import { prepareKnowledgeNote } from "../domain/knowledgeNote";
import { KnowledgeNoteFields } from "./KnowledgeNoteFields";


const modes = [
  { id: "action" as const, label: "Działanie", command: "/dzialanie", icon: ListPlus },
  { id: "goal" as const, label: "Cel", command: "/cel", icon: Flag },
  { id: "project" as const, label: "Projekt", command: "/projekt", icon: FolderKanban },
  { id: "routine" as const, label: "Rutyna", command: "/rutyna", icon: Repeat2 },
  { id: "inbox" as const, label: "Skrzynka", command: "/skrzynka", icon: BookMarked },
  { id: "library" as const, label: "Biblioteka", command: "/wiedza", icon: Library }
] satisfies Array<{ id: QuickAddMode; label: string; command: string; icon: typeof ListPlus }>;

const copy = {
  action: { label: "Co chcesz zrobić?", placeholder: "Np. Spisać trzy pytania do rozmowy", submit: "Dodaj Działanie", detail: "Działanie zapisze się w bieżącym kontekście" },
  goal: { label: "Co chcesz osiągnąć?", placeholder: "Np. Zbudować spokojny budżet domowy", submit: "Utwórz Cel", detail: "Cel zapisze się w bieżącym kontekście" },
  project: { label: "Jaki Projekt utworzyć?", placeholder: "Np. Finanse osobiste", submit: "Utwórz Projekt", detail: "Projekt stanie się stałym miejscem dla pracy" },
  routine: { label: "Co ma się powtarzać?", placeholder: "Np. Cotygodniowy przegląd", submit: "Utwórz Rutynę", detail: "Domyślnie co tydzień, od dzisiaj" },
  inbox: { label: "Co chcesz zachować?", placeholder: "Wklej link albo zapisz treść\nUporządkujesz później", submit: "Zapisz do Skrzynki", detail: "Surowa treść trafi do Wiedza → Skrzynka" },
  library: { label: "Co chcesz uporządkować?", placeholder: "Np. Wzorzec repozytorium", submit: "Zapisz w Bibliotece", detail: "Powstanie uporządkowany element Wiedzy" },
  knowledge: { label: "Co chcesz zachować?", placeholder: "Wklej link albo zapisz treść\nUporządkujesz później", submit: "Zapisz do Skrzynki", detail: "Zgodność ze starszą komendą — surowa treść trafi do Skrzynki" }
} satisfies Record<QuickAddMode, { label: string; placeholder: string; submit: string; detail: string }>;

const shiftDate = (value: string, amount: number) => { const result = new Date(`${value}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + amount); return result.toISOString().slice(0, 10); };

export function QuickAdd({ open, request, onClose }: { open: boolean; request?: QuickAddRequest; onClose: () => void }) {
  const { state, createAction, createGoal, createArea, createRecurringAction, createKnowledge, capture, materializeRecurring, linkKnowledge } = useStore();
  const { notifySuccess } = useActionFeedback();
  const currentDate = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [activeMode, setActiveMode] = useState(request?.mode);
  const draftRequest = { ...request, mode: activeMode };
  const draft = useCreationDraft(draftRequest, activeMode === request?.mode);
  const sessionDrafts = useRef(new Map<string, string>());
  const initialDraft = draft.initial;
  const navigate = useNavigate();
  const completion = useCreationReceipt(draft.storageKey, { value: draft.value.receipt, save: (receipt) => { draft.setValue((current) => ({ ...current, receipt })); return draft.flush(); } });
  const receipt = completion.receipt;
  const draftKind = draft.scope;
  const requestMaterialKnowledgeIds = draft.value.materialKnowledgeIds ?? [];
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const typeSummaryRef = useRef<HTMLButtonElement>(null);
  const [captureConfirmed, setCaptureConfirmed] = useState(false);
  const captureCloseGuard = useRef<(() => boolean) | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(!request?.mode);
  const [typeChosen, setTypeChosen] = useState(Boolean(request?.mode));
  const [scheduleChoiceOverride, setScheduleChoiceOverride] = useState<"today" | "tomorrow" | "unscheduled" | "custom">();
  const modeCopy = copy[draft.value.mode] ?? copy.inbox;
  const libraryGuidance = draft.value.mode === "library" ? knowledgeKindGuidance[draft.value.libraryKind] : undefined;
  const detailRequired = draft.value.mode === "library" && Boolean(libraryGuidance?.detailRequired);
  const [detailExpanded, setDetailExpanded] = useState(() => detailRequired || Boolean(draft.value.detail.trim()));
  const detailDisclosureRef = useRef({ draftKind, storageKey: draft.storageKey, mode: draft.value.mode, libraryKind: draft.value.libraryKind, restored: draft.restored, value: draft.value });
  const pendingDetailDraftKeyRef = useRef<string | undefined>(undefined);
  const shortNote = draft.value.mode === "library" && draft.value.libraryKind === "note";
  const scheduledFor = draft.value.scheduledFor ?? "";
  const tomorrowDate = shiftDate(currentDate, 1);
  const scheduleChoice = scheduleChoiceOverride ?? (scheduledFor === currentDate ? "today" : scheduledFor === tomorrowDate ? "tomorrow" : scheduledFor ? "custom" : "unscheduled");
  const activeGoals = useMemo(() => state.goals.filter((goal) => goal.visibility === "active" && (draft.value.mode === "library" || goal.status === "active")), [draft.value.mode, state.goals]);
  const activeAreas = useMemo(() => state.areas.filter((area) => area.visibility === "active"), [state.areas]);
  const selectedGoalId = draft.value.context.startsWith("goal:") ? draft.value.context.slice(5) : undefined;
  const selectedAreaId = draft.value.context.startsWith("area:") ? draft.value.context.slice(5) : undefined;
  const normalizedContext = useMemo(() => normalizeQuickAddContext({ mode: draft.value.mode, goalId: selectedGoalId, areaId: selectedAreaId, goalIds: draft.value.goalIds, activeGoals, activeAreas }), [activeAreas, activeGoals, draft.value.goalIds, draft.value.mode, selectedAreaId, selectedGoalId]);
  const selectedGoal = normalizedContext.goalId ? activeGoals.find((goal) => goal.id === normalizedContext.goalId) : undefined;
  const effectiveAreaId = normalizedContext.areaId;
  const contextSummary = selectedGoal ? `Cel: ${selectedGoal.title}${effectiveAreaId ? ` · Projekt: ${activeAreas.find((area) => area.id === effectiveAreaId)?.name ?? "niedostępny"}` : ""}` : effectiveAreaId ? `Projekt: ${activeAreas.find((area) => area.id === effectiveAreaId)?.name ?? "niedostępny"}` : draft.value.mode === "inbox" ? "Bez powiązań" : draft.value.mode === "project" ? "Nowy samodzielny Projekt" : "Bez powiązania";
  const scheduleSummary = draft.value.mode === "action" ? `${describeActionSchedule({ scheduledFor: scheduledFor || undefined, pinnedToToday: false }, currentDate, state.workspaceTimezone)} · ${draft.value.pinnedToToday ? "Na Starcie" : "nieprzypięte"}` : undefined;
  const routinePreview = useMemo(() => {
    if (draft.value.mode !== "routine") return [];
    const startsOn = draft.value.routineStartsOn || currentDate;
    const preview = { id: "quick-add-preview", title: draft.value.title || "Rutyna", detail: draft.value.detail, timezone: state.workspaceTimezone, startsOn, rule: { unit: draft.value.routineUnit, interval: Math.max(1, Number(draft.value.routineInterval) || 1), weekdays: draft.value.routineUnit === "week" ? draft.value.routineWeekdays : undefined, dayOfMonth: draft.value.routineUnit === "month" ? Number(startsOn.slice(8, 10)) : undefined, endsOn: draft.value.routineEndsOn || undefined }, missedPolicy: draft.value.routineMissedPolicy ?? "skip_missed" as const, status: "active" as const, checklist: [], skippedOccurrenceCount: 0, createdAt: "", updatedAt: "" } satisfies RecurringActionTemplate;
    return nextOccurrenceDates(preview, currentDate, 3);
  }, [currentDate, draft.value, state.workspaceTimezone]);
  const titleForMode = ({ action: "Nowe Działanie", goal: "Nowy Cel", project: "Nowy Projekt", routine: "Nowa Rutyna", inbox: "Dodaj do Skrzynki", library: "Dodaj do Biblioteki", knowledge: "Dodaj do Skrzynki" } as Record<QuickAddMode, string>)[draft.value.mode] ?? "Dodaj";

  useEffect(() => {
    const previous = detailDisclosureRef.current;
    const storageKey = draft.storageKey ?? draftKind;
    const draftChanged = previous.draftKind !== draftKind || previous.storageKey !== storageKey;
    const sessionChanged = previous.mode !== draft.value.mode
      || previous.libraryKind !== draft.value.libraryKind;
    const restored = draft.restored && (!previous.restored || sessionChanged);
    if (draftChanged) {
      pendingDetailDraftKeyRef.current = storageKey;
      setDetailExpanded(detailRequired);
      if (draft.value === initialDraft && !draft.restored) pendingDetailDraftKeyRef.current = undefined;
    } else if (pendingDetailDraftKeyRef.current === storageKey && previous.value !== draft.value) {
      pendingDetailDraftKeyRef.current = undefined;
      setDetailExpanded(detailRequired || Boolean(draft.value.detail.trim()));
    } else if (sessionChanged || restored) setDetailExpanded(detailRequired || Boolean(draft.value.detail.trim()));
    detailDisclosureRef.current = { draftKind, storageKey, mode: draft.value.mode, libraryKind: draft.value.libraryKind, restored: draft.restored, value: draft.value };
  }, [detailRequired, draft.restored, draft.storageKey, draft.value, draft.value.libraryKind, draft.value.mode, draftKind, initialDraft]);
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) { setDetailExpanded(detailRequired || Boolean(draft.value.detail.trim())); setScheduleChoiceOverride(undefined); }
    wasOpenRef.current = open;
  }, [detailRequired, draft.value.detail, open]);

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
  const setMode = (mode: QuickAddMode, content?: string) => {
    if (savingRef.current || receipt || draft.value.attempted || captureConfirmed) return;
    if (mode === draft.value.mode) {
      setTypeChosen(true);
      if (content !== undefined) draft.setValue(changeMode(draft.value, mode, content));
      setTypePickerOpen(false); return;
    }
    if (!draft.flush()) return;
    sessionDrafts.current.set(draft.scope, JSON.stringify(draft.value));
    let changed = changeMode(draft.value, mode, content);
    if (mode === "library" && draft.value.libraryKind === "note") changed = { ...changed, title: "", detail: content ?? (draft.value.mode === "inbox" ? draft.value.content : `${draft.value.title}${draft.value.detail ? `\n${draft.value.detail}` : ""}`) };
    const nextRequest = { ...request, mode };
    const nextScope = creationScope(nextRequest);
    const result = draft.fork(nextRequest, changed, sessionDrafts.current.get(nextScope));
    if (result.error) { setError(result.error); return; }
    setTypeChosen(true);
    if (result.value) sessionDrafts.current.set(nextScope, result.value);
    setError(result.conflict ? "Ten typ ma inny szkic. Bieżąca treść jest dostępna w sekcji Inne szkice do odzyskania." : "");
    setActiveMode(mode); setScheduleChoiceOverride(undefined); setTypePickerOpen(false);
    if (content === undefined) typeSummaryRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => { if (open) finishPerformanceTiming("quick-add", "quick-add-open"); }, [open]);
  useEffect(() => { if (open) setTypePickerOpen(!request?.mode); }, [open, request?.mode]);

  const close = () => {
    if (savingRef.current) return;
    if (draft.value.mode === "inbox" && captureCloseGuard.current && !captureCloseGuard.current()) return;
    if (!draft.flush()) return;
    setError(""); onClose();
  };
  const updateStructuredField = (field: "title" | "detail", value: string) => {
    setError("");
    draft.setValue((current) => ({ ...current, [field]: value, content: field === "title" ? `${value}${current.detail ? `\n${current.detail}` : ""}` : `${current.title}${value ? `\n${value}` : ""}` }));
  };
  const updateTitleField = (value: string) => {
    const command = parseQuickAddCommand(value);
    if (!command) { updateStructuredField("title", value); return; }
    setMode(command.mode, `${command.content}${!command.content.includes("\n") && draft.value.detail ? `\n${draft.value.detail}` : ""}`);
  };
  const showFieldError = (message: string, id: string) => {
    setError(message);
    const field = document.getElementById(id);
    field?.closest("details")?.setAttribute("open", "");
    field?.focus({ preventScroll: true });
  };

  const settleReceipt = async (result: NonNullable<typeof receipt>) => {
    if (result.pendingOccurrences) {
      try { await materializeRecurring(currentDate); }
      catch { setError("Rutyna została zapisana, ale nie udało się przygotować jej wystąpień. Ponów przygotowanie."); return; }
      result = { ...result, pendingOccurrences: false };
      if (!completion.remember(result)) { setError("Zapis potwierdzony. Usuń zapisany szkic."); return; }
    }
    if (!completion.finish(() => draft.clear({ ...initialDraft, knowledgeIdempotencyKey: crypto.randomUUID() }))) { setError("Zapis się udał, ale szkic pozostał na tym urządzeniu. Usuń zapisany szkic."); return; }
    notifySuccess(`${result.message} Jeśli wpis jest poza bieżącym filtrem, możesz go otworzyć.`, { label: "Otwórz", onClick: () => navigate(result.url) });
    window.dispatchEvent(new CustomEvent("creation:succeeded", { detail: { id: result.id, mode: draft.value.mode } }));
    setError(""); onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    if (receipt) {
      savingRef.current = true; setSaving(true); setError("");
      try { await settleReceipt(receipt); }
      finally { savingRef.current = false; setSaving(false); }
      return;
    }
    const mode = draft.value.mode;
    const shortNote = mode === "library" && draft.value.libraryKind === "note";
    const detail = draft.value.detail.trim();
    if (shortNote && !detail) { showFieldError("Wpisz treść notatki.", "quick-add-content"); return; }
    const preparedNote = shortNote ? prepareKnowledgeNote(detail, draft.value.title) : undefined;
    const content = mode === "inbox" ? draft.value.content : shortNote ? detail : `${draft.value.title.trim()}${detail ? `\n${detail}` : ""}`;
    const title = preparedNote?.title ?? draft.value.title.trim();
    const formData = { mode: normalizeQuickAddMode(mode), content, title, detail, goalId: normalizedContext.goalId, areaId: effectiveAreaId, scheduledFor, pinnedToToday: draft.value.pinnedToToday };
    if (!content.trim() || (mode !== "inbox" && !title)) {
      showFieldError(({ action: "Podaj nazwę Działania.", goal: "Podaj nazwę Celu.", project: "Podaj nazwę Projektu.", routine: "Podaj nazwę Rutyny.", library: "Podaj nazwę wpisu.", inbox: "Wpisz treść.", knowledge: "Wpisz treść." } as const)[mode], "quick-add-title"); return;
    }
    if (mode === "library" && draft.value.actionId && !state.actions.some((item) => item.id === draft.value.actionId)) { setError("Działanie jest niedostępne."); return; }
    if (mode === "library" && draft.value.libraryKind === "note" && draft.value.sourceBookId && state.knowledge.some((item) => item.id === draft.value.sourceBookId && (item.resourceFormat !== "book" || item.trashedAt))) { setError("Źródłowa książka jest niedostępna. Zmień źródło."); return; }
    if (normalizedContext.unavailable) { setError(`Wybrane powiązanie jest niedostępne: ${normalizedContext.unavailable.label}. Zmień je albo odłącz przed zapisem.`); return; }
    if (mode === "routine") {
      const interval = Number(draft.value.routineInterval);
      if (!Number.isInteger(interval) || interval < 1 || interval > 99) { showFieldError("Interwał Rutyny musi być liczbą całkowitą od 1 do 99.", "quick-add-routine-interval"); return; }
      if (!draft.value.routineStartsOn) { showFieldError("Podaj datę początku Rutyny.", "quick-add-routine-start"); return; }
      if (draft.value.routineEndsOn && draft.value.routineEndsOn < draft.value.routineStartsOn) { showFieldError("Data końca nie może poprzedzać początku.", "quick-add-routine-end"); return; }
      if (draft.value.routineUnit === "week" && !draft.value.routineWeekdays.length) { showFieldError("Wybierz co najmniej jeden dzień tygodnia.", "quick-add-weekday-1"); return; }
    }
    if (mode === "library") {
      if (draft.value.libraryKind === "decision" && !detail) { showFieldError("Uzasadnienie decyzji jest wymagane.", "quick-add-detail"); return; }
      if (draft.value.libraryKind === "resource") {
        try { normalizeHttpUrl(draft.value.sourceUrl); }
        catch { showFieldError("Podaj pełny adres HTTP lub HTTPS, np. https://example.com.", "quick-add-library-url"); return; }
      }
    }
    const previousAttempt = Boolean(draft.value.attempted);
    if (mode === "action" || shortNote) draft.setValue((current) => ({ ...current, attempted: true }));
    if (!draft.flush()) { draft.setValue((current) => ({ ...current, attempted: previousAttempt })); setError("Nie udało się zachować szkicu. Ponów zapis szkicu przed wysłaniem."); return; }
    savingRef.current = true;
    setSaving(true); setError("");
    // Snapshot all options before the first await. Controls remain locked until settlement.
    const snapshot = structuredClone(draft.value);
    let result: CreationReceipt | undefined;
    try {
      if (!result) {
        let id: string;
        let url: string;
        let message: string;
        if (formData.mode === "action") {
          id = await createAction({ title, detail, goalId: formData.goalId, areaId: formData.areaId, scheduledFor: formData.scheduledFor || undefined, pinnedToToday: formData.pinnedToToday, materialKnowledgeIds: requestMaterialKnowledgeIds }, snapshot.knowledgeIdempotencyKey);
          url = `/actions/${id}`; message = "Działanie dodane.";
        } else if (formData.mode === "goal") {
          id = await createGoal({ title, outcome: detail || title, areaId: formData.areaId, kind: snapshot.goalKind ?? "custom", templateId: snapshot.goalTemplateId, firstActionTitle: snapshot.firstActionTitle || undefined, criteria: (snapshot.goalCriteria ?? "").split("\n").map((value) => value.trim()).filter(Boolean), materialKnowledgeIds: requestMaterialKnowledgeIds });
          url = `/goals/${id}`; message = "Cel utworzony.";
        } else if (formData.mode === "project") {
          id = await createArea(title, detail || undefined, undefined, snapshot.projectCategoryIds ?? [], snapshot.projectPreset ?? "standard");
          url = `/projects/${id}`; message = "Projekt utworzony.";
        } else if (formData.mode === "routine") {
          id = await createRecurringAction({ title, detail, goalId: formData.goalId, areaId: formData.areaId, timezone: state.workspaceTimezone, startsOn: snapshot.routineStartsOn, rule: { unit: snapshot.routineUnit, interval: Number(snapshot.routineInterval), weekdays: snapshot.routineUnit === "week" ? snapshot.routineWeekdays : undefined, dayOfMonth: snapshot.routineUnit === "month" ? Number(snapshot.routineStartsOn.slice(8, 10)) : undefined, endsOn: snapshot.routineEndsOn || undefined }, missedPolicy: snapshot.routineMissedPolicy ?? "skip_missed", checklist: (snapshot.routineChecklist ?? "").split("\n").map((value) => value.trim()).filter(Boolean) });
          url = `/routines?series=${id}`; message = "Rutyna utworzona.";
        } else if (formData.mode === "inbox") {
          const normalized = normalizeCapture(formData.content);
          const item = await capture(normalized.content, normalized.kind, snapshot.knowledgeIdempotencyKey);
          id = item.id; url = `/knowledge?section=inbox&status=${item.status}&item=${id}`; message = "Zapisano w Skrzynce.";
        } else {
          const kind = snapshot.libraryKind;
          const relations = [
            ...(formData.areaId ? [{ meaning: knowledgeDefaultRelationMeaning(kind), target: { areaId: formData.areaId } }] : []),
            ...normalizedContext.goalIds.map((goalId) => ({ meaning: knowledgeDefaultRelationMeaning(kind), target: { goalId } })),
            ...(snapshot.actionId ? [{ meaning: snapshot.actionMeaning ?? knowledgeDefaultRelationMeaning(kind), target: { actionId: snapshot.actionId } }] : []),
            ...(kind === "note" && snapshot.sourceBookId ? [{ meaning: "source" as const, target: { targetKnowledgeItemId: snapshot.sourceBookId } }] : [])
          ];
          id = await createKnowledge({ kind, title, detail, sourceUrl: kind === "resource" ? normalizeHttpUrl(snapshot.sourceUrl) : undefined, relations, resourceFormat: kind === "resource" && snapshot.isBook ? "book" : undefined, resourceAuthor: kind === "resource" && snapshot.isBook ? snapshot.resourceAuthor : undefined, readingStatus: kind === "resource" && snapshot.isBook ? snapshot.readingStatus ?? "to_read" : undefined, ...(kind === "note" ? { idempotencyKey: snapshot.knowledgeIdempotencyKey } : {}) });
          url = `/knowledge/${id}`; message = `${knowledgeKindGuidance[kind].label} zapisano w Bibliotece.`;
        }
        result = { id, url, message, pendingOccurrences: formData.mode === "routine" };
        if (!completion.remember(result)) { setError("Zapis potwierdzony. Nie udało się zachować potwierdzenia na urządzeniu. Nie wysyłaj ponownie; usuń zapisany szkic."); return; }
      }
      await settleReceipt(result);
    } catch (caught) {
      // A rejected first attempt can be corrected. A rejection on a later
      // retry cannot disprove an earlier lost success (e.g. access revoked).
      const canCorrect = !result && !previousAttempt && (mode === "action" || shortNote) && isOperationRejected(caught);
      if (canCorrect) {
        draft.setValue(restartRejectedDraft(snapshot));
        draft.flush();
      }
      setError(canCorrect ? "Zapis został odrzucony. Popraw pola lub powiązania i spróbuj ponownie." : caught instanceof Error ? captureErrorMessage(caught.message) : "Nie udało się zapisać. Spróbuj ponownie.");
    }
    finally { savingRef.current = false; setSaving(false); }
  };

  const contextOptions = <><option value="">Bez powiązania</option>{activeGoals.length ? <optgroup label="Cele">{activeGoals.filter((goal) => !effectiveAreaId || goal.areaId === effectiveAreaId).map((goal) => <option key={goal.id} value={`goal:${goal.id}`}>{goal.title}{goal.areaId ? " · w Projekcie" : ""}</option>)}</optgroup> : null}{activeAreas.length ? <optgroup label="Projekty">{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup> : null}</>;
  const knowledgeTarget = draft.value.actionId ? { actionId: draft.value.actionId } : normalizedContext.goalIds.length === 1 ? { goalId: normalizedContext.goalIds[0]! } : !normalizedContext.goalIds.length && effectiveAreaId ? { areaId: effectiveAreaId } : undefined;

  const detailField = <label className="quick-add-field" htmlFor="quick-add-detail"><span className="field-label">{draft.value.mode === "goal" ? "Rezultat" : libraryGuidance?.detailLabel ?? "Opis"}</span><textarea id="quick-add-detail" rows={3} required={detailRequired} aria-describedby={error ? "quick-add-error" : undefined} aria-invalid={Boolean(error) && detailRequired && !draft.value.detail.trim() || undefined} placeholder={libraryGuidance?.detailPlaceholder ?? "Dodaj szczegóły, jeśli są potrzebne"} value={draft.value.detail} disabled={saving || Boolean(receipt) || draft.value.attempted} onChange={(event) => updateStructuredField("detail", event.target.value)} /></label>;

  const typeControl = <button ref={typeSummaryRef} type="button" className="quick-add-change-type" disabled={saving || Boolean(receipt) || draft.value.attempted || captureConfirmed} aria-label="Zmień typ wpisu" aria-expanded={typePickerOpen} aria-controls="quick-add-type-choices" onClick={() => setTypePickerOpen((current) => !current)}>Zmień<ChevronDown /></button>;
  const typeChoices = typePickerOpen ? <div className="quick-add-type-picker" id="quick-add-type-choices"><div className="quick-add-modes" role="group" aria-label="Co chcesz dodać?">{modes.map(({ id, label, icon: Icon }) => <button type="button" disabled={saving || Boolean(receipt) || draft.value.attempted} aria-label={id === "inbox" ? "Do Skrzynki" : label} aria-pressed={draft.value.mode === id} key={id} onClick={() => { if (draft.value.mode === "inbox" && captureCloseGuard.current && !captureCloseGuard.current()) return; setMode(id); }}><span><Icon /></span><small>{label}</small></button>)}</div></div> : null;
  if (!typeChosen && !draft.restored && !draft.dirty) return <CreationDialog open={open} title="Dodaj" initialFocus="none" onClose={close}><div className="quick-add"><div className="quick-add-body" data-modal-scroll-body><p className="quick-add-context-summary">Miejsce zapisu: {contextSummary}</p>{typeChoices}{error ? <p role="alert">{error}</p> : null}</div></div></CreationDialog>;
  if (draft.value.mode === "inbox") return <CreationDialog open={open} title="Szybki zapis" closeDisabled={saving} onClose={close} headingAction={typeControl}>
    <CaptureComposer id="quick-add-capture" draftKey="knowledge-capture" initialContent={draft.value.content} onContentChange={(content) => { if (content !== draft.value.content) draft.setValue((current) => ({ ...current, content })); }} onCleanup={draft.clear} onConfirmedChange={setCaptureConfirmed} header={typeChoices} closeGuard={captureCloseGuard} onSavingChange={(value) => { savingRef.current = value; setSaving(value); }} onSubmit={capture} onClose={close} onSuccess={(item) => { if (item) notifySuccess("Zapisano w Skrzynce.", { label: "Otwórz", onClick: () => navigate(`/knowledge?section=inbox&status=${item.status}&item=${item.id}`) }); onClose(); }} />
  </CreationDialog>;

  return <CreationDialog open={open} title={titleForMode} className={`creation-hub-modal${draft.value.mode === "action" ? " quick-add-action-modal" : ""}`} backdropClassName="quick-add-backdrop" exitDurationMs={180} initialFocus={typeChosen || request?.mode ? "first" : "none"} onClose={close} closeDisabled={saving} headingAction={typeControl} onEscape={() => { if (!typePickerOpen) return false; setTypePickerOpen(false); typeSummaryRef.current?.focus({ preventScroll: true }); return true; }}>
    <form className="quick-add" noValidate onSubmit={(event) => void submit(event)}>
      <div className="quick-add-body" data-modal-scroll-body>
        {draft.value.actionId ? <p>Działanie: {state.actions.find((item) => item.id === draft.value.actionId)?.title ?? "Niedostępne Działanie"}</p> : null}
        {draft.value.sourceBookId ? <p>Źródło: {state.knowledge.find((item) => item.id === draft.value.sourceBookId)?.title ?? draft.value.sourceBookTitle ?? draft.value.sourceBookId}</p> : null}
        {typeChoices}
        <fieldset className="creation-fields" disabled={saving || Boolean(receipt) || draft.value.attempted}><div className="quick-add-mode-panel">
          <div className="quick-add-mode-heading"><span>{modeCopy.label}</span><small>{modeCopy.detail}</small></div>
          {draft.value.mode === "library" ? <KnowledgeKindPicker value={draft.value.libraryKind} disabled={saving || Boolean(receipt) || draft.value.attempted} name="quick-add-library-kind" onChange={(libraryKind) => draft.setValue((current) => ({ ...current, libraryKind, actionMeaning: current.actionId ? knowledgeDefaultRelationMeaning(libraryKind) as QuickAddDraft["actionMeaning"] : undefined }))} /> : null}
          <FormTransition stateKey={`${draft.value.mode}:${draft.value.libraryKind}`} className="quick-add-form-fields">
          {shortNote ? <KnowledgeNoteFields idPrefix="quick-add" content={draft.value.detail} onContentChange={(value) => updateStructuredField("detail", value)} title={draft.value.title} onTitleChange={(value) => updateStructuredField("title", value)} context={`Miejsce zapisu: ${contextSummary}`} disabled={saving || Boolean(receipt) || draft.value.attempted}>
            <label className="field-label" htmlFor="quick-add-library-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-library-project" disabled={saving || Boolean(receipt) || draft.value.attempted} value={effectiveAreaId ? `area:${effectiveAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select>
            <KnowledgeSourceField id="quick-add-source-book" value={draft.value.sourceBookId} label={draft.value.sourceBookTitle} onChange={(sourceBookId) => draft.setValue((current) => ({ ...current, sourceBookId, sourceBookTitle: undefined }))} />
            <span className="field-label">Powiązane Cele <span className="optional-label">opcjonalnie</span></span><MultiCombobox disabled={saving || Boolean(receipt) || draft.value.attempted} label="Powiązane Cele" options={activeGoals.map((goal) => ({ id: goal.id, label: goal.title }))} value={normalizedContext.goalIds} onChange={(goalIds) => draft.setValue((current) => ({ ...current, goalIds, context: effectiveAreaId ? `area:${effectiveAreaId}` : "" }))} />
          </KnowledgeNoteFields> : <div className="quick-add-structured-fields">
            <label className="quick-add-field" htmlFor="quick-add-title"><span className="field-label">{libraryGuidance?.titleLabel ?? modeCopy.label}</span><input ref={titleRef} id="quick-add-title" required aria-label={libraryGuidance?.titleLabel ?? modeCopy.label} aria-describedby={error ? "quick-add-error" : undefined} aria-invalid={Boolean(error) && !draft.value.title.trim() || undefined} placeholder={libraryGuidance?.titlePlaceholder ?? modeCopy.placeholder.split("\n")[0]} value={draft.value.title} disabled={saving || Boolean(receipt) || draft.value.attempted} onChange={(event) => updateTitleField(event.target.value)} /></label>
            {draft.value.mode === "library" && draft.value.libraryKind === "resource" ? <label className="quick-add-field" htmlFor="quick-add-library-url"><span className="field-label">Link HTTP/HTTPS <span className="optional-label">opcjonalnie</span></span><input id="quick-add-library-url" type="url" placeholder="https://…" disabled={saving || Boolean(receipt) || draft.value.attempted} value={draft.value.sourceUrl} onChange={(event) => draft.setValue((current) => ({ ...current, sourceUrl: event.target.value }))} /></label> : null}
            {draft.value.mode !== "action" ? <details className="quick-add-detail-disclosure" open={detailRequired || detailExpanded}>
              <summary aria-expanded={detailRequired || detailExpanded} onClick={(event) => { event.preventDefault(); if (!detailRequired) setDetailExpanded((expanded) => !expanded); }}><span>{detailRequired ? libraryGuidance?.detailLabel ?? "Uzasadnienie" : "Dodaj opis"}</span>{detailRequired ? <strong>Wymagane</strong> : <small>opcjonalnie</small>}<ChevronDown aria-hidden="true" /></summary>
              {detailField}
            </details> : null}
          </div>}
          {draft.value.mode === "library" && draft.value.libraryKind === "resource" ? <KnowledgeSuggestions url={draft.value.sourceUrl} target={knowledgeTarget} onUse={knowledgeTarget ? async (item) => {
            if (savingRef.current || receipt || !draft.flush()) return;
            const target = { ...knowledgeTarget };
            savingRef.current = true; setSaving(true);
            try { await linkKnowledge(item.id, target, "material"); const result = { id: item.id, url: `/knowledge/${item.id}`, message: "Materiał powiązany." }; completion.remember(result); await settleReceipt(result); }
            finally { savingRef.current = false; setSaving(false); }
          } : undefined} /> : null}
          {draft.value.mode === "goal" ? <GoalCreationOptions value={draft.value} onChange={draft.setValue} /> : null}
          {draft.value.mode === "library" && draft.value.libraryKind === "resource" ? <BookCreationFields value={draft.value} onChange={(changes) => draft.setValue((current) => ({ ...current, ...changes }))} /> : null}
          {draft.value.mode === "project" ? <><ProjectPresetPicker value={draft.value.projectPreset ?? "standard"} categories={state.projectCategories ?? []} categoryIds={draft.value.projectCategoryIds ?? []} onChange={(projectPreset) => draft.setValue((current) => ({ ...current, projectPreset, projectPresetManuallyChosen: true }))} disabled={saving || Boolean(receipt) || draft.value.attempted} /><ProjectCategoryPicker value={draft.value.projectCategoryIds ?? []} onChange={(projectCategoryIds) => draft.setValue((current) => ({ ...current, projectCategoryIds, projectPreset: current.projectPresetManuallyChosen ? current.projectPreset : categoryPresetSuggestion(state.projectCategories ?? [], projectCategoryIds).preset }))} /></> : null}
          {!shortNote && (draft.value.mode !== "action" || draft.value.context || normalizedContext.unavailable) ? <p className={`quick-add-context-summary${normalizedContext.unavailable ? " is-invalid" : ""}`}><strong>Miejsce zapisu:</strong> {normalizedContext.unavailable ? `${normalizedContext.unavailable.label} — wybierz inne lub odłącz` : draft.value.mode === "library" && normalizedContext.goalIds.length ? `${contextSummary} · Cele: ${normalizedContext.goalIds.map((id) => activeGoals.find((goal) => goal.id === id)?.title).join(", ")}` : contextSummary}</p> : null}
          {normalizedContext.unavailable ? <Button type="button" variant="ghost" disabled={saving || Boolean(receipt) || draft.value.attempted} onClick={() => { setError(""); draft.setValue((current) => ({ ...current, context: "", goalIds: [], contexts: { ...current.contexts, [current.mode]: "" } })); }}>Odłącz niedostępne powiązanie</Button> : null}
          {scheduleSummary && (draft.value.mode !== "action" || draft.value.pinnedToToday || scheduleChoice === "custom") ? <p className="quick-add-context-summary"><strong>Termin:</strong> {scheduleSummary}</p> : null}
          {draft.value.mode === "routine" ? <p className="quick-add-occurrence-preview" aria-live="polite"><CalendarClock />Najbliższe: {routinePreview.length ? routinePreview.join(" · ") : "brak przy wybranym harmonogramie"}</p> : null}
          {draft.value.mode === "action" ? <ActionCreationFields {...{ draft, saving, currentDate, tomorrowDate, scheduledFor, scheduleChoice, setScheduleChoiceOverride, detailExpanded, setDetailExpanded, detailField, contextOptions }} /> : null}
          {draft.value.mode === "goal" ? <div className="quick-add-project-field"><label className="field-label" htmlFor="quick-add-context-secondary">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-context-secondary" disabled={saving || Boolean(receipt) || draft.value.attempted} value={effectiveAreaId ? `area:${effectiveAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select></div> : null}
          {draft.value.mode === "routine" ? <RoutineCreationFields value={draft.value} onChange={draft.setValue} contextOptions={contextOptions} /> : null}
          {draft.value.mode === "library" && !shortNote ? <div className="quick-add-library-fields"><label className="field-label" htmlFor="quick-add-library-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="quick-add-library-project" disabled={saving || Boolean(receipt) || draft.value.attempted} value={effectiveAreaId ? `area:${effectiveAreaId}` : ""} onChange={(event) => draft.setValue((current) => ({ ...current, context: event.target.value }))}><option value="">Bez Projektu</option>{activeAreas.map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</select><span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span><MultiCombobox disabled={saving || Boolean(receipt) || draft.value.attempted} label="Powiązane Cele" options={activeGoals.map((goal) => ({ id: goal.id, label: goal.title }))} value={normalizedContext.goalIds} onChange={(goalIds) => draft.setValue((current) => ({ ...current, goalIds, context: effectiveAreaId ? `area:${effectiveAreaId}` : "" }))} /></div> : null}
          {draft.value.actionId ? <label className="field-label">Rola wobec Działania<select value={draft.value.actionMeaning ?? "reference"} onChange={(event) => draft.setValue((current) => ({ ...current, actionMeaning: event.target.value as QuickAddDraft["actionMeaning"] }))}><option value="material">Materiał</option><option value="reference">Powiązanie</option>{draft.value.libraryKind === "decision" ? <option value="decision">Decyzja</option> : null}</select></label> : null}
          {draft.value.mode === "action" ? <p className="quick-add-action-hint">Wystarczy nazwa. Resztę możesz dodać później.</p> : null}
          </FormTransition>
        </div>
        </fieldset><div className="quick-add-hint" aria-label="Dostępne komendy"><span>Możesz też zacząć od</span>{modes.map(({ id, command }) => <button type="button" disabled={saving || Boolean(receipt) || draft.value.attempted} key={command} onClick={() => setMode(id)}><kbd>{command}</kbd></button>)}</div>
        <div className="quick-add-draft"><DraftStatus compact status={draft.status} restored={draft.restored} context={draft.value.mode === "library" && normalizedContext.goalIds.length ? `${contextSummary} · Cele: ${normalizedContext.goalIds.length}` : contextSummary} errorMessage={draft.errorMessage} onRetry={() => void draft.retry()} onCopy={() => void navigator.clipboard?.writeText(draft.value.mode === "inbox" ? draft.value.content : [draft.value.title, draft.value.detail, draft.value.sourceUrl].filter(Boolean).join("\n"))} />{draft.dirty ? <Button type="button" variant="ghost" disabled={saving || Boolean(receipt) || draft.value.attempted} onClick={() => { if (draft.clear()) { setScheduleChoiceOverride(undefined); setDetailExpanded(false); } }}>Odrzuć szkic</Button> : null}</div>
        <DraftRecovery alternatives={draft.alternatives} recover={draft.recover} disabled={saving || Boolean(receipt) || draft.value.attempted} />
        {draft.value.attempted && !saving && !receipt ? <p>Nie potwierdzono zapisu. Pola zachowują wysłaną treść; ponów tę samą próbę.</p> : null}
        {error ? <p id="quick-add-error" className="auth-message error" role="alert">{error}</p> : null}
      </div>
        <div className="quick-add-footer">{receipt && !receipt.pendingOccurrences ? <><Button type="button" onClick={() => navigate(receipt.url)}>Otwórz wynik</Button><Button type="button" onClick={() => { if (completion.finish(() => draft.clear({ ...initialDraft, knowledgeIdempotencyKey: crypto.randomUUID() }))) { notifySuccess(receipt.message, { label: "Otwórz", onClick: () => navigate(receipt.url) }); onClose(); } }}>Usuń zapisany szkic</Button></> : null}<Button type="submit" variant="primary" loading={saving} disabled={Boolean(receipt && !receipt.pendingOccurrences) || (shortNote ? !draft.value.detail.trim() : !draft.value.title.trim())}><Plus />{receipt?.pendingOccurrences ? "Ponów przygotowanie wystąpień" : shortNote ? "Zapisz notatkę" : draft.value.mode === "library" && draft.value.libraryKind === "resource" && draft.value.isBook ? "Dodaj książkę" : modeCopy.submit}</Button></div>
    </form>
  </CreationDialog>;
}
