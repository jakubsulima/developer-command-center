import { ProjectCategoryManager } from "../components/ProjectCategoryManager";
import "../components/ProjectCategories.css";
import { useMemo, useState, type CSSProperties } from "react";
import { Archive, Beaker, CalendarDays, ChevronDown, CircleAlert, CircleCheck, Clock3, FolderKanban, ListChecks, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { NavigationLink } from "../components/ContextNavigation";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Badge, Button } from "../components/ui";
import { locationAddress } from "../domain/navigation";
import { useLocation, useSearchParams } from "react-router-dom";
import { projectProjections, projectSignal, type ProjectSignal } from "../domain/projectModule";
import { useDesktopLayout } from "../hooks/useDesktopLayout";
import "../components/workspace-list.css";
import "./projects-workspace.css";

function projectSignalText(signal: ProjectSignal) {
  if (signal.kind === "blocked") return `${signal.counts.blockedActions} zablokowane`;
  if (signal.kind === "overdue") return `${signal.counts.overdueActions} zaległe`;
  if (signal.kind === "today") return `${signal.counts.todayActions} na dziś`;
  return signal.label;
}

function ProjectSignalIcon({ signal }: { signal: ProjectSignal }) {
  if (signal.kind === "blocked" || signal.kind === "empty") return <CircleAlert aria-hidden="true" />;
  if (signal.kind === "overdue") return <Clock3 aria-hidden="true" />;
  if (signal.kind === "today" || signal.kind === "scheduled") return <CalendarDays aria-hidden="true" />;
  if (signal.kind === "testing") return <Beaker aria-hidden="true" />;
  if (signal.kind === "available") return <CircleCheck aria-hidden="true" />;
  return <ListChecks aria-hidden="true" />;
}

