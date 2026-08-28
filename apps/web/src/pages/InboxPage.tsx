import { useEffect, useState } from "react";
import { AlarmClock, Archive, Check, File, Flag, Inbox, Link2, ListPlus, Mic, RotateCcw, Sparkles, TextCursorInput, Trash2 } from "lucide-react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { Modal } from "../components/Modal";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import type { InboxItem, InboxKind, KnowledgeKind } from "../domain/types";
import { CaptureComposer } from "../components/CaptureComposer";
import { tomorrowAtLocalTime } from "../domain/inbox";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { recordFirstFlowStage } from "../lib/firstFlow";
import { AIInboxTriagePreview } from "../components/AIInboxTriagePreview";
import type { AIInboxTriageProposal } from "../domain/aiInboxTriage";

const modes: Array<{ id: InboxKind; label: string; icon: typeof TextCursorInput }> = [
  { id: "text", label: "Tekst", icon: TextCursorInput }, { id: "link", label: "Link", icon: Link2 }
];
const legacyModes = [...modes, { id: "voice" as const, label: "Głos (historyczny)", icon: Mic }, { id: "file" as const, label: "Plik (historyczny)", icon: File }];
type Intent = "goal" | "action" | "knowledge";

export function KnowledgeInbox() {
  const { state, loading, capture, triageInboxIntent, setInboxStatus, releaseDueInbox, requestInboxTriageProposal, submitInboxTriageFeedback } = useStore();
  const inboxPage = useWorkspaceInfinitePage<InboxItem>("inbox", 50);
  const navigate = useNavigate();
  const { notifyUndo } = useActionFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [item, setItem] = useState<InboxItem>();
  const [intent, setIntent] = useState<Intent>();
  const [form, setForm] = useState({ title: "", outcome: "", firstAction: "", detail: "", goalId: "", areaId: "", projectId: "", targetDate: "", pin: true, knowledgeKind: "note" as KnowledgeKind });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiProposal, setAIProposal] = useState<AIInboxTriageProposal>();
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState("");
  const mutation = useKeyedMutation();

  const view = (searchParams.get("status") ?? "unprocessed") as InboxItem["status"];
  const captureOpen = searchParams.get("capture") === "true";
  useEffect(() => {
    if (!["unprocessed", "snoozed", "resolved", "discarded"].includes(view)) {
      const next = new URLSearchParams(searchParams); next.set("status", "unprocessed"); setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, view]);
  useEffect(() => { if (searchParams.get("capture") === "true") document.getElementById("capture-input")?.focus(); }, [searchParams]);
  useEffect(() => {
    const release = () => { void releaseDueInbox(); };
    release(); window.addEventListener("focus", release); return () => window.removeEventListener("focus", release);
  }, [releaseDueInbox]);
  useEffect(() => { const id = searchParams.get("item"); if (!id) return; requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-inbox-id="${CSS.escape(id)}"]`)?.focus()); }, [searchParams, state.inbox]);
  const inboxItems = mergePagedItems(state.inbox, inboxPage.data?.items ?? []);
  const visible = inboxItems.filter((candidate) => candidate.status === view);
  const open = (candidate: InboxItem) => {
    recordFirstFlowStage("triage-started");
    setItem(candidate); setIntent(undefined); setError(""); setAIProposal(undefined); setAIError("");
    setForm({ title: candidate.content.slice(0, 100), outcome: "", firstAction: "", detail: candidate.content, goalId: "", areaId: "", projectId: "", targetDate: "", pin: true, knowledgeKind: candidate.kind === "link" ? "resource" : "note" });
  };
  const close = () => { setItem(undefined); setIntent(undefined); };
  const requestAI = async () => {
    if (!item || aiLoading) return;
    setAILoading(true); setAIError("");
    try { setAIProposal(await requestInboxTriageProposal(item.id)); }
    catch (caught) { setAIError(caught instanceof Error ? caught.message : "Nie udało się przygotować propozycji AI."); }
    finally { setAILoading(false); }
  };
  const applyAIProposal = () => {
    if (!aiProposal) return;
    const suggestion = aiProposal.proposal;
    if (suggestion.decision === "keep_inbox") { close(); return; }
    const goalId = suggestion.linkedType === "goal" ? suggestion.linkedId ?? "" : "";
    const projectId = suggestion.linkedType === "project" ? suggestion.linkedId ?? "" : "";
    if (suggestion.decision === "goal") {
      setIntent("goal"); setForm((current) => ({ ...current, title: suggestion.title ?? current.title, outcome: suggestion.detail ?? current.detail, firstAction: "", areaId: projectId, targetDate: suggestion.targetDate ?? "" }));
    } else if (suggestion.decision === "action") {
      setIntent("action"); setForm((current) => ({ ...current, title: suggestion.title ?? current.title, detail: suggestion.detail ?? current.detail, goalId, areaId: projectId, targetDate: suggestion.targetDate ?? "" }));
    } else {
      setIntent("knowledge"); setForm((current) => ({ ...current, title: suggestion.title ?? current.title, detail: suggestion.detail ?? current.detail, knowledgeKind: suggestion.knowledgeKind ?? "note", goalId, projectId }));
    }
  };
  const approveAIProposal = async () => {
    if (!item || !aiProposal || saving) return;
    const suggestion = aiProposal.proposal;
    if (suggestion.decision === "keep_inbox") { close(); return; }
    const goalId = suggestion.linkedType === "goal" ? suggestion.linkedId ?? undefined : undefined;
    const projectId = suggestion.linkedType === "project" ? suggestion.linkedId ?? undefined : undefined;
    setSaving(true); setError("");
    try {
      if (suggestion.decision === "goal") await triageInboxIntent(item.id, { kind: "goal", title: suggestion.title!, outcome: suggestion.detail!, areaId: projectId, targetDate: suggestion.targetDate ?? undefined });
      if (suggestion.decision === "action") await triageInboxIntent(item.id, { kind: "action", title: suggestion.title!, detail: suggestion.detail ?? undefined, goalId, areaId: projectId, targetDate: suggestion.targetDate ?? undefined });
      if (suggestion.decision === "knowledge") await triageInboxIntent(item.id, { kind: "knowledge", knowledgeKind: suggestion.knowledgeKind!, title: suggestion.title!, detail: suggestion.detail ?? "", goalId, projectId, sourceUrl: item.kind === "link" ? item.content : undefined });
      if (suggestion.decision === "action") navigate("/");
      close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zatwierdzić propozycji."); }
    finally { setSaving(false); }
  };
  const finish = async () => {
    if (!item || !intent || saving) return;
    setSaving(true); setError("");
    try {
      if (intent === "goal") await triageInboxIntent(item.id, { kind: "goal", title: form.title, outcome: form.outcome, firstActionTitle: form.firstAction || undefined, areaId: form.areaId || undefined, targetDate: form.targetDate || undefined });
      if (intent === "action") await triageInboxIntent(item.id, { kind: "action", title: form.title, detail: form.detail, goalId: form.goalId || undefined, areaId: form.areaId || undefined, pinnedToToday: form.pin, targetDate: form.targetDate || undefined });
      if (intent === "knowledge") await triageInboxIntent(item.id, { kind: "knowledge", knowledgeKind: form.knowledgeKind, title: form.title, detail: form.detail, goalId: form.goalId || undefined, projectId: form.projectId || undefined, sourceUrl: item.kind === "link" ? item.content : undefined });
      if (intent === "action") {
        recordFirstFlowStage("action-created");
        close();
        navigate("/");
      } else close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się przetworzyć przechwycenia."); }
    finally { setSaving(false); }
  };
  const changeStatus = async (candidate: InboxItem, status: "snoozed" | "discarded") => {
    const until = status === "snoozed" ? tomorrowAtLocalTime(new Date(), state.workspaceTimezone) : undefined;
    await setInboxStatus(candidate.id, status, until);
    notifyUndo({ message: status === "snoozed" ? "Odłożono do jutra." : "Przechwycenie odrzucone.", undo: () => setInboxStatus(candidate.id, candidate.status, candidate.snoozedUntil) });
  };

  return <>
    {captureOpen ? <Panel className="capture-page-card knowledge-capture-panel"><div className="knowledge-capture-head"><div><h2>Dodaj do Skrzynki</h2><p>Zapisz teraz, uporządkuj później.</p></div></div><CaptureComposer draftKey="knowledge-capture" id="capture-input" onSubmit={capture} /></Panel> : null}
    <div className="inbox-tabs" role="tablist" aria-label="Widoki Skrzynki">{([{ id: "unprocessed", label: "Nowe" }, { id: "snoozed", label: "Odłożone" }, { id: "resolved", label: "Przetworzone" }, { id: "discarded", label: "Odrzucone" }] as const).map((tab) => <button role="tab" aria-selected={view === tab.id} key={tab.id} onClick={() => { searchParams.set("status", tab.id); searchParams.delete("item"); setSearchParams(searchParams); }}>{tab.label} <span>{inboxItems.filter((item) => item.status === tab.id).length}</span></button>)}</div>
    <div className="section-heading knowledge-inbox-heading"><h2>{view === "unprocessed" ? "Nowe" : view === "snoozed" ? "Odłożone" : view === "resolved" ? "Przetworzone" : "Odrzucone"}</h2><span>Oryginał pozostaje w historii Skrzynki</span></div>
    {loading || inboxPage.isPending ? <ListSkeleton label="Ładowanie Skrzynki" /> : null}
    {visible.length ? <div className="inbox-list">{visible.map((candidate) => { const mode = legacyModes.find((entry) => entry.id === candidate.kind); const Icon = mode?.icon ?? Inbox; const key = `status:${candidate.id}`; return <Panel className="inbox-item" key={candidate.id} data-inbox-id={candidate.id} tabIndex={-1}><span className="inbox-kind"><Icon /></span><div><strong>{candidate.content}</strong><small>{new Date(candidate.createdAt).toLocaleString("pl-PL", { timeZone: state.workspaceTimezone })}{candidate.snoozedUntil ? ` · wróci ${new Date(candidate.snoozedUntil).toLocaleString("pl-PL", { timeZone: state.workspaceTimezone })}` : ""}</small>{mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</div><Badge tone="neutral">{mode?.label}</Badge><div className="inbox-actions">{view === "unprocessed" ? <><Button variant="primary" onClick={() => open(candidate)}>Przetwórz</Button><Button variant="ghost" onClick={() => open(candidate)} aria-label="Asystuj AI"><Sparkles /></Button><Button variant="ghost" loading={mutation.isBusy(key)} aria-label="Odłóż do jutra" onClick={() => void mutation.run(key, () => changeStatus(candidate, "snoozed"))}><AlarmClock /></Button><Button variant="ghost" loading={mutation.isBusy(key)} aria-label="Odrzuć" onClick={() => void mutation.run(key, () => changeStatus(candidate, "discarded"))}><Trash2 /></Button></> : <Button loading={mutation.isBusy(key)} onClick={() => void mutation.run(key, async () => { await setInboxStatus(candidate.id, "unprocessed"); notifyUndo({ message: "Przywrócono do Skrzynki.", undo: () => setInboxStatus(candidate.id, candidate.status, candidate.snoozedUntil) }); })}><RotateCcw />Przywróć teraz</Button>}</div></Panel>; })}</div> : <EmptyState icon={<Inbox />} title="Brak elementów w tym widoku" detail={view === "unprocessed" ? "Dodaj link lub treść do Skrzynki. Uporządkujesz go później bez tracenia oryginału." : "Możesz wrócić do innego widoku Skrzynki."} />}
    {inboxPage.isError && visible.length ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać kolejnych elementów Skrzynki.</p> : null}
    {visible.length && inboxPage.hasNextPage ? <div className="list-pagination"><Button loading={inboxPage.isFetchingNextPage} onClick={() => void inboxPage.fetchNextPage()}>Załaduj starsze</Button></div> : null}
    {visible.length && !inboxPage.hasNextPage && !inboxPage.isFetching ? <p className="muted-copy list-end">To wszystkie elementy w tym widoku.</p> : null}

    <Modal open={Boolean(item)} closeDisabled={saving || aiLoading} title={aiProposal && !intent ? "Podgląd propozycji AI" : intent ? intent === "goal" ? "Utwórz Cel" : intent === "action" ? "Dodaj Działanie" : "Zapisz w Bibliotece" : "Co chcesz z tym zrobić?"} onClose={close}>
      {!intent && aiProposal ? <AIInboxTriagePreview proposal={aiProposal} state={state} onApprove={() => void approveAIProposal()} onEdit={applyAIProposal} onReject={() => setAIProposal(undefined)} onFeedback={(rating) => void submitInboxTriageFeedback(aiProposal.proposalId, rating)} /> : !intent ? <div className="intent-list"><p className="modal-intro">Wybierz rezultat. Możesz też poprosić AI o propozycję — nic nie zostanie zapisane bez Twojego zatwierdzenia.</p><div className="ai-inbox-scope"><strong>Zakres dla AI</strong><span>Treść tego elementu, typ, deterministyczne fakty oraz ograniczona lista aktywnych Celów i Projektów z tego Workspace'u. Bez profilu, e-maila, pełnej Skrzynki i Wiedzy.</span></div><Button variant="primary" loading={aiLoading} onClick={() => void requestAI()}><Sparkles />Zaproponuj przez AI</Button>{aiError ? <p className="auth-message error" role="alert">{aiError}</p> : null}<button onClick={() => setIntent("goal")}><Flag /><span><strong>Utwórz Cel</strong><small>Gdy przechwycenie opisuje rezultat, do którego chcesz dojść.</small></span></button><button onClick={() => setIntent("action")}><ListPlus /><span><strong>Dodaj Działanie</strong><small>Gdy to konkretny krok do wykonania.</small></span></button><button onClick={() => setIntent("knowledge")}><Archive /><span><strong>Zapisz w Bibliotece</strong><small>Gdy chcesz zachować materiał, notatkę albo decyzję.</small></span></button><button disabled={Boolean(item && mutation.isBusy(`status:${item.id}`))} aria-busy={Boolean(item && mutation.isBusy(`status:${item.id}`))} onClick={() => item && void mutation.run(`status:${item.id}`, async () => { await changeStatus(item, "snoozed"); close(); })}><AlarmClock /><span><strong>Odłóż do jutra</strong><small>Element wróci do Skrzynki później.</small></span></button><button disabled={Boolean(item && mutation.isBusy(`status:${item.id}`))} aria-busy={Boolean(item && mutation.isBusy(`status:${item.id}`))} onClick={() => item && void mutation.run(`status:${item.id}`, async () => { await changeStatus(item, "discarded"); close(); })}><Trash2 /><span><strong>Odrzuć</strong><small>Oryginał pozostanie w historii odzyskiwania.</small></span></button>{item && mutation.error(`status:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`status:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`status:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}</div> : <>
        <button className="back-link" onClick={() => { setIntent(undefined); setAIProposal(undefined); }}>← Wróć do decyzji</button>
        <label className="field-label" htmlFor="triage-title">{intent === "goal" ? "Co chcesz osiągnąć?" : intent === "action" ? "Jakie Działanie wykonać?" : "Tytuł"}</label><input id="triage-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required autoFocus />
        {intent === "goal" && <><label className="field-label" htmlFor="triage-outcome">Jaki rezultat chcesz zobaczyć?</label><textarea id="triage-outcome" rows={3} value={form.outcome} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="triage-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="triage-date" type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} /><label className="field-label" htmlFor="triage-first">Pierwszy krok <span className="optional-label">opcjonalnie</span></label><input id="triage-first" value={form.firstAction} onChange={(event) => setForm((current) => ({ ...current, firstAction: event.target.value }))} /></>}
        {intent === "action" && <><label className="field-label" htmlFor="triage-context">Powiązanie</label><select id="triage-context" value={form.goalId || (form.areaId ? `area:${form.areaId}` : "")} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Świadomie bez powiązania</option><optgroup label="Cele">{state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Projekty">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select><label className="field-label" htmlFor="triage-action-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="triage-action-date" type="date" value={form.targetDate} onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))} /><label className="checkbox-row"><input type="checkbox" checked={form.pin} onChange={(event) => setForm((current) => ({ ...current, pin: event.target.checked }))} />Pokaż na Starcie</label></>}
        {intent === "knowledge" && <><label className="field-label" htmlFor="triage-kind">Rodzaj</label><select id="triage-kind" value={form.knowledgeKind} onChange={(event) => setForm((current) => ({ ...current, knowledgeKind: event.target.value as KnowledgeKind }))}><option value="note">Notatka</option><option value="resource">Materiał</option><option value="decision">Decyzja</option><option value="artifact">Rezultat</option><option value="investigation">Poszukiwanie</option></select><label className="field-label" htmlFor="triage-goal">Połącz z Celem <span className="optional-label">opcjonalnie</span></label><select id="triage-goal" value={form.goalId} onChange={(event) => setForm((current) => ({ ...current, goalId: event.target.value, projectId: "" }))}><option value="">Bez powiązania</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><label className="field-label" htmlFor="triage-project">Połącz z Projektem <span className="optional-label">opcjonalnie</span></label><select id="triage-project" value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value, goalId: "" }))}><option value="">Bez powiązania</option>{state.projects.filter((project) => !project.archivedAt && !project.trashedAt).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></>}
        {intent !== "goal" && <><label className="field-label" htmlFor="triage-detail">Treść / kontekst</label><textarea id="triage-detail" rows={4} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /></>}
        {error && <p className="auth-message error" role="alert">{error}</p>}<div className="modal-actions"><Button onClick={close}>Anuluj</Button><Button variant="primary" loading={saving} disabled={!form.title.trim() || (intent === "goal" && !form.outcome.trim())} onClick={() => void finish()}><Check />Zapisz</Button></div>
      </>}
    </Modal>
  </>;
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
