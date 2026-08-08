import { useEffect, useState } from "react";
import { AlarmClock, Archive, Check, File, Flag, Inbox, Link2, ListPlus, Mic, RotateCcw, TextCursorInput, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import type { InboxItem, InboxKind, KnowledgeKind } from "../domain/types";
import { CaptureComposer } from "../components/CaptureComposer";
import { tomorrowAtLocalTime } from "../domain/inbox";
import { useKeyedMutation } from "../hooks/useKeyedMutation";

const modes: Array<{ id: InboxKind; label: string; icon: typeof TextCursorInput }> = [
  { id: "text", label: "Tekst", icon: TextCursorInput }, { id: "link", label: "Link", icon: Link2 }
];
const legacyModes = [...modes, { id: "voice" as const, label: "Głos (historyczny)", icon: Mic }, { id: "file" as const, label: "Plik (historyczny)", icon: File }];
type Intent = "goal" | "action" | "knowledge";

export function InboxPage() {
  const { state, loading, capture, triageInboxIntent, setInboxStatus, releaseDueInbox } = useStore();
  const { notifyUndo } = useActionFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [item, setItem] = useState<InboxItem>();
  const [intent, setIntent] = useState<Intent>();
  const [form, setForm] = useState({ title: "", outcome: "", firstAction: "", detail: "", goalId: "", areaId: "", pin: true, knowledgeKind: "note" as KnowledgeKind });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mutation = useKeyedMutation();

  const view = (searchParams.get("view") ?? "unprocessed") as InboxItem["status"];
  useEffect(() => {
    if (!["unprocessed", "snoozed", "resolved", "discarded"].includes(view)) {
      const next = new URLSearchParams(searchParams); next.set("view", "unprocessed"); setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, view]);
  useEffect(() => { if (searchParams.get("capture") === "true") document.getElementById("capture-input")?.focus(); }, [searchParams]);
  useEffect(() => {
    const release = () => { void releaseDueInbox(); };
    release(); window.addEventListener("focus", release); return () => window.removeEventListener("focus", release);
  }, [releaseDueInbox]);
  useEffect(() => { const id = searchParams.get("item"); if (!id) return; requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-inbox-id="${CSS.escape(id)}"]`)?.focus()); }, [searchParams, state.inbox]);
  const pending = state.inbox.filter((candidate) => candidate.status === "unprocessed");
  const visible = state.inbox.filter((candidate) => candidate.status === view);
  const open = (candidate: InboxItem) => {
    setItem(candidate); setIntent(undefined); setError("");
    setForm({ title: candidate.content.slice(0, 100), outcome: "", firstAction: "", detail: candidate.content, goalId: "", areaId: "", pin: true, knowledgeKind: candidate.kind === "link" ? "resource" : "note" });
  };
  const close = () => { setItem(undefined); setIntent(undefined); };
  const finish = async () => {
    if (!item || !intent || saving) return;
    setSaving(true); setError("");
    try {
      if (intent === "goal") await triageInboxIntent(item.id, { kind: "goal", title: form.title, outcome: form.outcome, firstActionTitle: form.firstAction || undefined });
      if (intent === "action") await triageInboxIntent(item.id, { kind: "action", title: form.title, detail: form.detail, goalId: form.goalId || undefined, areaId: form.areaId || undefined, pinnedToToday: form.pin });
      if (intent === "knowledge") await triageInboxIntent(item.id, { kind: "knowledge", knowledgeKind: form.knowledgeKind, title: form.title, detail: form.detail, goalId: form.goalId || undefined, sourceUrl: item.kind === "link" ? item.content : undefined });
      close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się przetworzyć przechwycenia."); }
    finally { setSaving(false); }
  };
  const changeStatus = async (candidate: InboxItem, status: "snoozed" | "discarded") => {
    const until = status === "snoozed" ? tomorrowAtLocalTime(new Date(), state.workspaceTimezone) : undefined;
    await setInboxStatus(candidate.id, status, until);
    notifyUndo({ message: status === "snoozed" ? "Odłożono do jutra." : "Przechwycenie odrzucone.", undo: () => setInboxStatus(candidate.id, candidate.status, candidate.snoozedUntil) });
  };

  return <AppShell>
    <PageHeading title="Inbox" eyebrow={`${pending.length} elementów czeka na decyzję`} />
    <Panel className="capture-page-card"><h2>Szybkie przechwycenie</h2><CaptureComposer draftKey="inbox-capture" id="capture-input" onSubmit={capture} /></Panel>
    <div className="inbox-tabs" role="tablist" aria-label="Widoki Inboxu">{([{ id: "unprocessed", label: "Do przetworzenia" }, { id: "snoozed", label: "Odłożone" }, { id: "resolved", label: "Zakończone" }, { id: "discarded", label: "Odrzucone" }] as const).map((tab) => <button role="tab" aria-selected={view === tab.id} key={tab.id} onClick={() => { searchParams.set("view", tab.id); searchParams.delete("item"); setSearchParams(searchParams); }}>{tab.label} <span>{state.inbox.filter((item) => item.status === tab.id).length}</span></button>)}</div>
    <div className="section-heading"><h2>{view === "unprocessed" ? "Do przetworzenia" : view === "snoozed" ? "Odłożone" : view === "resolved" ? "Zakończone" : "Odrzucone"}</h2><span>Oryginał pozostaje w historii</span></div>
    {loading ? <ListSkeleton label="Ładowanie Inboxu" /> : null}
    {visible.length ? <div className="inbox-list">{visible.map((candidate) => { const mode = legacyModes.find((entry) => entry.id === candidate.kind); const Icon = mode?.icon ?? Inbox; const key = `status:${candidate.id}`; return <Panel className="inbox-item" key={candidate.id} data-inbox-id={candidate.id} tabIndex={-1}><span className="inbox-kind"><Icon /></span><div><strong>{candidate.content}</strong><small>{new Date(candidate.createdAt).toLocaleString("pl-PL", { timeZone: state.workspaceTimezone })}{candidate.snoozedUntil ? ` · wróci ${new Date(candidate.snoozedUntil).toLocaleString("pl-PL", { timeZone: state.workspaceTimezone })}` : ""}</small>{mutation.error(key) ? <p className="inline-mutation-error" role="alert">{mutation.error(key)} <button type="button" onClick={() => void mutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</div><Badge tone="neutral">{mode?.label}</Badge><div className="inbox-actions">{view === "unprocessed" ? <><Button variant="primary" onClick={() => open(candidate)}>Co chcesz z tym zrobić?</Button><Button variant="ghost" loading={mutation.isBusy(key)} aria-label="Odłóż do jutra" onClick={() => void mutation.run(key, () => changeStatus(candidate, "snoozed"))}><AlarmClock /></Button><Button variant="ghost" loading={mutation.isBusy(key)} aria-label="Odrzuć" onClick={() => void mutation.run(key, () => changeStatus(candidate, "discarded"))}><Trash2 /></Button></> : <Button loading={mutation.isBusy(key)} onClick={() => void mutation.run(key, async () => { await setInboxStatus(candidate.id, "unprocessed"); notifyUndo({ message: "Przywrócono do przetworzenia.", undo: () => setInboxStatus(candidate.id, candidate.status, candidate.snoozedUntil) }); })}><RotateCcw />Przywróć teraz</Button>}</div></Panel>; })}</div> : <EmptyState icon={<Inbox />} title="Brak elementów w tym widoku" detail={view === "unprocessed" ? "Przechwyć myśl bez klasyfikowania. Decyzję podejmiesz później." : "Możesz wrócić do innej zakładki Inboxu."} />}

    <Modal open={Boolean(item)} closeDisabled={saving} title={intent ? intent === "goal" ? "Utwórz Cel" : intent === "action" ? "Dodaj Działanie" : "Zapisz w Wiedzy" : "Co chcesz z tym zrobić?"} onClose={close}>
      {!intent ? <div className="intent-list"><p className="modal-intro">Wybierz rezultat. Nie musisz znać typu danych ani modułu aplikacji.</p><button onClick={() => setIntent("goal")}><Flag /><span><strong>Utwórz Cel</strong><small>Gdy przechwycenie opisuje rezultat, do którego chcesz dojść.</small></span></button><button onClick={() => setIntent("action")}><ListPlus /><span><strong>Dodaj Działanie</strong><small>Gdy to konkretny krok do wykonania.</small></span></button><button onClick={() => setIntent("knowledge")}><Archive /><span><strong>Zapisz w Wiedzy</strong><small>Gdy chcesz zachować materiał, notatkę albo decyzję.</small></span></button><button disabled={Boolean(item && mutation.isBusy(`status:${item.id}`))} aria-busy={Boolean(item && mutation.isBusy(`status:${item.id}`))} onClick={() => item && void mutation.run(`status:${item.id}`, async () => { await changeStatus(item, "snoozed"); close(); })}><AlarmClock /><span><strong>Odłóż do jutra</strong><small>Element wróci do Inboxu później.</small></span></button><button disabled={Boolean(item && mutation.isBusy(`status:${item.id}`))} aria-busy={Boolean(item && mutation.isBusy(`status:${item.id}`))} onClick={() => item && void mutation.run(`status:${item.id}`, async () => { await changeStatus(item, "discarded"); close(); })}><Trash2 /><span><strong>Odrzuć</strong><small>Oryginał pozostanie w historii odzyskiwania.</small></span></button>{item && mutation.error(`status:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`status:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`status:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}</div> : <>
        <button className="back-link" onClick={() => setIntent(undefined)}>← Wróć do decyzji</button>
        <label className="field-label" htmlFor="triage-title">{intent === "goal" ? "Co chcesz osiągnąć?" : intent === "action" ? "Jakie Działanie wykonać?" : "Tytuł"}</label><input id="triage-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required autoFocus />
        {intent === "goal" && <><label className="field-label" htmlFor="triage-outcome">Jaki rezultat chcesz zobaczyć?</label><textarea id="triage-outcome" rows={3} value={form.outcome} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="triage-first">Pierwszy krok <span className="optional-label">opcjonalnie</span></label><input id="triage-first" value={form.firstAction} onChange={(event) => setForm((current) => ({ ...current, firstAction: event.target.value }))} /></>}
        {intent === "action" && <><label className="field-label" htmlFor="triage-context">Powiązanie</label><select id="triage-context" value={form.goalId || (form.areaId ? `area:${form.areaId}` : "")} onChange={(event) => { const value = event.target.value; setForm((current) => ({ ...current, goalId: value.startsWith("area:") ? "" : value, areaId: value.startsWith("area:") ? value.slice(5) : "" })); }}><option value="">Świadomie bez powiązania</option><optgroup label="Cele">{state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</optgroup><optgroup label="Obszary">{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={`area:${area.id}`}>{area.name}</option>)}</optgroup></select><label className="checkbox-row"><input type="checkbox" checked={form.pin} onChange={(event) => setForm((current) => ({ ...current, pin: event.target.checked }))} />Pokaż w Dzisiaj</label></>}
        {intent === "knowledge" && <><label className="field-label" htmlFor="triage-kind">Rodzaj</label><select id="triage-kind" value={form.knowledgeKind} onChange={(event) => setForm((current) => ({ ...current, knowledgeKind: event.target.value as KnowledgeKind }))}><option value="note">Notatka</option><option value="resource">Materiał</option><option value="decision">Decyzja</option><option value="artifact">Rezultat</option><option value="investigation">Poszukiwanie</option></select><label className="field-label" htmlFor="triage-goal">Połącz z Celem <span className="optional-label">opcjonalnie</span></label><select id="triage-goal" value={form.goalId} onChange={(event) => setForm((current) => ({ ...current, goalId: event.target.value }))}><option value="">Bez powiązania</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></>}
        {intent !== "goal" && <><label className="field-label" htmlFor="triage-detail">Treść / kontekst</label><textarea id="triage-detail" rows={4} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /></>}
        {error && <p className="auth-message error" role="alert">{error}</p>}<div className="modal-actions"><Button onClick={close}>Anuluj</Button><Button variant="primary" loading={saving} disabled={!form.title.trim() || (intent === "goal" && !form.outcome.trim())} onClick={() => void finish()}><Check />Zapisz</Button></div>
      </>}
    </Modal>
  </AppShell>;
}
