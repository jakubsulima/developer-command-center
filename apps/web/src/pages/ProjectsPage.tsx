import { ProjectCategoryManager } from "../components/ProjectCategoryManager";
import { ProjectCategoryPicker } from "../components/ProjectCategoryPicker";
import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, Beaker, CalendarDays, ChevronDown, CircleAlert, CircleCheck, Clock3, FolderKanban, ListChecks, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { NavigationLink } from "../components/ContextNavigation";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, Panel } from "../components/ui";
import { entityCardVariants } from "../components/ui-variants";
import { locationAddress } from "../domain/navigation";
import { useLocation } from "react-router-dom";
import { projectProjections, projectSignal, type ProjectSignal } from "../domain/projectModule";

const colors = ["violet", "orange", "amber"] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

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
  const { state, createArea, setAreaVisibility } = useStore();
  const location = useLocation();
  const [view, setView] = useState<"active" | "archived" | "trashed">("active");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", categoryIds: [] as string[] });
  const projects = projectProjections(state, view);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [manageCategories, setManageCategories] = useState(false);
  const categories = state.projectCategories ?? [];
  const filteredProjects = projects.filter((project) => !categoryFilter || (categoryFilter === "uncategorized" ? !project.categoryIds?.length : project.categoryIds?.includes(categoryFilter)));
  const groups = grouped ? [...categories.filter((category) => !categoryFilter || category.id === categoryFilter).map((category) => ({ ...category, projects: filteredProjects.filter((project) => project.categoryIds?.includes(category.id)) })), ...(!categoryFilter || categoryFilter === "uncategorized" ? [{ id: "uncategorized", name: "Bez kategorii", color: "#94a3b8", projects: filteredProjects.filter((project) => !project.categoryIds?.length) }] : [])].filter((group) => group.projects.length).sort((left, right) => right.projects.length - left.projects.length) : [{ id: "all", name: "", color: "", projects: filteredProjects }];
  const openCreate = () => { setForm({ name: "", description: "", categoryIds: categoryFilter && categoryFilter !== "uncategorized" ? [categoryFilter] : [] }); setError(""); setOpen(true); };
  const closeCategoryMenu = (element: HTMLElement) => { element.closest("details")?.removeAttribute("open"); };
  const viewLabel = view === "active" ? "Aktywne" : view === "archived" ? "Archiwum" : "Kosz";
  const selectedCategory = categoryFilter === "uncategorized" ? "Bez kategorii" : categories.find((category) => category.id === categoryFilter)?.name;
  const viewSummary = `Projekty w widoku: ${filteredProjects.length}${selectedCategory ? ` · ${selectedCategory}` : ""}`;

  const metrics = useMemo(() => new Map(projectProjections(state).map((project) => [project.id, {
    goals: project.goals.filter((goal) => goal.visibility === "active").length,
    actions: project.actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status)).length,
    knowledge: project.knowledge.filter((item) => !item.archivedAt && !item.trashedAt).length
  }])), [state]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await createArea(form.name, form.description, undefined, form.categoryIds);
      setForm({ name: "", description: "", categoryIds: [] as string[] });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się utworzyć Projektu.");
    } finally {
      setSaving(false);
    }
  };

  return <AppShell addAction={{ label: "Nowy Projekt", shortLabel: "Projekt", ariaLabel: "Dodaj nowy Projekt", active: open, quickAdd: { mode: "project", pinnedToToday: false, draftKey: "projects-list" }, onClick: () => openCreate() }}>
    <PageHeading className="project-page-heading" title="Projekty" eyebrow={viewSummary} action={<div className="project-heading-actions">
      <span className={`project-view-status project-view-status-${view}`} aria-label={`Widok: ${viewLabel}`}><span aria-hidden="true" />{viewLabel}</span>
      <details className="project-category-menu">
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
      </details>
    </div>} />
    {groups.length ? groups.map((group) => <section className="project-category-section" key={group.id}>
      {grouped ? <h2 className="project-category-heading"><span className="category-dot" style={{ backgroundColor: group.color }} />{group.name}<small>{group.projects.length}</small></h2> : null}
      {group.projects.length ? <div className="project-card-grid">{group.projects.map((project, index) => {
      const counts = metrics.get(project.id) ?? { goals: 0, actions: 0, knowledge: 0 };
      const signal = view === "active" ? projectSignal(state, project.id) : undefined;
      const cardId = grouped ? `project-${project.id}-${group.id}` : `project-${project.id}`;
      const Title = grouped ? "h3" : "h2";
      return <Panel className={`${entityCardVariants()} project-card project-context-card project-index-row entity-card`} key={project.id} data-navigation-card-id={cardId} tabIndex={-1}>
        <div className="project-card-head">
          <span className={`project-avatar ${colors[index % colors.length]}`} aria-hidden="true">{initials(project.name)}</span>
          <div className="project-card-identity"><Title className="line-clamp-2">{project.name}</Title></div>
          {view === "active" ? <NavigationLink className="project-card-cta entity-card-open" to={`/projects/${project.id}`} breadcrumbs={[{ label: "Projekty", to: "/projects" }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Projekty" sourceCardId={cardId} aria-label={`Otwórz projekt ${project.name}`}><span>Otwórz</span><ArrowRight aria-hidden="true" /></NavigationLink> : <Badge tone="neutral">{view === "archived" ? "Archiwum" : "W koszu"}</Badge>}
        </div>
        {!grouped ? <div className="project-card-categories">{categories.filter((category) => project.categoryIds?.includes(category.id)).map((category) => <span key={category.id} className="project-category-chip"><span style={{ backgroundColor: category.color }} />{category.name}</span>)}</div> : null}
        {signal ? <div className={`project-card-signal project-card-signal-${signal.kind}`} aria-label={`Najbliższy ruch: ${projectSignalText(signal)}${signal.actionId ? ` — ${signal.title}` : ""}`}>
          <ProjectSignalIcon signal={signal} />
          <span><strong>{projectSignalText(signal)}</strong>{signal.actionId ? <small className="line-clamp-1">{signal.title}</small> : null}</span>
        </div> : null}
        {view !== "active" && project.description?.trim() ? <p className="line-clamp-1 project-card-description">{project.description.trim()}</p> : null}
        <div className="project-context-metrics">
          <span><small>Cele</small><strong>{counts.goals}</strong></span>
          <span><small>Działania</small><strong>{counts.actions}</strong></span>
          <span><small>Wiedza</small><strong>{counts.knowledge}</strong></span>
        </div>
        {view !== "active" ? <Button onClick={() => void setAreaVisibility(project.id, "active")}><RotateCcw />Przywróć Projekt</Button> : null}
      </Panel>;
    })}</div> : <div className="category-empty"><FolderKanban /><p>Brak projektów pasujących do tego widoku.</p></div>}
    </section>) : <div className="category-empty"><FolderKanban /><p>Brak projektów pasujących do tego widoku.</p></div>}
    {manageCategories ? <ProjectCategoryManager onClose={() => { setManageCategories(false); if (categoryFilter !== "uncategorized" && !categories.some((category) => category.id === categoryFilter)) setCategoryFilter(""); }} /> : null}

    <Modal open={open} closeDisabled={saving} title="Nowy projekt" className="project-create-modal" onClose={() => setOpen(false)}>
      <form className="project-create-form" onSubmit={submit}>
        <p className="modal-intro">Nadaj projektowi nazwę i wybierz kategorie. Możesz zmienić je w dowolnym momencie.</p>
        <label className="field-label" htmlFor="project-name">Nazwa Projektu</label>
        <input id="project-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Np. Finanse osobiste" required />
        <label className="field-label" htmlFor="project-description" aria-label="Krótki kontekst opcjonalnie">Opis <span className="optional-label">opcjonalnie</span></label>
        <textarea id="project-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Co należy do tego Projektu?" />
        <ProjectCategoryPicker value={form.categoryIds} onChange={(categoryIds) => setForm((current) => ({ ...current, categoryIds }))} />
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        <div className="modal-actions"><Button type="button" onClick={() => setOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.name.trim()}><Plus />Utwórz Projekt</Button></div>
      </form>
    </Modal>
  </AppShell>;
}
