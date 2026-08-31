import { useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, FolderKanban, Plus, RotateCcw, Trash2 } from "lucide-react";
import { NavigationLink } from "../components/ContextNavigation";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import { entityCardVariants } from "../components/ui-variants";
import { locationAddress } from "../domain/navigation";
import { useLocation } from "react-router-dom";
import { projectProjections } from "../domain/projectModule";

const colors = ["violet", "orange", "amber"] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function ProjectsPage() {
  const { state, createArea, setAreaVisibility } = useStore();
  const location = useLocation();
  const [view, setView] = useState<"active" | "archived" | "trashed">("active");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "" });
  const projects = projectProjections(state, view);
  const activeProjects = projectProjections(state, "active").length;

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
      await createArea(form.name, form.description);
      setForm({ name: "", description: "" });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się utworzyć Projektu.");
    } finally {
      setSaving(false);
    }
  };

  return <AppShell>
    <PageHeading title="Projekty" eyebrow={`${activeProjects} aktywne · stałe konteksty pracy`} action={<Button variant="primary" onClick={() => setOpen(true)}><Plus />Nowy projekt</Button>} />
    <p className="page-lead">Projekt przechowuje wspólny kontekst przez długi czas. W jego ramach tworzysz prostsze Cele, Działania i Wiedzę.</p>
    <div className="knowledge-views" role="group" aria-label="Widoczność Projektów">
      <Button variant={view === "active" ? "primary" : "ghost"} onClick={() => setView("active")}>Aktywne</Button>
      <Button variant={view === "archived" ? "primary" : "ghost"} onClick={() => setView("archived")}><Archive />Archiwum</Button>
      <Button variant={view === "trashed" ? "primary" : "ghost"} onClick={() => setView("trashed")}><Trash2 />Kosz</Button>
    </div>
    {projects.length ? <div className="project-card-grid">{projects.map((project, index) => {
      const counts = metrics.get(project.id) ?? { goals: 0, actions: 0, knowledge: 0 };
      return <Panel className={`${entityCardVariants()} project-card project-context-card entity-card`} key={project.id} data-navigation-card-id={`project-${project.id}`} tabIndex={-1}>
        <div className="project-card-head"><span className={`project-avatar ${colors[index % colors.length]}`}>{initials(project.name)}</span><Badge tone="info">Stały kontekst</Badge></div>
        <h2 className="line-clamp-2">{project.name}</h2>
        <p className="line-clamp-2">{project.description || "Miejsce dla powiązanych celów, zadań i wiedzy."}</p>
        <div className="project-context-metrics">
          <span><strong>{counts.goals}</strong><small>Cele</small></span>
          <span><strong>{counts.actions}</strong><small>Otwarte zadania</small></span>
          <span><strong>{counts.knowledge}</strong><small>Wiedza</small></span>
        </div>
        {view === "active" ? <NavigationLink className="button button-secondary entity-card-open" to={`/projects/${project.id}`} breadcrumbs={[{ label: "Projekty", to: "/projects" }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Projekty" sourceCardId={`project-${project.id}`}>Otwórz projekt <ArrowRight /></NavigationLink> : <Button onClick={() => void setAreaVisibility(project.id, "active")}><RotateCcw />Przywróć Projekt</Button>}
      </Panel>;
    })}</div> : <EmptyState icon={<FolderKanban />} title={view === "active" ? "Nie masz jeszcze Projektu" : "Ten widok jest pusty"} detail={view === "active" ? "Utwórz trwałe miejsce, w którym połączysz Cele, Działania i Wiedzę." : "Nie ma tutaj żadnych Projektów."} action={view === "active" ? <Button variant="primary" onClick={() => setOpen(true)}><Plus />Utwórz pierwszy Projekt</Button> : undefined} />}

    <Modal open={open} title="Nowy projekt" onClose={() => setOpen(false)}>
      <form onSubmit={submit}>
        <p className="modal-intro">Projekt nie ma daty końcowej. Jest stałym miejscem dla powiązanych rezultatów i materiałów.</p>
        <label className="field-label" htmlFor="project-name">Nazwa Projektu</label>
        <input id="project-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Np. Finanse osobiste" required autoFocus />
        <label className="field-label" htmlFor="project-description">Krótki kontekst <span className="optional-label">opcjonalnie</span></label>
        <textarea id="project-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Co należy do tego Projektu?" />
        <div className="project-preview"><FolderKanban /><span><small>Stały Projekt</small><strong>{form.name.trim() || "Nowy Projekt"}</strong><p>{form.description.trim() || "Cele, Działania i Wiedza będą zebrane w jednym miejscu."}</p></span></div>
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}
        <div className="modal-actions"><Button type="button" onClick={() => setOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.name.trim()}><Plus />Utwórz Projekt</Button></div>
      </form>
    </Modal>
  </AppShell>;
}