export function ProjectsPage() {
  const desktop = useDesktopLayout();
  const { state, setAreaVisibility } = useStore();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const viewParam = params.get("view");
  const view = viewParam === "archived" || viewParam === "trashed" ? viewParam : "active";
  const setView = (nextView: typeof view) => {
    const next = new URLSearchParams(params);
    if (nextView === "active") next.delete("view");
    else next.set("view", nextView);
    setParams(next);
  };
  const projects = projectProjections(state, view);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [manageCategories, setManageCategories] = useState(false);
  const categories = state.projectCategories ?? [];
  const filteredProjects = projects.filter((project) => !categoryFilter || (categoryFilter === "uncategorized" ? !project.categoryIds?.length : project.categoryIds?.includes(categoryFilter)));
  const groups = grouped ? [...categories.filter((category) => !categoryFilter || category.id === categoryFilter).map((category) => ({ ...category, projects: filteredProjects.filter((project) => project.categoryIds?.includes(category.id)) })), ...(!categoryFilter || categoryFilter === "uncategorized" ? [{ id: "uncategorized", name: "Bez kategorii", color: "#94a3b8", projects: filteredProjects.filter((project) => !project.categoryIds?.length) }] : [])].filter((group) => group.projects.length).sort((left, right) => right.projects.length - left.projects.length) : [{ id: "all", name: "", color: "", projects: filteredProjects }];
  const closeCategoryMenu = (element: HTMLElement) => { element.closest("details")?.removeAttribute("open"); };
  const viewLabel = view === "active" ? "Aktywne" : view === "archived" ? "Archiwum" : "Kosz";
  const selectedCategory = categoryFilter === "uncategorized" ? "Bez kategorii" : categories.find((category) => category.id === categoryFilter)?.name;
  const viewSummary = `Projekty w widoku: ${filteredProjects.length}${grouped && groups.reduce((sum, group) => sum + group.projects.length, 0) > filteredProjects.length ? " (unikatowe)" : ""}${selectedCategory ? ` · ${selectedCategory}` : ""}`;

  const metrics = useMemo(() => new Map(projectProjections(state).map((project) => [project.id, {
    goals: project.goals.filter((goal) => goal.visibility === "active").length,
    actions: project.actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status)).length,
    knowledge: project.knowledge.filter((item) => !item.archivedAt && !item.trashedAt).length
  }])), [state]);

  return <AppShell addAction={{ label: "Nowy Projekt", shortLabel: "Projekt", ariaLabel: "Dodaj nowy Projekt", quickAdd: { mode: "project", pinnedToToday: false, draftKey: "projects-list", projectCategoryIds: categoryFilter && categoryFilter !== "uncategorized" ? [categoryFilter] : [] } }}>
    <PageHeading className="project-page-heading" title="Projekty" eyebrow={viewSummary} action={<div className="project-heading-actions">
      <span className={`project-view-status project-view-status-${view}`} aria-label={`Widok: ${viewLabel}`}><span aria-hidden="true" />{viewLabel}</span>
      {!desktop ? <details className="project-category-menu">
        <summary aria-label="Więcej opcji widoku" title="Więcej opcji widoku"><MoreHorizontal /><span className="sr-only">Więcej opcji widoku</span></summary>
        <div className="project-options-popover">
          <label className="project-category-filter"><span>Kategoria</span><span className="project-category-select"><select aria-label="Filtruj po kategorii" value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); closeCategoryMenu(event.currentTarget); }}><option value="">Wszystkie kategorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="uncategorized">Bez kategorii</option></select><ChevronDown aria-hidden="true" /></span></label>
          <div role="menu" aria-label="Opcje widoku projektów">
            <span className="project-menu-label">Opcje widoku</span>
            <Button role="menuitemradio" aria-checked={view === "active"} aria-pressed={view === "active"} variant={view === "active" ? "primary" : "ghost"} onClick={(event) => { setView("active"); closeCategoryMenu(event.currentTarget); }}>Aktywne</Button>
            <Button role="menuitemradio" aria-checked={view === "archived"} aria-pressed={view === "archived"} variant={view === "archived" ? "primary" : "ghost"} onClick={(event) => { setView("archived"); closeCategoryMenu(event.currentTarget); }}><Archive />Archiwum</Button>
            <Button role="menuitemradio" aria-checked={view === "trashed"} aria-pressed={view === "trashed"} variant={view === "trashed" ? "primary" : "ghost"} onClick={(event) => { setView("trashed"); closeCategoryMenu(event.currentTarget); }}><Trash2 />Kosz</Button>
            <div className="project-menu-separator" />
            <Button role="menuitemcheckbox" aria-checked={grouped} aria-pressed={grouped} variant={grouped ? "primary" : "ghost"} onClick={(event) => { setGrouped(!grouped); closeCategoryMenu(event.currentTarget); }}>Grupuj kategoriami</Button>
            <Button role="menuitem" variant="ghost" onClick={(event) => { setManageCategories(true); closeCategoryMenu(event.currentTarget); }}>Zarządzaj kategoriami</Button>
          </div>
        </div>
      </details> : null}
    </div>} />
    <div className="projects-index" data-view={view}>
    {desktop ? <div className="projects-index-toolbar">
      <div className="projects-index-views" role="group" aria-label="Widok Projektów">
        <Button variant={view === "active" ? "primary" : "ghost"} aria-pressed={view === "active"} onClick={() => setView("active")}>Aktywne</Button>
        <Button variant={view === "archived" ? "primary" : "ghost"} aria-pressed={view === "archived"} onClick={() => setView("archived")}><Archive />Archiwum</Button>
        <Button variant={view === "trashed" ? "primary" : "ghost"} aria-pressed={view === "trashed"} onClick={() => setView("trashed")}><Trash2 />Kosz</Button>
      </div>
      <label className="projects-index-category"><span>Kategoria</span><select aria-label="Filtruj po kategorii" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Wszystkie kategorie</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="uncategorized">Bez kategorii</option></select></label>
      <div className="projects-index-options"><Button variant="ghost" aria-pressed={grouped} onClick={() => setGrouped(!grouped)}>Grupuj kategoriami</Button><Button variant="ghost" onClick={() => setManageCategories(true)}>Zarządzaj kategoriami</Button></div>
    </div> : null}
    {groups.length ? groups.map((group) => <section className="project-category-section" key={group.id}
      style={grouped && group.id !== "uncategorized" ? { "--project-category-color": group.color } as CSSProperties : undefined}>
      {grouped ? <h2 className="project-category-heading">
        <span>{group.name}</span>
        <small>{group.projects.length}</small>
      </h2> : null}
      <div className="project-category-items">
      {group.projects.length ? <div className="project-list-columns" aria-hidden="true"><span>Projekt</span><span>{view === "active" ? "Najbliższy ruch" : "Opis"}</span><span>Powiązania</span>{view !== "active" ? <span /> : null}</div> : null}
      {group.projects.length ? <ul className="workspace-list project-list" role="list">{group.projects.map((project) => {
      const counts = metrics.get(project.id) ?? { goals: 0, actions: 0, knowledge: 0 };
      const signal = view === "active" ? projectSignal(state, project.id) : undefined;
      const rowCategories = categories.filter((category) => project.categoryIds?.includes(category.id) && (!grouped || category.id !== group.id));
      const cardId = grouped ? `project-${project.id}-${group.id}` : `project-${project.id}`;
      const Title = grouped ? "h3" : "h2";
      return <li className="project-card project-index-row" key={project.id} data-navigation-card-id={cardId} tabIndex={-1}>
        <div className="project-row-identity">
          <Title aria-label={project.name}>
            <NavigationLink className="project-card-link" to={`/projects/${project.id}`} breadcrumbs={[{ label: "Projekty", to: "/projects" }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Projekty" sourceCardId={cardId} aria-label={`Otwórz projekt ${project.name}`}>{project.name}</NavigationLink>
          </Title>
          {rowCategories.length ? <div className="project-row-categories">{rowCategories.map((category) => <span key={category.id} className="project-category-chip"><span style={{ backgroundColor: category.color }} />{category.name}</span>)}</div> : null}
        </div>
        {signal ? <div className="project-row-signal" data-signal={signal.kind} aria-label={`Najbliższy ruch: ${projectSignalText(signal)}${signal.actionId ? ` — ${signal.title}` : ""}`}>
          <ProjectSignalIcon signal={signal} />
          <span>{signal.actionId ? <><strong>{signal.title}</strong><small>{projectSignalText(signal)}</small></> : projectSignalText(signal)}</span>
        </div> : null}
        {view !== "active" && project.description?.trim() ? <p className="project-row-description">{project.description.trim()}</p> : null}
        <div className="project-row-metrics">
          <span><small>Grupy działań</small><strong>{counts.goals}</strong></span>
          <span><small>Działania</small><strong>{counts.actions}</strong></span>
          <span><small>Wiedza</small><strong>{counts.knowledge}</strong></span>
        </div>
        {view !== "active" ? <div className="project-row-history">
          <Badge tone="neutral">{view === "archived" ? "Archiwum" : "W koszu"}</Badge>
          <Button onClick={() => void setAreaVisibility(project.id, "active")}><RotateCcw />Przywróć Projekt</Button>
        </div> : null}
      </li>;
    })}</ul> : <div className="category-empty"><FolderKanban /><p>Brak projektów pasujących do tego widoku.</p></div>}
      </div>
    </section>) : <div className="category-empty"><FolderKanban /><p>Brak projektów pasujących do tego widoku.</p></div>}
    {manageCategories ? <ProjectCategoryManager onClose={() => { setManageCategories(false); if (categoryFilter !== "uncategorized" && !categories.some((category) => category.id === categoryFilter)) setCategoryFilter(""); }} /> : null}
    </div>

  </AppShell>;
}
