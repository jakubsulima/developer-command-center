import { Archive, ArrowLeft, CheckCircle2, Circle, Clock3, FileCheck2, GitBranch, ListChecks, Pause, Play, ShieldCheck, Star, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { AlertDialog } from "../components/AlertDialog";
import { useActionFeedback } from "../components/action-feedback-context";

const checkpointFormatter = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ProjectDetailPage() {
  const { state, startFocus, setCommitmentStatus, setPrimaryCommitment, setWorkItemStatus, setVisibility } = useStore();
  const { notifyUndo } = useActionFeedback();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return <AppShell><EmptyState icon={<ListChecks />} title="Nie znaleziono projektu" detail="Ten projekt nie istnieje albo został zarchiwizowany." action={<Button onClick={() => navigate("/projects")}>Wróć do projektów</Button>} /></AppShell>;
  const checkpoints = state.checkpoints.filter((item) => item.projectId === project.id);
  const artifacts = state.knowledge.filter((item) => item.type === "artifact");
  const budgetProgress = project.effortBudgetMinutes ? Math.min(100, Math.round(project.usedMinutes / project.effortBudgetMinutes * 100)) : undefined;
  const nextWorkItem = project.workItems.find((item) => !item.completed);
  const commitmentLabel = project.commitmentStatus === "paused"
    ? "Wstrzymany commitment"
    : project.commitmentStatus === "released"
      ? "Zwolniony commitment"
      : project.commitmentStatus === "fulfilled"
        ? "Spełniony commitment"
        : project.primary ? "Primary commitment" : "Aktywny commitment";

  const focusThisProject = () => {
    if (!nextWorkItem) return;
    void startFocus(nextWorkItem.id);
    navigate("/focus");
  };
  const archiveProject = async () => {
    try {
      await setVisibility("project", project.id, "archived");
      notifyUndo({ message: `Project „${project.name}” przeniesiono do Archive.`, undo: () => setVisibility("project", project.id, "active") });
      navigate("/projects");
    } catch {
      // Store exposes the repository error in the global sync indicator.
    }
  };
  const releaseCommitment = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setActionError("");
    try {
      await setCommitmentStatus(project.id, "released");
      setReleaseOpen(false);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Nie udało się zwolnić Commitmentu.");
    } finally {
      setActionLoading(false);
    }
  };
  const trashProject = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setActionError("");
    try {
      await setVisibility("project", project.id, "trashed");
      notifyUndo({ message: `Project „${project.name}” przeniesiono do Trash.`, undo: () => setVisibility("project", project.id, "active") });
      setTrashOpen(false);
      navigate("/projects");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Nie udało się przenieść Projectu do Trash.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AppShell>
      <button className="back-link" onClick={() => navigate("/projects")}><ArrowLeft />Wszystkie projekty</button>
      <div className="project-detail-head">
        <div><div className="project-title-row"><span className={`project-avatar large ${project.color}`}>{project.initials}</span><span><span className="meta-label">Project workspace</span><h1>{project.name}</h1></span></div><p>{project.technology}</p></div>
        <Button variant="primary" disabled={!nextWorkItem} onClick={focusThisProject}><Play />Rozpocznij fokus</Button>
      </div>
      <Panel className="outcome-panel">
        <span className="meta-label">Outcome</span><h2>{project.outcome}</h2>
        <div><Badge tone={project.primary ? "info" : "neutral"}>{commitmentLabel}</Badge><Badge tone={project.status === "Zagrożony" ? "danger" : "success"}>{project.status}</Badge></div>
        <div className="commitment-actions">
          {project.commitmentStatus === "active" && !project.primary && <Button onClick={() => setPrimaryCommitment(project.id)}><Star />Ustaw jako Primary</Button>}
          {project.commitmentStatus === "active"
            ? <Button onClick={() => void setCommitmentStatus(project.id, "paused")}><Pause />Wstrzymaj Commitment</Button>
            : project.commitmentStatus === "paused" && <Button onClick={() => void setCommitmentStatus(project.id, "active")}><Play />Wznów Commitment</Button>}
          {(project.commitmentStatus === "active" || project.commitmentStatus === "paused") && <Button variant="ghost" onClick={() => { setActionError(""); setReleaseOpen(true); }}>Zwolnij Commitment</Button>}
          <Button variant="ghost" onClick={() => void archiveProject()}><Archive />Archiwizuj Project</Button>
          <Button variant="ghost" onClick={() => { setActionError(""); setTrashOpen(true); }}><Trash2 />Przenieś Project do Trash</Button>
        </div>
      </Panel>

      <div className="project-detail-grid">
        <div className="detail-main">
          <Panel>
            <div className="section-heading"><h2>Work items</h2><span>{project.workItems.filter((item) => !item.completed).length} otwarte</span></div>
            <div className="work-item-list">{project.workItems.map((item, index) => {
              const status = item.status ?? (item.completed ? "completed" : "open");
              return <div className={index === 0 ? "current" : ""} key={item.id}>{item.completed ? <CheckCircle2 /> : <Circle />}<span><strong>{item.title}</strong><small>{item.detail}</small></span><select aria-label={`Status: ${item.title}`} value={status} onChange={(event) => setWorkItemStatus(project.id, item.id, event.target.value as "open" | "in_progress" | "blocked" | "completed" | "cancelled", item.blocker)}><option value="open">Otwarty</option><option value="in_progress">W toku</option><option value="blocked">Zablokowany</option><option value="completed">Ukończony</option><option value="cancelled">Anulowany</option></select></div>;
            })}</div>
          </Panel>
          <Panel>
            <div className="section-heading"><h2>Requirements</h2><span>Śledzenie do dowodu</span></div>
            <div className="requirement-list">{project.requirements.map((requirement) => <div key={requirement.id}><span className={`requirement-state ${requirement.status}`}>{requirement.status === "validated" ? <ShieldCheck /> : <ListChecks />}</span><span><strong>{requirement.title}</strong><small>{requirement.status === "validated" ? "Zwalidowane konkretnym dowodem" : requirement.status === "accepted" ? "Zaakceptowane do aktualnego zakresu" : "Proponowane podczas shaping"}</small></span><Badge tone={requirement.status === "validated" ? "success" : requirement.status === "accepted" ? "info" : "neutral"}>{requirement.status}</Badge></div>)}</div>
          </Panel>
        </div>
        <aside className="detail-aside">
          <Panel>
            <h2>Effort budget</h2>
            {budgetProgress !== undefined ? <><div className="budget-value"><strong>{project.usedMinutes}</strong><span>/ {project.effortBudgetMinutes} min</span></div><div className="progress-track"><span style={{ width: `${budgetProgress}%` }} /></div><small>{budgetProgress}% wykorzystanego skupienia</small></> : <p>Ten commitment nie ma limitu inwestowanej pracy.</p>}
          </Panel>
          <Panel>
            <h2>Checkpointy</h2>
            <div className="mini-checkpoints">{checkpoints.length ? checkpoints.map((checkpoint) => <div key={checkpoint.id}><GitBranch /><span><strong>{checkpoint.title}</strong><small><Clock3 />{checkpointFormatter.format(new Date(checkpoint.createdAt))}</small></span></div>) : <p>Jeszcze nie zapisano checkpointu.</p>}</div>
          </Panel>
          <Panel><h2>Artefakty i decyzje</h2>{artifacts.length ? artifacts.slice(0, 2).map((artifact) => <Link className="artifact-row" to="/knowledge" key={artifact.id}><FileCheck2 /><span><strong>{artifact.title}</strong><small>{artifact.detail}</small></span></Link>) : <p>Brak powiązanych artefaktów.</p>}</Panel>
        </aside>
      </div>
      <AlertDialog open={releaseOpen} title="Zwolnić Commitment?" objectName={project.name} consequence="Project przestanie należeć do aktywnego WIP i utraci oznaczenie Primary." preserved="Project, Outcome, Work Items, checkpointy i historia pozostaną bez zmian." recovery="Project pozostanie dostępny i będzie można utworzyć dla niego nowy Commitment." confirmLabel="Zwolnij Commitment" loading={actionLoading} error={actionError} onCancel={() => setReleaseOpen(false)} onConfirm={releaseCommitment} />
      <AlertDialog open={trashOpen} title="Przenieść Project do Trash?" objectName={project.name} consequence="Project zniknie z aktywnych widoków i trafi do tymczasowego obszaru odzyskiwania." preserved="Outcome, Work Items, checkpointy, artefakty i historia pozostaną zachowane." recovery="Project można przywrócić z widoku Trash lub natychmiast użyć akcji Cofnij." confirmLabel="Przenieś do Trash" loading={actionLoading} error={actionError} onCancel={() => setTrashOpen(false)} onConfirm={trashProject} />
    </AppShell>
  );
}
