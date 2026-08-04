import { useState, type FormEvent } from "react";
import { Archive, ArrowRight, FolderKanban, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { DraftStatus } from "../components/DraftStatus";
import { Badge, Button, Panel, StatusDot } from "../components/ui";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { useDraftCloseGuard } from "../components/DraftCloseGuard";
import { AlertDialog } from "../components/AlertDialog";
import { useActionFeedback } from "../components/action-feedback-context";
import type { Project } from "../domain/types";

const emptyProjectForm = {
  title: "",
  outcome: "",
  technology: "",
  firstWorkItemTitle: "",
  firstWorkItemDescription: "",
  effortBudgetMinutes: "",
  wipOverrideReason: ""
};

export function ProjectsPage() {
  const { state, createProject, setVisibility } = useStore();
  const { notifyUndo } = useActionFeedback();
  const [view, setView] = useState<"active" | "archived" | "trashed">("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [trashProject, setTrashProject] = useState<Project>();
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState("");
  const draft = usePersistentDraft("project", emptyProjectForm);
  const form = draft.value;
  const setForm = draft.setValue;
  const closeGuard = useDraftCloseGuard({ dirty: draft.dirty, status: draft.status, formName: "Formularz nowego Projectu", discard: draft.discard, onClose: () => setModalOpen(false) });
  const activeCommitments = state.projects.filter((project) => project.commitmentStatus === "active").length;
  const atWipLimit = activeCommitments >= 3;
  const visibleProjects = state.projects.filter((project) => view === "active" ? !project.archivedAt && !project.trashedAt : view === "archived" ? Boolean(project.archivedAt) && !project.trashedAt : Boolean(project.trashedAt));
  const confirmTrash = async () => {
    if (!trashProject || trashLoading) return;
    setTrashLoading(true);
    setTrashError("");
    try {
      const previous = trashProject.archivedAt ? "archived" : "active";
      await setVisibility("project", trashProject.id, "trashed");
      notifyUndo({ message: `Project „${trashProject.name}” przeniesiono do Trash.`, undo: () => setVisibility("project", trashProject.id, previous) });
      setTrashProject(undefined);
    } catch (caught) {
      setTrashError(caught instanceof Error ? caught.message : "Nie udało się przenieść Projectu do Trash.");
    } finally {
      setTrashLoading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createProject({
        title: form.title,
        outcome: form.outcome,
        technology: form.technology,
        firstWorkItemTitle: form.firstWorkItemTitle,
        firstWorkItemDescription: form.firstWorkItemDescription,
        effortBudgetMinutes: form.effortBudgetMinutes ? Number(form.effortBudgetMinutes) : undefined,
        wipOverrideReason: form.wipOverrideReason || undefined
      });
      setModalOpen(false);
      draft.clear();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się utworzyć projektu.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppShell>
      <PageHeading title="Projekty" eyebrow={`${activeCommitments} aktywne commitments • limit WIP 3`} action={<Button variant="primary" onClick={() => setModalOpen(true)}><Plus />Nowy projekt</Button>} />
      <div className="knowledge-views" role="group" aria-label="Widoczność projektów"><Button variant={view === "active" ? "primary" : "ghost"} onClick={() => setView("active")}>Aktywne</Button><Button variant={view === "archived" ? "primary" : "ghost"} onClick={() => setView("archived")}><Archive />Archive</Button><Button variant={view === "trashed" ? "primary" : "ghost"} onClick={() => setView("trashed")}><Trash2 />Trash</Button></div>
      <div className="project-card-grid">
        {visibleProjects.map((project) => (
          <Panel className="project-card" key={project.id}>
            <div className="project-card-head"><span className={`project-avatar ${project.color}`}>{project.initials}</span>{project.primary && <Badge>Primary commitment</Badge>}</div>
            <span className="meta-label">Outcome</span>
            <h2>{project.name}</h2>
            <p>{project.outcome}</p>
            <div className="project-card-meta"><span><StatusDot tone={project.status === "Zagrożony" ? "danger" : project.status === "Gotowy do decyzji" ? "warning" : "success"} />{project.status}</span><span>{project.technology}</span></div>
            <div className="project-next"><span>Następny krok</span><strong>{project.nextStep}</strong></div>
            {view === "active" ? <Link className="button button-secondary" to={`/projects/${project.id}`}>Otwórz workspace <ArrowRight /></Link> : <div className="button-row"><Button onClick={() => void setVisibility("project", project.id, "active")}><RotateCcw />Przywróć</Button>{view === "archived" && <Button variant="ghost" onClick={() => { setTrashError(""); setTrashProject(project); }}>Przenieś do Trash</Button>}</div>}
          </Panel>
        ))}
        {view === "active" && <Panel className="project-card new-project-card"><FolderKanban /><h2>Ukształtuj kolejny rezultat</h2><p>Nowy projekt potrzebuje jednego obserwowalnego outcome przed wejściem do WIP.</p><Button onClick={() => setModalOpen(true)}><Plus />Utwórz projekt</Button></Panel>}
      </div>
      <Modal open={modalOpen} title="Ukształtuj nowy projekt" onClose={closeGuard.requestClose}>
        <form onSubmit={submit}>
          <p className="modal-intro">Projekt od razu otrzyma outcome, pierwszy fizyczny Work Item i aktywny Commitment.</p>
          <label className="field-label" htmlFor="project-title">Nazwa projektu</label>
          <input id="project-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required autoFocus />
          <label className="field-label" htmlFor="project-outcome">Outcome — obserwowalna zmiana</label>
          <textarea id="project-outcome" rows={3} placeholder="Co będzie prawdą, gdy projekt się powiedzie?" value={form.outcome} onChange={(event) => setForm((current) => ({ ...current, outcome: event.target.value }))} required />
          <label className="field-label" htmlFor="project-technology">Technologie</label>
          <input id="project-technology" placeholder="Np. React, TypeScript, Supabase" value={form.technology} onChange={(event) => setForm((current) => ({ ...current, technology: event.target.value }))} />
          <label className="field-label" htmlFor="first-work-item">Pierwszy fizyczny krok</label>
          <input id="first-work-item" value={form.firstWorkItemTitle} onChange={(event) => setForm((current) => ({ ...current, firstWorkItemTitle: event.target.value }))} required />
          <label className="field-label" htmlFor="work-item-detail">Warunek lub krótki opis kroku</label>
          <textarea id="work-item-detail" rows={2} value={form.firstWorkItemDescription} onChange={(event) => setForm((current) => ({ ...current, firstWorkItemDescription: event.target.value }))} />
          <label className="field-label" htmlFor="effort-budget">Effort budget w minutach <span className="optional-label">opcjonalnie</span></label>
          <input id="effort-budget" type="number" min="1" inputMode="numeric" value={form.effortBudgetMinutes} onChange={(event) => setForm((current) => ({ ...current, effortBudgetMinutes: event.target.value }))} />
          {atWipLimit && <>
            <p className="form-warning">Limit trzech aktywnych Commitments jest wykorzystany.</p>
            <label className="field-label" htmlFor="wip-override-reason">Uzasadnienie przekroczenia WIP</label>
            <textarea id="wip-override-reason" rows={2} required value={form.wipOverrideReason} onChange={(event) => setForm((current) => ({ ...current, wipOverrideReason: event.target.value }))} />
          </>}
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <div className="draft-row"><DraftStatus status={draft.status} />{draft.dirty && <Button type="button" variant="ghost" onClick={draft.discard}>Odrzuć wersję roboczą</Button>}</div>
          <div className="modal-actions"><Button type="button" onClick={closeGuard.requestClose}>Anuluj</Button><Button type="submit" variant="primary" loading={loading} disabled={atWipLimit && !form.wipOverrideReason.trim()}><Save />Utwórz projekt</Button></div>
        </form>
      </Modal>
      {closeGuard.dialog}
      <AlertDialog open={Boolean(trashProject)} title="Przenieść Project do Trash?" objectName={trashProject?.name ?? "Project"} consequence="Project zniknie z Archive i trafi do tymczasowego obszaru odzyskiwania." preserved="Outcome, Work Items, checkpointy i historia pozostaną zachowane." recovery="Project można przywrócić z Trash lub natychmiast użyć akcji Cofnij." confirmLabel="Przenieś do Trash" loading={trashLoading} error={trashError} onCancel={() => setTrashProject(undefined)} onConfirm={confirmTrash} />
    </AppShell>
  );
}
