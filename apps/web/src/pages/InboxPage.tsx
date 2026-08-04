import { useEffect, useState } from "react";
import { AlarmClock, Check, Clock3, File, Inbox, Link2, Mic, Sparkles, TextCursorInput, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { useActionFeedback } from "../components/action-feedback-context";
import type { InboxItem, InboxKind, KnowledgeKind } from "../domain/types";

const modes: Array<{ id: InboxKind; label: string; icon: typeof TextCursorInput }> = [
  { id: "text", label: "Tekst", icon: TextCursorInput },
  { id: "voice", label: "Głos", icon: Mic },
  { id: "link", label: "Link", icon: Link2 },
  { id: "file", label: "Plik", icon: File }
];
const capturedAtFormatter = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export function InboxPage() {
  const { state, capture, resolveInbox, triageInbox, setInboxStatus, setAIProposal } = useStore();
  const { notifyUndo } = useActionFeedback();
  const [searchParams] = useSearchParams();
  const [kind, setKind] = useState<InboxKind>("text");
  const [value, setValue] = useState("");
  const [triageItem, setTriageItem] = useState<InboxItem>();
  const [triage, setTriage] = useState<{ target: KnowledgeKind; title: string; detail: string; projectId: string }>({ target: "note", title: "", detail: "", projectId: "" });

  useEffect(() => {
    if (searchParams.get("capture") === "true") document.getElementById("capture-input")?.focus();
  }, [searchParams]);

  const submit = () => {
    if (!value.trim()) return;
    capture(value, kind);
    setValue("");
  };

  const pending = state.inbox.filter((item) => item.status === "unprocessed");
  const proposalTarget = state.projects.find((project) => project.primary) ?? state.projects[0];
  const openTriage = (item: InboxItem) => {
    setTriageItem(item);
    setTriage({ target: item.kind === "link" ? "resource" : "note", title: item.content.slice(0, 100), detail: item.kind === "link" ? `Źródło: ${item.content}` : item.content, projectId: proposalTarget?.id ?? "" });
  };
  const submitTriage = () => {
    if (!triageItem || !triage.title.trim()) return;
    triageInbox(triageItem.id, triage.target, triage.title, triage.detail, triage.projectId || undefined);
    setTriageItem(undefined);
  };
  const changeInboxStatus = async (item: InboxItem, status: "snoozed" | "discarded", snoozedUntil?: string) => {
    try {
      await setInboxStatus(item.id, status, snoozedUntil);
      notifyUndo({
        message: status === "snoozed" ? "Inbox Item odłożony do jutra." : "Inbox Item odrzucony.",
        undo: () => setInboxStatus(item.id, item.status, item.snoozedUntil)
      });
    } catch {
      // Store exposes the repository error in the global sync indicator.
    }
  };

  return (
    <AppShell>
      <PageHeading title="Inbox" eyebrow={`${pending.length} elementów czeka na triage`} />
      <Panel className="capture-page-card">
        <h2>Szybkie przechwycenie</h2>
        <label className="sr-only" htmlFor="capture-input">Treść przechwycenia</label>
        <textarea id="capture-input" rows={4} placeholder="Zapisz myśl, zadanie lub link…" value={value} onChange={(event) => setValue(event.target.value)} />
        <div className="capture-mode-row">
          <div>{modes.map(({ id, label, icon: Icon }) => <button key={id} className={kind === id ? "active" : ""} onClick={() => setKind(id)}><Icon />{label}</button>)}</div>
          <Button variant="primary" onClick={submit} disabled={!value.trim()}>Zapisz</Button>
        </div>
      </Panel>

      <div className="section-heading"><h2>Ostatnie przechwycenia</h2><span>Oryginał pozostaje zachowany po triage</span></div>
      {pending.length ? (
        <div className="inbox-list">
          {pending.map((item) => {
            const mode = modes.find((candidate) => candidate.id === item.kind);
            const Icon = mode?.icon ?? Inbox;
            return (
              <Panel className="inbox-item" key={item.id}>
                <span className="inbox-kind"><Icon /></span>
                <div><strong>{item.content}</strong><small><Clock3 />{capturedAtFormatter.format(new Date(item.createdAt))}</small></div>
                <Badge tone="neutral">{mode?.label}</Badge>
                <div className="inbox-actions">
                  <Button variant="primary" onClick={() => openTriage(item)}>Triaguj</Button>
                  <Button variant="ghost" onClick={() => resolveInbox(item.id)}><Check />Oznacz jako przetworzone</Button>
                  <Button variant="ghost" aria-label="Odłóż do jutra" onClick={() => void changeInboxStatus(item, "snoozed", new Date(Date.now() + 86_400_000).toISOString())}><AlarmClock /></Button>
                  <Button variant="ghost" aria-label="Odrzuć Inbox Item" onClick={() => void changeInboxStatus(item, "discarded")}><Trash2 /></Button>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : <EmptyState icon={<Inbox />} title="Inbox jest pusty" detail="Przechwyć pierwszą myśl bez konieczności wybierania projektu lub typu." />}

      {state.aiProposal === "pending" && pending[0] && (
        <Panel className="ai-triage">
          <h2><Sparkles />Propozycja klasyfikacji AI</h2>
          <p><strong>{pending[0].content}</strong></p>
          <p>Proponowane: {proposalTarget ? <>dodaj do projektu <span>{proposalTarget.name}</span> jako Work Item</> : "pozostaw w Inboxie do ręcznego triage"}. Źródło: Inbox. Ryzyko: niskie.</p>
          <div className="button-row"><Button variant="primary" onClick={() => void setAIProposal("approved")}><Check />Zatwierdź</Button><Button onClick={() => void setAIProposal("rejected")}>Odrzuć</Button></div>
        </Panel>
      )}
      <Modal open={Boolean(triageItem)} title="Triage Inbox Itemu" onClose={() => setTriageItem(undefined)}>
        <p className="modal-lead">Oryginalna treść pozostanie w kopercie Inboxu wraz z pochodzeniem.</p>
        <label className="field-label" htmlFor="triage-target">Obiekt docelowy</label>
        <select id="triage-target" value={triage.target} onChange={(event) => setTriage((current) => ({ ...current, target: event.target.value as KnowledgeKind }))}>
          <option value="note">Note</option><option value="resource">Resource</option><option value="decision">Decision</option><option value="artifact">Artifact</option><option value="investigation">Investigation</option>
        </select>
        <label className="field-label" htmlFor="triage-title">Tytuł obiektu</label>
        <input id="triage-title" value={triage.title} onChange={(event) => setTriage((current) => ({ ...current, title: event.target.value }))} />
        <label className="field-label" htmlFor="triage-detail">Treść / kontekst</label>
        <textarea id="triage-detail" rows={4} value={triage.detail} onChange={(event) => setTriage((current) => ({ ...current, detail: event.target.value }))} />
        <label className="field-label" htmlFor="triage-project">Powiązany Project (opcjonalnie)</label>
        <select id="triage-project" value={triage.projectId} onChange={(event) => setTriage((current) => ({ ...current, projectId: event.target.value }))}><option value="">Bez projektu</option>{state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        <div className="modal-actions"><Button onClick={() => setTriageItem(undefined)}>Anuluj</Button><Button variant="primary" disabled={!triage.title.trim()} onClick={submitTriage}>Utwórz i rozwiąż</Button></div>
      </Modal>
    </AppShell>
  );
}
