import { GroupedProjectActions } from "../components/GroupedProjectActions";
import { ProjectActionFilterPicker } from "../components/ProjectActionFilterPicker";
import { WorkspaceListRow } from "../components/WorkspaceListRow";
import { ActionListRow } from "../components/ActionListRow";
import { completeActionWithUndo } from "../components/completeActionWithUndo";
import { useAuth } from "../auth/useAuth";
import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { CurrentWeekPlanNotice } from "../components/CurrentWeekPlanNotice";
import { useWorkspaceClock } from "../hooks/useWorkspaceClock";
import { useCurrentWeekPlan } from "../hooks/useCurrentWeekPlan";
import { AIContextExport } from "../components/AIContextExport";
import { readingPositionLabel } from "../domain/readingProgress";
import { ProjectCategoryPicker } from "../components/ProjectCategoryPicker";
import { ProjectPresetPicker } from "../components/ProjectPresetPicker";
import { useEffect, useMemo, useState } from "react";
import { Archive, Beaker, BookMarked, BookOpen, CalendarDays, Circle, CircleCheck, CircleX, Clock3, FileText, Flag, FolderKanban, History, ListChecks, LoaderCircle, MoreHorizontal, Pencil, ShieldAlert, SkipForward, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageActions } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Button, EmptyState, Panel } from "../components/ui";
import { actionStatusLabels, goalStatusLabels, knowledgeKindLabels, readingStatusLabels } from "../domain/labels";
import { compactTabsVariants } from "../components/ui-variants";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { actionStatusFeedbackEvent, useActionFeedback } from "../components/action-feedback-context";
import { ContextNavigation } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import { projectProjection, projectSignal } from "../domain/projectModule";
import { normalizeProjectPreset, projectPresets } from "../domain/projectPresets";
import type { KnowledgeItem, ProjectPreset, ReadingStatus } from "../domain/types";
import { ActionStatusDialog, type ActionStatusTarget, type ProjectActionStatus } from "../components/ActionStatusControls";
import { isActionInTodayProjection, localDateForTimeZone } from "../domain/activity";
import { isActionVisibleInList } from "../domain/actionsList";
import { resolveCompactRoutineTitle } from "../domain/actionPresentation";
import { useProjectKnowledgeItems } from "../hooks/useProjectKnowledgeItems";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { ProjectOverviewActions, ProjectOverviewContext } from "../components/ProjectOverview";
import { useDesktopLayout } from "../hooks/useDesktopLayout";
import { useProjectLayout } from "../hooks/useProjectLayout";
import type { AppShellAddAction } from "../components/AppShell";
import "../components/project-workspace.css";


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

function isProjectActionFilter(value: string | null): value is ProjectActionFilter {
  return value !== null && Object.hasOwn(projectActionFilterLabels, value);
}

function readSavedActionFilter(key: string | undefined): ProjectActionFilter {
  try {
    const value = key ? localStorage.getItem(key) : null;
    if (isProjectActionFilter(value)) return value;
  } catch { /* Storage may be disabled. */ }
  return "open";
}

