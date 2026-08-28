import { useEffect, useState, type FormEvent } from "react";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Ban, CalendarDays, Check, Circle, Flag, History, Layers3, Link2, ListTodo, LockKeyhole, MoreHorizontal, Pencil, Plus, RotateCcw, SkipForward, Target, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { AlertDialog } from "../components/AlertDialog";
import { useActionFeedback } from "../components/action-feedback-context";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { Progress } from "../components/ui/progress";
import { Modal } from "../components/Modal";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { goalKindLabels, progressKindLabels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { ActionKnowledgeRelations } from "../components/ActionKnowledgeRelations";
import type { GoalAction } from "../domain/types";
import type { GoalProgressPageItem } from "../data/workspaceRepository";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";

function ActionChecklist({ action, busy, onToggle }: { action: GoalAction; busy: boolean; onToggle: (entryId: string) => void }) {
  const completed = action.checklist.filter((entry) => entry.completed).length;
  const contentId = `action-checklist-${action.id}`;
  const [expanded, setExpanded] = useState(false);
  return <div className="action-checklist">
    <button type="button" className="action-checklist-toggle" aria-expanded={expanded} aria-controls={contentId} onClick={() => setExpanded((current) => !current)}>Checklista {completed}/{action.checklist.length}</button>
    {expanded ? <div id={contentId} className="action-checklist-content">{action.checklist.map((entry) => <label key={entry.id}><input type="checkbox" checked={entry.completed} disabled={busy || ["completed", "cancelled", "skipped"].includes(action.status)} onChange={() => onToggle(entry.id)} />{entry.title}</label>)}</div> : null}
  </div>;
}

export function GoalDetailPage() {
  const { state, createAction, updateAction, setActionStatus, setNextAction, addProgress, updateGoal, setGoalStatus, setGoalVisibility, linkKnowledge, unlinkKnowledge } = useStore();
  const { notifyUndo } = useActionFeedback();
  const actionMutation = useKeyedMutation();
  const { goalId } = useParams();
  const progressPage = useWorkspaceInfinitePage<GoalProgressPageItem>("goal-progress", 25, { goalId });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [actionForm, setActionForm] = useState({ title: "", detail: "", scheduledFor: "" });
  const [progress, setProgress] = useState({ kind: "note" as "note" | "decision" | "result" | "evidence" | "blocker", content: "" });
  const [blockActionId, setBlockActionId] = useState<string>();
  const [blocker, setBlocker] = useState("");
  const [knowledgeId, setKnowledgeId] = useState("");
  const [editAction, setEditAction] = useState<{ id: string; title: string; detail: string; scheduledFor: string; checklist: Array<{ id: string; title: string; completed: boolean }> }>();
  const [pendingGoalStatus, setPendingGoalStatus] = useState<"achieved" | "abandoned">();
  const [statusReason, setStatusReason] = useState("");
  const [goalStatusSaving, setGoalStatusSaving] = useState(false);
  const [goalStatusError, setGoalStatusError] = useState("");
  const [editGoal, setEditGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({ title: "", outcome: "", areaId: "", priority: "normal" as "low" | "normal" | "high", targetDate: "", criteria: "" });
  const [actionMenuId, setActionMenuId] = useState<string>();
  const [resultActionId, setResultActionId] = useState<string>();
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const goal = state.goals.find((item) => item.id === goalId);
  useEffect(() => { const id = searchParams.get("action"); if (id) requestAnimationFrame(() => { const target = document.querySelector<HTMLElement>(`[data-action-id="${CSS.escape(id)}"]`); target?.scrollIntoView?.({ block: "center", behavior: "auto" }); target?.focus(); }); }, [searchParams, state.actions]);
  if (!goal) return <AppShell><EmptyState icon={<Flag />} title="Nie znaleziono Celu" detail="Cel nie istnieje albo nie jest dostępny w tym Workspace." action={<Button onClick={() => navigate("/goals")}>Wróć do Celów</Button>} /></AppShell>;
  const actions = state.actions.filter((item) => item.goalId === goal.id).sort((a, b) => a.position - b.position);
  const criteria = state.goalCriteria.filter((item) => item.goalId === goal.id);
  const updates = mergePagedItems(state.progressEntries.filter((item) => item.goalId === goal.id), progressPage.data?.items ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const links = state.knowledgeLinks.filter((item) => item.goalId === goal.id);
  const linkedKnowledge = links.map((link) => ({ link, item: state.knowledge.find((item) => item.id === link.knowledgeItemId) })).filter((value) => value.item);
  const legacySessions = state.focusSessions.filter((session) => session.projectId === goal.id);
  const nextAction = actions.find((action) => action.isNext && ["ready", "in_progress"].includes(action.status));
  const openActions = actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status)).length;
  const completedCriteria = criteria.filter((item) => item.completed).length;
  const criteriaProgress = criteria.length ? Math.round((completedCriteria / criteria.length) * 100) : 0;
  const projectName = state.areas.find((area) => area.id === goal.areaId)?.name ?? "Bez Projektu";
  const priorityLabel = goal.priority === "high" ? "Wysoka ważność" : goal.priority === "low" ? "Niska ważność" : "Normalna ważność";

  const addAction = async (event: FormEvent) => {
    event.preventDefault();
    await actionMutation.run("goal-create-action", async () => {
      await createAction({ title: actionForm.title, detail: actionForm.detail, goalId: goal.id, areaId: goal.areaId, scheduledFor: actionForm.scheduledFor || undefined });
      setActionForm({ title: "", detail: "", scheduledFor: "" });
    });
  };
  const complete = async (actionId: string) => {
    const previous = state.actions.find((action) => action.id === actionId);
    if (!previous) return;
    await actionMutation.run(`goal-action:${actionId}`, async () => {
      await setActionStatus(actionId, "completed");
      if (!state.knowledgeLinks.some((link) => link.actionId === actionId && link.meaning === "result")) notifyUndo({ message: "Działanie ukończone.", undo: () => setActionStatus(actionId, previous.status, previous.blocker), action: { label: "Dodaj rezultat", onClick: () => setResultActionId(actionId) } });
    });
  };
  const restoreCompletedAction = (action: typeof actions[number]) => actionMutation.run(`goal-action:${action.id}`, async () => {
    await setActionStatus(action.id, "ready");
    notifyUndo({ message: "Działanie przywrócono.", undo: () => setActionStatus(action.id, action.status, action.blocker) });
  });
  const openActionEditor = (action: typeof actions[number]) => { setDialogError(""); setEditAction({ id: action.id, title: action.title, detail: action.detail, scheduledFor: action.scheduledFor ?? "", checklist: structuredClone(action.checklist) }); };
  const runDialog = async (operation: () => Promise<void>, close: () => void) => {
    if (dialogSaving) return;
    setDialogSaving(true); setDialogError("");
    try { await operation(); close(); }
    catch (caught) { setDialogError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmiany."); }
    finally { setDialogSaving(false); }
  };
  const move = async (actionId: string, direction: -1 | 1) => {
    const index = actions.findIndex((action) => action.id === actionId);
    const adjacent = actions[index + direction];
    const current = actions[index];
    if (!current || !adjacent) return;
    await Promise.all([updateAction(current.id, { position: adjacent.position }), updateAction(adjacent.id, { position: current.position })]);
  };
  const changeGoalVisibility = async (visibility: "archived" | "trashed") => {
    if (visibilitySaving) return;
    setVisibilitySaving(true); setVisibilityError("");
    try {
      await setGoalVisibility(goal.id, visibility);
      notifyUndo({ message: visibility === "archived" ? "Cel zarchiwizowano." : "Cel przeniesiono do Kosza.", undo: () => setGoalVisibility(goal.id, "active") });
      setTrashOpen(false);
      navigate(`/goals?status=${visibility}`);
    } catch (caught) {
      setVisibilityError(caught instanceof Error ? caught.message : "Nie udało się zmienić widoczności Celu.");
    } finally {
      setVisibilitySaving(false);
    }
  };
  const changeGoalStatus = async (status: "active" | "paused" | "achieved" | "abandoned", reason?: string) => {
    if (goalStatusSaving) return;
    setGoalStatusSaving(true); setGoalStatusError("");
    try {
      const previous = goal.status;
      await setGoalStatus(goal.id, status, reason);
      notifyUndo({
        message: status === "achieved" ? "Cel oznaczono jako osiągnięty." : status === "abandoned" ? "Cel oznaczono jako porzucony." : status === "paused" ? "Cel wstrzymano." : "Cel wznowiono.",
        undo: () => setGoalStatus(goal.id, previous, previous === "abandoned" ? "Cofnięto późniejszą zmianę stanu." : undefined)
      });
      setPendingGoalStatus(undefined);
    } catch (caught) {
      setGoalStatusError(caught instanceof Error ? caught.message : "Nie udało się zmienić stanu Celu.");
    } finally {
      setGoalStatusSaving(false);
    }
  };

  const renderAction = (action: typeof actions[number]) => <div className={`goal-action ${action.status}`} key={action.id} data-action-id={action.id} tabIndex={-1}>
    <ActionPrimaryControls action={action} busy={actionMutation.isBusy(`goal-action:${action.id}`)} onToggleComplete={() => void (action.status === "completed" ? restoreCompletedAction(action) : complete(action.id))} onMore={() => setActionMenuId(action.id)} />
    <div className="action-copy"><div className="action-title-row"><strong>{action.title}</strong>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><small>{action.detail || (action.scheduledFor ? `Termin: ${action.scheduledFor}` : "Bez terminu")}</small>{action.blocker && <em><LockKeyhole />{action.blocker}</em>}{action.checklist.length ? <ActionChecklist action={action} busy={actionMutation.isBusy(`goal-action:${action.id}`)} onToggle={(entryId) => void actionMutation.run(`goal-action:${action.id}`, () => updateAction(action.id, { checklist: action.checklist.map((candidate) => candidate.id === entryId ? { ...candidate, completed: !candidate.completed } : candidate) }))} /> : null}{actionMutation.error(`goal-action:${action.id}`) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(`goal-action:${action.id}`)} <button type="button" onClick={() => void actionMutation.retry(`goal-action:${action.id}`)?.()}>Spróbuj ponownie</button></p> : null}</div>
    <div className="action-menu">
      <Button variant="ghost" aria-label={`Edytuj: ${action.title}`} onClick={() => openActionEditor(action)}><Pencil /></Button>
      <Button variant="ghost" aria-label={`Przesuń wyżej: ${action.title}`} disabled={action.id === actions[0]?.id} onClick={() => void move(action.id, -1)}><ArrowUp /></Button>
      <Button variant="ghost" aria-label={`Przesuń niżej: ${action.title}`} disabled={action.id === actions.at(-1)?.id} onClick={() => void move(action.id, 1)}><ArrowDown /></Button>
      <Button variant="ghost" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.pinnedToToday; void actionMutation.run(`goal-action:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !previous }); notifyUndo({ message: previous ? "Odpięto od Startu." : "Przypięto do Startu.", undo: () => updateAction(action.id, { pinnedToToday: previous }) }); }); }}>{action.pinnedToToday ? "Odepnij" : "Przypnij"}</Button>
      {['ready', 'in_progress'].includes(action.status) && !action.isNext && <Button variant="ghost" disabled={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => void actionMutation.run(`goal-action:${action.id}`, () => setNextAction(goal.id, action.id))}>Ustaw jako następne</Button>}
      {['ready', 'in_progress'].includes(action.status) && <Button variant="ghost" aria-label={`Zablokuj: ${action.title}`} onClick={() => { setDialogError(""); setBlockActionId(action.id); setBlocker(""); }}><LockKeyhole /></Button>}
      {action.status === "blocked" && <Button variant="ghost" disabled={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => void actionMutation.run(`goal-action:${action.id}`, () => setActionStatus(action.id, "ready"))}><RotateCcw />Odblokuj</Button>}
      {action.recurringTemplateId && !["completed", "skipped", "cancelled"].includes(action.status) && <Button variant="ghost" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.status; void actionMutation.run(`goal-action:${action.id}`, async () => { await setActionStatus(action.id, "skipped"); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><SkipForward />Pomiń</Button>}
      {!['completed', 'cancelled'].includes(action.status) && <Button variant="danger" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.status; void actionMutation.run(`goal-action:${action.id}`, async () => { await setActionStatus(action.id, "cancelled"); notifyUndo({ message: "Działanie anulowane.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><Ban />Anuluj Działanie</Button>}
    </div><ActionKnowledgeRelations action={action} />
  </div>;

  const remainingActions = actions.filter((action) => action.id !== nextAction?.id);
  const saveProgress = (event: FormEvent) => {
    event.preventDefault();
    void actionMutation.run("goal-progress", async () => {
      await addProgress(goal.id, progress.kind, progress.content);
      setProgress({ kind: "note", content: "" });
    });
  };

  return <AppShell>
    <div className="goal-detail-toolbar"><button className="back-link" onClick={() => navigate("/goals")}><ArrowLeft />Wszystkie Cele</button><details className="goal-more-menu"><summary><MoreHorizontal />Więcej</summary><div><Button loading={visibilitySaving} onClick={() => void changeGoalVisibility("archived")}><Archive />Archiwizuj</Button><Button variant="danger" disabled={visibilitySaving} onClick={() => { setVisibilityError(""); setTrashOpen(true); }}><Trash2 />Przenieś do kosza</Button></div></details></div>
    <section className="goal-overview">
      <div className="goal-overview-main"><div className="goal-overview-kicker"><Badge tone="info">{goalKindLabels[goal.kind]}</Badge><span><Layers3 />{projectName}</span></div><h1>{goal.title}</h1><p>{goal.outcome}</p><div className="goal-overview-meta"><span><Target />{priorityLabel}</span><span><CalendarDays />{goal.targetDate ? `Termin: ${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${goal.targetDate}T12:00:00Z`))}` : "Bez daty docelowej"}</span></div></div>
      <div className="goal-overview-controls"><label htmlFor="goal-status">Stan Celu</label><select id="goal-status" value={goal.status} disabled={goalStatusSaving} aria-busy={goalStatusSaving} onChange={(event) => { const status = event.target.value as typeof goal.status; if (status === "achieved" || status === "abandoned") { setStatusReason(""); setGoalStatusError(""); setPendingGoalStatus(status); } else void changeGoalStatus(status); }}><option value="active">Aktywny</option><option value="paused">Wstrzymany</option><option value="achieved">Osiągnięty</option><option value="abandoned">Porzucony</option></select><Button variant="primary" onClick={() => { setDialogError(""); setGoalForm({ title: goal.title, outcome: goal.outcome, areaId: goal.areaId ?? "", priority: goal.priority, targetDate: goal.targetDate ?? "", criteria: criteria.map((item) => item.title).join("\n") }); setEditGoal(true); }}><Pencil />Edytuj Cel</Button></div>
      <div className="goal-health-grid"><div><span><ListTodo />Następny krok</span><strong>{nextAction?.title ?? "Wybierz następne Działanie"}</strong></div><div><span><Target />Kryteria</span><strong>{criteria.length ? `${completedCriteria} z ${criteria.length} spełnione` : "Brak kryteriów"}</strong></div><div><span><Flag />Otwarte Działania</span><strong>{openActions}</strong></div></div>
    </section>
    {goalStatusError && !pendingGoalStatus ? <p className="inline-mutation-error" role="alert">{goalStatusError}</p> : null}
    {visibilityError && !trashOpen ? <p className="inline-mutation-error" role="alert">{visibilityError} <button type="button" onClick={() => void changeGoalVisibility("archived")}>Spróbuj ponownie</button></p> : null}
    <Panel className="goal-next-step" aria-labelledby="goal-next-step-title">
      <div className="section-heading"><div><span className="eyebrow">Skup się na jednym kroku</span><h2 id="goal-next-step-title">Następne Działanie</h2><span>Wykonaj je albo zapisz krótko, co posunęło Cel do przodu.</span></div></div>
      {nextAction ? <div className="next-action-card">{renderAction(nextAction)}</div> : <div className="next-action-empty"><strong>Brak wybranego następnego Działania</strong><span>Ustaw je z listy poniżej, żeby łatwiej wrócić do tego Celu.</span></div>}
      <div className="quick-progress"><div><h3>Szybki wpis postępu</h3><p className="muted-copy">Jedno zdanie wystarczy, żeby zachować kontekst.</p></div><form className="progress-form" onSubmit={saveProgress}><select aria-label="Rodzaj aktualizacji" value={progress.kind} onChange={(event) => setProgress((current) => ({ ...current, kind: event.target.value as typeof current.kind }))}>{Object.entries(progressKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><textarea aria-label="Treść aktualizacji" placeholder="Co się zmieniło?" rows={2} value={progress.content} onChange={(event) => setProgress((current) => ({ ...current, content: event.target.value }))} required /><Button type="submit" loading={actionMutation.isBusy("goal-progress")} disabled={!progress.content.trim()}>Zapisz postęp</Button>{actionMutation.error("goal-progress") ? <p className="inline-mutation-error" role="alert">{actionMutation.error("goal-progress")} <button type="button" onClick={() => void actionMutation.retry("goal-progress")?.()}>Spróbuj ponownie</button></p> : null}</form></div>
    </Panel>
    <div className="goal-detail-grid">
      <div className="detail-main">
        <Panel>
          <div className="section-heading"><div><h2>Pozostałe Działania</h2><span>Każdy krok można wykonać bez uruchamiania sesji.</span></div></div>
          <div className="action-list">{remainingActions.length ? remainingActions.map((action) => <div className={`goal-action ${action.status}`} key={action.id} data-action-id={action.id} tabIndex={-1}>
            <ActionPrimaryControls action={action} busy={actionMutation.isBusy(`goal-action:${action.id}`)} onToggleComplete={() => void (action.status === "completed" ? restoreCompletedAction(action) : complete(action.id))} onMore={() => setActionMenuId(action.id)} />
            <div className="action-copy"><div className="action-title-row"><strong>{action.title}</strong>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><small>{action.detail || (action.scheduledFor ? `Termin: ${action.scheduledFor}` : "Bez terminu")}</small>{action.blocker && <em><LockKeyhole />{action.blocker}</em>}{action.checklist.length ? <ActionChecklist action={action} busy={actionMutation.isBusy(`goal-action:${action.id}`)} onToggle={(entryId) => void actionMutation.run(`goal-action:${action.id}`, () => updateAction(action.id, { checklist: action.checklist.map((candidate) => candidate.id === entryId ? { ...candidate, completed: !candidate.completed } : candidate) }))} /> : null}{actionMutation.error(`goal-action:${action.id}`) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(`goal-action:${action.id}`)} <button type="button" onClick={() => void actionMutation.retry(`goal-action:${action.id}`)?.()}>Spróbuj ponownie</button></p> : null}</div>
            <div className="action-menu">
              <Button variant="ghost" aria-label={`Edytuj: ${action.title}`} onClick={() => openActionEditor(action)}><Pencil /></Button>
              <Button variant="ghost" aria-label={`Przesuń wyżej: ${action.title}`} disabled={action.id === actions[0]?.id} onClick={() => void move(action.id, -1)}><ArrowUp /></Button>
              <Button variant="ghost" aria-label={`Przesuń niżej: ${action.title}`} disabled={action.id === actions.at(-1)?.id} onClick={() => void move(action.id, 1)}><ArrowDown /></Button>
              <Button variant="ghost" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.pinnedToToday; void actionMutation.run(`goal-action:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !previous }); notifyUndo({ message: previous ? "Odpięto od Startu." : "Przypięto do Startu.", undo: () => updateAction(action.id, { pinnedToToday: previous }) }); }); }}>{action.pinnedToToday ? "Odepnij" : "Przypnij"}</Button>
              {["ready", "in_progress"].includes(action.status) && !action.isNext && <Button variant="ghost" disabled={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => void actionMutation.run(`goal-action:${action.id}`, () => setNextAction(goal.id, action.id))}>Ustaw jako następne</Button>}
              {["ready", "in_progress"].includes(action.status) && <Button variant="ghost" aria-label={`Zablokuj: ${action.title}`} onClick={() => { setDialogError(""); setBlockActionId(action.id); setBlocker(""); }}><LockKeyhole /></Button>}
              {action.status === "blocked" && <Button variant="ghost" disabled={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => void actionMutation.run(`goal-action:${action.id}`, () => setActionStatus(action.id, "ready"))}><RotateCcw />Odblokuj</Button>}
              {action.recurringTemplateId && !["completed", "skipped", "cancelled"].includes(action.status) && <Button variant="ghost" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.status; void actionMutation.run(`goal-action:${action.id}`, async () => { await setActionStatus(action.id, "skipped"); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><SkipForward />Pomiń</Button>}
              {!["completed", "cancelled"].includes(action.status) && <Button variant="danger" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.status; void actionMutation.run(`goal-action:${action.id}`, async () => { await setActionStatus(action.id, "cancelled"); notifyUndo({ message: "Działanie anulowane.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><Ban />Anuluj Działanie</Button>}
            </div><ActionKnowledgeRelations action={action} />
          </div>) : <p className="muted-copy action-list-empty">Brak innych Działań. Dodaj kolejny konkretny krok poniżej.</p>}</div>
          <form className="inline-create" onSubmit={addAction}><input aria-label="Nowe Działanie" placeholder="Dodaj konkretny krok…" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required /><input aria-label="Termin Działania" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /><Button type="submit" loading={actionMutation.isBusy("goal-create-action")} disabled={!actionForm.title.trim()}><Plus />Dodaj</Button>{actionMutation.error("goal-create-action") ? <p className="inline-mutation-error" role="alert">{actionMutation.error("goal-create-action")} <button type="button" onClick={() => void actionMutation.retry("goal-create-action")?.()}>Spróbuj ponownie</button></p> : null}</form>
        </Panel>
        <Panel>
          <h2>Aktualizacje postępu</h2>
          <div className="timeline">{updates.map((entry) => <div key={entry.id}><span>{progressKindLabels[entry.kind]}</span><p>{entry.content}</p><time>{new Date(entry.createdAt).toLocaleString("pl-PL")}</time></div>)}{!updates.length && <p className="muted-copy">Pierwsza krótka aktualizacja zbuduje historię postępu.</p>}</div>
          {progressPage.isError && updates.length ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać dalszej historii postępu.</p> : null}
          {updates.length && progressPage.hasNextPage ? <div className="list-pagination"><Button loading={progressPage.isFetchingNextPage} onClick={() => void progressPage.fetchNextPage()}>Załaduj starsze</Button></div> : null}
        </Panel>
      </div>
      <aside className="detail-aside">
        <Panel><div className="criteria-heading"><div><h2>Kryteria sukcesu</h2><span>{completedCriteria}/{criteria.length}</span></div><Progress className="criteria-progress [&>div]:bg-success" aria-label={`Postęp kryteriów ${criteriaProgress}%`} value={criteriaProgress} /></div>{criteria.length ? <ul className="plain-list">{criteria.map((item) => { const key = `criterion:${item.id}`; return <li key={item.id}><label className="criterion-check"><input type="checkbox" checked={item.completed} disabled={actionMutation.isBusy(key)} onChange={() => void actionMutation.run(key, () => updateGoal(goal.id, { criteria: criteria.map((criterion) => criterion.id === item.id ? { ...criterion, completed: !criterion.completed } : criterion) }))} />{item.completed ? <Check /> : <Circle />}<span>{item.title}</span></label>{actionMutation.error(key) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(key)} <button type="button" onClick={() => void actionMutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</li>; })}</ul> : <p className="muted-copy">Dodaj kryteria, żeby łatwiej rozpoznać osiągnięcie Celu.</p>}</Panel>
        <Panel><h2><Link2 />Powiązana Wiedza</h2>{linkedKnowledge.map(({ link, item }) => <div className="linked-knowledge" key={link.id}><Link to={routeForEntity({ type: "knowledge", id: item!.id })}>{item!.title}</Link><Button variant="ghost" aria-label={`Odłącz ${item!.title}`} onClick={() => void unlinkKnowledge(link.id)}>×</Button></div>)}<div className="inline-link"><select aria-label="Element Wiedzy" value={knowledgeId} onChange={(event) => setKnowledgeId(event.target.value)}><option value="">Wybierz materiał…</option>{state.knowledge.filter((item) => !links.some((link) => link.knowledgeItemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button disabled={!knowledgeId} onClick={() => void linkKnowledge(knowledgeId, { goalId: goal.id }, "material").then(() => setKnowledgeId(""))}>Połącz</Button></div></Panel>
        {legacySessions.length > 0 && <Panel><h2><History />Historia pracy</h2><p className="muted-copy">Dawne sesje są zachowane tylko do odczytu.</p>{legacySessions.map((session) => <Link className="history-link" key={session.id} to={`/history/focus/${session.id}`}>{new Date(session.startedAt).toLocaleString("pl-PL")}<span>{session.endedAt ? "Zakończona" : "Historyczna"}</span></Link>)}</Panel>}
      </aside>
    </div>
    <Modal open={Boolean(actionMenuId)} closeDisabled={Boolean(actionMenuId && actionMutation.isBusy(`goal-action:${actionMenuId}`))} title="Działanie — więcej opcji" onClose={() => setActionMenuId(undefined)}>{(() => { const action = actions.find((candidate) => candidate.id === actionMenuId); if (!action) return null; const key = `goal-action:${action.id}`; return <div className="mobile-action-sheet"><Button disabled={actionMutation.isBusy(key)} onClick={() => { setActionMenuId(undefined); openActionEditor(action); }}><Pencil />Edytuj</Button>{action.id !== actions[0]?.id ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await move(action.id, -1); setActionMenuId(undefined); })}><ArrowUp />Przesuń wyżej</Button> : null}{action.id !== actions.at(-1)?.id ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await move(action.id, 1); setActionMenuId(undefined); })}><ArrowDown />Przesuń niżej</Button> : null}{["ready", "in_progress"].includes(action.status) && !action.isNext ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await setNextAction(goal.id, action.id); setActionMenuId(undefined); })}>Ustaw jako następne</Button> : null}<Button loading={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await updateAction(action.id, { pinnedToToday: !action.pinnedToToday }); setActionMenuId(undefined); })}>{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button>{["ready", "in_progress"].includes(action.status) ? <Button disabled={actionMutation.isBusy(key)} onClick={() => { setActionMenuId(undefined); setDialogError(""); setBlockActionId(action.id); }}><LockKeyhole />Zablokuj</Button> : null}{action.status === "blocked" ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await setActionStatus(action.id, "ready"); setActionMenuId(undefined); })}><RotateCcw />Odblokuj</Button> : null}{action.recurringTemplateId ? <Button loading={actionMutation.isBusy(key)} onClick={() => { const previous = action.status; void actionMutation.run(key, async () => { await setActionStatus(action.id, "skipped"); setActionMenuId(undefined); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><SkipForward />Pomiń</Button> : null}{!["completed", "cancelled"].includes(action.status) ? <Button variant="danger" loading={actionMutation.isBusy(key)} onClick={() => { const previous = action.status; void actionMutation.run(key, async () => { await setActionStatus(action.id, "cancelled"); setActionMenuId(undefined); notifyUndo({ message: "Działanie anulowane.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><Ban />Anuluj Działanie</Button> : null}{actionMutation.error(key) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(key)} <button type="button" onClick={() => void actionMutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</div>; })()}</Modal>
    <Modal open={editGoal} closeDisabled={dialogSaving} title="Edytuj Cel i kryteria" onClose={() => setEditGoal(false)}><form onSubmit={(event) => { event.preventDefault(); const previousByTitle = new Map(criteria.map((item) => [item.title, item])); const nextCriteria = goalForm.criteria.split("\n").map((title) => title.trim()).filter(Boolean).map((title) => previousByTitle.get(title) ?? { id: crypto.randomUUID(), title, completed: false }); void runDialog(() => updateGoal(goal.id, { title: goalForm.title, outcome: goalForm.outcome, areaId: goalForm.areaId || null, priority: goalForm.priority, targetDate: goalForm.targetDate || null, criteria: nextCriteria }), () => setEditGoal(false)); }}><label className="field-label" htmlFor="edit-goal-title">Nazwa</label><input id="edit-goal-title" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required autoFocus /><label className="field-label" htmlFor="edit-goal-outcome">Oczekiwany rezultat</label><textarea id="edit-goal-outcome" rows={3} value={goalForm.outcome} onChange={(event) => setGoalForm((current) => ({ ...current, outcome: event.target.value }))} required /><label className="field-label" htmlFor="edit-goal-criteria">Kryteria sukcesu <span className="optional-label">jedno w linii</span></label><textarea id="edit-goal-criteria" rows={4} value={goalForm.criteria} onChange={(event) => setGoalForm((current) => ({ ...current, criteria: event.target.value }))} /><div className="form-grid"><div><label className="field-label" htmlFor="edit-goal-project">Projekt</label><select id="edit-goal-project" value={goalForm.areaId} onChange={(event) => setGoalForm((current) => ({ ...current, areaId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div><div><label className="field-label" htmlFor="edit-goal-priority">Ważność</label><select id="edit-goal-priority" value={goalForm.priority} onChange={(event) => setGoalForm((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}><option value="low">Niska</option><option value="normal">Normalna</option><option value="high">Wysoka</option></select></div></div><label className="field-label" htmlFor="edit-goal-date">Data docelowa</label><input id="edit-goal-date" type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm((current) => ({ ...current, targetDate: event.target.value }))} />{dialogError ? <p className="auth-message error" role="alert">{dialogError}</p> : null}<div className="modal-actions"><Button type="button" disabled={dialogSaving} onClick={() => setEditGoal(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={dialogSaving} disabled={!goalForm.title.trim() || !goalForm.outcome.trim()}>Zapisz Cel</Button></div></form></Modal>
    <Modal open={Boolean(blockActionId)} closeDisabled={dialogSaving} title="Co blokuje Działanie?" onClose={() => setBlockActionId(undefined)}><textarea aria-label="Powód blokady" rows={3} value={blocker} onChange={(event) => setBlocker(event.target.value)} autoFocus />{dialogError ? <p className="auth-message error" role="alert">{dialogError}</p> : null}<div className="modal-actions"><Button disabled={dialogSaving} onClick={() => setBlockActionId(undefined)}>Anuluj</Button><Button variant="primary" loading={dialogSaving} disabled={!blocker.trim()} onClick={() => blockActionId && void runDialog(() => setActionStatus(blockActionId, "blocked", blocker), () => setBlockActionId(undefined))}>Zapisz blokadę</Button></div></Modal>
    <Modal open={Boolean(editAction)} closeDisabled={dialogSaving} title="Edytuj Działanie" onClose={() => setEditAction(undefined)}>{editAction ? <>
      <label className="field-label" htmlFor="edit-action-name">Nazwa</label><input id="edit-action-name" value={editAction.title} onChange={(event) => setEditAction((current) => current ? { ...current, title: event.target.value } : current)} autoFocus />
      <label className="field-label" htmlFor="edit-action-detail">Opis</label><textarea id="edit-action-detail" value={editAction.detail} onChange={(event) => setEditAction((current) => current ? { ...current, detail: event.target.value } : current)} />
      <label className="field-label" htmlFor="edit-action-date">Termin</label><input id="edit-action-date" type="date" value={editAction.scheduledFor} onChange={(event) => setEditAction((current) => current ? { ...current, scheduledFor: event.target.value } : current)} />
      <span className="field-label">Checklista</span><div className="checklist-editor">{editAction.checklist.map((entry) => <div key={entry.id}><input aria-label="Nazwa punktu checklisty" value={entry.title} onChange={(event) => setEditAction((current) => current ? { ...current, checklist: current.checklist.map((candidate) => candidate.id === entry.id ? { ...candidate, title: event.target.value } : candidate) } : current)} /><Button type="button" variant="ghost" aria-label={`Usuń punkt: ${entry.title || "bez nazwy"}`} onClick={() => setEditAction((current) => current ? { ...current, checklist: current.checklist.filter((candidate) => candidate.id !== entry.id) } : current)}>×</Button></div>)}</div>
      <Button type="button" variant="ghost" onClick={() => setEditAction((current) => current ? { ...current, checklist: [...current.checklist, { id: crypto.randomUUID(), title: "", completed: false }] } : current)}><Plus />Dodaj punkt</Button>
      {dialogError ? <p className="auth-message error" role="alert">{dialogError}</p> : null}<div className="modal-actions"><Button disabled={dialogSaving} onClick={() => setEditAction(undefined)}>Anuluj</Button><Button variant="primary" loading={dialogSaving} disabled={!editAction.title.trim()} onClick={() => void runDialog(() => updateAction(editAction.id, { title: editAction.title, detail: editAction.detail, scheduledFor: editAction.scheduledFor || null, checklist: editAction.checklist.map((entry) => ({ ...entry, title: entry.title.trim() })).filter((entry) => entry.title) }), () => setEditAction(undefined))}>Zapisz zmiany</Button></div>
    </> : null}</Modal>
    <Modal open={Boolean(pendingGoalStatus)} closeDisabled={goalStatusSaving} title={pendingGoalStatus === "achieved" ? "Potwierdź osiągnięcie Celu" : "Porzuć Cel"} onClose={() => setPendingGoalStatus(undefined)}>{pendingGoalStatus === "achieved" ? <><p>Kryteria: {criteria.filter((item) => item.completed).length}/{criteria.length}. Otwarte Działania: {actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status)).length}.</p><p className="muted-copy">Potwierdź tylko wtedy, gdy rezultat jest faktycznie osiągnięty.</p></> : <><label className="field-label" htmlFor="goal-abandon-reason">Powód porzucenia</label><textarea id="goal-abandon-reason" rows={3} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} autoFocus required /></>}{goalStatusError ? <p className="auth-message error" role="alert">{goalStatusError}</p> : null}<div className="modal-actions"><Button disabled={goalStatusSaving} onClick={() => setPendingGoalStatus(undefined)}>Anuluj</Button><Button variant={pendingGoalStatus === "abandoned" ? "danger" : "primary"} loading={goalStatusSaving} disabled={pendingGoalStatus === "abandoned" && !statusReason.trim()} onClick={() => { if (!pendingGoalStatus) return; void changeGoalStatus(pendingGoalStatus, statusReason); }}>{pendingGoalStatus === "achieved" ? "Potwierdź osiągnięcie" : "Porzuć Cel"}</Button></div></Modal>
    <AlertDialog open={trashOpen} title="Przenieść Cel do Kosza?" objectName={goal.title} consequence="Cel zniknie z aktywnych widoków i trafi do sekcji odzyskiwania." preserved="Działania, kryteria, Wiedza i historia postępu pozostaną zachowane." recovery="Cel można przywrócić z Kosza albo natychmiast użyć akcji Cofnij." confirmLabel="Przenieś do Kosza" loading={visibilitySaving} error={visibilityError} onCancel={() => setTrashOpen(false)} onConfirm={() => changeGoalVisibility("trashed")} />
    <ActionResultDialog action={state.actions.find((candidate) => candidate.id === resultActionId)} open={Boolean(resultActionId)} onClose={() => setResultActionId(undefined)} />
  </AppShell>;
}
