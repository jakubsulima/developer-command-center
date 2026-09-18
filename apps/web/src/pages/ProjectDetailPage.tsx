import { ProjectCategoryPicker } from "../components/ProjectCategoryPicker";
import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, FileText, Filter, Flag, FolderKanban, History, Lightbulb, ListChecks, MoreHorizontal, Pencil, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { actionStatusLabels, goalStatusLabels, knowledgeDefaultRelationMeaning, knowledgeKindLabels } from "../domain/labels";
import { knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { routeForEntity } from "../domain/routes";
import { compactTabsVariants, entityCardVariants } from "../components/ui-variants";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { useActionFeedback } from "../components/action-feedback-context";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import { projectProjection } from "../domain/projectModule";
import { FormTransition } from "../components/FormTransition";
import { KnowledgeKindPicker } from "../components/KnowledgeKindPicker";
import { normalizeHttpUrl } from "../domain/http-url";
import { ActionOriginMarker, ActionStatusDialog, ActionStatusIconTrigger, type ProjectActionStatus } from "../components/ActionStatusControls";
import { isActionInTodayProjection, localDateForTimeZone } from "../domain/activity";

type ProjectView = "overview" | "goals" | "actions" | "knowledge";
type ProjectHistoryFilter = "current" | "history";
type ProjectActionFilter = "open" | "today" | "overdue" | "unscheduled" | "blocked" | "history";

const projectActionFilterLabels: Record<ProjectActionFilter, string> = {
  open: "Otwarte",
  today: "Na dziś",
  overdue: "Zaległe",
  unscheduled: "Bez terminu",
  blocked: "Zablokowane",
  history: "Historia"
};

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, createGoal, createAction, createKnowledge, updateArea, setAreaVisibility, setActionStatus } = useStore();
  const mutation = useKeyedMutation();
  const { notifyUndo } = useActionFeedback();
  const project = projectProjection(state, projectId ?? "");
  const [dialog, setDialog] = useState<"goal" | "action" | "knowledge" | "edit" | "archive" | "trash">();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [goalForm, setGoalForm] = useState({ title: "", outcome: "", firstAction: "" });
  const [actionForm, setActionForm] = useState({ title: "", detail: "", goalId: "", scheduledFor: "" });
  const [knowledgeForm, setKnowledgeForm] = useState({ kind: "note" as CreatableKnowledgeKind, title: "", detail: "", sourceUrl: "" });
  const [projectForm, setProjectForm] = useState({ name: project?.name ?? "", description: project?.description ?? "", categoryIds: project?.categoryIds ?? [] });
  const [statusActionId, setStatusActionId] = useState<string>();
  const requestedView = searchParams.get("view");
  const view: ProjectView = requestedView && ["overview", "goals", "actions", "knowledge"].includes(requestedView) ? requestedView as ProjectView : "overview";
  const goalFilter: ProjectHistoryFilter = searchParams.get("goals") === "history" ? "history" : "current";
  const requestedActionFilter = searchParams.get("actions");
  const actionFilter: ProjectActionFilter = requestedActionFilter && Object.hasOwn(projectActionFilterLabels, requestedActionFilter) ? requestedActionFilter as ProjectActionFilter : "open";
  const updateProjectParam = (key: "view" | "goals" | "actions", value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(key); else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setView = (next: ProjectView) => updateProjectParam("view", next, "overview");
  const setGoalFilter = (next: ProjectHistoryFilter) => updateProjectParam("goals", next, "current");
  const setActionFilter = (next: ProjectActionFilter) => updateProjectParam("actions", next, "open");

  const goals = useMemo(() => state.goals.filter((goal) => goal.areaId === projectId && goal.visibility === "active"), [projectId, state.goals]);
  const goalIds = useMemo(() => new Set(goals.map((goal) => goal.id)), [goals]);
  const actions = useMemo(() => state.actions.filter((action) => action.areaId === projectId || Boolean(action.goalId && goalIds.has(action.goalId))), [goalIds, projectId, state.actions]);
  const actionIds = useMemo(() => new Set(actions.map((action) => action.id)), [actions]);
  const recurringIds = useMemo(() => new Set(state.recurringActionTemplates.filter((item) => item.areaId === projectId || Boolean(item.goalId && goalIds.has(item.goalId))).map((item) => item.id)), [goalIds, projectId, state.recurringActionTemplates]);
  const knowledgeIds = useMemo(() => new Set(state.knowledgeLinks.filter((link) => link.areaId === projectId || Boolean(link.goalId && goalIds.has(link.goalId)) || Boolean(link.actionId && actionIds.has(link.actionId)) || Boolean(link.recurringTemplateId && recurringIds.has(link.recurringTemplateId))).map((link) => link.knowledgeItemId)), [actionIds, goalIds, projectId, recurringIds, state.knowledgeLinks]);
  const knowledge = state.knowledge.filter((item) => knowledgeIds.has(item.id) && !item.archivedAt && !item.trashedAt);
  const openActions = actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status));
  const historicalActions = actions.filter((action) => ["completed", "cancelled", "skipped"].includes(action.status));
  const today = localDateForTimeZone(new Date(), state.workspaceTimezone);
  const actionFilterOptions = [
    { value: "open" as const, label: projectActionFilterLabels.open, count: openActions.length, icon: <ListChecks /> },
    { value: "today" as const, label: projectActionFilterLabels.today, count: openActions.filter((action) => isActionInTodayProjection(action, today)).length, icon: <CalendarDays /> },
    { value: "overdue" as const, label: projectActionFilterLabels.overdue, count: openActions.filter((action) => Boolean(action.scheduledFor && action.scheduledFor < today)).length, icon: <Clock3 /> },
    { value: "unscheduled" as const, label: projectActionFilterLabels.unscheduled, count: openActions.filter((action) => !action.scheduledFor).length, icon: <CalendarDays /> },
    { value: "blocked" as const, label: projectActionFilterLabels.blocked, count: openActions.filter((action) => action.status === "blocked").length, icon: <ShieldAlert /> },
    { value: "history" as const, label: projectActionFilterLabels.history, count: historicalActions.length, icon: <History /> }
  ];
  const currentGoals = goals.filter((goal) => !["achieved", "abandoned"].includes(goal.status));
  const historicalGoals = goals.filter((goal) => ["achieved", "abandoned"].includes(goal.status));
  const displayedGoals = goalFilter === "current" ? currentGoals : historicalGoals;
  const displayedActions = actionFilter === "history" ? historicalActions : openActions.filter((action) => {
    if (actionFilter === "today") return isActionInTodayProjection(action, today);
    if (actionFilter === "overdue") return Boolean(action.scheduledFor && action.scheduledFor < today);
    if (actionFilter === "unscheduled") return !action.scheduledFor;
    if (actionFilter === "blocked") return action.status === "blocked";
    return true;
  });
  const activeGoals = goals.filter((goal) => goal.status === "active");
  const nextAction = openActions.find((action) => action.isNext) ?? openActions[0];
  const insights = knowledge.filter((item) => item.type === "artifact" || item.type === "decision");
  const activeGoalsLabel = activeGoals.length === 1 ? "1 aktywny" : `${activeGoals.length} aktywne`;
  const insightsLabel = insights.length === 1 ? "1 wynik lub wniosek" : `${insights.length} wyniki / wnioski`;

  if (!project) return <AppShell><EmptyState icon={<FolderKanban />} title="Nie znaleziono Projektu" detail="Ten Projekt nie istnieje albo nie jest już dostępny." action={<Button onClick={() => navigate("/projects")}>Wróć do Projektów</Button>} /></AppShell>;
  const projectQuery = searchParams.toString();
  const projectUrl = `/projects/${encodeURIComponent(project.id)}${projectQuery ? `?${projectQuery}` : ""}`;
  const projectBreadcrumbs: NavigationBreadcrumb[] = breadcrumbsForPage(location.state, [{ label: "Projekty", to: "/projects" }], { label: project.name, to: projectUrl });
  const projectNavigation = { breadcrumbs: projectBreadcrumbs, returnTo: locationAddress(location), returnLabel: `Projekt: ${project.name}` };

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
    if (knowledgeKindGuidance[knowledgeForm.kind].detailRequired && !knowledgeForm.detail.trim()) return;
    void run(async () => { await createKnowledge({ kind: knowledgeForm.kind, title: knowledgeForm.title, detail: knowledgeForm.detail, sourceUrl: knowledgeForm.kind === "resource" ? normalizeHttpUrl(knowledgeForm.sourceUrl) : undefined, relations: [{ meaning: knowledgeDefaultRelationMeaning(knowledgeForm.kind), target: { areaId: project.id } }] }); }, () => setKnowledgeForm({ kind: "note", title: "", detail: "", sourceUrl: "" }));
  };
  const closeStatusEditor = () => setStatusActionId(undefined);
  const openStatusEditor = (action: typeof actions[number]) => setStatusActionId(action.id);
  const changeActionStatus = async (action: typeof actions[number], status: ProjectActionStatus, blocker?: string) => {
    const previous = { status: action.status, blocker: action.blocker };
    return mutation.run(`project-action-status:${action.id}`, async () => {
      await setActionStatus(action.id, status, blocker);
      notifyUndo({ message: `Status zmieniono na „${actionStatusLabels[status]}”.`, undo: () => setActionStatus(action.id, previous.status, previous.blocker) });
    });
  };
  const openProjectEditor = () => { setProjectForm({ name: project.name, description: project.description ?? "", categoryIds: project.categoryIds ?? [] }); setDialog("edit"); };
  const closeProjectMenu = (target: HTMLElement) => target.closest("details")?.removeAttribute("open");

  const visibleSections = view === "overview" ? [] : [view];
  const selectedProjectCategories = (state.projectCategories ?? []).filter((category) => project.categoryIds?.includes(category.id));
  const addAction = view === "goals"
    ? { label: "Nowy Cel", shortLabel: "Cel", ariaLabel: `Dodaj Cel do Projektu ${project.name}`, active: dialog === "goal", quickAdd: { mode: "goal" as const, areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-goals` }, onClick: () => setDialog("goal" as const) }
    : view === "actions"
      ? { label: "Nowe Działanie", shortLabel: "Działanie", ariaLabel: `Dodaj Działanie do Projektu ${project.name}`, active: dialog === "action", quickAdd: { mode: "action" as const, areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-actions` }, onClick: () => setDialog("action" as const) }
      : view === "knowledge"
        ? { label: "Nowa Wiedza", shortLabel: "Wiedza", ariaLabel: `Dodaj Wiedzę do Projektu ${project.name}`, active: dialog === "knowledge", quickAdd: { mode: "library" as const, areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-knowledge` }, onClick: () => setDialog("knowledge" as const) }
        : { label: "Dodaj w Projekcie", shortLabel: "Dodaj", ariaLabel: `Dodaj w Projekcie ${project.name}`, quickAdd: { areaId: project.id, pinnedToToday: false, draftKey: `project-${project.id}-overview` } };
  return <AppShell addAction={addAction}>
    <ContextNavigation current={{ label: project.name, to: projectUrl }} fallbackBreadcrumbs={[{ label: "Projekty", to: "/projects" }]} fallbackReturnTo="/projects" fallbackReturnLabel="Wszystkie Projekty" showBack={false} />
    <div className="project-detail-head persistent-project-head">
      <div><div className="project-title-row"><span className="project-avatar large violet">{project.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span><span><h1>{project.name}</h1><span className="project-title-categories">{selectedProjectCategories.length ? selectedProjectCategories.map((category, index) => <span key={category.id} className="project-category-chip"><span style={{ backgroundColor: category.color }} />{category.name}{index === selectedProjectCategories.length - 1 ? <Button variant="ghost" className="project-title-category-edit" onClick={openProjectEditor} aria-label="Zmień kategorie projektu" title="Zmień kategorie"><Pencil /></Button> : null}</span>) : <span className="meta-label">Projekt</span>}</span></span></div><p>{project.description || "Wspólny kontekst dla Celów, Działań i Wiedzy."}</p></div>
      <details className="project-more-menu project-management-menu"><summary aria-label={`Opcje Projektu: ${project.name}`} aria-haspopup="menu" title="Opcje Projektu"><MoreHorizontal /><span className="sr-only">Opcje Projektu</span></summary><div role="menu" aria-label={`Zarządzaj Projektem: ${project.name}`}><span className="project-menu-label">Zarządzaj Projektem</span><Button role="menuitem" aria-label="Edytuj informacje" onClick={(event) => { closeProjectMenu(event.currentTarget); openProjectEditor(); }}><Pencil />Edytuj informacje</Button><div className="project-menu-separator" /><Button role="menuitem" aria-label="Archiwizuj Projekt" variant="ghost" onClick={(event) => { closeProjectMenu(event.currentTarget); setDialog("archive"); }}><Archive />Archiwizuj Projekt</Button><Button role="menuitem" aria-label="Przenieś do Kosza" variant="ghost" className="project-menu-danger" onClick={(event) => { closeProjectMenu(event.currentTarget); setDialog("trash"); }}><Trash2 />Przenieś do Kosza</Button></div></details>
    </div>
    <div className={`project-tabs ${compactTabsVariants()}`} role="tablist" aria-label="Zawartość Projektu">
      {(["overview", "goals", "actions", "knowledge"] as const).map((value) => <button key={value} role="tab" aria-selected={view === value} onClick={() => setView(value)}>{value === "overview" ? "Przegląd" : value === "goals" ? "Cele" : value === "actions" ? "Działania" : "Wiedza"}</button>)}
    </div>

    {view === "overview" ? <>
      <section className="project-overview" aria-labelledby="project-overview-title">
        <div className="project-overview-heading"><span className="eyebrow">Podsumowanie</span><h2 id="project-overview-title">Co jest teraz najważniejsze</h2><p>Pełne listy znajdziesz w kartach powyżej. Tutaj wystarczy jeden rzut oka.</p></div>
        <Panel className="project-now-card"><span className="project-now-icon"><ListChecks /></span><div><span className="eyebrow">Najbliższy ruch</span><h3>{nextAction?.title ?? (currentGoals.length ? "Dodaj następne Działanie" : "Ustal pierwszy Cel")}</h3><p>{nextAction ? (nextAction.goalId ? `Cel: ${goals.find((goal) => goal.id === nextAction.goalId)?.title ?? "Cel Projektu"}` : "Działanie bezpośrednio w Projekcie") : currentGoals.length ? `Masz ${currentGoals.length} ${currentGoals.length === 1 ? "bieżący Cel" : "bieżące Cele"}, ale żaden nie ma otwartego Działania.` : "Projekt potrzebuje pierwszego konkretnego rezultatu."}</p></div><Button variant="primary" onClick={() => setView(nextAction || currentGoals.length ? "actions" : "goals")}>{nextAction ? "Otwórz Działania" : currentGoals.length ? "Dodaj Działanie" : "Przejdź do Celów"}<ArrowRight /></Button></Panel>
        <div className="project-overview-cards">
          <button type="button" className="project-overview-card" onClick={() => setView("goals")} aria-label={`Otwórz Cele — ${currentGoals.length} ${currentGoals.length === 1 ? "bieżący" : "bieżących"}`}><span className="project-overview-card-icon"><Flag /></span><span className="project-overview-card-copy"><small>Cele</small><strong>{currentGoals.length}</strong><span>{currentGoals[0]?.title ?? (historicalGoals.length ? `${historicalGoals.length} w historii` : "Ustal pierwszy rezultat")}</span></span><ArrowRight /></button>
          <button type="button" className="project-overview-card" onClick={() => setView("actions")} aria-label={`Otwórz Działania — ${openActions.length} ${openActions.length === 1 ? "otwarte" : "otwartych"}`}><span className="project-overview-card-icon"><ListChecks /></span><span className="project-overview-card-copy"><small>Działania</small><strong>{openActions.length}</strong><span>{nextAction?.title ?? (historicalActions.length ? `${historicalActions.length} w historii` : "Brak otwartych kroków")}</span></span><ArrowRight /></button>
          <button type="button" className="project-overview-card" onClick={() => setView("knowledge")} aria-label={`Otwórz Wiedzę — ${knowledge.length} ${knowledge.length === 1 ? "element" : "elementów"}`}><span className="project-overview-card-icon"><BookOpen /></span><span className="project-overview-card-copy"><small>Wiedza</small><strong>{knowledge.length}</strong><span>{knowledge[0]?.title ?? "Zachowaj pierwszy materiał lub wniosek"}</span></span><ArrowRight /></button>
        </div>
      </section>
      <details className="project-flow-guide"><summary><span className="project-flow-guide-label"><span><Lightbulb /></span><span><strong>Pętla pracy — wskazówka</strong><small>Jak przejść od kierunku Projektu do zachowanej Wiedzy</small></span></span><span className="project-flow-guide-action">Pokaż <ChevronDown /></span></summary><section className="project-flow" aria-labelledby="project-flow-title"><div className="project-flow-heading"><div><span className="eyebrow">Pętla pracy</span><h2 id="project-flow-title">Od kierunku do wiedzy</h2></div><p>Każdy krok zostawia kontekst, który można wykorzystać ponownie.</p></div><div className="project-flow-steps"><div><span>1</span><small>Projekt</small><strong>{project.name}</strong><p>Kierunek i wspólny kontekst</p></div><ArrowRight /><button type="button" onClick={() => setView("goals")}><span>2</span><small>Cele</small><strong>{activeGoals.length ? activeGoalsLabel : "Ustal rezultat"}</strong><p>Po czym poznasz sukces</p></button><ArrowRight /><button type="button" onClick={() => setView("actions")}><span>3</span><small>Działanie</small><strong>{nextAction?.title ?? "Wybierz następny krok"}</strong><p>Co konkretnie robisz teraz</p></button><ArrowRight /><button type="button" onClick={() => setView("knowledge")}><span>4</span><small>Rezultat / wiedza</small><strong>{insights.length ? insightsLabel : "Zapisz rezultat"}</strong><p>Co zostaje na przyszłość</p></button></div></section></details>
    </> : null}

    <div className="project-sections">
      {visibleSections.includes("goals") ? <section aria-labelledby="project-goals-title"><div className="section-heading project-section-heading"><div><h2 id="project-goals-title">Cele</h2><span>{goalFilter === "current" ? "Bieżące rezultaty do wykonania w tym Projekcie" : "Osiągnięte i porzucone Cele"}</span></div>{goalFilter === "current" && historicalGoals.length ? <div className="project-section-actions project-section-actions-single"><details className="project-more-menu project-section-more-menu"><summary aria-label="Więcej opcji Celów" title="Więcej opcji Celów"><MoreHorizontal /><span className="sr-only">Więcej opcji Celów</span></summary><div><Button onClick={(event) => { closeProjectMenu(event.currentTarget); setGoalFilter("history"); }}><History />Pokaż historię <span className="project-menu-count">{historicalGoals.length}</span></Button></div></details></div> : null}</div>
        {goalFilter === "history" ? <div className="project-history-banner"><span><History /><span><strong>Historia Celów</strong><small>{historicalGoals.length} {historicalGoals.length === 1 ? "zapisany Cel" : "zapisanych Celów"}</small></span></span><Button variant="ghost" onClick={() => setGoalFilter("current")}><RotateCcw />Bieżące</Button></div> : null}
        {displayedGoals.length ? <div className="project-entity-list">{displayedGoals.map((goal) => <Panel className={`${entityCardVariants({ density: "compact" })} entity-card`} key={goal.id} data-navigation-card-id={navigationCardId("goal", goal.id)} tabIndex={-1}><Flag /><span><strong className="line-clamp-2">{goal.title}</strong><small className="line-clamp-2">{goal.outcome}</small></span><Badge>{goalStatusLabels[goal.status]}</Badge><NavigationLink className="button button-ghost entity-card-open" to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={projectBreadcrumbs} returnTo={projectNavigation.returnTo} returnLabel={projectNavigation.returnLabel} sourceCardId={navigationCardId("goal", goal.id)} aria-label={`Otwórz Cel: ${goal.title}`}><ArrowRight /></NavigationLink></Panel>)}</div> : <EmptyState icon={goalFilter === "history" ? <History /> : <Flag />} title={goalFilter === "history" ? "Historia Celów jest pusta" : "Brak bieżących Celów"} detail={goalFilter === "history" ? "Osiągnięte i porzucone Cele pojawią się tutaj." : historicalGoals.length ? "Zakończone Cele są zachowane w historii." : "Użyj przycisku Dodaj na dole, aby dodać pierwszy rezultat w tym Projekcie."} action={goalFilter === "current" && historicalGoals.length ? <Button onClick={() => setGoalFilter("history")}><History />Pokaż historię</Button> : undefined} />}
      </section> : null}

      {visibleSections.includes("actions") ? <section aria-labelledby="project-actions-title"><div className="section-heading project-section-heading"><div><h2 id="project-actions-title">Działania</h2><span>{actionFilter === "history" ? "Ukończone, pominięte i anulowane Działania" : "Otwarte kroki — z Celu albo bezpośrednio z Projektu"}</span></div><div className="project-section-actions project-section-actions-single"><details className={`project-more-menu project-section-more-menu project-filter-menu${actionFilter !== "open" ? " is-filtered" : ""}`}><summary aria-label={`Filtruj Działania. Wybrano: ${projectActionFilterLabels[actionFilter]}`} aria-haspopup="menu" title="Filtruj Działania"><Filter /><span className="sr-only">Filtruj Działania</span></summary><div role="menu" aria-label="Filtry Działań"><span className="project-menu-label">Pokaż Działania</span>{actionFilterOptions.map((option) => <Button key={option.value} role="menuitemradio" variant="ghost" className={actionFilter === option.value ? "is-active" : ""} aria-label={`${option.label}: ${option.count}`} aria-checked={actionFilter === option.value} onClick={(event) => { closeProjectMenu(event.currentTarget); setActionFilter(option.value); }}><span className="project-menu-option-icon">{actionFilter === option.value ? <Check /> : option.icon}</span>{option.label}<span className="project-menu-count">{option.count}</span></Button>)}</div></details></div></div>
        {actionFilter !== "open" ? <div className="project-history-banner project-filter-banner"><span><Filter /><span><strong>Filtr: {projectActionFilterLabels[actionFilter]}</strong><small>{displayedActions.length} {displayedActions.length === 1 ? "pasujące Działanie" : "pasujących Działań"}</small></span></span><Button variant="ghost" onClick={() => setActionFilter("open")}><RotateCcw />Wszystkie otwarte</Button></div> : null}
        {displayedActions.length ? <div className="project-action-list">{displayedActions.map((action) => <div className={`project-action-row ${action.status}`} key={action.id} data-action-id={action.id} data-navigation-card-id={navigationCardId("action", action.id)} tabIndex={-1}>
          <div className="action-copy"><div className="action-title-row"><NavigationLink className="project-action-title" to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={projectBreadcrumbs} returnTo={projectNavigation.returnTo} returnLabel={projectNavigation.returnLabel} sourceCardId={navigationCardId("action", action.id)} aria-label={`Otwórz Działanie: ${action.title}`}><strong>{action.title}</strong></NavigationLink>{action.isNext ? <span className="action-next-badge">Następne</span> : null}</div><small>{action.recurringTemplateId ? <><ActionOriginMarker action={action} /><span aria-hidden="true"> · </span></> : null}{action.goalId ? goals.find((goal) => goal.id === action.goalId)?.title : "Działanie Projektu"}{action.scheduledFor ? ` · ${action.scheduledFor}` : ""}</small></div>
          <ActionStatusIconTrigger action={action} disabled={mutation.isBusy(`project-action-status:${action.id}`)} onClick={() => openStatusEditor(action)} />
        </div>)}</div> : <EmptyState icon={actionFilter === "history" ? <History /> : <ListChecks />} title={actionFilter === "history" ? "Historia Działań jest pusta" : actionFilter === "open" ? "Brak otwartych Działań" : `Brak Działań: ${projectActionFilterLabels[actionFilter]}`} detail={actionFilter === "history" ? "Ukończone, pominięte i anulowane Działania pojawią się tutaj." : actionFilter !== "open" ? "Wybierz inny filtr, aby zobaczyć pozostałe Działania Projektu." : historicalActions.length ? "Zakończone Działania są zachowane w historii." : "Użyj przycisku Dodaj na dole, aby dodać pojedynczy krok."} action={actionFilter !== "open" ? <Button onClick={() => setActionFilter("open")}><RotateCcw />Wszystkie otwarte</Button> : historicalActions.length ? <Button onClick={() => setActionFilter("history")}><History />Pokaż historię</Button> : undefined} />}
      </section> : null}

      {visibleSections.includes("knowledge") ? <section aria-labelledby="project-knowledge-title"><div className="section-heading project-section-heading"><div><h2 id="project-knowledge-title">Wiedza</h2><span>Notatki, materiały i decyzje zachowane przy Projekcie</span></div></div>
        {knowledge.length ? <div className="project-entity-list">{knowledge.map((item) => <Panel className="entity-card" key={item.id} data-navigation-card-id={navigationCardId("knowledge", item.id)} tabIndex={-1}><FileText /><span><strong className="line-clamp-2">{item.title}</strong><small className="line-clamp-2">{item.detail || knowledgeKindLabels[item.type]}</small></span><Badge>{knowledgeKindLabels[item.type]}</Badge><NavigationLink className="button button-ghost entity-card-open" to={routeForEntity({ type: "knowledge", id: item.id })} breadcrumbs={projectBreadcrumbs} returnTo={projectNavigation.returnTo} returnLabel={projectNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", item.id)} aria-label={`Otwórz Wiedzę: ${item.title}`}><ArrowRight /></NavigationLink></Panel>)}</div> : <EmptyState icon={<BookOpen />} title="Brak Wiedzy" detail="Użyj przycisku Dodaj na dole, aby zapisać materiał, decyzję albo notatkę w tym Projekcie." />}
      </section> : null}
    </div>

    <Modal open={dialog === "goal"} title="Nowy Cel w Projekcie" onClose={() => setDialog(undefined)}><form onSubmit={submitGoal}><p className="modal-intro">Cel jest lekkim, konkretnym rezultatem. Szczegóły możesz dopracować później.</p><label className="field-label" htmlFor="project-goal-title">Co chcesz osiągnąć?</label><input id="project-goal-title" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} required /><label className="field-label" htmlFor="project-goal-outcome">Po czym poznasz, że jest gotowe? <span className="optional-label">opcjonalnie</span></label><textarea id="project-goal-outcome" rows={2} value={goalForm.outcome} onChange={(event) => setGoalForm((current) => ({ ...current, outcome: event.target.value }))} /><label className="field-label" htmlFor="project-goal-action">Pierwsze Działanie <span className="optional-label">opcjonalnie</span></label><input id="project-goal-action" value={goalForm.firstAction} onChange={(event) => setGoalForm((current) => ({ ...current, firstAction: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!goalForm.title.trim()}>Dodaj Cel</Button></div></form></Modal>
    <Modal open={dialog === "action"} className="project-action-create-modal" title="Nowe Działanie w Projekcie" onClose={() => setDialog(undefined)}><form className="project-action-create-form" onSubmit={submitAction}><div className="project-action-context"><FolderKanban /><span><small>Dodajesz do Projektu</small><strong>{project.name}</strong></span></div><label className="field-label" htmlFor="project-action-title">Co trzeba zrobić?</label><input id="project-action-title" placeholder="Krótki, konkretny następny krok" value={actionForm.title} onChange={(event) => setActionForm((current) => ({ ...current, title: event.target.value }))} required /><details className="advanced-options project-action-options"><summary><span><strong>Szczegóły i przypisanie</strong><small>Opis, Cel i termin</small></span><ChevronDown /></summary><div className="project-action-options-content"><label className="field-label" htmlFor="project-action-detail">Opis <span className="optional-label">opcjonalnie</span></label><textarea id="project-action-detail" rows={2} placeholder="Dodatkowy kontekst, jeśli jest potrzebny" value={actionForm.detail} onChange={(event) => setActionForm((current) => ({ ...current, detail: event.target.value }))} /><div className="project-action-options-grid"><div><label className="field-label" htmlFor="project-action-goal">Cel <span className="optional-label">opcjonalnie</span></label><select id="project-action-goal" value={actionForm.goalId} onChange={(event) => setActionForm((current) => ({ ...current, goalId: event.target.value }))}><option value="">Bez Celu</option>{currentGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></div><div><label className="field-label" htmlFor="project-action-date">Termin <span className="optional-label">opcjonalnie</span></label><input id="project-action-date" type="date" value={actionForm.scheduledFor} onChange={(event) => setActionForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></div></div></div></details>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!actionForm.title.trim()}>Dodaj Działanie</Button></div></form></Modal>
    <Modal open={dialog === "knowledge"} className="knowledge-create-modal" title="Nowa Wiedza w Projekcie" onClose={() => setDialog(undefined)}><form className="knowledge-create-form" noValidate onSubmit={submitKnowledge}><div className="knowledge-create-body" data-modal-scroll-body><KnowledgeKindPicker value={knowledgeForm.kind} name="project-knowledge-kind" onChange={(kind) => setKnowledgeForm((current) => ({ ...current, kind }))} /><FormTransition stateKey={knowledgeForm.kind}><label className="field-label" htmlFor="project-new-knowledge-title">{knowledgeKindGuidance[knowledgeForm.kind].titleLabel}</label><input id="project-new-knowledge-title" placeholder={knowledgeKindGuidance[knowledgeForm.kind].titlePlaceholder} value={knowledgeForm.title} onChange={(event) => setKnowledgeForm((current) => ({ ...current, title: event.target.value }))} required />{knowledgeForm.kind === "resource" ? <><label className="field-label" htmlFor="project-new-knowledge-url">Link do źródła <span className="optional-label">opcjonalnie</span></label><input id="project-new-knowledge-url" type="url" placeholder="https://…" value={knowledgeForm.sourceUrl} onChange={(event) => setKnowledgeForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></> : null}<label className="field-label" htmlFor="project-new-knowledge-detail">{knowledgeKindGuidance[knowledgeForm.kind].detailLabel}{!knowledgeKindGuidance[knowledgeForm.kind].detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label><textarea id="project-new-knowledge-detail" rows={4} required={knowledgeKindGuidance[knowledgeForm.kind].detailRequired} placeholder={knowledgeKindGuidance[knowledgeForm.kind].detailPlaceholder} value={knowledgeForm.detail} onChange={(event) => setKnowledgeForm((current) => ({ ...current, detail: event.target.value }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}</FormTransition></div><div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!knowledgeForm.title.trim() || (knowledgeKindGuidance[knowledgeForm.kind].detailRequired && !knowledgeForm.detail.trim())}>{knowledgeKindGuidance[knowledgeForm.kind].saveLabel}</Button></div></form></Modal>
        {(() => { const action = actions.find((candidate) => candidate.id === statusActionId); const key = action ? `project-action-status:${action.id}` : ""; return <ActionStatusDialog action={action} open={Boolean(action)} busy={Boolean(key && mutation.isBusy(key))} error={key ? mutation.error(key) : undefined} compact onClose={closeStatusEditor} onChange={(status, blocker) => action ? changeActionStatus(action, status, blocker) : false} />; })()}

    <Modal open={dialog === "edit"} closeDisabled={saving} title="Edytuj Projekt" onClose={() => setDialog(undefined)}><form onSubmit={(event) => { event.preventDefault(); void run(() => updateArea(project.id, projectForm), () => undefined); }}><label className="field-label" htmlFor="edit-project-name">Nazwa</label><input id="edit-project-name" value={projectForm.name} onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))} required /><label className="field-label" htmlFor="edit-project-description">Kontekst</label><textarea id="edit-project-description" rows={3} value={projectForm.description} onChange={(event) => setProjectForm((current) => ({ ...current, description: event.target.value }))} /><ProjectCategoryPicker value={projectForm.categoryIds} onChange={(categoryIds) => setProjectForm((current) => ({ ...current, categoryIds }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" onClick={() => setDialog(undefined)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!projectForm.name.trim()}>Zapisz Projekt</Button></div></form></Modal>
    <Modal open={dialog === "archive"} title="Archiwizować Projekt?" onClose={() => setDialog(undefined)}><p>Projekt <strong>{project.name}</strong> zniknie z bieżących Projektów. Jego zawartość pozostanie zachowana.</p>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button disabled={saving} onClick={() => setDialog(undefined)}>Anuluj</Button><Button loading={saving} onClick={() => void run(() => setAreaVisibility(project.id, "archived"), () => navigate("/projects"))}><Archive />Archiwizuj Projekt</Button></div></Modal>
    <Modal open={dialog === "trash"} title="Przenieść Projekt do Kosza?" onClose={() => setDialog(undefined)}><p>Projekt <strong>{project.name}</strong> zniknie z bieżących Projektów. Będzie można go później przywrócić z Kosza.</p>{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button disabled={saving} onClick={() => setDialog(undefined)}>Anuluj</Button><Button variant="danger" loading={saving} onClick={() => void run(() => setAreaVisibility(project.id, "trashed"), () => navigate("/projects"))}><Trash2 />Przenieś do Kosza</Button></div></Modal>
  </AppShell>;
}
