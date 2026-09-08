import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowRight, BookOpen, CircleDot, Flag, Heart, Layers3, RefreshCw, Rocket, RotateCcw, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { entityCardVariants, stickyFormActionsVariants } from "../components/ui-variants";
import { routeForEntity } from "../domain/routes";
import type { GoalKind, GoalStatus } from "../domain/types";
import { goalKindLabels as kindLabels, goalStatusLabels as statusLabels } from "../domain/labels";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId } from "../domain/navigation";

const systemTemplates = [
  { id: "blank", name: "Własny", kind: "custom" as const, outcomePrompt: "Co chcesz osiągnąć?", description: "Zacznij od pustej karty", icon: CircleDot },
  { id: "project", name: "Projektowy", kind: "project" as const, outcomePrompt: "Jaki rezultat ma dostarczyć projekt?", description: "Dostarcz konkretny rezultat", icon: Rocket },
  { id: "learning", name: "Nauka", kind: "learning" as const, outcomePrompt: "Co będziesz umieć lub potrafić pokazać?", description: "Zdobądź i pokaż umiejętność", icon: BookOpen },
  { id: "personal", name: "Osobisty", kind: "personal" as const, outcomePrompt: "Jaka zmiana ma być widoczna?", description: "Wprowadź ważną zmianę", icon: Heart },
  { id: "maintenance", name: "Utrzymanie", kind: "maintenance" as const, outcomePrompt: "Jaki stan chcesz regularnie utrzymywać?", description: "Dbaj o pożądany stan", icon: RefreshCw }
];

function goalCountLabel(count: number) {
  if (count === 1) return "1 Cel";
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? `${count} Cele` : `${count} Celów`;
}

