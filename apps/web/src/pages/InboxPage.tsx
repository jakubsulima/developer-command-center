import { ActionGroupTypePicker } from "../components/ActionGroupTypePicker";
import { actionGroupType } from "../domain/actionGroups";
import type { CreationReceipt } from "../components/creationDraft";
import { normalizeQuickAddContext } from "../domain/quickAdd";
import { KnowledgeSourceField } from "../components/KnowledgeSourceField";
import { CreationBody, CreationFooter } from "../components/CreationForm";
import { InboxProcessingSurface } from "../components/InboxProcessingSurface";
import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { GoalCreationOptions } from "../components/GoalCreationOptions";
import { TriageActionFields } from "../components/TriageActionFields";
import { BookCreationFields } from "../components/BookCreationFields";
import { emptyDraft } from "../components/creationDraft";
import { useCreationReceipt } from "../components/useCreationReceipt";
import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "../lib/supabase";
import { KnowledgeSuggestions } from "../components/KnowledgeSuggestions";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AlarmClock, Archive, Check, File, Flag, Inbox, Link2, ListPlus, Mic, MoreHorizontal, RotateCcw, Sparkles, TextCursorInput, Trash2 } from "lucide-react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { Modal } from "../components/Modal";
import { useActionFeedback } from "../components/action-feedback-context";
import { Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import type { GoalKind, InboxItem, InboxKind, ReadingStatus } from "../domain/types";
import { tomorrowAtLocalTime } from "../domain/inbox";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { recordFirstFlowStage } from "../lib/firstFlow";
import { AIInboxTriagePreview } from "../components/AIInboxTriagePreview";
import type { AIInboxTriageProposal } from "../domain/aiInboxTriage";
import { KnowledgeKindPicker } from "../components/KnowledgeKindPicker";
import { knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { KnowledgeNoteFields } from "../components/KnowledgeNoteFields";
import { DraftStatus } from "../components/DraftStatus";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { prepareKnowledgeNote } from "../domain/knowledgeNote";
import { routeForEntity } from "../domain/routes";
import { inboxStatusLabels } from "../domain/labels";
import { safeHttpUrl } from "../domain/http-url";
import "./knowledge-workspace.css";

const modes: Array<{ id: InboxKind; label: string; icon: typeof TextCursorInput }> = [
  { id: "text", label: "Tekst", icon: TextCursorInput }, { id: "link", label: "Link", icon: Link2 }
];
const legacyModes = [...modes, { id: "voice" as const, label: "Głos (historyczny)", icon: Mic }, { id: "file" as const, label: "Plik (historyczny)", icon: File }];
const inboxViews = ["unprocessed", "snoozed", "resolved", "discarded"] as const;
type Intent = "goal" | "action" | "knowledge";
type InboxNoteDraft = { sourceBookId?: string; title: string; detail: string; goalId: string; projectId: string; idempotencyKey: string };

export function KnowledgeInbox() {
  const desktop = useDesktopLayout();
  const { state, mode, loading, triageInboxIntent, triageExistingKnowledge, setInboxStatus, releaseDueInbox, requestInboxTriageProposal, submitInboxTriageFeedback } = useStore();

  const { notifyUndo } = useActionFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [item, setItem] = useState<InboxItem>();
  const selectedTriggerRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const handledRequestRef = useRef<string | null>(null);
  const [batchLeft, setBatchLeft] = useState(0);
  const [finished, setFinished] = useState<CreationReceipt>();
  const triageInitial = useMemo(() => ({ groupType: "category" as "category" | "task", title: item?.content.slice(0, 100) ?? "", outcome: "", firstAction: "", detail: item?.content ?? "", goalId: "", areaId: "", projectId: "", targetDate: "", pin: false, knowledgeKind: item?.kind === "link" ? "resource" as CreatableKnowledgeKind : "note" as CreatableKnowledgeKind, isBook: false, resourceAuthor: "", readingStatus: "to_read" as ReadingStatus, goalKind: "custom" as GoalKind, goalTemplateId: "", goalCriteria: "", intent: undefined as Intent | undefined, receipt: undefined as CreationReceipt | undefined }), [item?.content, item?.kind]);
  const formDraft = usePersistentDraft("inbox-triage", triageInitial, 250, { targetId: item?.id ?? "none", enabled: Boolean(item) });
  const form = formDraft.value;
  const setForm = formDraft.setValue;
  const flushForm = formDraft.flush;
  const intent = form.intent;
  const completion = useCreationReceipt(formDraft.storageKey, { value: formDraft.value.receipt, save: (receipt) => { formDraft.setValue((current) => ({ ...current, receipt })); return formDraft.flush(); } });
  const busyRef = useRef(false);
  const chooseIntent = (next: Intent) => setForm((current) => ({ ...current, intent: next }));

  const noteInitial = useMemo<InboxNoteDraft>(() => ({ title: "", detail: item?.content ?? "", goalId: "", projectId: "", idempotencyKey: item?.id ? crypto.randomUUID() : "" }), [item?.content, item?.id]);
  const noteDraft = usePersistentDraft<InboxNoteDraft>("inbox-knowledge-note", noteInitial, 450, { targetId: item?.id ?? "none", enabled: Boolean(item) });
  const flushNote = noteDraft.flush;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiProposal, setAIProposal] = useState<AIInboxTriageProposal>();
  const [aiLoading, setAILoading] = useState(false);
  const [noteProposalConflict, setNoteProposalConflict] = useState(false);
  const [aiError, setAIError] = useState("");
  const mutation = useKeyedMutation();

  const view = (searchParams.get("status") ?? "unprocessed") as InboxItem["status"];
  const inboxPage = useWorkspaceInfinitePage<InboxItem>("inbox", 50, { inboxStatus: view });
  const captureOpen = searchParams.get("capture") === "true";
  useEffect(() => { if (!captureOpen) return; const next = new URLSearchParams(searchParams); next.delete("capture"); setSearchParams(next, { replace: true }); requestAppQuickAdd({ mode: "inbox", draftKey: "knowledge-inbox" }); }, [captureOpen, searchParams, setSearchParams]);
  useEffect(() => {
    if (!inboxViews.includes(view)) {
      const next = new URLSearchParams(searchParams); next.set("status", "unprocessed"); setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, view]);
  useEffect(() => {
    const release = () => { void releaseDueInbox(); };
    release(); window.addEventListener("focus", release); return () => window.removeEventListener("focus", release);
  }, [releaseDueInbox]);
  useEffect(() => { const id = searchParams.get("item"); if (!id) return; requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-inbox-id="${CSS.escape(id)}"]`)?.focus()); }, [searchParams, state.inbox]);
  const requestedId = searchParams.get("item");
  const selectedQuery = useQuery({
    queryKey: ["inbox-item", state.workspaceId, requestedId],
    enabled: mode === "supabase" && Boolean(requestedId && state.workspaceId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc("get_inbox_filtered_page", { target_workspace_id: state.workspaceId, target_item_id: requestedId, page_size: 1 });
      if (error) throw error;
      return (data as { items: InboxItem[] }).items[0] ?? null;
    }
  });
  const requested = state.inbox.find((entry) => entry.id === requestedId) ?? selectedQuery.data;
  useEffect(() => {
    if (item || finished || !requested || requested.status === view) return;
    const next = new URLSearchParams(searchParams);
    next.set("status", requested.status);
    next.delete("organize");
    setSearchParams(next, { replace: true });
  }, [finished, item, requested, searchParams, setSearchParams, view]);
  const dismissPreview = () => { const next = new URLSearchParams(searchParams); next.delete("item"); next.delete("organize"); setSearchParams(next, { replace: desktop }); };
  const inboxItems = mergePagedItems(state.inbox, inboxPage.data?.items ?? []);
  const visible = inboxItems.filter((candidate) => candidate.status === view).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const initialInboxLoad = (loading || inboxPage.isPending) && !inboxPage.data && !visible.length;
  const refreshingInbox = !initialInboxLoad && (loading || (inboxPage.isFetching && !inboxPage.isFetchingNextPage));
  const open = useCallback((candidate: InboxItem) => {
    if (busyRef.current || aiLoading) return false;
    if (!flushForm() || !flushNote()) {
      setError("Nie udało się zapisać szkicu na tym urządzeniu. Ponów zapis albo skopiuj treść przed zmianą wpisu.");
      return false;
    }
    setFinished(undefined);
    recordFirstFlowStage("triage-started");
    setNoteProposalConflict(false);
    setItem(candidate); setError(""); setAIProposal(undefined); setAIError("");
    return true;
  }, [aiLoading, flushForm, flushNote]);
  useEffect(() => {
    // Navigation can lag local state while closing. Handle each URL request once.
    if (!requestedId || searchParams.get("organize") !== "true") { handledRequestRef.current = null; return; }
    if (requested?.status === "unprocessed" && handledRequestRef.current !== requestedId) {
      handledRequestRef.current = requestedId;
      if (requested.id !== item?.id) open(requested);
    }
  }, [requested, requestedId, searchParams, item?.id, open]);
  useEffect(() => {
    if (!desktop || item || requestedId || finished) return;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, [desktop, item, requestedId, finished]);
  const close = (confirmed = false) => {
    if (!confirmed && (busyRef.current || aiLoading)) return false;
    if (!confirmed && (!formDraft.flush() || !noteDraft.flush())) {
      setError("Nie udało się zapisać szkicu na tym urządzeniu. Skopiuj treść albo ponów zapis szkicu przed zamknięciem.");
      return false;
    }
    setItem(undefined);
    setFinished(undefined);
    if (requestedId) dismissPreview();
    if (desktop && !confirmed) {
      const selectedId = item?.id ?? requestedId;
      const fallback = Array.from(document.querySelectorAll<HTMLElement>("[data-inbox-id]")).find((row) => row.getAttribute("data-inbox-id") === selectedId)?.querySelector<HTMLElement>("a");
      const trigger = selectedTriggerRef.current?.isConnected ? selectedTriggerRef.current : fallback;
      returnFocusRef.current = trigger ?? null;
    }
    return true;
  };
  const select = (candidate: InboxItem, trigger?: HTMLElement) => {
    if (candidate.id === item?.id) return true;
    if (candidate.status === "unprocessed") {
      if (!open(candidate)) return false;
    } else {
      if (!close()) return false;
    }
    selectedTriggerRef.current = trigger ?? null;
    const next = new URLSearchParams(searchParams);
    next.set("item", candidate.id);
    if (candidate.status === "unprocessed") next.set("organize", "true"); else next.delete("organize");
    setSearchParams(next, { replace: true });
    return true;
  };
  const completeProcessing = (result: CreationReceipt) => {
    close(true);
    setFinished(result);
    setBatchLeft((count) => Math.max(0, count - 1));
  };
  const inboxAddress = (id: string, status: InboxItem["status"]) => {
    const next = new URLSearchParams(searchParams);
    next.set("section", "inbox");
    next.set("status", status);
    next.set("item", id);
    next.delete("organize");
    next.delete("capture");
    return `/knowledge?${next}`;
  };
  const resultReceipt = (source: InboxItem, message: string): CreationReceipt => ({
    id: source.id,
    url: inboxAddress(source.id, "resolved"),
    message: `Zapisano. ${message}`
  });
  const backToDecision = () => {
    if (intent === "knowledge" && form.knowledgeKind === "note" && !noteDraft.flush()) {
      setError("Nie udało się zapisać szkicu na tym urządzeniu. Skopiuj treść albo ponów zapis szkicu przed zmianą widoku.");
      return;
    }
    setForm((current) => ({ ...current, intent: undefined })); setAIProposal(undefined);
  };
  const requestAI = async () => {
    if (!item || aiLoading) return;
    setAILoading(true); setAIError("");
    try { setAIProposal(await requestInboxTriageProposal(item.id)); }
    catch (caught) { setAIError(caught instanceof Error ? caught.message : "Nie udało się przygotować propozycji AI."); }
    finally { setAILoading(false); }
  };
  const applyAIProposal = (replaceDraft = false) => {
    if (!aiProposal) return;
    const suggestion = aiProposal.proposal;
    if (suggestion.decision === "keep_inbox") { close(); return; }
    const goalId = suggestion.linkedType === "goal" ? suggestion.linkedId ?? "" : "";
    const projectId = suggestion.linkedType === "project" ? suggestion.linkedId ?? "" : "";
    if (suggestion.decision === "knowledge" && (suggestion.knowledgeKind ?? "note") === "note") {
      if (noteDraft.dirty && !replaceDraft) { setNoteProposalConflict(true); return; }
      noteDraft.setValue((current) => ({ ...current, title: suggestion.title ?? "", detail: suggestion.detail ?? item?.content ?? "", goalId, projectId }));
    }
    setNoteProposalConflict(false);
    if (suggestion.decision === "goal") {
      chooseIntent("goal"); setForm((current) => ({ ...current, groupType: "task", title: suggestion.title ?? current.title, outcome: suggestion.detail ?? current.detail, firstAction: "", areaId: projectId, targetDate: suggestion.targetDate ?? "" }));
    } else if (suggestion.decision === "action") {
      chooseIntent("action"); setForm((current) => ({ ...current, title: suggestion.title ?? current.title, detail: suggestion.detail ?? current.detail, goalId, areaId: projectId, targetDate: suggestion.targetDate ?? "" }));
    } else {
      chooseIntent("knowledge"); setForm((current) => ({ ...current, title: suggestion.title ?? current.title, detail: suggestion.detail ?? current.detail, knowledgeKind: suggestion.knowledgeKind ?? "note", goalId, projectId }));
    }
  };
  const approveAIProposal = async () => {
    if (!item || !aiProposal || saving) return;
    const suggestion = aiProposal.proposal;
    if (suggestion.decision === "keep_inbox") { close(); return; }
    const goalId = suggestion.linkedType === "goal" ? suggestion.linkedId ?? undefined : undefined;
    const projectId = suggestion.linkedType === "project" ? suggestion.linkedId ?? undefined : undefined;
    if (busyRef.current || !formDraft.flush()) return;
    busyRef.current = true;
    setSaving(true); setError("");
    try {
      if (suggestion.decision === "goal") await triageInboxIntent(item.id, { kind: "goal", groupType: "task", title: suggestion.title!, outcome: suggestion.detail!, areaId: projectId, targetDate: suggestion.targetDate ?? undefined });
      if (suggestion.decision === "action") await triageInboxIntent(item.id, { kind: "action", title: suggestion.title!, detail: suggestion.detail ?? undefined, goalId, areaId: projectId, targetDate: suggestion.targetDate ?? undefined });
      if (suggestion.decision === "knowledge") await triageInboxIntent(item.id, { kind: "knowledge", knowledgeKind: suggestion.knowledgeKind!, title: suggestion.title!, detail: suggestion.detail ?? "", goalId, projectId, sourceUrl: item.kind === "link" ? item.content : undefined });
      const label = suggestion.decision === "goal" ? "Grupa działań" : suggestion.decision === "action" ? "Działanie" : knowledgeKindGuidance[suggestion.knowledgeKind!].label;
      const result = resultReceipt(item, `${label} · ${suggestion.title}`);
      completion.remember(result);
      if (!completion.finish(formDraft.clear)) { setError("Zapis potwierdzony. Usuń zapisany szkic."); return; }
      completeProcessing(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zatwierdzić propozycji."); }
    finally { busyRef.current = false; setSaving(false); }
  };
  const finish = async () => {
    if (!item || busyRef.current) return;
    const receipt = completion.receipt;
    if (receipt) {
      if (completion.finish(() => formDraft.clear() && noteDraft.clear())) completeProcessing(receipt);
      return;
    }
    if (!intent) return;
    const contextGoalId = intent === "knowledge" && form.knowledgeKind === "note" ? noteDraft.value.goalId : intent === "goal" ? "" : form.goalId;
    const contextProjectId = intent === "knowledge" ? form.knowledgeKind === "note" ? noteDraft.value.projectId : form.projectId : form.areaId;
    const context = normalizeQuickAddContext({ mode: intent === "knowledge" ? "library" : intent, goalId: contextGoalId || undefined, areaId: contextProjectId || undefined, activeGoals: state.goals, activeAreas: state.areas });
    if (context.unavailable) { setError(`${context.unavailable.label} — zmień lub odłącz powiązanie przed zapisem.`); return; }
    if (intent === "action" && form.goalId && form.areaId && context.areaId !== form.areaId) { setError("Grupa działań należy do innego Projektu. Wybierz powiązanie ponownie."); return; }
    if (intent === "knowledge" && form.knowledgeKind === "note" && !noteDraft.value.detail.trim()) return;
    if (intent === "knowledge" && form.knowledgeKind !== "note" && knowledgeKindGuidance[form.knowledgeKind].detailRequired && !form.detail.trim()) return;
    if (!formDraft.flush() || (intent === "knowledge" && form.knowledgeKind === "note" && !noteDraft.flush())) return;
    busyRef.current = true;
    setSaving(true); setError("");
    const snapshot = structuredClone(form);
    try {
      const note = intent === "knowledge" && snapshot.knowledgeKind === "note" ? prepareKnowledgeNote(noteDraft.value.detail, noteDraft.value.title) : undefined;
      if (intent === "goal") await triageInboxIntent(item.id, { kind: "goal", title: snapshot.title, outcome: snapshot.outcome.trim(), groupType: actionGroupType(snapshot), goalKind: snapshot.goalKind, templateId: actionGroupType(snapshot) === "task" ? snapshot.goalTemplateId || undefined : undefined, criteria: actionGroupType(snapshot) === "task" ? snapshot.goalCriteria.split("\n").map((value) => value.trim()).filter(Boolean) : [], firstActionTitle: snapshot.firstAction || undefined, areaId: snapshot.areaId || undefined, targetDate: actionGroupType(snapshot) === "task" ? snapshot.targetDate || undefined : undefined });
      if (intent === "action") await triageInboxIntent(item.id, { kind: "action", title: snapshot.title, detail: snapshot.detail, goalId: snapshot.goalId || undefined, areaId: snapshot.areaId || undefined, pinnedToToday: snapshot.pin, targetDate: snapshot.targetDate || undefined });
      if (note) {
        await triageInboxIntent(item.id, { kind: "knowledge", knowledgeKind: "note", title: note.title, detail: note.detail, goalId: noteDraft.value.goalId || undefined, projectId: noteDraft.value.projectId || undefined, sourceBookId: noteDraft.value.sourceBookId });
      }
      if (intent === "knowledge" && snapshot.knowledgeKind !== "note") await triageInboxIntent(item.id, { kind: "knowledge", knowledgeKind: snapshot.knowledgeKind, title: snapshot.title, detail: snapshot.detail, goalId: snapshot.goalId || undefined, projectId: snapshot.projectId || undefined, sourceUrl: item.kind === "link" ? item.content : undefined, resourceFormat: snapshot.knowledgeKind === "resource" && snapshot.isBook ? "book" : undefined, resourceAuthor: snapshot.knowledgeKind === "resource" && snapshot.isBook ? snapshot.resourceAuthor : undefined, readingStatus: snapshot.knowledgeKind === "resource" && snapshot.isBook ? snapshot.readingStatus : undefined });
      if (intent === "action") recordFirstFlowStage("action-created");
      const label = intent === "goal" ? "Grupa działań" : intent === "action" ? "Działanie" : snapshot.isBook && snapshot.knowledgeKind === "resource" ? "Książka" : knowledgeKindGuidance[snapshot.knowledgeKind].label;
      const result = resultReceipt(item, `${label} · ${note?.title ?? snapshot.title.trim()}`);
      completion.remember(result);
      if (!completion.finish(() => formDraft.clear() && (intent !== "knowledge" || snapshot.knowledgeKind !== "note" || noteDraft.clear()))) { setError("Zapis potwierdzony. Usuń zapisany szkic."); return; }
      completeProcessing(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się przetworzyć przechwycenia."); }
    finally { busyRef.current = false; setSaving(false); }
  };
  const changeStatus = async (candidate: InboxItem, status: "snoozed" | "discarded") => {
    const until = status === "snoozed" ? tomorrowAtLocalTime(new Date(), state.workspaceTimezone) : undefined;
    await setInboxStatus(candidate.id, status, until);
    notifyUndo({ message: status === "snoozed" ? "Odłożono do jutra." : "Przechwycenie odrzucone.", undo: () => setInboxStatus(candidate.id, candidate.status, candidate.snoozedUntil) });
  };
  const runInboxOperation = async (candidate: InboxItem, operation?: () => Promise<void>) => {
    if (busyRef.current || aiLoading) return;
    if (!formDraft.flush() || !noteDraft.flush()) {
      setError("Nie udało się zapisać szkicu. Ponów zapis przed zmianą wpisu.");
      return;
    }
    busyRef.current = true;
    setSaving(true);
    const key = `status:${candidate.id}`;
    try {
      const succeeded = operation ? await mutation.run(key, operation) : await mutation.retry(key)?.();
      if (succeeded && (candidate.id === item?.id || (!item && requestedId === candidate.id))) close(true);
    } finally { busyRef.current = false; setSaving(false); }
  };
  const runMenuStatusChange = (event: MouseEvent<HTMLButtonElement>, candidate: InboxItem, status: "snoozed" | "discarded") => {
    const menu = event.currentTarget.closest("details");
    if (menu) {
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
    void runInboxOperation(candidate, () => changeStatus(candidate, status));
  };
  const changeView = (target: InboxItem["status"]) => {
    if (view === target) return true;
    if (!close()) return false;
    setBatchLeft(0);
    const next = new URLSearchParams(searchParams);
    next.set("status", target);
    next.delete("item");
    next.delete("organize");
    setSearchParams(next);
    return true;
  };

  const editorTitle = aiProposal && !intent ? "Podgląd propozycji AI" : intent ? intent === "goal" ? "Utwórz grupę" : intent === "action" ? "Dodaj Działanie" : "Zapisz w Bibliotece" : "Co chcesz z tym zrobić?";
  const panelTitle = item ? editorTitle : finished ? "Wynik" : requestedId ? "Zapis ze Skrzynki" : "Wybierz wpis ze Skrzynki";
  function resultLink(source: InboxItem | undefined) {
    const id = source?.resolvedToIds?.at(-1);
    if (!id) return undefined;
    const type = state.knowledge.some((entry) => entry.id === id) ? "knowledge"
      : state.actions.some((entry) => entry.id === id) ? "action"
      : state.goals.some((entry) => entry.id === id) ? "goal" : undefined;
    return type && routeForEntity({ type, id });
  }
  const requestedResult = resultLink(requested ?? undefined);
  const sourcePreview = <>{requested ? <><p className="inbox-source-preview">{requested.content}</p>{requested.status === "unprocessed" ? <Button onClick={() => desktop ? select(requested) : open(requested)}>Uporządkuj</Button> : <><p>Status: {inboxStatusLabels[requested.status]}</p>{requestedResult && <Link className="button button-secondary" to={requestedResult}>Otwórz wynik</Link>}</>}</> : selectedQuery.isPending && mode !== "demo" ? <p role="status">Ładowanie zapisu…</p> : <p role="alert">Nie udało się otworzyć zapisu. <button onClick={() => void selectedQuery.refetch()}>Spróbuj ponownie</button></p>}</>;
  const nextCandidate = visible.find((candidate) => candidate.id !== finished?.id);
  const batchSize = Math.min(3, visible.length);
  const resolvedResult = finished && resultLink(state.inbox.find((candidate) => candidate.id === finished.id));
  const finishedContent = finished ? <Panel className="inbox-finished">
    <p role="status">{finished.message}</p>
    {nextCandidate ? <Button variant="primary" onClick={() => desktop ? select(nextCandidate) : open(nextCandidate)}>{batchLeft > 0 ? `Następny wpis · zostało ${Math.min(batchLeft, visible.filter((candidate) => candidate.id !== finished.id).length)}` : "Następny wpis"}</Button> : null}
    {resolvedResult ? <Link className="button button-secondary" to={resolvedResult}>Otwórz wynik</Link> : null}
    <Link className="button button-ghost" to={finished.url} onClick={() => { setFinished(undefined); setBatchLeft(0); }}>Pokaż w historii</Link>
    <Button variant="ghost" onClick={() => { setFinished(undefined); setBatchLeft(0); }}>Zakończ</Button>
  </Panel> : null;

  return <div className="inbox-workspace" onKeyDown={(event) => {
    if (desktop && event.key === "Escape" && (item || requestedId || finished) && !document.querySelector('[aria-modal="true"]')) { event.preventDefault(); close(); }
  }}><div className="inbox-collection">
    <div className="inbox-toolbar">
      <div className="inbox-view-tabs" role="tablist" aria-label="Widoki Skrzynki" onKeyDown={(event) => {
        if (saving || aiLoading || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = inboxViews.indexOf(view);
        const next = event.key === "Home" ? 0 : event.key === "End" ? inboxViews.length - 1
          : (index + inboxViews.length + (event.key === "ArrowRight" ? 1 : -1)) % inboxViews.length;
        const target = inboxViews[next]!;
        if (changeView(target)) event.currentTarget.querySelector<HTMLButtonElement>(`#inbox-tab-${target}`)?.focus();
      }}>
        {inboxViews.map((status) => <button type="button" role="tab" id={`inbox-tab-${status}`} aria-controls="inbox-results-panel" aria-selected={view === status} tabIndex={view === status ? 0 : -1} key={status} disabled={saving || aiLoading} onClick={() => changeView(status)}>{inboxStatusLabels[status]}</button>)}
      </div>
      {view === "unprocessed" && batchSize > 1 && !finished ? <Button className="inbox-batch-button" variant="secondary" disabled={saving || aiLoading} onClick={() => {
        if (desktop ? select(visible[0]!) : open(visible[0]!)) setBatchLeft(batchSize);
      }}>Uporządkuj {batchSize} wpisy</Button> : null}
    </div>
    {!desktop && finished ? finishedContent : null}
    <Modal open={!desktop && Boolean(requestedId) && !item} title="Zapis ze Skrzynki" onClose={dismissPreview}>{sourcePreview}</Modal>

    <div id="inbox-results-panel" role="tabpanel" aria-labelledby={`inbox-tab-${view}`}>
    {initialInboxLoad ? <ListSkeleton label="Ładowanie Skrzynki" /> : null}
    <p className={initialInboxLoad ? "sr-only" : "inbox-refresh-status"} role="status">{refreshingInbox ? "Odświeżanie Skrzynki…" : ""}</p>
    {visible.length ? <ul className="workspace-list inbox-results" role="list" aria-label="Wpisy Skrzynki">{visible.map((candidate) => {
      const kind = legacyModes.find((entry) => entry.id === candidate.kind);
      const content = candidate.content.trim();
      const source = safeHttpUrl(content.match(/^https?:\/\/\S+/i)?.[0]);
      const description = source ? content.slice(source.length).trim() : "";
      const Icon = source ? Link2 : kind?.icon ?? Inbox;
      const key = `status:${candidate.id}`;
      const selected = desktop && (item?.id === candidate.id || (!item && requestedId === candidate.id));
      return <li className="workspace-list-row inbox-result-row" key={candidate.id} data-inbox-id={candidate.id} data-selected={selected || undefined} tabIndex={-1}>
        <span className="inbox-kind"><Icon aria-hidden="true" /></span>
        <div className="inbox-result-content">
          <Link className="inbox-result-title" to={`${inboxAddress(candidate.id, candidate.status)}${candidate.status === "unprocessed" ? "&organize=true" : ""}`} aria-current={selected ? "true" : undefined} aria-disabled={saving || aiLoading || undefined} onClick={(event) => {
            if (saving || aiLoading) { event.preventDefault(); return; }
            if (!desktop || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            select(candidate, event.currentTarget);
          }}><strong className="inbox-content-preview">{description || candidate.content}</strong></Link>
          <small className="inbox-result-meta">
            {source && description ? `${new URL(source).hostname} · ` : ""}
            {candidate.snoozedUntil
              ? `Wróci ${new Date(candidate.snoozedUntil).toLocaleString("pl-PL", { timeZone: state.workspaceTimezone, dateStyle: "medium", timeStyle: "short" })}`
              : new Date(candidate.createdAt).toLocaleDateString("pl-PL", { timeZone: state.workspaceTimezone, dateStyle: "medium" })}
          </small>
          {mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" disabled={saving || aiLoading} onClick={() => void runInboxOperation(candidate)}>Spróbuj ponownie</button></p> : null}
        </div>
        <div className="inbox-result-actions">
          {view === "unprocessed" ? <>
            <details className="inbox-result-menu" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }} onKeyDown={(event) => {
              if (event.key !== "Escape" || !event.currentTarget.open) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }}>
              <summary aria-label="Więcej opcji wpisu" title="Więcej opcji wpisu"><MoreHorizontal aria-hidden="true" /></summary>
              <div>
                <Button variant="ghost" disabled={saving || aiLoading} onClick={(event) => runMenuStatusChange(event, candidate, "snoozed")}><AlarmClock aria-hidden="true" />Odłóż do jutra</Button>
                <Button variant="ghost" disabled={saving || aiLoading} onClick={(event) => runMenuStatusChange(event, candidate, "discarded")}><Trash2 aria-hidden="true" />Odrzuć</Button>
              </div>
            </details>
          </> : <Button loading={mutation.isBusy(key)} disabled={saving || aiLoading} onClick={() => void runInboxOperation(candidate, async () => {
            await setInboxStatus(candidate.id, "unprocessed");
            notifyUndo({ message: "Przywrócono do Skrzynki.", undo: () => setInboxStatus(candidate.id, candidate.status, candidate.snoozedUntil) });
          })}><RotateCcw aria-hidden="true" />Przywróć teraz</Button>}
        </div>
      </li>;
    })}</ul> : !initialInboxLoad && !inboxPage.isError ? <EmptyState icon={<Inbox />} title="Brak elementów w tym widoku" detail={view === "unprocessed" ? "Dodaj link lub treść do Skrzynki. Uporządkujesz go później bez tracenia oryginału." : "Możesz wrócić do innego widoku Skrzynki."} action={view === "unprocessed" && !captureOpen ? <Button variant="primary" onClick={() => requestAppQuickAdd({ mode: "inbox", draftKey: "knowledge-inbox" })}>Zapisz do Skrzynki</Button> : undefined} /> : null}
    {inboxPage.isError ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać kolejnych elementów Skrzynki.</p> : null}
    {inboxPage.hasNextPage ? <div className="list-pagination"><Button loading={inboxPage.isFetchingNextPage} onClick={() => void inboxPage.fetchNextPage()}>Załaduj starsze</Button></div> : null}
    </div>
    </div>
    <InboxProcessingSurface desktop={desktop} open={Boolean(item)} busy={saving || aiLoading} title={panelTitle} focusKey={item ? `process:${item.id}` : finished ? "finished" : requestedId ? `source:${requestedId}` : ""} onClose={() => close()} idle={finished ? finishedContent : requestedId ? <div className="inbox-readonly-source">{sourcePreview}</div> : null}><div className="quick-add"><CreationBody><fieldset className="creation-fields" disabled={saving || aiLoading || Boolean(completion.receipt)}>
      {item && (intent === "knowledge" && form.knowledgeKind === "note"
        ? <details className="inbox-original"><summary>Oryginalny wpis</summary><blockquote className="inbox-source-preview">{item.content}</blockquote></details>
        : <blockquote className="inbox-source-preview">{item.content}</blockquote>)}
      {intent ? <p className="quick-add-context-summary">Miejsce zapisu: {(() => { const goalId = intent === "knowledge" && form.knowledgeKind === "note" ? noteDraft.value.goalId : intent === "goal" ? "" : form.goalId; const areaId = intent === "knowledge" ? form.knowledgeKind === "note" ? noteDraft.value.projectId : form.projectId : form.areaId; return [goalId ? `Grupa: ${state.goals.find((goal) => goal.id === goalId)?.title ?? "Niedostępna grupa działań"}` : "", areaId ? `Projekt: ${state.areas.find((area) => area.id === areaId)?.name ?? "Niedostępny Projekt"}` : ""].filter(Boolean).join(" · ") || "Bez powiązania"; })()}</p> : null}
      {!intent && aiProposal && noteProposalConflict ? <div role="alert"><p>Masz własny szkic notatki. Wybierz, którą treść chcesz edytować.</p><div className="button-row"><Button onClick={() => { setNoteProposalConflict(false); chooseIntent("knowledge"); setForm((current) => ({ ...current, knowledgeKind: "note" })); }}>Otwórz zapisany szkic</Button><Button onClick={() => applyAIProposal(true)}>Zastąp szkic propozycją AI</Button></div></div> : null}
      {!intent && aiProposal ? <AIInboxTriagePreview proposal={aiProposal} state={state} onApprove={() => void approveAIProposal()} onEdit={() => applyAIProposal()} onReject={() => { setAIProposal(undefined); setNoteProposalConflict(false); }} onFeedback={(rating) => void submitInboxTriageFeedback(aiProposal.proposalId, rating)} /> : !intent ? <div className="intent-list">
        <button onClick={() => chooseIntent("action")}><ListPlus /><span><strong>Dodaj Działanie</strong><small>Konkretny krok do wykonania.</small></span></button>
        <button onClick={() => { setForm((current) => ({ ...current, knowledgeKind: "note" })); chooseIntent("knowledge"); }}><Archive /><span><strong>Zapisz notatkę</strong></span></button>
        <button onClick={() => { setForm((current) => ({ ...current, knowledgeKind: "resource" })); chooseIntent("knowledge"); }}><Link2 /><span><strong>Zapisz materiał</strong></span></button>
        <details><summary>Więcej możliwości</summary><button onClick={() => chooseIntent("goal")}><Flag />Utwórz grupę</button>
        <div className="ai-inbox-scope">AI otrzyma ten wpis i ograniczony kontekst aktywnych grup oraz Projektów. Przed zapisem zobaczysz propozycję.</div>
        <Button loading={aiLoading} onClick={() => void requestAI()}><Sparkles />Zaproponuj przez AI</Button>
        {aiError ? <p role="alert">{aiError}</p> : null}
        <Button onClick={() => item && runInboxOperation(item, () => changeStatus(item, "snoozed"))}>Odłóż do jutra</Button>
        <Button onClick={() => item && runInboxOperation(item, () => changeStatus(item, "discarded"))}>Odrzuć</Button>
        </details>{item && mutation.error(`status:${item.id}`) ? <p role="alert">{mutation.error(`status:${item.id}`)}</p> : null}
      </div> : <>
        <button className="back-link" onClick={backToDecision}>← Wróć do decyzji</button>
        {intent !== "knowledge" || form.knowledgeKind !== "note" ? <><label className="field-label" htmlFor="triage-title">{intent === "goal" ? "Nazwa grupy" : intent === "action" ? "Jakie Działanie wykonać?" : knowledgeKindGuidance[form.knowledgeKind].titleLabel}</label><input id="triage-title" placeholder={intent === "knowledge" ? knowledgeKindGuidance[form.knowledgeKind].titlePlaceholder : undefined} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required /></> : null}
        {intent === "goal" ? <><label className="field-label" htmlFor="triage-outcome">Rezultat <span className="optional-label">opcjonalnie</span></label><textarea id="triage-outcome" rows={3} value={form.outcome} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="triage-goal-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="triage-goal-project" value={form.areaId} onChange={(event) => setForm((current) => ({ ...current, areaId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><ActionGroupTypePicker value={actionGroupType(form)} onChange={(groupType) => setForm((current) => ({ ...current, groupType }))} /><GoalCreationOptions value={{ ...emptyDraft, groupType: actionGroupType(form), mode: "goal", title: form.title, detail: form.outcome, firstActionTitle: form.firstAction, goalKind: form.goalKind, goalTemplateId: form.goalTemplateId, goalCriteria: form.goalCriteria }} onChange={(value) => setForm((current) => ({ ...current, firstAction: value.firstActionTitle ?? "", goalKind: value.goalKind ?? "custom", goalTemplateId: value.goalTemplateId ?? "", goalCriteria: value.goalCriteria ?? "" }))} />{actionGroupType(form) === "task" ? <><label className="field-label" htmlFor="triage-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="triage-date" type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} /></> : null}</> : null}
        {intent === "action" ? <TriageActionFields key={item?.id} value={form} onChange={(changes) => setForm((current) => ({ ...current, ...changes }))} /> : null}
        {intent === "knowledge" && <>{item?.kind === "link" && form.knowledgeKind === "resource" ? <KnowledgeSuggestions url={item.content} onUse={async (material) => {
          if (busyRef.current) return;
          if (!formDraft.flush() || !noteDraft.flush()) throw new Error("Nie udało się zapisać szkicu. Ponów zapis przed połączeniem materiału.");
          busyRef.current = true; setSaving(true);
          try { await triageExistingKnowledge(item.id, material.id, form.goalId || undefined, form.projectId || undefined); completeProcessing(resultReceipt(item, `Powiązany materiał · ${material.title}`)); }
          finally { busyRef.current = false; setSaving(false); }
        }} /> : null}<details className="inbox-knowledge-type"><summary>Zmień typ · {knowledgeKindGuidance[form.knowledgeKind].label}</summary><KnowledgeKindPicker value={form.knowledgeKind} onChange={(knowledgeKind) => { if (form.knowledgeKind === "note" && !noteDraft.flush()) { setError("Nie udało się zapisać szkicu na tym urządzeniu. Skopiuj treść albo ponów zapis szkicu przed zmianą rodzaju."); return; } if (knowledgeKind === "note" && !noteDraft.dirty) noteDraft.setValue((current) => ({ ...current, detail: form.detail, title: "" })); setError(""); setForm((current) => ({ ...current, knowledgeKind, isBook: knowledgeKind === "resource" ? current.isBook : false })); }} name="triage-knowledge-kind" /></details>{form.knowledgeKind === "note" ? <KnowledgeNoteFields idPrefix={`inbox-note-${item?.id ?? "new"}`} content={noteDraft.value.detail} onContentChange={(detail) => noteDraft.setValue((current) => ({ ...current, detail }))} title={noteDraft.value.title} onTitleChange={(title) => noteDraft.setValue((current) => ({ ...current, title }))} context="Skrzynka · oryginał zostaje w historii" disabled={saving}><label className="field-label" htmlFor="triage-note-goal">Grupa działań <span className="optional-label">opcjonalnie</span></label><select id="triage-note-goal" value={noteDraft.value.goalId} onChange={(event) => noteDraft.setValue((current) => ({ ...current, goalId: event.target.value }))}><option value="">Bez grupy</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><label className="field-label" htmlFor="triage-note-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="triage-note-project" value={noteDraft.value.projectId} onChange={(event) => noteDraft.setValue((current) => ({ ...current, projectId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><KnowledgeSourceField id="triage-note-source" value={noteDraft.value.sourceBookId} onChange={(sourceBookId) => noteDraft.setValue((current) => ({ ...current, sourceBookId }))} /></KnowledgeNoteFields> : <>{form.knowledgeKind === "resource" ? <><BookCreationFields value={form} onChange={(changes) => setForm((current) => ({ ...current, ...changes }))} /></> : null}<label className="field-label" htmlFor="triage-goal">Połącz z grupą <span className="optional-label">opcjonalnie</span></label><select id="triage-goal" value={form.goalId} onChange={(event) => setForm((current) => ({ ...current, goalId: event.target.value, projectId: "" }))}><option value="">Bez powiązania</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><label className="field-label" htmlFor="triage-project">Połącz z Projektem <span className="optional-label">opcjonalnie</span></label><select id="triage-project" value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value, goalId: "" }))}><option value="">Bez powiązania</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></>}</>}
        {noteDraft.status !== "idle" && intent === "knowledge" && form.knowledgeKind === "note" ? <DraftStatus status={noteDraft.status} restored={noteDraft.restored} errorMessage={noteDraft.errorMessage} onRetry={() => void noteDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${noteDraft.value.title}\n${noteDraft.value.detail}`)} /> : null}
        {noteDraft.dirty && intent === "knowledge" && form.knowledgeKind === "note" ? <Button type="button" variant="ghost" onClick={() => noteDraft.discard()}>Odrzuć szkic</Button> : null}
        {intent === "knowledge" && form.knowledgeKind !== "note" && <><label className="field-label" htmlFor="triage-detail">{intent === "knowledge" ? knowledgeKindGuidance[form.knowledgeKind].detailLabel : "Treść / kontekst"}{intent === "knowledge" && !knowledgeKindGuidance[form.knowledgeKind].detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label><textarea id="triage-detail" rows={4} required={intent === "knowledge" && knowledgeKindGuidance[form.knowledgeKind].detailRequired} placeholder={intent === "knowledge" ? knowledgeKindGuidance[form.knowledgeKind].detailPlaceholder : undefined} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /></>}

      </>}
    </fieldset>{error ? <p className="auth-message error" role="alert">{error}</p> : null}</CreationBody>{intent || completion.receipt ? <CreationFooter><Button disabled={saving} onClick={() => close()}>Anuluj</Button><Button variant="primary" loading={saving} disabled={!completion.receipt && ((intent === "knowledge" && form.knowledgeKind === "note" ? !noteDraft.value.detail.trim() : !form.title.trim()) || (intent === "knowledge" && form.knowledgeKind !== "note" && knowledgeKindGuidance[form.knowledgeKind].detailRequired && !form.detail.trim()))} onClick={() => void finish()}><Check />{completion.receipt ? "Usuń zapisany szkic" : intent === "knowledge" && form.knowledgeKind === "note" ? "Zapisz notatkę" : intent === "knowledge" ? knowledgeKindGuidance[form.knowledgeKind].saveLabel : "Zapisz"}</Button></CreationFooter> : null}</div></InboxProcessingSurface>
  </div>;
}

export function InboxPage() {
  const location = useLocation();
  const legacy = new URLSearchParams(location.search);
  const next = new URLSearchParams();
  next.set("section", "inbox");
  next.set("status", legacy.get("view") ?? "unprocessed");
  for (const key of ["item", "capture"]) {
    const value = legacy.get(key);
    if (value) next.set(key, value);
  }
  return <Navigate to={`/knowledge?${next.toString()}`} replace />;
}
