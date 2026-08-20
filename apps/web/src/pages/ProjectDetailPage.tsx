import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, FileText, Flag, FolderKanban, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import type { KnowledgeKind } from "../domain/types";
import { goalStatusLabels, knowledgeKindLabels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { compactTabsVariants, entityCardVariants } from "../components/ui-variants";

type ProjectView = "overview" | "goals" | "actions" | "knowledge";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { state, createGoal, createAction, createKnowledge, linkKnowledge, updateArea, setAreaVisibility } = useStore();
  const project = state.areas.find((item) => item.id === projectId);
  const [view, setView] = useState<ProjectView>("overview");
  const [dialog, setDialog] = useState<"goal" | "action" | "knowledge" | "edit">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [goalForm, setGoalForm] = useState({ title: "", outcome: "", firstAction: "" });
  const [actionForm, setActionForm] = useState({ title: "", detail: "", goalId: "", scheduledFor: "" });
  const [knowledgeForm, setKnowledgeForm] = useState({ kind: "note" as KnowledgeKind, title: "", detail: "" });
  const [projectForm, setProjectForm] = useState({ name: project?.name ?? "", description: project?.description ?? "" });

  const goals = useMemo(() => state.goals.filter((goal) => goal.areaId === projectId && goal.visibility === "active"), [projectId, state.goals]);
  const goalIds = useMemo(() => new Set(goals.map((goal) => goal.id)), [goals]);
  const actions = useMemo(() => state.actions.filter((action) => action.areaId === projectId || Boolean(action.goalId && goalIds.has(action.goalId))), [goalIds, projectId, state.actions]);
  const actionIds = useMemo(() => new Set(actions.map((action) => action.id)), [actions]);
  const recurringIds = useMemo(() => new Set(state.recurringActionTemplates.filter((item) => item.areaId === projectId || Boolean(item.goalId && goalIds.has(item.goalId))).map((item) => item.id)), [goalIds, projectId, state.recurringActionTemplates]);
  const knowledgeIds = useMemo(() => new Set(state.knowledgeLinks.filter((link) => link.areaId === projectId || Boolean(link.goalId && goalIds.has(link.goalId)) || Boolean(link.actionId && actionIds.has(link.actionId)) || Boolean(link.recurringTemplateId && recurringIds.has(link.recurringTemplateId))).map((link) => link.knowledgeItemId)), [actionIds, goalIds, projectId, recurringIds, state.knowledgeLinks]);
  const knowledge = state.knowledge.filter((item) => knowledgeIds.has(item.id) && !item.archivedAt && !item.trashedAt);
  const openActions = actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status));

  if (!project) return <AppShell><EmptyState icon={<FolderKanban />} title="Nie znaleziono Projektu" detail="Ten Projekt nie istnieje albo nie jest już dostępny." action={<Button onClick={() => navigate("/projects")}>Wróć do Projektów</Button>} /></AppShell>;

  const run = async (operation: () => Promise<unknown>, onSuccess: () => void) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try { await operation(); onSuccess(); setDialog(undefined); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmian."); }
    finally { setSaving(false); }
  };

  const submitGoal = (event: FormEvent) => {
    event.preventDefault();
    void run(() => createGoal({ title: goalForm.title, outcome: goalForm.outcome.trim() || goalForm.title, firstActionTitle: goalForm.firstAction || undefined, kind: "custom", areaId: project.id }), () => setGoalForm({ title: "", outcome: "", firstAction: "" }));
  };
  const submitAction = (event: FormEvent) => {
    event.preventDefault();
    void run(() => createAction({ title: actionForm.title, detail: actionForm.detail, goalId: actionForm.goalId || undefined, areaId: project.id, scheduledFor: actionForm.scheduledFor || undefined }), () => setActionForm({ title: "", detail: "", goalId: "", scheduledFor: "" }));
  };
  const submitKnowledge = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => { const id = await createKnowledge(knowledgeForm.kind, knowledgeForm.title, knowledgeForm.detail); await linkKnowledge(id, { areaId: project.id }, "reference"); }, () => setKnowledgeForm({ kind: "note", title: "", detail: "" }));
  };

  const visibleSections = view === "overview" ? ["goals", "actions", "knowledge"] : [view];
  return <AppShell>
    <button className="back-link" onClick={() => navigate("/projects")}><ArrowLeft />Wszystkie Projekty</button>
    <div className="project-detail-head persistent-project-head">
      <div><div className="project-title-row"><span className="project-avatar large violet">{project.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><span className="meta-label">Stały Projekt</span><h1>{project.name}</h1></span></div><p>{project.description || "Wspólny kontekst dla Celów, Zadań i Wiedzy."}</p></div>
      <Button onClick={() => { setProjectForm({ name: project.name, description: project.description ?? "" }); setDialog("edit"); }}><Pencil />Edytuj Projekt</Button>
    </div>
    <div className="project-summary-strip">
      <span><Flag /><strong>{goals.length}</strong><small>Cele</small></span>
      <span><ListChecks /><strong>{openActions.length}</strong><small>Otwarte Zadania</small></span>
      <span><BookOpen /><strong>{knowledge.length}</strong><small>Wiedza</small></span>
    </div>
    <div className={`project-tabs ${compactTabsVariants()}`} role="tablist" aria-label="Zawartość Projektu">
      {(["overview", "goals", "actions", "knowledge"] as const).map((value) => <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)}>{value === "overview" ? "Przegląd" : value === "goals" ? "Cele" : value === "actions" ? "Zadania" : "Wiedza"}</button>)}
    </div>

    <div className="project-sections">
      {visibleSections.includes("goals") ? <section><div className="section-heading"><div><h2>Cele</h2><span>Proste rezultaty do wykonania w tym Projekcie</span></div><Button onClick={() => setDialog("goal")}><Plus />Dodaj Cel</Button></div>
        {goals.length ? <div className="project-entity-list">{goals.map((goal) => <Panel className={`${entityCardVariants({ density: "compact" })} entity-card`} key={goal.id}><Flag /><span><strong className="line-clamp-2">{goal.title}</strong><small className="line-clamp-2">{goal.outcome}</small></span><Badge>{goalStatusLabels[goal.status]}</Badge><Link className="button button-ghost entity-card-open" to={routeForEntity({ type: "goal", id: goal.id })} aria-label={`Otwórz Cel: ${goal.title}`}><ArrowRight /></Link></Panel>)}</div> : <EmptyState icon={<Flag />} title="Brak Celów" detail="Dodaj pierwszy, konkretny rezultat w ramach tego Projektu." action={<Button onClick={() => setDialog("goal")}><Plus />Dodaj Cel</Button>} />}
      </section> : null}

      {visibleSections.includes("actions") ? <section><div className="section-heading"><div><h2>Zadania</h2><span>Konkretne kroki — z Celu albo bezpośrednio z Projektu</span></div><Button onClick={() => setDialog("action")}><Plus />Dodaj Zadanie</Button></div>
        {actions.length ? <div className="project-entity-list">{actions.map((action) => <Panel className="entity-card" key={action.id}>{action.status === "completed" ? <CheckCircle2 /> : <Circle />}<span><strong className="line-clamp-2">{action.title}</strong><small className="line-clamp-2">{action.goalId ? goals.find((goal) => goal.id === action.goalId)?.title : "Zadanie Projektu"}{action.scheduledFor ? ` · ${action.scheduledFor}` : ""}</small></span><Badge tone={action.status === "blocked" ? "danger" : "neutral"}>{action.status === "ready" ? "Do zrobienia" : action.status === "in_progress" ? "W toku" : action.status === "completed" ? "Gotowe" : action.status}</Badge><Link className="button button-ghost entity-card-open" to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })} aria-label={`Otwórz Zadanie: ${action.title}`}><ArrowRight /></Link></Panel>)}</div> : <EmptyState icon={<ListChecks />} title="Brak Zadań" detail="Dodaj pojedynczy krok lub utwórz go wewnątrz Celu." action={<Button onClick={() => setDialog("action")}><Plus />Dodaj Zadanie</Button>} />}
      </section> : null}

      {visibleSections.includes("knowledge") ? <section><div className="section-heading"><div><h2>Wiedza</h2><span>Notatki, materiały i decyzje zachowane przy Projekcie</span></div><Button onClick={() => setDialog("knowledge")}><Plus />Dodaj Wiedzę</Button></div>
        {knowledge.length ? <div className="project-entity-list">{knowledge.map((item) => <Panel className="entity-card" key={item.id}><FileText /><span><strong className="line-clamp-2">{item.title}</strong><small className="line-clamp-2">{item.detail || knowledgeKindLabels[item.type]}</small></span><Badge>{knowledgeKindLabels[item.type]}</Badge><Link className="button button-ghost entity-card-open" to={routeForEntity({ type: "knowledge", id: item.id })} aria-label={`Otwórz Wiedzę: ${item.title}`}><ArrowRight /></Link></Panel>)}</div> : <EmptyState icon={<BookOpen />} title="Brak Wiedzy" detail="Zapisz materiał, decyzję albo notatkę, która ma zostać w tym Projekcie." action={<Button onClick={() => setDialog("knowledge")}><Plus />Dodaj Wiedzę</Button>} />}
      </section> : null}
    </div>

    <Modal open={dialog === "goal"} title="Nowy Cel w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitGoal}><p className="modal-intro">Cel jest lekkim, konkretnym rezultatem. Szczegóły możesz dopracować później.</p><label className="field-label" htmlFor="project-goal-title">Co chcesz osiągnąć?</label><input id="project-goal-title" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="project-goal-outcome">Po czym poznasz, że jest gotowe? <span className="optional-label">opcjonalnie</span></label><textarea id="project-goal-outcome" rows={2} value={goalForm.outcome} onChange={(event) => setGoalForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="project-goal-action">Pierwsze Zadanie <span className="optional-label">opcjonalnie</span></label><input id="project-goal-action" value={goalForm.firstAction} onChange={(event) => setGoalForm((current) => ({ ...current, firstAction: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!goalForm.title.trim()}>Dodaj Cel</Button></div></form></Modal>
    <Modal open={dialog === "action"} title="Nowe Zadanie w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitAction}><label className="field-label" htmlFor="project-action-title">Nazwa Zadania</label><input id="project-action-title" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="project-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="project-action-detail" rows={2} value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /><div className="form-grid"><div><label className="field-label" htmlFor="project-action-goal">Cel <span className="optional-label">opcjonalnie</span></label><select id="project-action-goal" value={actionForm.goalId} onChange={(event) => setActionForm((current) => ({ ...current, goalId: event.target.value }))}><option value="">Bez Celu</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></div><div><label className="field-label" htmlFor="project-action-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="project-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></div></div>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!actionForm.title.trim()}>Dodaj Zadanie</Button></div></form></Modal>
    <Modal open={dialog === "knowledge"} title="Nowa Wiedza w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitKnowledge}><label className="field-label" htmlFor="project-knowledge-kind">Rodzaj</label><select id="project-knowledge-kind" value={knowledgeForm.kind} onChange={(event) => setKnowledgeForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>{Object.entries(knowledgeKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="field-label" htmlFor="project-knowledge-title">Tytuł</label><input id="project-knowledge-title" value={knowledgeForm.title} onChange={(event) => setKnowledgeForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="project-knowledge-detail">Treść</label><textarea id="project-knowledge-detail" rows={5} value={knowledgeForm.detail} onChange={(event) => setKnowledgeForm((current) => ({ ...current, detail: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!knowledgeForm.title.trim()}>Zapisz Wiedzę</Button></div></form></Modal>
    <Modal open={dialog === "edit"} title="Edytuj Projekt" onClose={() => setDialog(undefined)}><form onSubmit={(event) => { event.preventDefault(); void run(() => updateArea(project.id, projectForm), () => undefined); }}><label className="field-label" htmlFor="edit-project-name">Nazwa</label><input id="edit-project-name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="edit-project-description">Kontekst</label><textarea id="edit-project-description" rows={3} value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="project-danger-actions"><Button type="button" variant="ghost" onClick={() => void setAreaVisibility(project.id, "archived").then(() => navigate("/projects"))}><Archive />Archiwizuj</Button><Button type="button" variant="ghost" onClick={() => void setAreaVisibility(project.id, "trashed").then(() => navigate("/projects"))}><Trash2 />Do Kosza</Button></div><div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!projectForm.name.trim()}>Zapisz Projekt</Button></div></form></Modal>
  </AppShell>;
}