export function ProjectDetailPage() {
  const desktop = useDesktopLayout();
  const [workspaceRef, hasWorkspaceRoom] = useProjectLayout();
  const wideWorkspace = desktop && hasWorkspaceRoom;
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { state, mode, linkKnowledge, updateArea, setAreaVisibility, setActionStatus, undoActionCompletion } = useStore();
  const mutation = useKeyedMutation();
  const { notifyUndo, notifySuccess } = useActionFeedback();
  const project = projectProjection(state, projectId ?? "");
  const projectKnowledgeQuery = useProjectKnowledgeItems(projectId ?? "");
  const existingBooksQuery = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { resourceFormat: "book" });
  const now = useWorkspaceClock();
  const planRead = useCurrentWeekPlan(now);
  const currentPlan = planRead.plan;
  const signal = project ? projectSignal(state, project.id, now, currentPlan?.snapshot?.plan.selectedGoals.map((goal) => goal.id)) : undefined;
  const [dialog, setDialog] = useState<"existing-book" | "edit" | "archive" | "trash">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projectForm, setProjectForm] = useState({ name: project?.name ?? "", description: project?.description ?? "", categoryIds: project?.categoryIds ?? [], preset: normalizeProjectPreset(project?.preset) as ProjectPreset });
  const [statusTarget, setStatusTarget] = useState<ActionStatusTarget>();
  const preset = normalizeProjectPreset(project?.preset);
  const defaultView = projectPresets[preset].defaultView;
  const requestedView = searchParams.get("view");
  const view: ProjectView = requestedView && ["overview", "goals", "actions", "knowledge"].includes(requestedView) ? requestedView as ProjectView : defaultView;
  const goalFilter: ProjectHistoryFilter = searchParams.get("goals") === "history" ? "history" : "current";
  const requestedActionFilter = searchParams.get("actions");
  const filterStorageKey = user && projectId && (state.workspaceId || mode === "demo")
    ? `command-project-action-filter:${user.id}:${state.workspaceId ?? "demo-workspace"}:${projectId}`
    : undefined;
  const actionFilter = isProjectActionFilter(requestedActionFilter) ? requestedActionFilter : readSavedActionFilter(filterStorageKey);
  const readingStatusValue = searchParams.get("readingStatus");
  const readingStatusFilter = preset === "reading" && (["to_read", "reading", "read", "paused", "abandoned"] as string[]).includes(readingStatusValue ?? "") ? readingStatusValue as ReadingStatus : undefined;
  useEffect(() => {
    if (project && readingStatusValue && !readingStatusFilter) { const next = new URLSearchParams(searchParams); next.delete("readingStatus"); setSearchParams(next, { replace: true, state: location.state }); }
  }, [location.state, project, readingStatusFilter, readingStatusValue, searchParams, setSearchParams]);
  const updateProjectParam = (key: "view" | "goals" | "actions" | "readingStatus", value: string, defaultValue?: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true, state: location.state });
  };
  const setView = (next: ProjectView) => updateProjectParam("view", next, defaultView);
  const setGoalFilter = (next: ProjectHistoryFilter) => updateProjectParam("goals", next, "current");
  const setActionFilter = (next: ProjectActionFilter) => {
    try { if (filterStorageKey) localStorage.setItem(filterStorageKey, next); } catch { /* The current URL still tracks the filter. */ }
    updateProjectParam("actions", next);
  };

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
    { value: "ready" as const, label: projectActionFilterLabels.ready, count: actions.filter((action) => action.status === "ready").length, icon: <Circle className="action-status-glyph" aria-hidden="true" /> },
    { value: "in_progress" as const, label: projectActionFilterLabels.in_progress, count: actions.filter((action) => action.status === "in_progress").length, icon: <LoaderCircle className="action-status-glyph" aria-hidden="true" /> },
    { value: "testing" as const, label: projectActionFilterLabels.testing, count: actions.filter((action) => action.status === "testing").length, icon: <Beaker className="action-status-glyph" aria-hidden="true" /> },
    { value: "blocked" as const, label: projectActionFilterLabels.blocked, count: actions.filter((action) => action.status === "blocked").length, icon: <ShieldAlert className="action-status-glyph" aria-hidden="true" /> },
    { value: "completed" as const, label: projectActionFilterLabels.completed, count: actions.filter((action) => action.status === "completed").length, icon: <CircleCheck className="action-status-glyph" aria-hidden="true" /> },
    { value: "skipped" as const, label: projectActionFilterLabels.skipped, count: actions.filter((action) => action.status === "skipped").length, icon: <SkipForward className="action-status-glyph" aria-hidden="true" /> },
    { value: "cancelled" as const, label: projectActionFilterLabels.cancelled, count: actions.filter((action) => action.status === "cancelled").length, icon: <CircleX className="action-status-glyph" aria-hidden="true" /> }
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
  const highlightedActionId = wideWorkspace && signal?.actionId && displayedActions.some((action) => action.id === signal.actionId && isActionVisibleInList(state, action)) ? signal.actionId : undefined;
  const signalAction = signal?.actionId ? actions.find((action) => action.id === signal.actionId) : undefined;
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

  const linkExistingBook = (item: KnowledgeItem) => void run(() => linkKnowledge(item.id, { areaId: project.id }, "material"), () => undefined);
  const closeStatusEditor = () => setStatusTarget(undefined);
  const renderAction = (action: typeof actions[number], { desktopOverview = false, featuredLabel, description }: {
    desktopOverview?: boolean;
    featuredLabel?: string;
    description?: string;
  } = {}) => {
    const statusKey = `project-action-status:${action.id}`;
    const error = mutation.error(statusKey);
    const group = action.goalId ? goals.find((goal) => goal.id === action.goalId) : undefined;
    const cardId = desktopOverview ? `overview-${navigationCardId("action", action.id)}` : featuredLabel ? "project-now-card" : undefined;
    const indicator = featuredLabel ?? (action.isNext ? "Następne" : undefined);
    return <ActionListRow key={action.id} action={action} cardId={cardId} navigation={projectNavigation}
      linkLabel={desktopOverview ? undefined : `Otwórz Działanie: ${action.title}`}
      timeZone={state.workspaceTimezone} today={today} routineTitle={resolveCompactRoutineTitle(action, state.recurringActionTemplates)} showUnscheduled={false}
      busy={mutation.isBusy(statusKey)} onOpenStatus={() => setStatusTarget({ action, menu: true })}
      onToggleComplete={() => {
        if (action.status === "completed") {
          void changeActionStatus(action, "ready");
        } else {
          void mutation.run(statusKey, () => completeActionWithUndo({ action, setActionStatus, undoActionCompletion, notifyUndo }));
        }
      }}
      context={group && !description ? { label: `Grupa: ${group.title}`, to: `/goals/${encodeURIComponent(group.id)}` } : undefined}
      indicator={indicator ? <span className="action-next-badge">{indicator}</span> : null}
      description={action.status === "blocked" && action.blocker ? undefined : description}>
      {error ? <p className="inline-mutation-error" role="alert">{error} <button type="button" onClick={() => void mutation.retry(statusKey)?.()}>Spróbuj ponownie</button></p> : null}
    </ActionListRow>;
  };
  const changeActionStatus = async (action: typeof actions[number], status: ProjectActionStatus, blocker?: string, reviewOn?: string | null) => {
    const previous = { status: action.status, blocker: action.blocker, reviewOn: action.reviewOn };
    return mutation.run(`project-action-status:${action.id}`, async () => {
      await setActionStatus(action.id, status, blocker, action.version, reviewOn);
      notifyUndo({ event: actionStatusFeedbackEvent(status), message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker, action.version + 1, previous.reviewOn ?? null) });
    });
  };
  const openProjectEditor = () => { setProjectForm({ name: project.name, description: project.description ?? "", categoryIds: project.categoryIds ?? [], preset: normalizeProjectPreset(project.preset) }); setDialog("edit"); };
  const saveProject = () => void run(() => updateArea(project.id, projectForm), () => {
    if (projectForm.preset !== preset) {
      const next = new URLSearchParams(searchParams);
      next.delete("view");
      next.delete("readingStatus");
      setSearchParams(next, { replace: true, state: location.state });
    }
    notifySuccess("Zapisano zmiany w Projekcie.");
  });
  const closeProjectMenu = (target: HTMLElement) => target.closest("details")?.removeAttribute("open");
  const studyWorkspace = preset === "study" && view === "knowledge" && wideWorkspace;
  const visibleSections = studyWorkspace ? ["knowledge", "goals"] : view === "overview" ? [] : [view];
  const selectedProjectCategories = (state.projectCategories ?? []).filter((category) => project.categoryIds?.includes(category.id));
  const orderedViews = projectPresets[preset].sectionOrder;
  const addAction: AppShellAddAction = {
    label: "Dodaj",
    ariaLabel: `Dodaj w Projekcie ${project.name}`,
    menu: [
      ...(preset === "reading" ? [{ label: "Książka", icon: <BookMarked />, request: { mode: "library" as const, libraryKind: "resource" as const, isBook: true, areaId: project.id, draftKey: `project-${project.id}-knowledge` } }] : []),
      { label: "Działanie", icon: <ListChecks />, request: { mode: "action", areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-actions` } },
      { label: "Grupa działań", icon: <Flag />, request: { mode: "goal", areaId: project.id, draftKey: `project-${project.id}-goals` } },
      ...([ ["Notatka", "note"], ["Materiał", "resource"], ["Decyzja", "decision"] ] as const).map(([label, libraryKind]) => ({ label, icon: <FileText />, request: { mode: "library" as const, libraryKind, areaId: project.id, draftKey: `project-${project.id}-knowledge` } }))
    ]
  };
  const historyActionFilterOption = { value: "history" as const, label: projectActionFilterLabels.history, count: historicalActions.length, icon: <History /> };
  return <AppShell addAction={addAction}>
    <div className="project-detail-toolbar">
      <ContextNavigation current={{ label: project.name, to: projectUrl }} fallbackBreadcrumbs={[{ label: "Projekty", to: "/projects" }]} fallbackReturnTo="/projects" fallbackReturnLabel="Wszystkie Projekty" showBack />
      <div className="project-heading-tools">
        <PageActions />
        <details className="project-more-menu project-management-menu">
          <summary aria-label={`Opcje Projektu: ${project.name}`} aria-haspopup="menu" title="Opcje Projektu"><MoreHorizontal aria-hidden="true" /></summary>
          <div role="menu" aria-label={`Zarządzaj Projektem: ${project.name}`}>
            <Button role="menuitem" onClick={(event) => { closeProjectMenu(event.currentTarget); openProjectEditor(); }}><Pencil aria-hidden="true" />Edytuj Projekt</Button>
            <AIContextExport target={{ type: "project", id: project.id }} />
            <div className="project-menu-separator" />
            <Button role="menuitem" variant="ghost" onClick={(event) => { closeProjectMenu(event.currentTarget); setDialog("archive"); }}><Archive aria-hidden="true" />Archiwizuj Projekt</Button>
            <Button role="menuitem" variant="ghost" className="project-menu-danger" onClick={(event) => { closeProjectMenu(event.currentTarget); setDialog("trash"); }}><Trash2 aria-hidden="true" />Przenieś do Kosza</Button>
          </div>
        </details>
      </div>
    </div>
    {view === "overview" ? <CurrentWeekPlanNotice read={planRead} /> : null}
    <header className="project-detail-head persistent-project-head">
      <div>
        <div className="project-title-row"><h1>{project.name}</h1></div>
        {selectedProjectCategories.length ? <div className="project-title-categories">{selectedProjectCategories.map((category) => <span key={category.id} className="project-category-chip"><span style={{ backgroundColor: category.color }} />{category.name}</span>)}</div> : null}
        {project.description ? <p>{project.description}</p> : null}
      </div>
    </header>
    <div ref={workspaceRef} className="project-workspace-container">
    <div className={`project-tabs ${compactTabsVariants()}`} role={wideWorkspace ? "navigation" : "tablist"} aria-label="Zawartość Projektu">
      {orderedViews.map((value) => <button key={value} role={wideWorkspace ? undefined : "tab"} aria-selected={wideWorkspace ? undefined : view === value} aria-current={wideWorkspace && view === value ? "page" : undefined} aria-label={value === "goals" ? "Grupy działań" : undefined} onClick={() => setView(value)}>
        {value === "overview" ? "Przegląd" : value === "goals" ? <><span className="project-tab-full-label">Grupy działań</span><span className="project-tab-short-label" aria-hidden="true">Grupy</span></> : value === "actions" ? "Działania" : "Wiedza"}
      </button>)}
    </div>

    {view === "overview" ? <div className="project-overview-workspace"><div className="project-overview-main">
      {!highlightedActionId ? <section className="project-overview" aria-labelledby="project-overview-title">
        <h2 className="sr-only" id="project-overview-title">Co jest teraz najważniejsze</h2>
        {signal && signalAction ? <ul className="workspace-list" role="list">{renderAction(signalAction, { featuredLabel: "Najbliższy ruch", description: signal.description })}</ul> : signal ? <Panel className={`project-now-card project-now-card-${signal.kind}`} data-navigation-card-id="project-now-card" tabIndex={-1}>
          <span className="project-now-icon"><ListChecks /></span>
          <div><span className="eyebrow">Najbliższy ruch · {signal.label}</span><h3>{signal.title}</h3><p>{signal.description}</p></div>
          {currentGoals.length ? <Button variant="primary" onClick={() => requestAppQuickAdd({ mode: "action", areaId: project.id, draftKey: `project-${project.id}-actions` })}>Dodaj Działanie</Button>
              : <Button variant="primary" onClick={() => setView(preset === "reading" ? "knowledge" : "goals")}>{preset === "reading" ? "Otwórz Wiedzę" : "Przejdź do grup działań"}</Button>}
        </Panel> : <Panel className="project-now-card project-now-card-inactive"><span className="project-now-icon"><ListChecks /></span><div><span className="eyebrow">Projekt poza aktywną przestrzenią</span><h3>{project.visibility === "archived" ? "Projekt w Archiwum" : "Projekt w Koszu"}</h3><p>Jego Działania pozostają zachowane w tym kontekście.</p></div><Button variant="primary" onClick={() => setView("actions")}>Pokaż Działania</Button></Panel>}

      </section> : null}
      {wideWorkspace && project.visibility === "active" ? <ProjectOverviewActions actions={displayedActions} filter={actionFilter} filters={[...statusActionFilterOptions, ...scheduleActionFilterOptions, historyActionFilterOption]} onFilter={(value) => setActionFilter(value as ProjectActionFilter)} renderAction={(action) => renderAction(action, { desktopOverview: true, featuredLabel: action.id === highlightedActionId ? "Najbliższy ruch" : undefined })} /> : null}
    </div>{wideWorkspace && project.visibility === "active" ? <ProjectOverviewContext reading={preset === "reading"} goals={currentGoals} knowledge={knowledge} navigation={projectNavigation} knowledgeLoading={projectKnowledgeQuery.isPending} knowledgeError={projectKnowledgeQuery.isError} onRetryKnowledge={() => void projectKnowledgeQuery.refetch()} onShowGoals={() => setView("goals")} onShowKnowledge={() => setView("knowledge")} /> : null}</div> : null}

    <div className={`project-sections${studyWorkspace ? " project-study-sections" : ""}`}>
      {visibleSections.includes("knowledge") ? <section aria-labelledby="project-knowledge-title">
        <h2 id="project-knowledge-title" className={studyWorkspace ? "project-list-heading" : "sr-only"}>{preset === "reading" ? "Książki i Wiedza" : "Wiedza"}</h2>
        {preset === "reading" ? <div className="project-list-toolbar reading-project-toolbar">
          <select aria-label="Status czytania" value={readingStatusFilter ?? "all"} onChange={(event) => updateProjectParam("readingStatus", event.target.value, "all")}>
            <option value="all">Wszystkie książki i materiały</option>
            {Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Button variant="ghost" onClick={() => setDialog("existing-book")}><BookOpen aria-hidden="true" />Połącz książkę</Button>
        </div> : null}
        {projectKnowledgeQuery.isError ? <p className="inline-mutation-error" role="alert">Nie udało się wczytać Wiedzy Projektu. <button type="button" onClick={() => void projectKnowledgeQuery.refetch()}>Spróbuj ponownie</button></p> : null}
        {displayedKnowledge.length ? <ul className="workspace-list" role="list">{displayedKnowledge.map((item) => {
          const book = item.resourceFormat === "book";
          const details = book ? [item.resourceAuthor, readingPositionLabel(item), item.readingStatus ? readingStatusLabels[item.readingStatus] : undefined].filter(Boolean).join(" · ") || item.detail : item.detail;
          return <WorkspaceListRow key={item.id} id={item.id} type="knowledge" title={item.title} navigation={projectNavigation} linkLabel={`Otwórz Wiedzę: ${item.title}`}
            leading={book ? <BookMarked aria-hidden="true" /> : <FileText aria-hidden="true" />}
            description={[book ? "Książka" : knowledgeKindLabels[item.type], details].filter(Boolean).join(" · ")} />;
        })}</ul> : !projectKnowledgeQuery.isPending && !projectKnowledgeQuery.isError ? <p className="project-list-empty">{preset === "study" ? projectPresets.study.emptyState.title : readingStatusFilter ? `Brak: ${readingStatusLabels[readingStatusFilter]}` : preset === "reading" ? "Czytelnia jest pusta" : "Brak Wiedzy"}</p> : null}
      </section> : null}

      {visibleSections.includes("goals") ? <section aria-labelledby="project-goals-title">
        <h2 id="project-goals-title" className={studyWorkspace ? "project-list-heading" : "sr-only"}>Grupy działań</h2>
        {goalFilter === "history" || historicalGoals.length ? <div className="project-list-toolbar">
          <select aria-label="Widok grup działań" value={goalFilter} onChange={(event) => setGoalFilter(event.target.value === "history" ? "history" : "current")}>
            <option value="current">Bieżące grupy</option>
            <option value="history">Historia grup działań</option>
          </select>
        </div> : null}
        {displayedGoals.length ? <ul className="workspace-list" role="list">{displayedGoals.map((goal) => {
          const details = [goal.status === "active" ? undefined : goalStatusLabels[goal.status], goal.outcome].filter(Boolean).join(" · ");
          return <WorkspaceListRow key={goal.id} id={goal.id} type="goal" title={goal.title} navigation={projectNavigation} linkLabel={`Otwórz grupę: ${goal.title}`}
            leading={<Flag aria-hidden="true" />} description={details} />;
        })}</ul> : <p className="project-list-empty">{goalFilter === "history" ? "Historia grup działań jest pusta" : "Brak bieżących grup"}</p>}
      </section> : null}

      {visibleSections.includes("actions") ? <section className="project-actions-section" aria-labelledby="project-actions-title">
        <h2 id="project-actions-title" className="sr-only">Działania</h2>
        <div className="project-list-toolbar project-action-filter-bar">
          <ProjectActionFilterPicker value={actionFilter} label={projectActionFilterLabels[actionFilter]} active={actionFilter !== "open"} onChange={setActionFilter} groups={[
            { label: "Status", options: statusActionFilterOptions },
            { label: "Termin", options: scheduleActionFilterOptions },
            { options: [historyActionFilterOption] }
          ]} />
        </div>
        {displayedActions.length ? <GroupedProjectActions actions={displayedActions} className="workspace-list" listAs="ul" renderAction={(action) => renderAction(action)} /> : <p className="project-list-empty">{actionFilter === "history" ? "Historia Działań jest pusta" : actionFilter === "open" ? "Brak otwartych Działań" : "Brak Działań dla wybranego filtra"}</p>}
      </section> : null}

    </div>
    </div>
    <Modal open={dialog === "existing-book"} title="Połącz książkę z Biblioteki" onClose={() => setDialog(undefined)}><p className="modal-intro">Książka pozostaje tym samym elementem Wiedzy; Projekt dostaje wspólne powiązanie.</p>{existingBooksQuery.isError ? <p className="auth-message error" role="alert">Nie udało się wczytać książek. <button type="button" onClick={() => void existingBooksQuery.refetch()}>Spróbuj ponownie</button></p> : null}{availableBooks.length ? <div className="project-entity-list">{availableBooks.map((item) => <Panel className="entity-card" key={item.id}><BookMarked /><span><strong>{item.title}</strong><small>{[item.resourceAuthor, readingPositionLabel(item), item.readingStatus ? readingStatusLabels[item.readingStatus] : undefined].filter(Boolean).join(" · ")}</small></span><Button loading={saving} onClick={() => linkExistingBook(item)}>Połącz</Button></Panel>)}</div> : existingBooksQuery.isError ? null : <EmptyState icon={<BookOpen />} title="Brak dostępnych książek" detail="Dodaj książkę do Biblioteki albo zmień istniejący Materiał na książkę." />}{existingBooksQuery.hasNextPage ? <div className="list-pagination"><Button loading={existingBooksQuery.isFetchingNextPage} onClick={() => void existingBooksQuery.fetchNextPage()}>Załaduj starsze</Button></div> : null}{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button onClick={() => setDialog(undefined)}>Zamknij</Button></div></Modal>
        {(() => { const action = actions.find((candidate) => candidate.id === statusTarget?.action.id); const key = action ? `project-action-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} menu={statusTarget?.menu} busy={Boolean(key && mutation.isBusy(key))} error={key ? mutation.error(key) : undefined} compact onClose={closeStatusEditor} onChange={(status, blocker, reviewOn) => action ? changeActionStatus(action, status, blocker, reviewOn) : false} />; })()}

      <Modal open={dialog === "edit"} closeDisabled={saving} title="Edytuj Projekt" onClose={() => setDialog(undefined)}><form onSubmit={(event) => { event.preventDefault(); saveProject(); }}><label className="field-label" htmlFor="edit-project-name">Nazwa</label><input id="edit-project-name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} required /><label className="field-label" htmlFor="edit-project-description">Kontekst</label><textarea id="edit-project-description" rows={3} value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} /><ProjectPresetPicker value={projectForm.preset} categories={state.projectCategories ?? []} categoryIds={projectForm.categoryIds} onChange={(preset) => setProjectForm((current) => ({ ...current, preset }))} disabled={saving} /><ProjectCategoryPicker value={projectForm.categoryIds} onChange={(categoryIds) => setProjectForm((current) => ({ ...current, categoryIds }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!projectForm.name.trim()}>Zapisz Projekt</Button></div></form></Modal>
    <Modal open={dialog === "archive"} title="Archiwizować Projekt?" onClose={() => setDialog(undefined)}><p>Projekt <strong>{project.name}</strong> zniknie z bieżących Projektów. Jego zawartość pozostanie zachowana.</p>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button disabled={saving} onClick={() => setDialog(undefined)}>Anuluj</Button><Button loading={saving} onClick={() => void run(() => setAreaVisibility(project.id, "archived"), () => {
      notifyUndo({ event: "archived", message: "Projekt został zarchiwizowany.", undo: () => setAreaVisibility(project.id, "active") });
      navigate("/projects");
    })}><Archive />Archiwizuj Projekt</Button></div></Modal>
    <Modal open={dialog === "trash"} title="Przenieść Projekt do Kosza?" onClose={() => setDialog(undefined)}><p>Projekt <strong>{project.name}</strong> zniknie z bieżących Projektów. Będzie można go później przywrócić z Kosza.</p>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button disabled={saving} onClick={() => setDialog(undefined)}>Anuluj</Button><Button variant="danger" loading={saving} onClick={() => void run(() => setAreaVisibility(project.id, "trashed"), () => navigate("/projects"))}><Trash2 />Przenieś do Kosza</Button></div></Modal>
  </AppShell>;
}