export function GoalsPage() {
  const { state, loading: storeLoading, createGoal, createGoalTemplate, updateGoalTemplate, setGoalVisibility, setGoalTemplateVisibility } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; outcome?: string }>({});
  const [form, setForm] = useState({ title: "", outcome: "", criteria: "", firstAction: "", templateId: "blank", areaId: "" });
  const [template, setTemplate] = useState({ name: "", kind: "custom" as GoalKind, firstAction: "" });
  const [editingTemplateId, setEditingTemplateId] = useState<string>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const status = (params.get("status") ?? "active") as GoalStatus | "archived" | "trashed" | "all";
  const kind = params.get("kind") as GoalKind | null;
  const activeFilterCount = Number(status !== "active") + Number(Boolean(kind));
  const statusTabs = (mobile = false) => <Tabs value={status} onValueChange={(value) => { const next = new URLSearchParams(params); next.set("status", value); setParams(next); if (mobile) setFiltersOpen(false); }} className="filter-pills">
    <TabsList className={mobile ? "grid h-auto w-full grid-cols-2 items-stretch border-0 bg-transparent p-0" : "h-auto flex-wrap border-0 bg-transparent p-0"}>
      {(["active", "paused", "achieved", "abandoned", "all"] as const).map((value) => <TabsTrigger className="min-h-10 justify-start" role="button" value={value} key={value}>{value === "all" ? "Wszystkie" : statusLabels[value]}</TabsTrigger>)}
      <TabsTrigger className="min-h-10 justify-start" role="button" value="archived"><Archive />Archiwum</TabsTrigger>
      <TabsTrigger className="min-h-10 justify-start" role="button" value="trashed"><Trash2 />Kosz</TabsTrigger>
    </TabsList>
  </Tabs>;
  useEffect(() => {
    const next = new URLSearchParams(params);
    let changed = false;
    if (!["active", "paused", "achieved", "abandoned", "archived", "trashed", "all"].includes(status)) { next.set("status", "active"); changed = true; }
    if (kind && !Object.prototype.hasOwnProperty.call(kindLabels, kind)) { next.delete("kind"); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [kind, params, setParams, status]);
  const selectedSystemTemplate = systemTemplates.find((item) => item.id === form.templateId);
  const selectedTemplate = selectedSystemTemplate ?? state.goalTemplates.find((item) => item.visibility === "active" && item.id === form.templateId);
  const criteriaCount = form.criteria.split("\n").filter((item) => item.trim()).length;
  const selectedProject = state.areas.find((item) => item.id === form.areaId)?.name ?? "Bez Projektu";

  const goals = useMemo(() => state.goals.filter((goal) => {
    const visibilityMatches = status === "archived" ? goal.visibility === "archived"
      : status === "trashed" ? goal.visibility === "trashed"
        : goal.visibility === "active" && (status === "all" || goal.status === status);
    return visibilityMatches && (!kind || goal.kind === kind);
  }), [kind, state.goals, status]);

  const submitGoal = async (event: FormEvent) => {
    event.preventDefault();
    const nextFieldErrors = {
      title: form.title.trim() ? undefined : "Podaj nazwę Celu.",
      outcome: undefined
    };
    setFieldErrors(nextFieldErrors);
    if (nextFieldErrors.title || nextFieldErrors.outcome) return;
    setLoading(true);
    setError("");
    try {
      const id = await createGoal({
        title: form.title,
        outcome: form.outcome.trim() || form.title.trim(),
        firstActionTitle: form.firstAction || undefined,
        kind: selectedTemplate?.kind ?? "custom",
        areaId: form.areaId || undefined,
        templateId: state.goalTemplates.some((item) => item.id === form.templateId) ? form.templateId : undefined,
        criteria: form.criteria.split("\n").map((item) => item.trim()).filter(Boolean)
      });
      setNewOpen(false);
      setForm({ title: "", outcome: "", criteria: "", firstAction: "", templateId: "blank", areaId: "" });
      navigate(`/goals/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się utworzyć Celu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell addAction={{ label: "Nowy Cel", shortLabel: "Cel", ariaLabel: "Dodaj nowy Cel", active: newOpen, onClick: () => setNewOpen(true) }}>
      <PageHeading title="Cele" eyebrow="Proste rezultaty do wykonania" />
      <Button className="mobile-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><Settings2 />Filtry ({activeFilterCount})</Button>
      <div className="goal-toolbar">
        {statusTabs()}
        <div className="goal-toolbar-side">
          <select aria-label="Typ Celu" value={kind ?? ""} onChange={(event) => { if (event.target.value) params.set("kind", event.target.value); else params.delete("kind"); setParams(params); }}><option value="">Każdy typ</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <Button onClick={() => setSettingsOpen(true)}><Settings2 />Szablony Celów</Button>
          {(kind || status !== "active") ? <Button variant="ghost" onClick={() => setParams({})}>Wyczyść filtry</Button> : null}
        </div>
      </div>
      <Modal open={filtersOpen} title={`Filtry Celów (${activeFilterCount})`} onClose={() => setFiltersOpen(false)}>
        <div className="mobile-filter-sheet">
          {statusTabs(true)}
          <label className="field-label" htmlFor="mobile-goal-kind">Typ Celu</label>
          <select id="mobile-goal-kind" value={kind ?? ""} onChange={(event) => { if (event.target.value) params.set("kind", event.target.value); else params.delete("kind"); setParams(params); }}><option value="">Każdy typ</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <div className="modal-actions"><Button variant="ghost" disabled={!activeFilterCount} onClick={() => setParams({})}>Wyczyść filtry</Button><Button variant="primary" onClick={() => setFiltersOpen(false)}>Pokaż {goals.length} Celów</Button></div>
        </div>
      </Modal>
      <p className="results-summary">{goalCountLabel(goals.length)}{kind ? ` · typ: ${kindLabels[kind]}` : ""}</p>
      {storeLoading ? <ListSkeleton label="Ładowanie Celów" /> : null}

      {goals.length ? <div className="goal-grid">{goals.map((goal) => {
        const areaName = state.areas.find((item) => item.id === goal.areaId)?.name;
        const next = state.actions.find((action) => action.goalId === goal.id && action.isNext && ["ready", "in_progress"].includes(action.status));
        const blocked = state.actions.some((action) => action.goalId === goal.id && action.status === "blocked");
        const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone }).format(new Date());
        const overdue = state.actions.some((action) => action.goalId === goal.id && action.scheduledFor && action.scheduledFor < localToday && !["completed", "cancelled", "skipped"].includes(action.status));
        const card = <>
          <div className="goal-card-top"><Badge tone={goal.priority === "high" ? "warning" : "neutral"}>{kindLabels[goal.kind]}</Badge><span>{statusLabels[goal.status]}</span></div>
          <h2 className="line-clamp-2">{goal.title}</h2>
          {areaName || next ? <div className="goal-card-context">{areaName ? <span><Layers3 />{areaName}</span> : null}{next ? <span><Flag />{next.title}</span> : null}</div> : null}
          <div className="goal-card-signals">{blocked ? <Badge tone="danger">Blokada</Badge> : null}{overdue ? <Badge tone="warning">Zaległe</Badge> : null}{!next && goal.status === "active" ? <Badge tone="warning">Brak następnego Działania</Badge> : null}</div>
        </>;
        return status === "archived" || status === "trashed"
          ? <Panel className={`${entityCardVariants({ density: "compact" })} goal-card entity-card`} key={goal.id}>{card}<Button onClick={() => void setGoalVisibility(goal.id, "active")}><RotateCcw />Przywróć</Button></Panel>
          : <NavigationLink className={`${entityCardVariants({ density: "compact" })} goal-card entity-card goal-card-link`} key={goal.id} data-navigation-card-id={navigationCardId("goal", goal.id)} tabIndex={-1} to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={[{ label: "Cele", to: "/goals" }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Cele" sourceCardId={navigationCardId("goal", goal.id)} aria-label={`Otwórz Cel: ${goal.title}`}>{card}</NavigationLink>;
      })}</div> : <EmptyState icon={<Flag />} title="Nie ma tu jeszcze Celów" detail={status === "active" ? "Użyj przycisku Cel na dole i zacznij od rezultatu, który jest dla Ciebie ważny." : "Zmień filtr albo przywróć Cel z archiwum."} action={status === "active" && !kind ? undefined : <Button onClick={() => setParams({})}>Wyczyść filtry</Button>} />}

      <Modal open={newOpen} title="Nowy cel" onClose={() => setNewOpen(false)}>
        <form className="guided-form" onSubmit={submitGoal} noValidate>
          <p className="modal-intro">Cel to prosty rezultat do wykonania. Wystarczy nazwa — resztę możesz dopisać później.</p>
          <details className="advanced-options"><summary>Więcej opcji <span className="optional-label">szablon, pierwszy krok i kryteria</span></summary><section className="guided-section"><div className="guided-section-title"><div><strong>Jaki to rodzaj Celu?</strong><small>Wybór zmienia tylko podpowiedzi.</small></div></div>
            <fieldset className="template-choice-grid"><legend className="sr-only">Rodzaj Celu</legend>{systemTemplates.map((item) => { const Icon = item.icon; return <button type="button" aria-pressed={form.templateId === item.id} key={item.id} onClick={() => setForm((current) => ({ ...current, templateId: item.id }))}><Icon /><span><strong>{item.name}</strong><small>{item.description}</small></span></button>; })}</fieldset>
            {state.goalTemplates.some((item) => item.visibility === "active") ? <><label className="field-label" htmlFor="goal-template">Własny szablon <span className="optional-label">opcjonalnie</span></label><select id="goal-template" value={state.goalTemplates.some((item) => item.id === form.templateId) ? form.templateId : ""} onChange={(event) => { const templateId = event.target.value || "blank"; const suggested = state.goalTemplates.find((item) => item.id === templateId)?.defaultActions[0]?.title; setForm((current) => ({ ...current, templateId, firstAction: current.firstAction || suggested || "" })); }}><option value="">Nie używaj własnego szablonu</option>{state.goalTemplates.filter((item) => item.visibility === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></> : null}
            {selectedSystemTemplate && selectedSystemTemplate.id !== "blank" ? <Button type="button" variant="ghost" onClick={() => void createGoalTemplate(`${selectedSystemTemplate.name} — własny`, selectedSystemTemplate.kind, form.firstAction ? [{ title: form.firstAction }] : []).then((id) => setForm((current) => ({ ...current, templateId: id })))}>Zapisz ten układ jako własny szablon</Button> : null}
            <label className="field-label" htmlFor="goal-first-action">Jaki jest pierwszy krok? <span className="optional-label">opcjonalnie</span></label><input id="goal-first-action" placeholder="Najmniejszy konkretny krok" value={form.firstAction} onChange={(event) => setForm((current) => ({ ...current, firstAction: event.target.value }))} />
            <label className="field-label" htmlFor="goal-criteria">Kryteria sukcesu <span className="optional-label">jedno w linii</span></label><textarea id="goal-criteria" placeholder={"Np. Stałe koszty są spisane\nLimit wydatków jest ustalony"} rows={3} value={form.criteria} onChange={(event) => setForm((current) => ({ ...current, criteria: event.target.value }))} />
          </section></details>
          <section className="guided-section"><div className="guided-section-title"><span>1</span><div><strong>Nazwij Cel</strong><small>Krótko i konkretnie — jak rezultat, który można zamknąć.</small></div></div>
            <label className="field-label" htmlFor="goal-title">Nazwa Celu</label>
            <input id="goal-title" placeholder="Np. Zbudować spokojny budżet domowy" aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "goal-title-error" : undefined} value={form.title} onChange={(event) => { setFieldErrors((current) => ({ ...current, title: undefined })); setForm((current) => ({ ...current, title: event.target.value })); }} required autoFocus />
            {fieldErrors.title ? <p id="goal-title-error" className="field-error" role="alert">{fieldErrors.title}</p> : null}
            <label className="field-label" htmlFor="goal-outcome">Po czym poznasz, że Cel jest gotowy? <span className="optional-label">opcjonalnie</span></label>
            <textarea id="goal-outcome" placeholder="Np. budżet na kolejny miesiąc jest zatwierdzony" rows={3} aria-invalid={Boolean(fieldErrors.outcome)} aria-describedby={fieldErrors.outcome ? "goal-outcome-error" : undefined} value={form.outcome} onChange={(event) => { setFieldErrors((current) => ({ ...current, outcome: undefined })); setForm((current) => ({ ...current, outcome: event.target.value })); }} />
            {fieldErrors.outcome ? <p id="goal-outcome-error" className="field-error" role="alert">{fieldErrors.outcome}</p> : null}
          </section>
          <section className="guided-section"><div className="guided-section-title"><span>2</span><div><strong>Dodaj kontekst</strong><small>Projekt pomaga od razu umieścić Cel we właściwym miejscu.</small></div></div>
            <label className="field-label" htmlFor="goal-area">Projekt <span className="optional-label">opcjonalnie</span></label><select id="goal-area" value={form.areaId} onChange={(event) => setForm((current) => ({ ...current, areaId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((item) => item.visibility === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </section>
        <div className="creation-summary goal-summary" aria-live="polite"><span className="creation-summary-icon"><Sparkles /></span><div><small>Nowy Cel</small><strong>{form.title.trim() || "Nazwij rezultat"}</strong><p>{form.outcome.trim() || "Szczegół wyniku możesz dopisać później."}</p><div className="summary-chips"><span><Layers3 />{selectedProject}</span>{criteriaCount ? <span>{criteriaCount} {criteriaCount === 1 ? "kryterium" : "kryteria"}</span> : null}</div>{form.firstAction.trim() ? <p className="summary-next"><ArrowRight />Pierwsze Działanie: {form.firstAction}</p> : null}</div></div>
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <div className={`modal-actions ${stickyFormActionsVariants({ align: "stretch" })}`}><Button type="button" onClick={() => setNewOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={loading} disabled={!form.title}>Utwórz cel</Button></div>
        </form>
      </Modal>

      <Modal open={settingsOpen} title="Własne szablony Celów" onClose={() => setSettingsOpen(false)}>
        <div className="settings-stack">
          <form onSubmit={(event) => { event.preventDefault(); const changes = { name: template.name, kind: template.kind, defaultActions: template.firstAction ? [{ title: template.firstAction }] : [] }; const operation = editingTemplateId ? updateGoalTemplate(editingTemplateId, changes) : createGoalTemplate(template.name, template.kind, changes.defaultActions).then(() => undefined); void operation.then(() => { setTemplate({ name: "", kind: "custom", firstAction: "" }); setEditingTemplateId(undefined); }); }}>
            <h3>{editingTemplateId ? "Edytuj własny szablon" : "Własny szablon Celu"}</h3><p>Gotowe propozycje pozostają niezmienne; własny szablon należy tylko do tej przestrzeni pracy.</p>
            <label className="field-label" htmlFor="template-name">Nazwa</label><input id="template-name" value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} required />
            <label className="field-label" htmlFor="template-kind">Charakter</label><select id="template-kind" value={template.kind} onChange={(event) => setTemplate((current) => ({ ...current, kind: event.target.value as GoalKind }))}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="field-label" htmlFor="template-action">Domyślne pierwsze Działanie</label><input id="template-action" value={template.firstAction} onChange={(event) => setTemplate((current) => ({ ...current, firstAction: event.target.value }))} />
            <Button type="submit" disabled={!template.name.trim()}>Zapisz szablon</Button>{editingTemplateId ? <Button type="button" variant="ghost" onClick={() => { setEditingTemplateId(undefined); setTemplate({ name: "", kind: "custom", firstAction: "" }); }}>Anuluj edycję</Button> : null}
            {state.goalTemplates.filter((item) => !item.system && item.visibility === "active").map((item) => <div className="settings-item" key={item.id}><span>{item.name}</span><Button type="button" variant="ghost" onClick={() => { setEditingTemplateId(item.id); setTemplate({ name: item.name, kind: item.kind, firstAction: item.defaultActions[0]?.title ?? "" }); }}>Edytuj</Button><Button type="button" variant="ghost" onClick={() => void setGoalTemplateVisibility(item.id, "archived")}>Archiwizuj</Button></div>)}
          </form>
        </div>
      </Modal>
    </AppShell>
  );
}
