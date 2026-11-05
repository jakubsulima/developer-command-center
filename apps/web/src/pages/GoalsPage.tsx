import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { useEffect, useMemo, useRef, useState } from "react";
import { CreationBody, CreationDialog, CreationFooter } from "../components/CreationForm";
import { Archive, Flag, Layers3, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { entityCardVariants } from "../components/ui-variants";
import { routeForEntity } from "../domain/routes";
import type { GoalKind, GoalStatus } from "../domain/types";
import { goalKindLabels as kindLabels, goalStatusLabels as statusLabels } from "../domain/labels";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId } from "../domain/navigation";


function goalCountLabel(count: number) {
  if (count === 1) return "1 Cel";
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? `${count} Cele` : `${count} Celów`;
}

export function GoalsPage() {
  const { state, loading: storeLoading, createGoalTemplate, updateGoalTemplate, setGoalVisibility, setGoalTemplateVisibility } = useStore();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const templateLocked = useRef(false);
  const [templateError, setTemplateError] = useState("");
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
  useEffect(() => { if (params.get("create") === "true") { requestAppQuickAdd({ mode: "goal", draftKey: "goals-list", goalKind: kind ?? undefined }); const next = new URLSearchParams(params); next.delete("create"); setParams(next, { replace: true }); } }, [kind, params, setParams]);

  const goals = useMemo(() => state.goals.filter((goal) => {
    const visibilityMatches = status === "archived" ? goal.visibility === "archived"
      : status === "trashed" ? goal.visibility === "trashed"
        : goal.visibility === "active" && (status === "all" || goal.status === status);
    return visibilityMatches && (!kind || goal.kind === kind);
  }), [kind, state.goals, status]);

  const saveTemplate = async () => {
    if (templateLocked.current || !template.name.trim()) return;
    templateLocked.current = true; setTemplateSaving(true); setTemplateError("");
    const snapshot = { ...template };
    const changes = { name: snapshot.name, kind: snapshot.kind, defaultActions: snapshot.firstAction ? [{ title: snapshot.firstAction }] : [] };
    try {
      if (editingTemplateId) await updateGoalTemplate(editingTemplateId, changes);
      else await createGoalTemplate(snapshot.name, snapshot.kind, changes.defaultActions);
      setTemplate({ name: "", kind: "custom", firstAction: "" }); setEditingTemplateId(undefined);
    } catch (caught) { setTemplateError(caught instanceof Error ? caught.message : "Nie udało się zapisać szablonu."); }
    finally { templateLocked.current = false; setTemplateSaving(false); }
  };


  return (
    <AppShell addAction={{ label: "Nowy Cel", shortLabel: "Cel", ariaLabel: "Dodaj nowy Cel", quickAdd: { mode: "goal", pinnedToToday: false, draftKey: "goals-list", goalKind: kind ?? undefined } }}>
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
          <h2 className="line-clamp-2">{goal.title}</h2><div className="goal-card-top"><Badge tone={goal.priority === "high" ? "warning" : "neutral"}>{kindLabels[goal.kind]}</Badge><span>{statusLabels[goal.status]}</span></div>
          {areaName || next ? <div className="goal-card-context">{areaName ? <span><Layers3 />{areaName}</span> : null}{next ? <span><Flag />{next.title}</span> : null}</div> : null}
          <div className="goal-card-signals">{blocked ? <Badge tone="danger">Blokada</Badge> : null}{overdue ? <Badge tone="warning">Zaległe</Badge> : null}{!next && goal.status === "active" ? <Badge tone="warning">Brak następnego Działania</Badge> : null}</div>
        </>;
        return status === "archived" || status === "trashed"
          ? <Panel className={`${entityCardVariants({ density: "compact" })} goal-card entity-card`} key={goal.id}>{card}<Button onClick={() => void setGoalVisibility(goal.id, "active")}><RotateCcw />Przywróć</Button></Panel>
          : <NavigationLink className={`${entityCardVariants({ density: "compact" })} goal-card entity-card goal-card-link`} key={goal.id} data-navigation-card-id={navigationCardId("goal", goal.id)} tabIndex={-1} to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={[{ label: "Cele", to: "/goals" }]} returnTo={locationAddress(location)} returnLabel="Wszystkie Cele" sourceCardId={navigationCardId("goal", goal.id)} aria-label={`Otwórz Cel: ${goal.title}`}>{card}</NavigationLink>;
      })}</div> : <EmptyState icon={<Flag />} title="Nie ma tu jeszcze Celów" detail={status === "active" ? "Użyj przycisku + w nagłówku i zacznij od rezultatu, który jest dla Ciebie ważny." : "Zmień filtr albo przywróć Cel z archiwum."} action={status === "active" && !kind ? undefined : <Button onClick={() => setParams({})}>Wyczyść filtry</Button>} />}

      <CreationDialog open={settingsOpen} title="Własne szablony Celów" closeDisabled={templateSaving} onClose={() => { if (!templateLocked.current) setSettingsOpen(false); }}>
        <div className="quick-add"><CreationBody>
          <form id="goal-template-settings" onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }}><fieldset className="creation-fields" disabled={templateSaving}>
            <h3>{editingTemplateId ? "Edytuj własny szablon" : "Własny szablon Celu"}</h3><p>Gotowe propozycje pozostają niezmienne; własny szablon należy tylko do tej przestrzeni pracy.</p>
            <label className="field-label" htmlFor="template-name">Nazwa</label><input id="template-name" value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} required />
            <label className="field-label" htmlFor="template-kind">Charakter</label><select id="template-kind" value={template.kind} onChange={(event) => setTemplate((current) => ({ ...current, kind: event.target.value as GoalKind }))}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="field-label" htmlFor="template-action">Domyślne pierwsze Działanie</label><input id="template-action" value={template.firstAction} onChange={(event) => setTemplate((current) => ({ ...current, firstAction: event.target.value }))} />
            {editingTemplateId ? <Button type="button" variant="ghost" onClick={() => { setEditingTemplateId(undefined); setTemplate({ name: "", kind: "custom", firstAction: "" }); }}>Anuluj edycję</Button> : null}
            {state.goalTemplates.filter((item) => !item.system && item.visibility === "active").map((item) => <div className="settings-item" key={item.id}><span>{item.name}</span><Button type="button" variant="ghost" onClick={() => { setEditingTemplateId(item.id); setTemplate({ name: item.name, kind: item.kind, firstAction: item.defaultActions[0]?.title ?? "" }); }}>Edytuj</Button><Button type="button" variant="ghost" onClick={() => void setGoalTemplateVisibility(item.id, "archived")}>Archiwizuj</Button></div>)}
          </fieldset></form>{templateError ? <p role="alert">{templateError}</p> : null}
        </CreationBody><CreationFooter><Button type="button" disabled={templateSaving} onClick={() => setSettingsOpen(false)}>Zamknij</Button><Button type="submit" form="goal-template-settings" loading={templateSaving} disabled={!template.name.trim()}>Zapisz szablon</Button></CreationFooter></div>
      </CreationDialog>
    </AppShell>
  );
}
