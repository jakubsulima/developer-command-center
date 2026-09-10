import { useEffect, useRef, useState, type FormEvent } from "react";
import { Archive, ArrowDown, ArrowUp, Ban, Check, ChevronDown, Circle, Flag, History, Link2, ListTodo, LockKeyhole, MoreHorizontal, Pencil, Plus, RotateCcw, SkipForward, Target, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { ActionPrimaryControls } from "../components/ActionPrimaryControls";
import { AlertDialog } from "../components/AlertDialog";
import { useActionFeedback } from "../components/action-feedback-context";
import { Button, EmptyState, Panel } from "../components/ui";
import { Progress } from "../components/ui/progress";
import { Modal } from "../components/Modal";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { goalKindLabels, progressKindLabels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { ActionResultDialog } from "../components/ActionResultDialog";
import { ActionKnowledgeRelations } from "../components/ActionKnowledgeRelations";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import type { GoalAction } from "../domain/types";
import type { GoalProgressPageItem } from "../data/workspaceRepository";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { DraftStatus } from "../components/DraftStatus";
import { DraftConflictNotice } from "../components/DraftConflictNotice";
import { isDraftVersionConflict } from "../components/draftConflict";

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
  const location = useLocation();
  const navigate = useNavigate();
  const goal = state.goals.find((item) => item.id === goalId);
  const actionDraft = usePersistentDraft("goal-action", { title: "", detail: "", scheduledFor: "" }, 450, { targetId: goalId ?? "new", enabled: Boolean(goalId) });
  const progressDraft = usePersistentDraft("goal-progress", { kind: "note" as "note" | "decision" | "result" | "evidence" | "blocker", content: "" }, 450, { targetId: goalId ?? "new", enabled: Boolean(goalId) });
  const statusReasonDraft = usePersistentDraft("goal-status-reason", { content: "" }, 450, { targetId: goalId ?? "new", baseVersion: goal?.version, enabled: Boolean(goalId) });
  const [actionForm, setActionForm] = [actionDraft.value, actionDraft.setValue] as const;
  const [progress, setProgress] = [progressDraft.value, progressDraft.setValue] as const;
  const [blockActionId, setBlockActionId] = useState<string>();
  const blockerDraft = usePersistentDraft("action-blocker", { content: "" }, 450, { targetId: blockActionId ?? "new", enabled: Boolean(blockActionId) });
  const blocker = blockerDraft.value.content;
  const [knowledgeId, setKnowledgeId] = useState("");
  const [editAction, setEditAction] = useState<{ id: string; title: string; detail: string; scheduledFor: string; checklist: Array<{ id: string; title: string; completed: boolean }> }>();
  const [pendingGoalStatus, setPendingGoalStatus] = useState<"achieved" | "abandoned">();
  const statusReason = statusReasonDraft.value.content;
  const [goalStatusSaving, setGoalStatusSaving] = useState(false);
  const [goalStatusError, setGoalStatusError] = useState("");
  const [goalConflict, setGoalConflict] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const goalDraft = usePersistentDraft("goal-edit", { title: "", outcome: "", areaId: "", priority: "normal" as "low" | "normal" | "high", targetDate: "", criteria: "" }, 450, { targetId: goalId ?? "new", baseVersion: goal?.version, enabled: Boolean(goalId) });
  const goalForm = goalDraft.value;
  const setGoalForm = goalDraft.setValue;
  const [actionMenuId, setActionMenuId] = useState<string>();
  const [resultActionId, setResultActionId] = useState<string>();
  const [dialogSaving, setDialogSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const editActionDraft = usePersistentDraft("goal-action-edit", { title: "", detail: "", scheduledFor: "" }, 450, { targetId: editAction?.id ?? "new", enabled: Boolean(editAction) });
  const actionsSectionRef = useRef<HTMLDetailsElement>(null);
  const newActionInputRef = useRef<HTMLInputElement>(null);
  const progressIntentRef = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!editAction || editActionDraft.dirty || editActionDraft.restored) return;
    editActionDraft.setValue({ title: editAction.title, detail: editAction.detail, scheduledFor: editAction.scheduledFor });
  // The draft object is intentionally omitted: its setters are recreated by
  // the hook, while dirty/restored are the state that controls this hydrate.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editAction, editActionDraft.dirty, editActionDraft.restored]);
  useEffect(() => { const id = searchParams.get("action"); if (id) requestAnimationFrame(() => { const target = document.querySelector<HTMLElement>(`[data-action-id="${CSS.escape(id)}"]`); target?.scrollIntoView?.({ block: "center", behavior: "auto" }); target?.focus(); }); }, [searchParams, state.actions]);
  if (!goal) return <AppShell><EmptyState icon={<Flag />} title="Nie znaleziono Celu" detail="Cel nie istnieje albo nie jest dostępny w tej przestrzeni pracy." action={<Button onClick={() => navigate("/goals")}>Wróć do Celów</Button>} /></AppShell>;
  const actions = state.actions.filter((item) => item.goalId === goal.id).sort((a, b) => a.position - b.position);
  const criteria = state.goalCriteria.filter((item) => item.goalId === goal.id);
  const updates = mergePagedItems(state.progressEntries.filter((item) => item.goalId === goal.id), progressPage.data?.items ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const links = state.knowledgeLinks.filter((item) => item.goalId === goal.id);
  const linkedKnowledge = links.map((link) => ({ link, item: state.knowledge.find((item) => item.id === link.knowledgeItemId) })).filter((value) => value.item);
  const legacySessions = state.focusSessions.filter((session) => session.projectId === goal.id);
  const nextAction = actions.find((action) => action.isNext && ["ready", "in_progress"].includes(action.status));
  const completedCriteria = criteria.filter((item) => item.completed).length;
  const criteriaProgress = criteria.length ? Math.round((completedCriteria / criteria.length) * 100) : 0;
  const project = goal.areaId ? state.areas.find((area) => area.id === goal.areaId) : undefined;
  const fallbackBreadcrumbs: NavigationBreadcrumb[] = project ? [{ label: "Projekty", to: "/projects" }, { label: project.name, to: `/projects/${encodeURIComponent(project.id)}` }] : [{ label: "Cele", to: "/goals" }];
  const goalRoute = `/goals/${encodeURIComponent(goal.id)}`;
  const currentBreadcrumb = { label: `Cel: ${goal.title}`, to: goalRoute };
  const breadcrumbs = breadcrumbsForPage(location.state, fallbackBreadcrumbs, currentBreadcrumb);
  const priorityLabel = goal.priority === "high" ? "Wysoka ważność" : goal.priority === "low" ? "Niska ważność" : "Normalna ważność";

  const openGoalEditor = () => {
    setDialogError("");
    setGoalConflict(false);
    if (!goalDraft.dirty && !goalDraft.restored) setGoalForm({ title: goal.title, outcome: goal.outcome, areaId: goal.areaId ?? "", priority: goal.priority, targetDate: goal.targetDate ?? "", criteria: criteria.map((item) => item.title).join("\n") });
    setEditGoal(true);
  };
  const closeGoalMenu = (target: HTMLElement) => target.closest("details")?.removeAttribute("open");
  const addAction = async (event: FormEvent) => {
    event.preventDefault();
    await actionMutation.run("goal-create-action", async () => {
      await createAction({ title: actionForm.title, detail: actionForm.detail, goalId: goal.id, areaId: goal.areaId, scheduledFor: actionForm.scheduledFor || undefined });
      actionDraft.clear();
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
    catch (caught) { if (isDraftVersionConflict(caught)) setGoalConflict(true); setDialogError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmiany."); }
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
      statusReasonDraft.clear();
      setPendingGoalStatus(undefined);
    } catch (caught) {
      setGoalStatusError(caught instanceof Error ? caught.message : "Nie udało się zmienić stanu Celu.");
    } finally {
      setGoalStatusSaving(false);
    }
  };

  const renderAction = (action: typeof actions[number]) => <div className={`goal-action ${action.status}`} key={action.id} data-action-id={action.id} data-navigation-card-id={navigationCardId("action", action.id)} tabIndex={-1}>
    <ActionPrimaryControls action={action} busy={actionMutation.isBusy(`goal-action:${action.id}`)} onToggleComplete={() => void (action.status === "completed" ? restoreCompletedAction(action) : complete(action.id))} onMore={() => setActionMenuId(action.id)} />
    <div className="action-copy"><div className="action-title-row"><NavigationLink to={`/actions/${encodeURIComponent(action.id)}`} breadcrumbs={breadcrumbs} returnTo={locationAddress(location)} returnLabel={`Cel: ${goal.title}`} sourceCardId={navigationCardId("action", action.id)}><strong>{action.title}</strong></NavigationLink>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><small>{action.detail || (action.scheduledFor ? `Termin: ${action.scheduledFor}` : "Bez terminu")}</small>{action.blocker && <em><LockKeyhole />{action.blocker}</em>}{action.checklist.length ? <ActionChecklist action={action} busy={actionMutation.isBusy(`goal-action:${action.id}`)} onToggle={(entryId) => void actionMutation.run(`goal-action:${action.id}`, () => updateAction(action.id, { checklist: action.checklist.map((candidate) => candidate.id === entryId ? { ...candidate, completed: !candidate.completed } : candidate) }))} /> : null}{actionMutation.error(`goal-action:${action.id}`) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(`goal-action:${action.id}`)} <button type="button" onClick={() => void actionMutation.retry(`goal-action:${action.id}`)?.()}>Spróbuj ponownie</button></p> : null}</div>
    <div className="action-menu">
      <Button variant="ghost" aria-label={`Edytuj: ${action.title}`} onClick={() => openActionEditor(action)}><Pencil /></Button>
      <Button variant="ghost" aria-label={`Przesuń wyżej: ${action.title}`} disabled={action.id === actions[0]?.id} onClick={() => void move(action.id, -1)}><ArrowUp /></Button>
      <Button variant="ghost" aria-label={`Przesuń niżej: ${action.title}`} disabled={action.id === actions.at(-1)?.id} onClick={() => void move(action.id, 1)}><ArrowDown /></Button>
      <Button variant="ghost" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.pinnedToToday; void actionMutation.run(`goal-action:${action.id}`, async () => { await updateAction(action.id, { pinnedToToday: !previous }); notifyUndo({ message: previous ? "Odpięto od Startu." : "Przypięto do Startu.", undo: () => updateAction(action.id, { pinnedToToday: previous }) }); }); }}>{action.pinnedToToday ? "Odepnij" : "Przypnij"}</Button>
      {['ready', 'in_progress'].includes(action.status) && !action.isNext && <Button variant="ghost" disabled={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => void actionMutation.run(`goal-action:${action.id}`, () => setNextAction(goal.id, action.id))}>Ustaw jako następne</Button>}
      {['ready', 'in_progress'].includes(action.status) && <Button variant="ghost" aria-label={`Zablokuj: ${action.title}`} onClick={() => { setDialogError(""); setBlockActionId(action.id); }}><LockKeyhole /></Button>}
      {action.status === "blocked" && <Button variant="ghost" disabled={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => void actionMutation.run(`goal-action:${action.id}`, () => setActionStatus(action.id, "ready"))}><RotateCcw />Odblokuj</Button>}
      {action.recurringTemplateId && !["completed", "skipped", "cancelled"].includes(action.status) && <Button variant="ghost" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.status; void actionMutation.run(`goal-action:${action.id}`, async () => { await setActionStatus(action.id, "skipped"); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><SkipForward />Pomiń</Button>}
      {!['completed', 'cancelled'].includes(action.status) && <Button variant="danger" loading={actionMutation.isBusy(`goal-action:${action.id}`)} onClick={() => { const previous = action.status; void actionMutation.run(`goal-action:${action.id}`, async () => { await setActionStatus(action.id, "cancelled"); notifyUndo({ message: "Działanie anulowane.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><Ban />Anuluj Działanie</Button>}
  </div><ActionKnowledgeRelations action={action} navigation={{ breadcrumbs, returnTo: locationAddress(location), returnLabel: `Cel: ${goal.title}` }} />
  </div>;

  const remainingActions = actions.filter((action) => action.id !== nextAction?.id && !["completed", "cancelled", "skipped"].includes(action.status));
  const historicalActions = actions.filter((action) => ["completed", "cancelled", "skipped"].includes(action.status));
  const saveProgress = (event: FormEvent) => {
    event.preventDefault();
    void actionMutation.run("goal-progress", async () => {
      await addProgress(goal.id, progress.kind, progress.content, undefined, undefined, progressIntentRef.current);
      progressIntentRef.current = crypto.randomUUID();
      setProgress({ kind: "note", content: "" });
    });
  };

  return <AppShell addAction={{ label: "Nowe Działanie", shortLabel: "Działanie", ariaLabel: `Dodaj Działanie do Celu ${goal.title}`, quickAdd: { mode: "action", goalId: goal.id, areaId: goal.areaId, pinnedToToday: false, draftKey: `goal-${goal.id}` } }}>
    <div className="goal-detail-toolbar"><ContextNavigation current={currentBreadcrumb} fallbackBreadcrumbs={fallbackBreadcrumbs} fallbackReturnTo={project ? `/projects/${encodeURIComponent(project.id)}` : "/goals"} fallbackReturnLabel={project ? `Projekt: ${project.name}` : "Wszystkie Cele"} /><details className="goal-more-menu"><summary aria-label="Opcje Celu" title="Opcje Celu"><MoreHorizontal /><span className="sr-only">Opcje Celu</span></summary><div>
      <div className="goal-menu-context"><span>{goalKindLabels[goal.kind]}</span><strong>{project?.name ?? "Bez Projektu"}</strong><small>{priorityLabel} · {goal.targetDate ? `Termin ${new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${goal.targetDate}T12:00:00Z`))}` : "Bez daty docelowej"}</small></div>
      <label className="goal-menu-field" htmlFor="goal-status"><span>Stan Celu</span><select id="goal-status" value={goal.status} disabled={goalStatusSaving} aria-busy={goalStatusSaving} onChange={(event) => { const status = event.target.value as typeof goal.status; closeGoalMenu(event.currentTarget); if (status === "achieved" || status === "abandoned") { setGoalStatusError(""); setPendingGoalStatus(status); } else void changeGoalStatus(status); }}><option value="active">Aktywny</option><option value="paused">Wstrzymany</option><option value="achieved">Osiągnięty</option><option value="abandoned">Porzucony</option></select></label>
      <Button onClick={(event) => { closeGoalMenu(event.currentTarget); openGoalEditor(); }}><Pencil />Edytuj Cel</Button>
      <Button loading={visibilitySaving} onClick={() => void changeGoalVisibility("archived")}><Archive />Archiwizuj</Button>
      <Button variant="danger" disabled={visibilitySaving} onClick={(event) => { closeGoalMenu(event.currentTarget); setVisibilityError(""); setTrashOpen(true); }}><Trash2 />Przenieś do kosza</Button>
    </div></details></div>
    <section className="goal-overview">
      <div className="goal-overview-main"><h1>{goal.title}</h1><p>{goal.outcome}</p></div>
    </section>
    {goalStatusError && !pendingGoalStatus ? <p className="inline-mutation-error" role="alert">{goalStatusError}</p> : null}
    {visibilityError && !trashOpen ? <p className="inline-mutation-error" role="alert">{visibilityError} <button type="button" onClick={() => void changeGoalVisibility("archived")}>Spróbuj ponownie</button></p> : null}
    <Panel className="goal-next-step" aria-labelledby="goal-next-step-title">
      <div className="section-heading"><div><span className="eyebrow">Skup się na jednym kroku</span><h2 id="goal-next-step-title">Następne Działanie</h2></div></div>
      {nextAction ? <div className="next-action-card">{renderAction(nextAction)}</div> : <div className="next-action-empty"><strong>Brak wybranego następnego Działania</strong><span>Ustaw je z listy poniżej, żeby łatwiej wrócić do tego Celu.</span></div>}
      <div className="quick-progress"><div><h3>Szybki wpis postępu</h3><p className="muted-copy">Jedno zdanie wystarczy, żeby zachować kontekst.</p></div><form className="progress-form" onSubmit={saveProgress}><label className="progress-form-field" htmlFor="goal-progress-kind"><span>Rodzaj aktualizacji</span><select id="goal-progress-kind" aria-label="Rodzaj aktualizacji" value={progress.kind} onChange={(event) => setProgress((current) => ({ ...current, kind: event.target.value as typeof current.kind }))}>{Object.entries(progressKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="progress-form-field progress-form-content" htmlFor="goal-progress-content"><span>Treść aktualizacji</span><textarea id="goal-progress-content" aria-label="Treść aktualizacji" placeholder="Co się zmieniło?" rows={2} value={progress.content} onChange={(event) => setProgress((current) => ({ ...current, content: event.target.value }))} required /></label><div className="progress-form-feedback"><DraftStatus status={progressDraft.status} errorMessage={progressDraft.errorMessage} onRetry={() => void progressDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(progress.content)} />{actionMutation.error("goal-progress") ? <p className="inline-mutation-error" role="alert">{actionMutation.error("goal-progress")} <button type="button" onClick={() => void actionMutation.retry("goal-progress")?.()}>Spróbuj ponownie</button></p> : null}</div><Button type="submit" loading={actionMutation.isBusy("goal-progress")} disabled={!progress.content.trim()}>Zapisz postęp</Button></form></div>
    </Panel>
    <Panel className="goal-secondary" aria-labelledby="goal-secondary-title">
      <div className="goal-secondary-intro"><div><span className="eyebrow">Na później</span><h2 id="goal-secondary-title">Szczegóły Celu</h2><p>Rozwiń tylko tę część, której teraz potrzebujesz.</p></div></div>
      <div className="goal-secondary-list">
        <details className="goal-secondary-section" ref={actionsSectionRef}>
          <summary><span className="goal-secondary-icon"><ListTodo /></span><span className="goal-secondary-label"><strong>Działania</strong><small>Otwarte kroki, dodawanie i historia</small></span><span className="goal-secondary-count">{remainingActions.length}</span><ChevronDown /></summary>
          <div className="goal-secondary-content">
            <div className="action-list">{remainingActions.length ? remainingActions.map(renderAction) : <p className="muted-copy action-list-empty">Brak innych otwartych Działań.</p>}</div>
            <form className="inline-create" onSubmit={addAction}><input ref={newActionInputRef} aria-label="Nowe Działanie" placeholder="Dodaj konkretny krok…" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required /><input aria-label="Termin Działania" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /><Button type="submit" loading={actionMutation.isBusy("goal-create-action")} disabled={!actionForm.title.trim()}>Dodaj</Button>{actionMutation.error("goal-create-action") ? <p className="inline-mutation-error" role="alert">{actionMutation.error("goal-create-action")} <button type="button" onClick={() => void actionMutation.retry("goal-create-action")?.()}>Spróbuj ponownie</button></p> : null}</form>
            {historicalActions.length ? <details className="goal-action-history"><summary><History />Historia Działań <span>{historicalActions.length}</span></summary><div className="action-list">{historicalActions.map(renderAction)}</div></details> : null}
          </div>
        </details>
        <details className="goal-secondary-section">
          <summary><span className="goal-secondary-icon"><Target /></span><span className="goal-secondary-label"><strong>Kryteria sukcesu</strong><small>Po czym poznasz, że Cel jest osiągnięty</small></span><span className="goal-secondary-count">{completedCriteria}/{criteria.length}</span><ChevronDown /></summary>
          <div className="goal-secondary-content"><div className="criteria-heading"><Progress className="criteria-progress [&>div]:bg-success" aria-label={`Postęp kryteriów ${criteriaProgress}%`} value={criteriaProgress} /></div>{criteria.length ? <ul className="plain-list">{criteria.map((item) => { const key = `criterion:${item.id}`; return <li key={item.id}><label className="criterion-check"><input type="checkbox" checked={item.completed} disabled={actionMutation.isBusy(key)} onChange={() => void actionMutation.run(key, () => updateGoal(goal.id, { criteria: criteria.map((criterion) => criterion.id === item.id ? { ...criterion, completed: !criterion.completed } : criterion) }))} />{item.completed ? <Check /> : <Circle />}<span>{item.title}</span></label>{actionMutation.error(key) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(key)} <button type="button" onClick={() => void actionMutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</li>; })}</ul> : <p className="muted-copy">Dodaj kryteria podczas edycji Celu, żeby łatwiej rozpoznać jego osiągnięcie.</p>}</div>
        </details>
        <details className="goal-secondary-section">
          <summary><span className="goal-secondary-icon"><History /></span><span className="goal-secondary-label"><strong>Historia postępu</strong><small>Decyzje, rezultaty i wcześniejsze aktualizacje</small></span><span className="goal-secondary-count">{updates.length}</span><ChevronDown /></summary>
          <div className="goal-secondary-content"><div className="timeline">{updates.map((entry) => <div key={entry.id}><span>{progressKindLabels[entry.kind]}</span><p>{entry.content}</p><time>{new Date(entry.createdAt).toLocaleString("pl-PL")}</time></div>)}{!updates.length && <p className="muted-copy">Pierwsza krótka aktualizacja zbuduje historię postępu.</p>}</div>{progressPage.isError && updates.length ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać dalszej historii postępu.</p> : null}{updates.length && progressPage.hasNextPage ? <div className="list-pagination"><Button loading={progressPage.isFetchingNextPage} onClick={() => void progressPage.fetchNextPage()}>Załaduj starsze</Button></div> : null}</div>
        </details>
        <details className="goal-secondary-section">
          <summary><span className="goal-secondary-icon"><Link2 /></span><span className="goal-secondary-label"><strong>Powiązana Wiedza</strong><small>Materiały wspierające ten Cel</small></span><span className="goal-secondary-count">{linkedKnowledge.length}</span><ChevronDown /></summary>
          <div className="goal-secondary-content">{linkedKnowledge.map(({ link, item }) => <div className="linked-knowledge" key={link.id} data-navigation-card-id={navigationCardId("knowledge", item!.id)} tabIndex={-1}><NavigationLink to={routeForEntity({ type: "knowledge", id: item!.id })} breadcrumbs={breadcrumbs} returnTo={locationAddress(location)} returnLabel={`Cel: ${goal.title}`} sourceCardId={navigationCardId("knowledge", item!.id)}>{item!.title}</NavigationLink><Button variant="ghost" aria-label={`Odłącz ${item!.title}`} onClick={() => void unlinkKnowledge(link.id)}>×</Button></div>)}<div className="inline-link"><select aria-label="Element Wiedzy" value={knowledgeId} onChange={(event) => setKnowledgeId(event.target.value)}><option value="">Wybierz materiał…</option>{state.knowledge.filter((item) => !links.some((link) => link.knowledgeItemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><Button disabled={!knowledgeId} onClick={() => void linkKnowledge(knowledgeId, { goalId: goal.id }, "material").then(() => setKnowledgeId(""))}>Połącz</Button></div></div>
        </details>
        {legacySessions.length > 0 ? <details className="goal-secondary-section"><summary><span className="goal-secondary-icon"><History /></span><span className="goal-secondary-label"><strong>Historia pracy</strong><small>Dawne sesje tylko do odczytu</small></span><span className="goal-secondary-count">{legacySessions.length}</span><ChevronDown /></summary><div className="goal-secondary-content">{legacySessions.map((session) => <Link className="history-link" key={session.id} to={`/history/focus/${session.id}`}>{new Date(session.startedAt).toLocaleString("pl-PL")}<span>{session.endedAt ? "Zakończona" : "Historyczna"}</span></Link>)}</div></details> : null}
      </div>
    </Panel>
    <Modal open={Boolean(actionMenuId)} closeDisabled={Boolean(actionMenuId && actionMutation.isBusy(`goal-action:${actionMenuId}`))} title="Działanie — więcej opcji" onClose={() => setActionMenuId(undefined)}>{(() => { const action = actions.find((candidate) => candidate.id === actionMenuId); if (!action) return null; const key = `goal-action:${action.id}`; return <div className="mobile-action-sheet"><Button disabled={actionMutation.isBusy(key)} onClick={() => { setActionMenuId(undefined); openActionEditor(action); }}><Pencil />Edytuj</Button>{action.id !== actions[0]?.id ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await move(action.id, -1); setActionMenuId(undefined); })}><ArrowUp />Przesuń wyżej</Button> : null}{action.id !== actions.at(-1)?.id ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await move(action.id, 1); setActionMenuId(undefined); })}><ArrowDown />Przesuń niżej</Button> : null}{["ready", "in_progress"].includes(action.status) && !action.isNext ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await setNextAction(goal.id, action.id); setActionMenuId(undefined); })}>Ustaw jako następne</Button> : null}<Button loading={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await updateAction(action.id, { pinnedToToday: !action.pinnedToToday }); setActionMenuId(undefined); })}>{action.pinnedToToday ? "Odepnij od Startu" : "Przypnij do Startu"}</Button>{["ready", "in_progress"].includes(action.status) ? <Button disabled={actionMutation.isBusy(key)} onClick={() => { setActionMenuId(undefined); setDialogError(""); setBlockActionId(action.id); }}><LockKeyhole />Zablokuj</Button> : null}{action.status === "blocked" ? <Button disabled={actionMutation.isBusy(key)} onClick={() => void actionMutation.run(key, async () => { await setActionStatus(action.id, "ready"); setActionMenuId(undefined); })}><RotateCcw />Odblokuj</Button> : null}{action.recurringTemplateId ? <Button loading={actionMutation.isBusy(key)} onClick={() => { const previous = action.status; void actionMutation.run(key, async () => { await setActionStatus(action.id, "skipped"); setActionMenuId(undefined); notifyUndo({ message: "Działanie pominięte.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><SkipForward />Pomiń</Button> : null}{!["completed", "cancelled"].includes(action.status) ? <Button variant="danger" loading={actionMutation.isBusy(key)} onClick={() => { const previous = action.status; void actionMutation.run(key, async () => { await setActionStatus(action.id, "cancelled"); setActionMenuId(undefined); notifyUndo({ message: "Działanie anulowane.", undo: () => setActionStatus(action.id, previous, action.blocker) }); }); }}><Ban />Anuluj Działanie</Button> : null}{actionMutation.error(key) ? <p className="inline-mutation-error" role="alert">{actionMutation.error(key)} <button type="button" onClick={() => void actionMutation.retry(key)?.()}>Spróbuj ponownie</button></p> : null}</div>; })()}</Modal>
    <Modal open={editGoal} closeDisabled={dialogSaving} title="Edytuj Cel i kryteria" onClose={() => setEditGoal(false)}><form onSubmit={(event) => { event.preventDefault(); const previousByTitle = new Map(criteria.map((item) => [item.title, item])); const nextCriteria = goalForm.criteria.split("\n").map((title) => title.trim()).filter(Boolean).map((title) => previousByTitle.get(title) ?? { id: crypto.randomUUID(), title, completed: false }); void runDialog(() => updateGoal(goal.id, { title: goalForm.title, outcome: goalForm.outcome, areaId: goalForm.areaId || null, priority: goalForm.priority, targetDate: goalForm.targetDate || null, criteria: nextCriteria }, typeof goalDraft.baseVersion === "number" ? goalDraft.baseVersion : undefined), () => { goalDraft.clear(); setEditGoal(false); }); }}><label className="field-label" htmlFor="edit-goal-title">Nazwa</label><input id="edit-goal-title" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required /><label className="field-label" htmlFor="edit-goal-outcome">Oczekiwany rezultat</label><textarea id="edit-goal-outcome" rows={3} value={goalForm.outcome} onChange={(event) => setGoalForm((current) => ({ ...current, outcome: event.target.value }))} required /><label className="field-label" htmlFor="edit-goal-criteria">Kryteria sukcesu <span className="optional-label">jedno w linii</span></label><textarea id="edit-goal-criteria" rows={4} value={goalForm.criteria} onChange={(event) => setGoalForm((current) => ({ ...current, criteria: event.target.value }))} /><div className="form-grid"><div><label className="field-label" htmlFor="edit-goal-project">Projekt</label><select id="edit-goal-project" value={goalForm.areaId} onChange={(event) => setGoalForm((current) => ({ ...current, areaId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div><div><label className="field-label" htmlFor="edit-goal-priority">Ważność</label><select id="edit-goal-priority" value={goalForm.priority} onChange={(event) => setGoalForm((current) => ({ ...current, priority: event.target.value as typeof current.priority }))}><option value="low">Niska</option><option value="normal">Normalna</option><option value="high">Wysoka</option></select></div></div><label className="field-label" htmlFor="edit-goal-date">Data docelowa</label><input id="edit-goal-date" type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm((current) => ({ ...current, targetDate: event.target.value }))} />{dialogError ? <p className="auth-message error" role="alert">{dialogError}</p> : null}{goalConflict ? <DraftConflictNotice onCopy={() => void navigator.clipboard?.writeText(`${goalForm.title}\n${goalForm.outcome}\n${goalForm.criteria}`)} onOpenCurrent={() => { goalDraft.clear(); setGoalConflict(false); setEditGoal(false); }} /> : null}<div className="modal-actions"><DraftStatus status={goalDraft.status} errorMessage={goalDraft.errorMessage} onRetry={() => void goalDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${goalForm.title}\n${goalForm.outcome}\n${goalForm.criteria}`)} />{goalDraft.dirty ? <Button type="button" variant="ghost" onClick={goalDraft.discard}>Odrzuć szkic</Button> : null}<Button type="button" disabled={dialogSaving} onClick={() => setEditGoal(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={dialogSaving} disabled={!goalForm.title.trim() || !goalForm.outcome.trim()}>Zapisz Cel</Button></div></form></Modal>
    <Modal open={Boolean(blockActionId)} closeDisabled={dialogSaving} title="Co blokuje Działanie?" onClose={() => setBlockActionId(undefined)}><textarea aria-label="Powód blokady" rows={3} value={blocker} onChange={(event) => blockerDraft.setValue({ content: event.target.value })} />{dialogError ? <p className="auth-message error" role="alert">{dialogError}</p> : null}<div className="modal-actions"><DraftStatus status={blockerDraft.status} errorMessage={blockerDraft.errorMessage} onRetry={() => void blockerDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(blocker)} />{blockerDraft.dirty ? <Button type="button" variant="ghost" onClick={blockerDraft.discard}>Odrzuć szkic</Button> : null}<Button disabled={dialogSaving} onClick={() => setBlockActionId(undefined)}>Anuluj</Button><Button variant="primary" loading={dialogSaving} disabled={!blocker.trim()} onClick={() => blockActionId && void runDialog(() => setActionStatus(blockActionId, "blocked", blocker), () => { blockerDraft.clear(); setBlockActionId(undefined); })}>Zapisz blokadę</Button></div></Modal>
    <Modal open={Boolean(editAction)} closeDisabled={dialogSaving} title="Edytuj Działanie" onClose={() => setEditAction(undefined)}>{editAction ? <>
      <label className="field-label" htmlFor="edit-action-name">Nazwa</label><input id="edit-action-name" value={editActionDraft.value.title} onChange={(event) => editActionDraft.setValue((current) => ({ ...current, title: event.target.value }))} />
      <label className="field-label" htmlFor="edit-action-detail">Opis</label><textarea id="edit-action-detail" value={editActionDraft.value.detail} onChange={(event) => editActionDraft.setValue((current) => ({ ...current, detail: event.target.value }))} />
      <label className="field-label" htmlFor="edit-action-date">Termin</label><input id="edit-action-date" type="date" value={editActionDraft.value.scheduledFor} onChange={(event) => editActionDraft.setValue((current) => ({ ...current, scheduledFor: event.target.value }))} />
      <span className="field-label">Checklista</span><div className="checklist-editor">{editAction.checklist.map((entry) => <div key={entry.id}><input aria-label="Nazwa punktu checklisty" value={entry.title} onChange={(event) => setEditAction((current) => current ? { ...current, checklist: current.checklist.map((candidate) => candidate.id === entry.id ? { ...candidate, title: event.target.value } : candidate) } : current)} /><Button type="button" variant="ghost" aria-label={`Usuń punkt: ${entry.title || "bez nazwy"}`} onClick={() => setEditAction((current) => current ? { ...current, checklist: current.checklist.filter((candidate) => candidate.id !== entry.id) } : current)}>×</Button></div>)}</div>
      <Button type="button" variant="ghost" onClick={() => setEditAction((current) => current ? { ...current, checklist: [...current.checklist, { id: crypto.randomUUID(), title: "", completed: false }] } : current)}><Plus />Dodaj punkt</Button>
      {dialogError ? <p className="auth-message error" role="alert">{dialogError}</p> : null}<div className="modal-actions"><DraftStatus status={editActionDraft.status} errorMessage={editActionDraft.errorMessage} onRetry={() => void editActionDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${editActionDraft.value.title}\n${editActionDraft.value.detail}`)} />{editActionDraft.dirty ? <Button type="button" variant="ghost" onClick={editActionDraft.discard}>Odrzuć szkic</Button> : null}<Button disabled={dialogSaving} onClick={() => setEditAction(undefined)}>Anuluj</Button><Button variant="primary" loading={dialogSaving} disabled={!editActionDraft.value.title.trim()} onClick={() => void runDialog(() => updateAction(editAction.id, { title: editActionDraft.value.title, detail: editActionDraft.value.detail, scheduledFor: editActionDraft.value.scheduledFor || null, checklist: editAction.checklist.map((entry) => ({ ...entry, title: entry.title.trim() })).filter((entry) => entry.title) }), () => { editActionDraft.clear(); setEditAction(undefined); })}>Zapisz zmiany</Button></div>
    </> : null}</Modal>
    <Modal open={Boolean(pendingGoalStatus)} closeDisabled={goalStatusSaving} title={pendingGoalStatus === "achieved" ? "Potwierdź osiągnięcie Celu" : "Porzuć Cel"} onClose={() => setPendingGoalStatus(undefined)}>{pendingGoalStatus === "achieved" ? <><p>Kryteria: {criteria.filter((item) => item.completed).length}/{criteria.length}. Otwarte Działania: {actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status)).length}.</p><p className="muted-copy">Potwierdź tylko wtedy, gdy rezultat jest faktycznie osiągnięty.</p></> : <><label className="field-label" htmlFor="goal-abandon-reason">Powód porzucenia</label><textarea id="goal-abandon-reason" rows={3} value={statusReason} onChange={(event) => statusReasonDraft.setValue({ content: event.target.value })} required /></>}{goalStatusError ? <p className="auth-message error" role="alert">{goalStatusError}</p> : null}<div className="modal-actions"><DraftStatus status={statusReasonDraft.status} errorMessage={statusReasonDraft.errorMessage} onRetry={() => void statusReasonDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(statusReason)} />{statusReasonDraft.dirty ? <Button type="button" variant="ghost" onClick={statusReasonDraft.discard}>Odrzuć szkic</Button> : null}<Button disabled={goalStatusSaving} onClick={() => setPendingGoalStatus(undefined)}>Anuluj</Button><Button variant={pendingGoalStatus === "abandoned" ? "danger" : "primary"} loading={goalStatusSaving} disabled={pendingGoalStatus === "abandoned" && !statusReason.trim()} onClick={() => { if (!pendingGoalStatus) return; void changeGoalStatus(pendingGoalStatus, statusReason); }}>{pendingGoalStatus === "achieved" ? "Potwierdź osiągnięcie" : "Porzuć Cel"}</Button></div></Modal>
    <AlertDialog open={trashOpen} title="Przenieść Cel do Kosza?" objectName={goal.title} consequence="Cel zniknie z aktywnych widoków i trafi do sekcji odzyskiwania." preserved="Działania, kryteria, Wiedza i historia postępu pozostaną zachowane." recovery="Cel można przywrócić z Kosza albo natychmiast użyć akcji Cofnij." confirmLabel="Przenieś do Kosza" loading={visibilitySaving} error={visibilityError} onCancel={() => setTrashOpen(false)} onConfirm={() => changeGoalVisibility("trashed")} />
    <ActionResultDialog action={state.actions.find((candidate) => candidate.id === resultActionId)} open={Boolean(resultActionId)} onClose={() => setResultActionId(undefined)} />
  </AppShell>;
}
