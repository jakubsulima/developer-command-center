import { Archive, BookMarked, FileCode2, FileText, FlaskConical, Link2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import type { KnowledgeItem, KnowledgeKind } from "../domain/types";
import { useActionFeedback } from "../components/action-feedback-context";

const kinds = {
  artifact: { icon: FileCode2, label: "Artifact" },
  decision: { icon: FileText, label: "Decision" },
  resource: { icon: Link2, label: "Resource" },
  note: { icon: BookMarked, label: "Note" },
  investigation: { icon: FlaskConical, label: "Investigation" }
} as const;

type View = "active" | "archived" | "trashed";

export function KnowledgePage() {
  const { state, createKnowledge, setVisibility } = useStore();
  const { notifyUndo } = useActionFeedback();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KnowledgeKind | "all">("all");
  const [view, setView] = useState<View>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ kind: KnowledgeKind; title: string; detail: string; projectId: string; sourceUrl: string }>({ kind: "note", title: "", detail: "", projectId: "", sourceUrl: "" });
  const normalized = query.trim().toLocaleLowerCase("pl");
  const results = state.knowledge.filter((item) => {
    const visible = view === "active" ? !item.archivedAt && !item.trashedAt : view === "archived" ? Boolean(item.archivedAt) && !item.trashedAt : Boolean(item.trashedAt);
    return visible && (kind === "all" || item.type === kind) && (!normalized || `${item.title} ${item.detail}`.toLocaleLowerCase("pl").includes(normalized));
  });
  const create = () => {
    if (!form.title.trim()) return;
    createKnowledge(form.kind, form.title, form.detail, form.projectId || undefined, form.sourceUrl || undefined);
    setForm({ kind: "note", title: "", detail: "", projectId: "", sourceUrl: "" });
    setModalOpen(false);
  };
  const changeVisibility = async (item: KnowledgeItem, visibility: "archived" | "trashed") => {
    const previous = item.trashedAt ? "trashed" : item.archivedAt ? "archived" : "active";
    try {
      await setVisibility("knowledge", item.id, visibility);
      notifyUndo({
        message: visibility === "archived" ? `„${item.title}” przeniesiono do Archive.` : `„${item.title}” przeniesiono do Trash.`,
        undo: () => setVisibility("knowledge", item.id, previous)
      });
    } catch {
      // Store exposes the repository error in the global sync indicator.
    }
  };

  return (
    <AppShell>
      <PageHeading title="Wiedza" eyebrow="Typowane obiekty i relacje zamiast folderów" action={<Button variant="primary" onClick={() => setModalOpen(true)}><Plus />Nowy obiekt</Button>} />
      <div className="knowledge-toolbar">
        <div className="knowledge-search"><Search /><input type="search" aria-label="Szukaj w wiedzy" placeholder="Szukaj po tytule, treści i powiązaniach…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <label className="sr-only" htmlFor="knowledge-kind">Filtr typu</label>
        <select id="knowledge-kind" value={kind} onChange={(event) => setKind(event.target.value as KnowledgeKind | "all")}><option value="all">Wszystkie typy</option>{Object.entries(kinds).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select>
      </div>
      <div className="knowledge-views" role="group" aria-label="Widoczność obiektów">
        <Button variant={view === "active" ? "primary" : "ghost"} onClick={() => setView("active")}>Aktywne</Button>
        <Button variant={view === "archived" ? "primary" : "ghost"} onClick={() => setView("archived")}><Archive />Archive</Button>
        <Button variant={view === "trashed" ? "primary" : "ghost"} onClick={() => setView("trashed")}><Trash2 />Trash</Button>
      </div>
      {results.length ? (
        <div className="knowledge-list">
          {results.map((item) => {
            const { icon: Icon, label } = kinds[item.type];
            return (
              <Panel key={item.id}>
                <Icon />
                <span><strong>{item.title}</strong><small>{item.detail}</small>{item.sourceInboxItemId && <small>Źródło: Inbox • zachowano oryginał</small>}{item.status && <small>Status: {item.status}</small>}</span>
                <Badge tone="neutral">{label}</Badge>
                <div className="knowledge-actions">
                  {view === "active" && <><Button variant="ghost" onClick={() => void changeVisibility(item, "archived")}>Archiwizuj</Button><Button variant="ghost" onClick={() => void changeVisibility(item, "trashed")}>Przenieś do Trash</Button></>}
                  {view === "archived" && <><Button variant="ghost" onClick={() => void setVisibility("knowledge", item.id, "active")}><RotateCcw />Przywróć</Button><Button variant="ghost" onClick={() => void changeVisibility(item, "trashed")}>Przenieś do Trash</Button></>}
                  {view === "trashed" && <Button variant="ghost" onClick={() => void setVisibility("knowledge", item.id, "active")}><RotateCcw />Przywróć</Button>}
                </div>
              </Panel>
            );
          })}
        </div>
      ) : <EmptyState icon={<BookMarked />} title={normalized ? "Brak pasujących obiektów" : `Brak obiektów: ${view === "active" ? "aktywne" : view === "archived" ? "Archive" : "Trash"}`} detail={normalized ? "Spróbuj krótszego zapytania albo innego słowa." : "Note, Resource, Decision, Artifact i Investigation pojawią się tu po świadomej promocji lub utworzeniu."} />}
      <Modal open={modalOpen} title="Nowy obiekt wiedzy" onClose={() => setModalOpen(false)}>
        <label className="field-label" htmlFor="knowledge-new-kind">Typ obiektu</label>
        <select id="knowledge-new-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>{Object.entries(kinds).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select>
        <label className="field-label" htmlFor="knowledge-title">Tytuł / pytanie</label>
        <input id="knowledge-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        <label className="field-label" htmlFor="knowledge-detail">Treść</label>
        <textarea id="knowledge-detail" rows={5} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
        <label className="field-label" htmlFor="knowledge-project">Powiązany Project</label>
        <select id="knowledge-project" value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))}><option value="">Bez projektu</option>{state.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
        {form.kind === "resource" && <><label className="field-label" htmlFor="knowledge-url">URL źródła</label><input id="knowledge-url" type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></>}
        <div className="modal-actions"><Button onClick={() => setModalOpen(false)}>Anuluj</Button><Button variant="primary" disabled={!form.title.trim()} onClick={create}>Utwórz obiekt</Button></div>
      </Modal>
    </AppShell>
  );
}
