import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowLeft, ArrowRight, BookOpen, FileText, Flag, FolderKanban, ListChecks, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import type { KnowledgeKind } from "../domain/types";
import { goalStatusLabels, knowledgeKindLabels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { compactTabsVariants, entityCardVariants } from "../components/ui-variants";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { useActionFeedback } from "../components/action-feedback-context";

type ProjectView = "overview" | "goals" | "actions" | "knowledge";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { state, createGoal, createAction, createKnowledge, updateArea, setAreaVisibility, updateAction, setActionStatus, setNextAction } = useStore();
  const mutation = useKeyedMutation();
  const { notifyUndo } = useActionFeedback();
  const project = state.areas.find((item) => item.id === projectId);
  const [view, setView] = useState<ProjectView>("overview");
  const [dialog, setDialog] = useState<"goal" | "action" | "knowledge" | "edit">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [goalForm, setGoalForm] = useState({ title: "", outcome: "", firstAction: "" });
  const [actionForm, setActionForm] = useState({ title: "", detail: "", goalId: "", scheduledFor: "" });
  const [knowledgeForm, setKnowledgeForm] = useState({ kind: "note" as KnowledgeKind, title: "", detail: "" });
  const [projectForm, setProjectForm] = useState({ name: project?.name ?? "", description: project?.description ?? "" });
  const [actionMenuId, setActionMenuId] = useState<string>();

  const goals = useMemo(() => state.goals.filter((goal) => goal.areaId === projectId && goal.visibility === "active"), [projectId, state.goals]);
  const goalIds = useMemo(() => new Set(goals.map((goal) => goal.id)), [goals]);
  const actions = useMemo(() => state.actions.filter((action) => action.areaId === projectId || Boolean(action.goalId && goalIds.has(action.goalId))), [goalIds, projectId, state.actions]);
  const actionIds = useMemo(() => new Set(actions.map((action) => action.id)), [actions]);
  const recurringIds = useMemo(() => new Set(state.recurringActionTemplates.filter((item) => item.areaId === projectId || Boolean(item.goalId && goalIds.has(item.goalId))).map((item) => item.id)), [goalIds, projectId, state.recurringActionTemplates]);
  const knowledgeIds = useMemo(() => new Set(state.knowledgeLinks.filter((link) => link.areaId === projectId || Boolean(link.goalId && goalIds.has(link.goalId)) || Boolean(link.actionId && actionIds.has(link.actionId)) || Boolean(link.recurringTemplateId && recurringIds.has(link.recurringTemplateId))).map((link) => link.knowledgeItemId)), [actionIds, goalIds, projectId, recurringIds, state.knowledgeLinks]);
  const knowledge = state.knowledge.filter((item) => knowledgeIds.has(item.id) && !item.archivedAt && !item.trashedAt);
  const openActions = actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status));
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const nextAction = openActions.find((action) => action.isNext) ?? openActions[0];
  const insights = knowledge.filter((item) => item.type === "artifact" || item.type === "decision");
  const activeGoalsLabel = activeGoals.length === 1 ? "1 aktywny" : `${activeGoals.length} aktywne`;
  const insightsLabel = insights.length === 1 ? "1 wynik lub wniosek" : `${insights.length} wyniki / wnioski`;

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
    void run(async () => { await createKnowledge({ kind: knowledgeForm.kind, title: knowledgeForm.title, detail: knowledgeForm.detail, relations: [{ meaning: "reference", target: { areaId: project.id } }] }); }, () => setKnowledgeForm({ kind: "note", title: "", detail: "" }));
  };
  const completeAction = (actionId: string) => mutation.run(`project-action:${actionId}`, async () => { const previous = state.actions.find((action) => action.id === actionId); await setActionStatus(actionId, "completed"); if (previous) notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(actionId, previous.status, previous.blocker) }); });
  const togglePin = (action: typeof actions[number]) => mutation.run(`project-action:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !action.pinnedToToday }); });

  const visibleSections = view === "overview" ? ["goals", "actions", "knowledge"] : [view];
  return <AppShell>
    <button className="back-link" onClick={() => navigate("/projects")}><ArrowLeft />Wszystkie Projekty</button>
    <div className="project-detail-head persistent-project-head">
      <div><div className="project-title-row"><span className="project-avatar large violet">{project.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><span className="meta-label">Stały Projekt</span><h1>{project.name}</h1></span></div><p>{project.description || "Wspólny kontekst dla Celów, Działań i Wiedzy."}</p></div>
      <Button onClick={() => { setProjectForm({ name: project.name, description: project.description ?? "" }); setDialog("edit"); }}><Pencil />Edytuj Projekt</Button>
    </div>
    <div className="project-summary-strip">
      <span><Flag /><strong>{goals.length}</strong><small>Cele</small></span>
      <span><ListChecks /><strong>{openActions.length}</strong><small>Otwarte Działania</small></span>
      <span><BookOpen /><strong>{knowledge.length}</strong><small>Wiedza</small></span>
    </div>
    <div className={`project-tabs ${compactTabsVariants()}`} role="tablist" aria-label="Zawartość Projektu">
      {(["overview", "goals", "actions", "knowledge"] as const).map((value) => <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)}>{value === "overview" ? "Przegląd" : value === "goals" ? "Cele" : value === "actions" ? "Działania" : "Wiedza"}</button>)}
    </div>

    {view === "overview" ? <section className="project-flow" aria-labelledby="project-flow-title"><div className="project-flow-heading"><div><span className="eyebrow">Pętla pracy</span><h2 id="project-flow-title">Od kierunku do wiedzy</h2></div><p>Każdy krok zostawia kontekst, który można wykorzystać ponownie.</p></div><div className="project-flow-steps"><div><span>1</span><small>Projekt</small><strong>{project.name}</strong><p>Kierunek i wspólny kontekst</p></div><ArrowRight /><button type="button" onClick={() => setView("goals")}><span>2</span><small>Cele</small><strong>{activeGoals.length ? activeGoalsLabel : "Ustal rezultat"}</strong><p>Po czym poznasz sukces</p></button><ArrowRight /><button type="button" onClick={() => setView("actions")}><span>3</span><small>Działanie</small><strong>{nextAction?.title ?? "Wybierz następny krok"}</strong><p>Co konkretnie robisz teraz</p></button><ArrowRight /><button type="button" onClick={() => setView("knowledge")}><span>4</span><small>Rezultat / wiedza</small><strong>{insights.length ? insightsLabel : "Zapisz rezultat"}</strong><p>Co zostaje na przyszłość</p></button></div></section> : null}

    <div className="project-sections">
      {visibleSections.includes("goals") ? <section><div className="section-heading"><div><h2>Cele</h2><span>Proste rezultaty do wykonania w tym Projekcie</span></div><Button onClick={() => setDialog("goal")}><Plus />Dodaj Cel</Button></div>
        {goals.length ? <div className="project-entity-list">{goals.map((goal) => <Panel className={`${entityCardVariants({ density: "compact" })} entity-card`} key={goal.id}><Flag /><span><strong className="line-clamp-2">{goal.title}</strong><small className="line-clamp-2">{goal.outcome}</small></span><Badge>{goalStatusLabels[goal.status]}</Badge><Link className="button button-ghost entity-card-open" to={routeForEntity({ type: "goal", id: goal.id })} aria-label={`Otwórz Cel: ${goal.title}`}><ArrowRight /></Link></Panel>)}</div> : <EmptyState icon={<Flag />} title="Brak Celów" detail="Dodaj pierwszy, konkretny rezultat w ramach tego Projektu." action={<Button onClick={() => setDialog("goal")}><Plus />Dodaj Cel</Button>} />}
      </section> : null}

      {visibleSections.includes("actions") ? <section><div className="section-heading"><div><h2>Działania</h2><span>Konkretne kroki — z Celu albo bezpośrednio z Projektu</span></div><Button onClick={() => setDialog("action")}><Plus />Dodaj Działanie</Button></div>
        {actions.length ? <div className="project-action-list">{actions.map((action) => <div className={`project-action-row ${action.status}`} key={action.id} data-action-id={action.id} tabIndex={-1}>
          <ActionPrimaryControls action={action} busy={mutation.isBusy(`project-action:${action.id}`)} onToggleComplete={() => void (action.status === "completed" ? mutation.run(`project-action:${action.id}`, () => setActionStatus(action.id, "ready")) : completeAction(action.id))} onMore={() => setActionMenuId(action.id)} />
          <div className="action-copy"><div className="action-title-row"><Link className="project-action-title" to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })} aria-label={`Otwórz Działanie: ${action.title}`}><strong>{action.title}</strong></Link>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><small>{action.goalId ? goals.find((goal) => goal.id === action.goalId)?.title : "Działanie Projektu"}{action.scheduledFor ? ` · ${action.scheduledFor}` : ""}</small>{action.status === "blocked" ? <Badge tone="danger">Zablokowane</Badge> : null}</div>
        </div>)}</div> : <EmptyState icon={<ListChecks />} title="Brak Działań" detail="Dodaj pojedynczy krok lub utwórz go wewnątrz Celu." action={<Button onClick={() => setDialog("action")}><Plus />Dodaj Działanie</Button>} />}
      </section> : null}

      {visibleSections.includes("knowledge") ? <section><div className="section-heading"><div><h2>Wiedza</h2><span>Notatki, materiały i decyzje zachowane przy Projekcie</span></div><Button onClick={() => setDialog("knowledge")}><Plus />Dodaj Wiedzę</Button></div>
        {knowledge.length ? <div className="project-entity-list">{knowledge.map((item) => <Panel className="entity-card" key={item.id}><FileText /><span><strong className="line-clamp-2">{item.title}</strong><small className="line-clamp-2">{item.detail || knowledgeKindLabels[item.type]}</small></span><Badge>{knowledgeKindLabels[item.type]}</Badge><Link className="button button-ghost entity-card-open" to={routeForEntity({ type: "knowledge", id: item.id })} aria-label={`Otwórz Wiedzę: ${item.title}`}><ArrowRight /></Link></Panel>)}</div> : <EmptyState icon={<BookOpen />} title="Brak Wiedzy" detail="Zapisz materiał, decyzję albo notatkę, która ma zostać w tym Projekcie." action={<Button onClick={() => setDialog("knowledge")}><Plus />Dodaj Wiedzę</Button>} />}
      </section> : null}
    </div>

    <Modal open={dialog === "goal"} title="Nowy Cel w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitGoal}><p className="modal-intro">Cel jest lekkim, konkretnym rezultatem. Szczegóły możesz dopracować później.</p><label className="field-label" htmlFor="project-goal-title">Co chcesz osiągnąć?</label><input id="project-goal-title" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="project-goal-outcome">Po czym poznasz, że jest gotowe? <span className="optional-label">opcjonalnie</span></label><textarea id="project-goal-outcome" rows={2} value={goalForm.outcome} onChange={(event) => setGoalForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="project-goal-action">Pierwsze Działanie <span className="optional-label">opcjonalnie</span></label><input id="project-goal-action" value={goalForm.firstAction} onChange={(event) => setGoalForm((current) => ({ ...current, firstAction: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!goalForm.title.trim()}>Dodaj Cel</Button></div></form></Modal>
    <Modal open={dialog === "action"} title="Nowe Działanie w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitAction}><label className="field-label" htmlFor="project-action-title">Nazwa Działania</label><input id="project-action-title" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="project-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="project-action-detail" rows={2} value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /><div className="form-grid"><div><label className="field-label" htmlFor="project-action-goal">Cel <span className="optional-label">opcjonalnie</span></label><select id="project-action-goal" value={actionForm.goalId} onChange={(event) => setActionForm((current) => ({ ...current, goalId: event.target.value }))}><option value="">Bez Celu</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></div><div><label className="field-label" htmlFor="project-action-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="project-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></div></div>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!actionForm.title.trim()}>Dodaj Działanie</Button></div></form></Modal>
    <Modal open={dialog === "knowledge"} title="Nowa Wiedza w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitKnowledge}><label className="field-label" htmlFor="project-knowledge-kind">Rodzaj</label><select id="project-knowledge-kind" value={knowledgeForm.kind} onChange={(event) => setKnowledgeForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>{Object.entries(knowledgeKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="field-label" htmlFor="project-knowledge-title">Tytuł</label><input id="project-knowledge-title" value={knowledgeForm.title} onChange={(event) => setKnowledgeForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="project-knowledge-detail">Treść</label><textarea id="project-knowledge-detail" rows={5} value={knowledgeForm.detail} onChange={(event) => setKnowledgeForm((current) => ({ ...current, detail: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!knowledgeForm.title.trim()}>Zapisz Wiedzę</Button></div></form></Modal>
    <Modal open={Boolean(actionMenuId)} title="Działanie — więcej opcji" onClose={() => setActionMenuId(undefined)}>{(() => { const action = actions.find((candidate) => candidate.id === actionMenuId); if (!action) return null; const key = `project-action:${action.id}`; return <div className="mobile-action-sheet"><Link className="button button-secondary" to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })} onClick={() => setActionMenuId(undefined)}>Otwórz Działanie</Link>{action.goalId && !action.isNext && ["ready", "in_progress"].includes(action.status) ? <Button loading={mutation.isBusy(key)} onClick={() => void mutation.run(key, async () => { await setNextAction(action.goalId!, action.id); setActionMenuId(undefined); })}>Ustaw jako następne</Button> : null}<Button loading={mutation.isBusy(key)} onClick={() => void togglePin(action).then(() => setActionMenuId(undefined))}>{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button>{action.status === "blocked" ? <Button disabled={mutation.isBusy(key)} onClick={() => void mutation.run(key, async () => { await setActionStatus(action.id, "ready"); setActionMenuId(undefined); })}><RotateCcw />Odblokuj</Button> : null}{!["completed", "cancelled"].includes(action.status) ? <Button variant="danger" loading={mutation.isBusy(key)} onClick={() => void mutation.run(key, async () => { await setActionStatus(action.id, "cancelled"); setActionMenuId(undefined); })}>Anuluj Działanie</Button> : null}</div>; })()}</Modal>
    <Modal open={dialog === "edit"} title="Edytuj Projekt" onClose={() => setDialog(undefined)}><form onSubmit={(event) => { event.preventDefault(); void run(() => updateArea(project.id, projectForm), () => undefined); }}><label className="field-label" htmlFor="edit-project-name">Nazwa</label><input id="edit-project-name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="edit-project-description">Kontekst</label><textarea id="edit-project-description" rows={3} value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="project-danger-actions"><Button type="button" variant="ghost" onClick={() => void setAreaVisibility(project.id, "archived").then(() => navigate("/projects"))}><Archive />Archiwizuj</Button><Button type="button" variant="ghost" onClick={() => void setAreaVisibility(project.id, "trashed").then(() => navigate("/projects"))}><Trash2 />Do Kosza</Button></div><div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!projectForm.name.trim()}>Zapisz Projekt</Button></div></form></Modal>
  </AppShell>;
}
