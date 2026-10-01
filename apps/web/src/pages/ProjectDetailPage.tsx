import { ProjectCategoryPicker } from "../components/ProjectCategoryPicker";
import { ProjectPresetPicker } from "../components/ProjectPresetPicker";
import { MultiCombobox } from "../components/MultiCombobox";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, Beaker, BookMarked, BookOpen, CalendarDays, Check, ChevronDown, Circle, CircleCheck, CircleX, Clock3, FileText, Filter, Flag, FolderKanban, History, Lightbulb, ListChecks, LoaderCircle, MoreHorizontal, Pencil, RotateCcw, ShieldAlert, SkipForward, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { actionStatusLabels, goalStatusLabels, knowledgeDefaultRelationMeaning, knowledgeKindLabels, polishCount, readingStatusLabels } from "../domain/labels";
import { knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { routeForEntity } from "../domain/routes";
import { compactTabsVariants, entityCardVariants } from "../components/ui-variants";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { useActionFeedback } from "../components/action-feedback-context";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import { projectProjection, projectSignal } from "../domain/projectModule";
import { normalizeProjectPreset, projectPresets } from "../domain/projectPresets";
import type { KnowledgeItem, ProjectPreset, ReadingStatus } from "../domain/types";
import { FormTransition } from "../components/FormTransition";
import { KnowledgeKindPicker } from "../components/KnowledgeKindPicker";
import { normalizeHttpUrl } from "../domain/http-url";
import { ActionStatusDialog, type ProjectActionStatus } from "../components/ActionStatusControls";
import { isActionInTodayProjection, localDateForTimeZone } from "../domain/activity";
import { describeActionSchedule, resolveRoutineTitle } from "../domain/actionPresentation";
import { useProjectKnowledgeItems } from "../hooks/useProjectKnowledgeItems";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { KnowledgeNoteFields } from "../components/KnowledgeNoteFields";
import { DraftStatus } from "../components/DraftStatus";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { prepareKnowledgeNote } from "../domain/knowledgeNote";

type ProjectNoteDraft = { content: string; title: string; projectId: string; goalIds: string[]; idempotencyKey: string };

type ProjectView = "overview" | "goals" | "actions" | "knowledge";
type ProjectHistoryFilter = "current" | "history";
type ProjectActionFilter = "open" | ProjectActionStatus | "today" | "overdue" | "unscheduled" | "history";

const projectActionFilterLabels: Record<ProjectActionFilter, string> = {
  open: "Otwarte",
  ready: actionStatusLabels.ready,
  in_progress: actionStatusLabels.in_progress,
  testing: actionStatusLabels.testing,
  blocked: actionStatusLabels.blocked,
  completed: actionStatusLabels.completed,
  skipped: actionStatusLabels.skipped,
  cancelled: actionStatusLabels.cancelled,
  today: "Na dziś",
  overdue: "Zaległe",
  unscheduled: "Bez terminu",
  history: "Historia"
};

const projectActionStatusIcons = {
  ready: Circle,
  in_progress: LoaderCircle,
  testing: Beaker,
  blocked: ShieldAlert,
  completed: CircleCheck,
  skipped: SkipForward,
  cancelled: CircleX
} satisfies Record<ProjectActionStatus, typeof Circle>;

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, createGoal, createAction, createKnowledge, linkKnowledge, updateArea, setAreaVisibility, setActionStatus } = useStore();
  const mutation = useKeyedMutation();
  const { notifyUndo } = useActionFeedback();
  const project = projectProjection(state, projectId ?? "");
  const projectKnowledgeQuery = useProjectKnowledgeItems(projectId ?? "");
  const existingBooksQuery = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { resourceFormat: "book" });
  const signal = project ? projectSignal(state, project.id) : undefined;
  const [dialog, setDialog] = useState<"goal" | "action" | "knowledge" | "existing-book" | "edit" | "archive" | "trash">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [goalForm, setGoalForm] = useState({ title: "", outcome: "", firstAction: "" });
  const [actionForm, setActionForm] = useState({ title: "", detail: "", goalId: "", scheduledFor: "" });
  const [knowledgeForm, setKnowledgeForm] = useState({ kind: "note" as CreatableKnowledgeKind, title: "", detail: "", sourceUrl: "", isBook: false, resourceAuthor: "", readingStatus: "to_read" as ReadingStatus });
  const projectNoteInitial = useMemo<ProjectNoteDraft>(() => ({ content: "", title: "", projectId: projectId ?? "", goalIds: [], idempotencyKey: crypto.randomUUID() }), [projectId]);
  const projectNoteDraft = usePersistentDraft<ProjectNoteDraft>("project-knowledge-note", projectNoteInitial, 450, { targetId: projectId ?? "missing" });
  const closeKnowledgeForm = () => { if (projectNoteDraft.flush()) setDialog(undefined); };
  const [projectForm, setProjectForm] = useState({ name: project?.name ?? "", description: project?.description ?? "", categoryIds: project?.categoryIds ?? [], preset: normalizeProjectPreset(project?.preset) as ProjectPreset });
  const [statusActionId, setStatusActionId] = useState<string>();
  const preset = normalizeProjectPreset(project?.preset);
  const defaultView = projectPresets[preset].defaultView;
  const requestedView = searchParams.get("view");
  const view: ProjectView = requestedView && ["overview", "goals", "actions", "knowledge"].includes(requestedView) ? requestedView as ProjectView : defaultView;
  const goalFilter: ProjectHistoryFilter = searchParams.get("goals") === "history" ? "history" : "current";
  const requestedActionFilter = searchParams.get("actions");
  const actionFilter: ProjectActionFilter = requestedActionFilter && Object.hasOwn(projectActionFilterLabels, requestedActionFilter) ? requestedActionFilter as ProjectActionFilter : "open";
  const readingStatusValue = searchParams.get("readingStatus");
  const readingStatusFilter = (["to_read", "reading", "read", "paused", "abandoned"] as string[]).includes(readingStatusValue ?? "") ? readingStatusValue as ReadingStatus : undefined;
  useEffect(() => {
    if (readingStatusValue && !readingStatusFilter) { const next = new URLSearchParams(searchParams); next.delete("readingStatus"); setSearchParams(next, { replace: true }); }
  }, [readingStatusFilter, readingStatusValue, searchParams, setSearchParams]);
  const updateProjectParam = (key: "view" | "goals" | "actions" | "readingStatus", value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setView = (next: ProjectView) => updateProjectParam("view", next, defaultView);
  const setGoalFilter = (next: ProjectHistoryFilter) => updateProjectParam("goals", next, "current");
  const setActionFilter = (next: ProjectActionFilter) => updateProjectParam("actions", next, "open");

  const goals = useMemo(() => state.goals.filter((goal) => goal.areaId === projectId && goal.visibility === "active"), [projectId, state.goals]);
  const goalIds = useMemo(() => new Set(goals.map((goal) => goal.id)), [goals]);
  const actions = useMemo(() => state.actions.filter((action) => action.areaId === projectId || Boolean(action.goalId && goalIds.has(action.goalId))), [goalIds, projectId, state.actions]);
  const knowledge = projectKnowledgeQuery.items;
  const displayedKnowledge = readingStatusFilter ? knowledge.filter((item) => item.resourceFormat === "book" && item.readingStatus === readingStatusFilter) : knowledge;
  const openActions = actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status));
  const historicalActions = actions.filter((action) => ["completed", "cancelled", "skipped"].includes(action.status));
  const today = localDateForTimeZone(new Date(), state.workspaceTimezone);
  const statusActionFilterOptions = [
    { value: "open" as const, label: projectActionFilterLabels.open, count: openActions.length, icon: <ListChecks /> },
    { value: "ready" as const, label: projectActionFilterLabels.ready, count: actions.filter((action) => action.status === "ready").length, icon: <Circle /> },
    { value: "in_progress" as const, label: projectActionFilterLabels.in_progress, count: actions.filter((action) => action.status === "in_progress").length, icon: <LoaderCircle /> },
    { value: "testing" as const, label: projectActionFilterLabels.testing, count: actions.filter((action) => action.status === "testing").length, icon: <Beaker /> },
    { value: "blocked" as const, label: projectActionFilterLabels.blocked, count: actions.filter((action) => action.status === "blocked").length, icon: <ShieldAlert /> },
    { value: "completed" as const, label: projectActionFilterLabels.completed, count: actions.filter((action) => action.status === "completed").length, icon: <CircleCheck /> },
    { value: "skipped" as const, label: projectActionFilterLabels.skipped, count: actions.filter((action) => action.status === "skipped").length, icon: <SkipForward /> },
    { value: "cancelled" as const, label: projectActionFilterLabels.cancelled, count: actions.filter((action) => action.status === "cancelled").length, icon: <CircleX /> }
  ];
  const scheduleActionFilterOptions = [
    { value: "today" as const, label: projectActionFilterLabels.today, count: openActions.filter((action) => isActionInTodayProjection(action, today)).length, icon: <CalendarDays /> },
    { value: "overdue" as const, label: projectActionFilterLabels.overdue, count: openActions.filter((action) => Boolean(action.scheduledFor && action.scheduledFor < today)).length, icon: <Clock3 /> },
    { value: "unscheduled" as const, label: projectActionFilterLabels.unscheduled, count: openActions.filter((action) => !action.scheduledFor).length, icon: <CalendarDays /> }
  ];
  const currentGoals = goals.filter((goal) => !["achieved", "abandoned"].includes(goal.status));
  const historicalGoals = goals.filter((goal) => ["achieved", "abandoned"].includes(goal.status));
  const displayedGoals = goalFilter === "current" ? currentGoals : historicalGoals;
  const displayedActions = actionFilter === "history" ? historicalActions : actions.filter((action) => {
    if (["ready", "in_progress", "testing", "blocked", "completed", "skipped", "cancelled"].includes(actionFilter)) return action.status === actionFilter;
    if (actionFilter === "today") return isActionInTodayProjection(action, today);
    if (actionFilter === "overdue") return openActions.includes(action) && Boolean(action.scheduledFor && action.scheduledFor < today);
    if (actionFilter === "unscheduled") return openActions.includes(action) && !action.scheduledFor;
    return openActions.includes(action);
  });
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const insights = knowledge.filter((item) => item.type === "artifact" || item.type === "decision");
  const activeGoalsLabel = activeGoals.length === 1 ? "1 aktywny" : `${activeGoals.length} aktywne`;
  const insightsLabel = insights.length === 1 ? "1 wynik lub wniosek" : `${insights.length} wyniki / wnioski`;

  if (!project) return <AppShell><EmptyState icon={<FolderKanban />} title="Nie znaleziono Projektu" detail="Ten Projekt nie istnieje albo nie jest już dostępny." action={<Button onClick={() => navigate("/projects")}>Wróć do Projektów</Button>} /></AppShell>;
  const projectQuery = searchParams.toString();
  const projectUrl = `/projects/${encodeURIComponent(project.id)}${projectQuery ? `?${projectQuery}` : ""}`;
  const projectBreadcrumbs: NavigationBreadcrumb[] = breadcrumbsForPage(location.state, [{ label: "Projekty", to: "/projects" }], { label: project.name, to: projectUrl });
  const projectNavigation = { breadcrumbs: projectBreadcrumbs, returnTo: locationAddress(location), returnLabel: `Projekt: ${project.name}` };
  const availableBooks = [...new Map([...(existingBooksQuery.data?.items ?? []), ...state.knowledge]
    .filter((item) => item.resourceFormat === "book" && !item.archivedAt && !item.trashedAt && !knowledge.some((linked) => linked.id === item.id))
    .map((item) => [item.id, item])).values()];

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
    const isNote = knowledgeForm.kind === "note";
    if (isNote ? !projectNoteDraft.value.content.trim() : !knowledgeForm.title.trim() || (knowledgeKindGuidance[knowledgeForm.kind].detailRequired && !knowledgeForm.detail.trim())) return;
    const resourceFormat = knowledgeForm.kind === "resource" && knowledgeForm.isBook ? "book" : undefined;
    void run(async () => {
      const note = isNote ? prepareKnowledgeNote(projectNoteDraft.value.content, projectNoteDraft.value.title) : undefined;
      await createKnowledge({ kind: knowledgeForm.kind, title: note?.title ?? knowledgeForm.title, detail: note?.detail ?? knowledgeForm.detail, sourceUrl: knowledgeForm.kind === "resource" ? normalizeHttpUrl(knowledgeForm.sourceUrl) : undefined, resourceFormat, resourceAuthor: resourceFormat ? knowledgeForm.resourceAuthor : undefined, readingStatus: resourceFormat ? knowledgeForm.readingStatus : undefined, relations: note ? [...(projectNoteDraft.value.projectId ? [{ meaning: "reference" as const, target: { areaId: projectNoteDraft.value.projectId } }] : []), ...projectNoteDraft.value.goalIds.map((goalId) => ({ meaning: "reference" as const, target: { goalId } }))] : [{ meaning: knowledgeDefaultRelationMeaning(knowledgeForm.kind), target: { areaId: project.id } }], ...(note ? { idempotencyKey: projectNoteDraft.value.idempotencyKey } : {}) });
      if (note && !projectNoteDraft.clear({ content: "", title: "", projectId: project.id, goalIds: [], idempotencyKey: crypto.randomUUID() })) throw new Error("Notatka została zapisana, ale jej szkic pozostał na tym urządzeniu. Ponów zapis szkicu lub skopiuj treść.");
    }, () => setKnowledgeForm({ kind: "note", title: "", detail: "", sourceUrl: "", isBook: false, resourceAuthor: "", readingStatus: "to_read" }));
  };
  const linkExistingBook = (item: KnowledgeItem) => void run(() => linkKnowledge(item.id, { areaId: project.id }, "material"), () => undefined);
  const closeStatusEditor = () => setStatusActionId(undefined);
  const openStatusEditor = (action: typeof actions[number]) => setStatusActionId(action.id);
  const changeActionStatus = async (action: typeof actions[number], status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => {
    const previous = { status: action.status, blocker: action.blocker, reviewOn: action.reviewOn };
    return mutation.run(`project-action-status:${action.id}`, async () => {
      await setActionStatus(action.id, status, blocker, action.version, reviewOn);
      notifyUndo({ message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker, action.version + 1, previous.reviewOn ?? null) });
    });
  };
  const openProjectEditor = () => { setProjectForm({ name: project.name, description: project.description ?? "", categoryIds: project.categoryIds ?? [], preset: normalizeProjectPreset(project.preset) }); setDialog("edit"); };
  const closeProjectMenu = (target: HTMLElement) => target.closest("details")?.removeAttribute("open");
  const openBookForm = () => { setKnowledgeForm((current) => ({ ...current, kind: "resource", isBook: true, readingStatus: "to_read" })); setDialog("knowledge"); };
  const changeKnowledgeKind = (kind: CreatableKnowledgeKind) => {
    if (knowledgeForm.kind === "note" && !projectNoteDraft.flush()) { setError("Nie udało się zapisać szkicu na tym urządzeniu. Skopiuj treść albo ponów zapis szkicu przed zmianą rodzaju."); return; }
    setError("");
    setKnowledgeForm((current) => ({ ...current, kind, isBook: kind === "resource" ? current.isBook : false }));
  };

  const visibleSections = view === "overview" ? [] : [view];
  const selectedProjectCategories = (state.projectCategories ?? []).filter((category) => project.categoryIds?.includes(category.id));
  const orderedViews = projectPresets[preset].sectionOrder;
  const addAction = view === "goals"
    ? { label: "Nowy Cel", shortLabel: "Cel", ariaLabel: `Dodaj Cel do Projektu ${project.name}`, active: dialog === "goal", quickAdd: { mode: "goal" as const, areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-goals` }, onClick: () => setDialog("goal" as const) }
    : view === "actions"
      ? { label: "Nowe Działanie", shortLabel: "Działanie", ariaLabel: `Dodaj Działanie do Projektu ${project.name}`, active: dialog === "action", quickAdd: { mode: "action" as const, areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-actions` }, onClick: () => setDialog("action" as const) }
      : view === "knowledge"
        ? preset === "reading"
          ? { label: "Dodaj książkę", shortLabel: "Książka", ariaLabel: `Dodaj książkę do Projektu ${project.name}`, active: dialog === "knowledge", onClick: openBookForm }
          : { label: "Nowa Wiedza", shortLabel: "Wiedza", ariaLabel: `Dodaj Wiedzę do Projektu ${project.name}`, active: dialog === "knowledge", quickAdd: { mode: "library" as const, areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-knowledge` }, onClick: () => setDialog("knowledge" as const) }
        : preset === "reading"
          ? { label: projectPresets[preset].mainActionLabel, shortLabel: "Książka", ariaLabel: `${projectPresets[preset].mainActionLabel} w ${project.name}`, active: dialog === "knowledge", onClick: openBookForm }
          : { label: projectPresets[preset].mainActionLabel, shortLabel: "Dodaj", ariaLabel: `Dodaj w Projekcie ${project.name}`, active: false, quickAdd: { areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-overview` } };
  return <AppShell addAction={addAction}>
    <ContextNavigation current={{ label: project.name, to: projectUrl }} fallbackBreadcrumbs={[{ label: "Projekty", to: "/projects" }]} fallbackReturnTo="/projects" fallbackReturnLabel="Wszystkie Projekty" showBack />
    <div className="project-detail-head persistent-project-head">
      <div><div className="project-title-row"><span className="project-avatar large violet">{project.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><h1>{project.name}</h1><span className="project-title-categories">{selectedProjectCategories.length ? selectedProjectCategories.map((category, index) => <span key={category.id} className="project-category-chip"><span style={{ backgroundColor: category.color }} />{category.name}{index === selectedProjectCategories.length - 1 ? <Button variant="ghost" className="project-title-category-edit" onClick={openProjectEditor} aria-label="Zmień kategorie projektu" title="Zmień kategorie"><Pencil /></Button> : null}</span>) : <span className="meta-label">Projekt</span>}</span></span></div><p>{project.description || "Wspólny kontekst dla Celów, Działań i Wiedzy."}</p></div>
      <details className="project-more-menu project-management-menu"><summary aria-label={`Opcje Projektu: ${project.name}`} aria-haspopup="menu" title="Opcje Projektu"><MoreHorizontal /><span className="sr-only">Opcje Projektu</span></summary><div role="menu" aria-label={`Zarządzaj Projektem: ${project.name}`}><span className="project-menu-label">Zarządzaj Projektem</span><Button role="menuitem" aria-label="Edytuj informacje" onClick={(event) => { closeProjectMenu(event.currentTarget); openProjectEditor(); }}><Pencil />Edytuj informacje</Button><div className="project-menu-separator" /><Button role="menuitem" aria-label="Archiwizuj Projekt" variant="ghost" onClick={(event) => { closeProjectMenu(event.currentTarget); setDialog("archive"); }}><Archive />Archiwizuj Projekt</Button><Button role="menuitem" aria-label="Przenieś do Kosza" variant="ghost" className="project-menu-danger" onClick={(event) => { closeProjectMenu(event.currentTarget); setDialog("trash"); }}><Trash2 />Przenieś do Kosza</Button></div></details>
    </div>
    <div className={`project-tabs ${compactTabsVariants()}`} role="tablist" aria-label="Zawartość Projektu">
      {orderedViews.map((value) => <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)}>{value === "overview" ? "Przegląd" : value === "goals" ? "Cele" : value === "actions" ? "Działania" : "Wiedza"}</button>)}
    </div>

    {view === "overview" ? <>
      <section className="project-overview" aria-labelledby="project-overview-title">
        <div className="project-overview-heading"><span className="eyebrow">Podsumowanie</span><h2 id="project-overview-title">Co jest teraz najważniejsze</h2><p>Pełne listy znajdziesz w kartach powyżej. Tutaj wystarczy jeden rzut oka.</p></div>
        {signal ? <Panel className={`project-now-card project-now-card-${signal.kind}`} data-navigation-card-id="project-now-card" tabIndex={-1}>
          <span className="project-now-icon"><ListChecks /></span>
          <div><span className="eyebrow">Najbliższy ruch · {signal.label}</span><h3>{signal.title}</h3><p>{signal.description}</p></div>
          {signal.actionId ? <NavigationLink className="button button-primary" to={routeForEntity({ type: "action", id: signal.actionId })} breadcrumbs={projectBreadcrumbs} returnTo={projectUrl} returnLabel={`Projekt: ${project.name}`} sourceCardId="project-now-card" aria-label={`Otwórz Działanie: ${signal.title}`}>Otwórz Działanie <ArrowRight /></NavigationLink>
            : currentGoals.length ? <Button variant="primary" onClick={() => setDialog("action")}>Dodaj Działanie <ArrowRight /></Button>
              : <Button variant="primary" onClick={() => setView(preset === "reading" ? "knowledge" : "goals")}>{preset === "reading" ? "Otwórz Wiedzę" : "Przejdź do Celów"} <ArrowRight /></Button>}
        </Panel> : <Panel className="project-now-card project-now-card-inactive"><span className="project-now-icon"><ListChecks /></span><div><span className="eyebrow">Projekt poza aktywną przestrzenią</span><h3>{project.visibility === "archived" ? "Projekt w Archiwum" : "Projekt w Koszu"}</h3><p>Jego Działania pozostają zachowane w tym kontekście.</p></div><Button variant="primary" onClick={() => setView("actions")}>Pokaż Działania <ArrowRight /></Button></Panel>}
        <div className="project-overview-cards">
          <button type="button" className="project-overview-card" onClick={() => setView("goals")} aria-label={`Otwórz Cele — ${currentGoals.length} ${currentGoals.length === 1 ? "bieżący" : "bieżących"}`}><span className="project-overview-card-icon"><Flag /></span><span className="project-overview-card-copy"><small>Cele</small><strong>{currentGoals.length}</strong><span>{currentGoals[0]?.title ?? (historicalGoals.length ? `${historicalGoals.length} w historii` : preset === "reading" ? "Opcjonalnie dodaj Cel" : "Ustal pierwszy rezultat")}</span></span><ArrowRight /></button>
          <button type="button" className="project-overview-card" onClick={() => setView("actions")} aria-label={`Otwórz Działania — ${openActions.length} ${openActions.length === 1 ? "otwarte" : "otwartych"}`}><span className="project-overview-card-icon"><ListChecks /></span><span className="project-overview-card-copy"><small>Działania</small><strong>{openActions.length}</strong><span>{signal?.actionId ? signal.title : historicalActions.length ? `${historicalActions.length} w historii` : "Brak otwartych kroków"}</span></span><ArrowRight /></button>
          <button type="button" className="project-overview-card" onClick={() => setView("knowledge")} aria-label={`Otwórz Wiedzę — ${polishCount(knowledge.length, "element", "elementy", "elementów")}`}><span className="project-overview-card-icon"><BookOpen /></span><span className="project-overview-card-copy"><small>Wiedza</small><strong>{knowledge.length}</strong><span>{knowledge[0]?.title ?? "Zachowaj pierwszy materiał lub wniosek"}</span></span><ArrowRight /></button>
        </div>
      </section>
      <details className="project-flow-guide"><summary><span className="project-flow-guide-label"><span><Lightbulb /></span><span><strong>Pętla pracy — wskazówka</strong><small>Jak przejść od kierunku Projektu do zachowanej Wiedzy</small></span></span><span className="project-flow-guide-action">Pokaż <ChevronDown /></span></summary><section className="project-flow" aria-labelledby="project-flow-title"><div className="project-flow-heading"><div><span className="eyebrow">Pętla pracy</span><h2 id="project-flow-title">Od kierunku do wiedzy</h2></div><p>Każdy krok zostawia kontekst, który można wykorzystać ponownie.</p></div><div className="project-flow-steps"><div><span>1</span><small>Projekt</small><strong>{project.name}</strong><p>Kierunek i wspólny kontekst</p></div><ArrowRight /><button type="button" onClick={() => setView("goals")}><span>2</span><small>Cele</small><strong>{activeGoals.length ? activeGoalsLabel : "Ustal rezultat"}</strong><p>Po czym poznasz sukces</p></button><ArrowRight /><button type="button" onClick={() => setView("actions")}><span>3</span><small>Działanie</small><strong>{signal?.actionId ? signal.title : "Wybierz następny krok"}</strong><p>Co konkretnie robisz teraz</p></button><ArrowRight /><button type="button" onClick={() => setView("knowledge")}><span>4</span><small>Rezultat / wiedza</small><strong>{insights.length ? insightsLabel : "Zapisz rezultat"}</strong><p>Co zostaje na przyszłość</p></button></div></section></details>
    </> : null}

    <div className="project-sections">
      {visibleSections.includes("goals") ? <section aria-labelledby="project-goals-title"><div className="section-heading project-section-heading"><div><h2 id="project-goals-title">Cele</h2><span>{goalFilter === "current" ? "Bieżące rezultaty do wykonania w tym Projekcie" : "Osiągnięte i porzucone Cele"}</span></div>{goalFilter === "current" && historicalGoals.length ? <div className="project-section-actions project-section-actions-single"><details className="project-more-menu project-section-more-menu"><summary aria-label="Więcej opcji Celów" title="Więcej opcji Celów"><MoreHorizontal /><span className="sr-only">Więcej opcji Celów</span></summary><div><Button onClick={(event) => { closeProjectMenu(event.currentTarget); setGoalFilter("history"); }}><History />Pokaż historię <span className="project-menu-count">{historicalGoals.length}</span></Button></div></details></div> : null}</div>
        {goalFilter === "history" ? <div className="project-history-banner"><span><History /><span><strong>Historia Celów</strong><small>{historicalGoals.length} {historicalGoals.length === 1 ? "zapisany Cel" : "zapisanych Celów"}</small></span></span><Button variant="ghost" onClick={() => setGoalFilter("current")}><RotateCcw />Bieżące</Button></div> : null}
        {displayedGoals.length ? <div className="project-entity-list">{displayedGoals.map((goal) => <Panel className={`${entityCardVariants({ density: "compact" })} entity-card`} key={goal.id} data-navigation-card-id={navigationCardId("goal", goal.id)} tabIndex={-1}><Flag /><span><strong className="line-clamp-2">{goal.title}</strong><small className="line-clamp-2">{goal.outcome}</small></span><Badge>{goalStatusLabels[goal.status]}</Badge><NavigationLink className="button button-ghost entity-card-open" to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={projectBreadcrumbs} returnTo={projectNavigation.returnTo} returnLabel={projectNavigation.returnLabel} sourceCardId={navigationCardId("goal", goal.id)} aria-label={`Otwórz Cel: ${goal.title}`}><ArrowRight /></NavigationLink></Panel>)}</div> : <EmptyState icon={goalFilter === "history" ? <History /> : <Flag />} title={goalFilter === "history" ? "Historia Celów jest pusta" : "Brak bieżących Celów"} detail={goalFilter === "history" ? "Osiągnięte i porzucone Cele pojawią się tutaj." : historicalGoals.length ? "Zakończone Cele są zachowane w historii." : "Użyj przycisku Dodaj na dole, aby dodać pierwszy rezultat w tym Projekcie."} action={goalFilter === "current" && historicalGoals.length ? <Button onClick={() => setGoalFilter("history")}><History />Pokaż historię</Button> : undefined} />}
      </section> : null}

      {visibleSections.includes("actions") ? <section aria-labelledby="project-actions-title"><div className="section-heading project-section-heading"><div><h2 id="project-actions-title">Działania</h2><span>{actionFilter === "open" ? "Otwarte kroki — z Celu albo bezpośrednio z Projektu" : `Wybrano: ${projectActionFilterLabels[actionFilter]}`}</span></div><div className="project-section-actions project-section-actions-single"><details className={`project-more-menu project-section-more-menu project-filter-menu${actionFilter !== "open" ? " is-filtered" : ""}`}><summary aria-label={`Filtruj Działania. Wybrano: ${projectActionFilterLabels[actionFilter]}`} aria-haspopup="menu" title="Filtruj Działania"><Filter /><span className="sr-only">Filtruj Działania</span></summary><div role="menu" aria-label="Filtry Działań">
        <span className="project-menu-label">Status</span>
        {statusActionFilterOptions.map((option) => <Button key={option.value} role="menuitemradio" variant="ghost" className={actionFilter === option.value ? "is-active" : ""} aria-label={`${option.label}: ${option.count}`} aria-checked={actionFilter === option.value} onClick={(event) => { closeProjectMenu(event.currentTarget); setActionFilter(option.value); }}><span className="project-menu-option-icon">{actionFilter === option.value ? <Check /> : option.icon}</span>{option.label}<span className="project-menu-count">{option.count}</span></Button>)}
        <div className="project-menu-separator" />
        <span className="project-menu-label">Termin</span>
        {scheduleActionFilterOptions.map((option) => <Button key={option.value} role="menuitemradio" variant="ghost" className={actionFilter === option.value ? "is-active" : ""} aria-label={`${option.label}: ${option.count}`} aria-checked={actionFilter === option.value} onClick={(event) => { closeProjectMenu(event.currentTarget); setActionFilter(option.value); }}><span className="project-menu-option-icon">{actionFilter === option.value ? <Check /> : option.icon}</span>{option.label}<span className="project-menu-count">{option.count}</span></Button>)}
        <div className="project-menu-separator" />
        <Button role="menuitemradio" variant="ghost" className={actionFilter === "history" ? "is-active" : ""} aria-label={`${projectActionFilterLabels.history}: ${historicalActions.length}`} aria-checked={actionFilter === "history"} onClick={(event) => { closeProjectMenu(event.currentTarget); setActionFilter("history"); }}><span className="project-menu-option-icon">{actionFilter === "history" ? <Check /> : <History />}</span>{projectActionFilterLabels.history}<span className="project-menu-count">{historicalActions.length}</span></Button>
      </div></details></div></div>
        {actionFilter !== "open" ? <div className="project-history-banner project-filter-banner"><span><Filter /><span><strong>Filtr: {projectActionFilterLabels[actionFilter]}</strong><small>{displayedActions.length} {displayedActions.length === 1 ? "pasujące Działanie" : "pasujących Działań"}</small></span></span><Button variant="ghost" onClick={() => setActionFilter("open")}><RotateCcw />Wszystkie otwarte</Button></div> : null}
        {displayedActions.length ? <div className="project-action-list">{displayedActions.map((action) => {
          const StatusIcon = projectActionStatusIcons[action.status];
          const schedule = describeActionSchedule(action, today, state.workspaceTimezone);
          const routineTitle = resolveRoutineTitle(action, state.recurringActionTemplates);
          const context = action.goalId ? goals.find((goal) => goal.id === action.goalId)?.title ?? "Cel Projektu" : "Działanie Projektu";
          return <Panel className={`project-action-row entity-card ${action.status}`} key={action.id} data-action-id={action.id} data-navigation-card-id={navigationCardId("action", action.id)} tabIndex={-1}>
            <button type="button" className={`project-action-status-button ${action.status}`} disabled={mutation.isBusy(`project-action-status:${action.id}`)} aria-label={`Zmień status: ${actionStatusLabels[action.status]} — ${action.title}`} onClick={() => openStatusEditor(action)}><StatusIcon aria-hidden="true" /><span className="sr-only">{actionStatusLabels[action.status]}</span></button>
            <span className="project-action-copy"><span className="project-action-heading"><strong className="line-clamp-2">{action.title}</strong>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</span><small className={`project-action-meta${action.scheduledFor && action.scheduledFor < today ? " overdue" : ""}`}><span className="project-action-status-label">{actionStatusLabels[action.status]}</span><span aria-hidden="true">·</span><span>{schedule}</span>{routineTitle ? <><span aria-hidden="true">·</span><span>{routineTitle}</span></> : null}<span aria-hidden="true">·</span><span>{context}</span></small>{action.status === "blocked" && action.blocker ? <small className="project-action-blocker"><ShieldAlert aria-hidden="true" />{action.blocker}</small> : null}</span>
            <NavigationLink className="button button-ghost entity-card-open" to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={projectBreadcrumbs} returnTo={projectNavigation.returnTo} returnLabel={projectNavigation.returnLabel} sourceCardId={navigationCardId("action", action.id)} aria-label={`Otwórz Działanie: ${action.title}`}><ArrowRight /></NavigationLink>
          </Panel>;
        })}</div> : <EmptyState icon={actionFilter === "history" ? <History /> : <ListChecks />} title={actionFilter === "history" ? "Historia Działań jest pusta" : actionFilter === "open" ? "Brak otwartych Działań" : `Brak Działań: ${projectActionFilterLabels[actionFilter]}`} detail={actionFilter === "history" ? "Ukończone, pominięte i anulowane Działania pojawią się tutaj." : actionFilter !== "open" ? "Wybierz inny filtr, aby zobaczyć pozostałe Działania Projektu." : historicalActions.length ? "Zakończone Działania są zachowane w historii." : "Użyj przycisku Dodaj na dole, aby dodać pojedynczy krok."} action={actionFilter !== "open" ? <Button onClick={() => setActionFilter("open")}><RotateCcw />Wszystkie otwarte</Button> : historicalActions.length ? <Button onClick={() => setActionFilter("history")}><History />Pokaż historię</Button> : undefined} />}
      </section> : null}

      {visibleSections.includes("knowledge") ? <section aria-labelledby="project-knowledge-title"><div className="section-heading project-section-heading"><div><h2 id="project-knowledge-title">{preset === "reading" ? "Książki i Wiedza" : "Wiedza"}</h2><span>{preset === "reading" ? "Książki oraz powiązane notatki, decyzje i materiały" : "Notatki, materiały i decyzje zachowane przy Projekcie"}</span></div>{preset === "reading" ? <div className="project-section-actions"><Button onClick={openBookForm}><BookMarked />Dodaj książkę</Button><Button variant="secondary" onClick={() => setDialog("existing-book")}><BookOpen />Połącz istniejącą</Button></div> : null}</div>
        {projectKnowledgeQuery.isError ? <p className="inline-mutation-error" role="alert">Nie udało się wczytać Wiedzy Projektu. <button type="button" onClick={() => void projectKnowledgeQuery.refetch()}>Spróbuj ponownie</button></p> : null}
        {preset === "reading" ? <div className="knowledge-kind-filters reading-status-filters" role="group" aria-label="Status czytania"><button type="button" aria-pressed={!readingStatusFilter} onClick={() => updateProjectParam("readingStatus", "all", "all")}>Wszystkie</button>{Object.entries(readingStatusLabels).map(([value, label]) => <button key={value} type="button" aria-pressed={readingStatusFilter === value} onClick={() => updateProjectParam("readingStatus", value, "all")}>{label}</button>)}</div> : null}
        {displayedKnowledge.length ? <div className="project-entity-list">{displayedKnowledge.map((item) => <Panel className="entity-card" key={item.id} data-navigation-card-id={navigationCardId("knowledge", item.id)} tabIndex={-1}>{item.resourceFormat === "book" ? <BookMarked /> : <FileText />}<span><strong className="line-clamp-2">{item.title}</strong><small className="line-clamp-2">{item.resourceFormat === "book" ? [item.resourceAuthor, item.readingStatus ? readingStatusLabels[item.readingStatus] : undefined].filter(Boolean).join(" · ") || item.detail || "Książka" : item.detail || knowledgeKindLabels[item.type]}</small></span><Badge>{item.resourceFormat === "book" ? "Książka" : knowledgeKindLabels[item.type]}</Badge><NavigationLink className="button button-ghost entity-card-open" to={routeForEntity({ type: "knowledge", id: item.id })} breadcrumbs={projectBreadcrumbs} returnTo={projectNavigation.returnTo} returnLabel={projectNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", item.id)} aria-label={`Otwórz Wiedzę: ${item.title}`}><ArrowRight /></NavigationLink></Panel>)}</div> : <EmptyState icon={<BookOpen />} title={readingStatusFilter ? `Brak: ${readingStatusLabels[readingStatusFilter]}` : preset === "reading" ? "Czytelnia jest pusta" : "Brak Wiedzy"} detail={readingStatusFilter ? "Zmień status, aby zobaczyć pozostałe książki." : preset === "reading" ? "Dodaj pierwszą książkę albo połącz ją z Biblioteki." : "Użyj przycisku Dodaj na dole, aby zapisać materiał, decyzję albo notatkę w tym Projekcie."} action={readingStatusFilter ? <Button onClick={() => updateProjectParam("readingStatus", "all", "all")}>Pokaż wszystkie</Button> : preset === "reading" ? <Button onClick={openBookForm}><BookMarked />Dodaj książkę</Button> : undefined} />}
      </section> : null}
    </div>

    <Modal open={dialog === "goal"} title="Nowy Cel w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitGoal}><p className="modal-intro">Cel jest lekkim, konkretnym rezultatem. Szczegóły możesz dopracować później.</p><label className="field-label" htmlFor="project-goal-title">Co chcesz osiągnąć?</label><input id="project-goal-title" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required /><label className="field-label" htmlFor="project-goal-outcome">Po czym poznasz, że jest gotowe? <span className="optional-label">opcjonalnie</span></label><textarea id="project-goal-outcome" rows={2} value={goalForm.outcome} onChange={(event) => setGoalForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="project-goal-action">Pierwsze Działanie <span className="optional-label">opcjonalnie</span></label><input id="project-goal-action" value={goalForm.firstAction} onChange={(event) => setGoalForm((current) => ({ ...current, firstAction: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!goalForm.title.trim()}>Dodaj Cel</Button></div></form></Modal>
    <Modal open={dialog === "action"} className="project-action-create-modal" title="Nowe Działanie w Projekcie" onClose={() => setDialog(undefined)}><form className="project-action-create-form" onSubmit={submitAction}><div className="project-action-context"><FolderKanban /><span><small>Dodajesz do Projektu</small><strong>{project.name}</strong></span></div><label className="field-label" htmlFor="project-action-title">Co trzeba zrobić?</label><input id="project-action-title" placeholder="Krótki, konkretny następny krok" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required /><details className="advanced-options project-action-options"><summary><span><strong>Szczegóły i przypisanie</strong><small>Opis, Cel i termin</small></span><ChevronDown /></summary><div className="project-action-options-content"><label className="field-label" htmlFor="project-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="project-action-detail" rows={2} placeholder="Dodatkowy kontekst, jeśli jest potrzebny" value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /><div className="project-action-options-grid"><div><label className="field-label" htmlFor="project-action-goal">Cel <span className="optional-label">opcjonalnie</span></label><select id="project-action-goal" value={actionForm.goalId} onChange={(event) => setActionForm((current) => ({ ...current, goalId: event.target.value }))}><option value="">Bez Celu</option>{currentGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></div><div><label className="field-label" htmlFor="project-action-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="project-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></div></div></div></details>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!actionForm.title.trim()}>Dodaj Działanie</Button></div></form></Modal>
    <Modal open={dialog === "knowledge"} closeDisabled={saving} className="knowledge-create-modal" title={preset === "reading" && knowledgeForm.isBook ? "Dodaj książkę" : "Nowa Wiedza w Projekcie"} onClose={knowledgeForm.kind === "note" ? closeKnowledgeForm : () => setDialog(undefined)}><form className="knowledge-create-form" noValidate onSubmit={submitKnowledge}><div className="knowledge-create-body" data-modal-scroll-body><KnowledgeKindPicker value={knowledgeForm.kind} name="project-knowledge-kind" onChange={changeKnowledgeKind} /><FormTransition stateKey={knowledgeForm.kind}>{knowledgeForm.kind === "note" ? <KnowledgeNoteFields idPrefix="project-knowledge-note" content={projectNoteDraft.value.content} onContentChange={(content) => projectNoteDraft.setValue((current) => ({ ...current, content }))} title={projectNoteDraft.value.title} onTitleChange={(title) => projectNoteDraft.setValue((current) => ({ ...current, title }))} context={`Projekt · ${project.name}`} disabled={saving}><label className="field-label" htmlFor="project-note-context">Projekt <span className="optional-label">możesz zmienić lub usunąć</span></label><select id="project-note-context" value={projectNoteDraft.value.projectId} onChange={(event) => projectNoteDraft.setValue((current) => ({ ...current, projectId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span><MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={projectNoteDraft.value.goalIds} onChange={(goalIds) => projectNoteDraft.setValue((current) => ({ ...current, goalIds }))} /></KnowledgeNoteFields> : <><label className="field-label" htmlFor="project-new-knowledge-title">{knowledgeKindGuidance[knowledgeForm.kind].titleLabel}</label><input id="project-new-knowledge-title" placeholder={knowledgeKindGuidance[knowledgeForm.kind].titlePlaceholder} value={knowledgeForm.title} onChange={(event) => setKnowledgeForm((current) => ({ ...current, title: event.target.value }))} required />{knowledgeForm.kind === "resource" ? <><label className="field-label" htmlFor="project-new-knowledge-url">Link do źródła <span className="optional-label">opcjonalnie</span></label><input id="project-new-knowledge-url" type="url" value={knowledgeForm.sourceUrl} onChange={(event) => setKnowledgeForm((current) => ({ ...current, sourceUrl: event.target.value }))} /><label className="checkbox-field"><input type="checkbox" checked={knowledgeForm.isBook} onChange={(event) => setKnowledgeForm((current) => ({ ...current, isBook: event.target.checked }))} /><span>To książka</span></label>{knowledgeForm.isBook ? <><label className="field-label" htmlFor="project-book-author">Autor <span className="optional-label">opcjonalnie</span></label><input id="project-book-author" value={knowledgeForm.resourceAuthor} onChange={(event) => setKnowledgeForm((current) => ({ ...current, resourceAuthor: event.target.value }))} /><label className="field-label" htmlFor="project-book-status">Status czytania</label><select id="project-book-status" value={knowledgeForm.readingStatus} onChange={(event) => setKnowledgeForm((current) => ({ ...current, readingStatus: event.target.value as ReadingStatus }))}>{Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></> : null}</> : null}<label className="field-label" htmlFor="project-new-knowledge-detail">{knowledgeKindGuidance[knowledgeForm.kind].detailLabel}{!knowledgeKindGuidance[knowledgeForm.kind].detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label><textarea id="project-new-knowledge-detail" rows={4} required={knowledgeKindGuidance[knowledgeForm.kind].detailRequired} value={knowledgeForm.detail} onChange={(event) => setKnowledgeForm((current) => ({ ...current, detail: event.target.value }))} /></>}{knowledgeForm.kind === "note" ? <DraftStatus status={projectNoteDraft.status} restored={projectNoteDraft.restored} errorMessage={projectNoteDraft.errorMessage} onRetry={() => void projectNoteDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${projectNoteDraft.value.title}\n${projectNoteDraft.value.content}`)} /> : null}{error ? <p className="auth-message error" role="alert">{error}</p> : null}</FormTransition></div><div className="modal-actions">{knowledgeForm.kind === "note" && projectNoteDraft.dirty ? <Button type="button" variant="ghost" onClick={() => projectNoteDraft.discard()}>Odrzuć szkic</Button> : null}{knowledgeForm.kind === "note" ? <Button type="button" disabled={saving} onClick={closeKnowledgeForm}>Zamknij</Button> : <Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button>}<Button type="submit" variant="primary" loading={saving} disabled={knowledgeForm.kind === "note" ? !projectNoteDraft.value.content.trim() : !knowledgeForm.title.trim() || (knowledgeKindGuidance[knowledgeForm.kind].detailRequired && !knowledgeForm.detail.trim())}>{knowledgeForm.isBook ? "Dodaj książkę" : knowledgeForm.kind === "note" ? "Zapisz notatkę" : knowledgeKindGuidance[knowledgeForm.kind].saveLabel}</Button></div></form></Modal>
    <Modal open={dialog === "existing-book"} title="Połącz książkę z Biblioteki" onClose={() => setDialog(undefined)}><p className="modal-intro">Książka pozostaje tym samym elementem Wiedzy; Projekt dostaje wspólne powiązanie.</p>{existingBooksQuery.isError ? <p className="auth-message error" role="alert">Nie udało się wczytać książek. <button type="button" onClick={() => void existingBooksQuery.refetch()}>Spróbuj ponownie</button></p> : null}{availableBooks.length ? <div className="project-entity-list">{availableBooks.map((item) => <Panel className="entity-card" key={item.id}><BookMarked /><span><strong>{item.title}</strong><small>{[item.resourceAuthor, item.readingStatus ? readingStatusLabels[item.readingStatus] : undefined].filter(Boolean).join(" · ")}</small></span><Button loading={saving} onClick={() => linkExistingBook(item)}>Połącz</Button></Panel>)}</div> : existingBooksQuery.isError ? null : <EmptyState icon={<BookOpen />} title="Brak dostępnych książek" detail="Dodaj książkę do Biblioteki albo zmień istniejący Materiał na książkę." />}{existingBooksQuery.hasNextPage ? <div className="list-pagination"><Button loading={existingBooksQuery.isFetchingNextPage} onClick={() => void existingBooksQuery.fetchNextPage()}>Załaduj starsze</Button></div> : null}{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button onClick={() => setDialog(undefined)}>Zamknij</Button></div></Modal>
        {(() => { const action = actions.find((candidate) => candidate.id === statusActionId); const key = action ? `project-action-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} busy={Boolean(key && mutation.isBusy(key))} error={key ? mutation.error(key) : undefined} compact onClose={closeStatusEditor} onChange={(status, blocker, reviewOn) => action ? changeActionStatus(action, status, blocker, reviewOn) : false} />; })()}

      <Modal open={dialog === "edit"} closeDisabled={saving} title="Edytuj Projekt" onClose={() => setDialog(undefined)}><form onSubmit={(event) => { event.preventDefault(); void run(() => updateArea(project.id, projectForm), () => undefined); }}><label className="field-label" htmlFor="edit-project-name">Nazwa</label><input id="edit-project-name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} required /><label className="field-label" htmlFor="edit-project-description">Kontekst</label><textarea id="edit-project-description" rows={3} value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} /><ProjectPresetPicker value={projectForm.preset} categories={state.projectCategories ?? []} categoryIds={projectForm.categoryIds} onChange={(preset) => setProjectForm((current) => ({ ...current, preset }))} disabled={saving} /><ProjectCategoryPicker value={projectForm.categoryIds} onChange={(categoryIds) => setProjectForm((current) => ({ ...current, categoryIds }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!projectForm.name.trim()}>Zapisz Projekt</Button></div></form></Modal>
    <Modal open={dialog === "archive"} title="Archiwizować Projekt?" onClose={() => setDialog(undefined)}><p>Projekt <strong>{project.name}</strong> zniknie z bieżących Projektów. Jego zawartość pozostanie zachowana.</p>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button disabled={saving} onClick={() => setDialog(undefined)}>Anuluj</Button><Button loading={saving} onClick={() => void run(() => setAreaVisibility(project.id, "archived"), () => navigate("/projects"))}><Archive />Archiwizuj Projekt</Button></div></Modal>
    <Modal open={dialog === "trash"} title="Przenieść Projekt do Kosza?" onClose={() => setDialog(undefined)}><p>Projekt <strong>{project.name}</strong> zniknie z bieżących Projektów. Będzie można go później przywrócić z Kosza.</p>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button disabled={saving} onClick={() => setDialog(undefined)}>Anuluj</Button><Button variant="danger" loading={saving} onClick={() => void run(() => setAreaVisibility(project.id, "trashed"), () => navigate("/projects"))}><Trash2 />Przenieś do Kosza</Button></div></Modal>
  </AppShell>;
}
