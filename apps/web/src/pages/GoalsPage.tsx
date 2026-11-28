import { actionGroupType, actionGroupTypeLabels } from "../domain/actionGroups";
import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { useEffect, useMemo, useRef, useState } from "react";
import { CreationBody, CreationDialog, CreationFooter } from "../components/CreationForm";
import { Archive, ChevronRight, Flag, Folder, Layers3, ListChecks, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { routeForEntity } from "../domain/routes";
import type { GoalKind, GoalStatus } from "../domain/types";
import { goalKindLabels as kindLabels, goalStatusLabels as statusLabels, polishPluralForm } from "../domain/labels";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId } from "../domain/navigation";
import "./goals-workspace.css";


function goalCountLabel(count: number) {
  return `${count} ${polishPluralForm(count, "grupa działań", "grupy działań", "grup działań")}`;
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
  const groupType = params.get("groupType");
  const kind = params.get("kind") as GoalKind | null;
  const activeFilterCount = Number(status !== "active") + Number(Boolean(kind)) + Number(Boolean(groupType));
  const statusButtons = <div className="filter-pills goal-status-filters" role="group" aria-label="Stan grup działań">
    {([
      ["active", "Aktywne"], ["paused", "Wstrzymane"], ["achieved", "Ukończone"], ["abandoned", "Porzucone"], ["all", "Wszystkie"], ["archived", "Archiwum"], ["trashed", "Kosz"]
    ] as const).map(([value, label]) => <Button type="button" key={value} aria-pressed={status === value} variant={status === value ? "secondary" : "ghost"} onClick={() => {
      const next = new URLSearchParams(params);
      if (value === "active") next.delete("status");
      else next.set("status", value);
      setParams(next);
    }}>{value === "archived" ? <Archive aria-hidden="true" /> : value === "trashed" ? <Trash2 aria-hidden="true" /> : null}{label}</Button>)}
  </div>;
  useEffect(() => {
    const next = new URLSearchParams(params);
    let changed = false;
    if (!["active", "paused", "achieved", "abandoned", "archived", "trashed", "all"].includes(status)) { next.set("status", "active"); changed = true; }
    if (groupType && !["category", "task"].includes(groupType)) { next.delete("groupType"); changed = true; }
    if (kind && !Object.prototype.hasOwnProperty.call(kindLabels, kind)) { next.delete("kind"); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [groupType, kind, params, setParams, status]);
  useEffect(() => { if (params.get("create") === "true") { requestAppQuickAdd({ mode: "goal", draftKey: "goals-list", groupType: groupType === "task" ? "task" : "category", goalKind: kind ?? undefined }); const next = new URLSearchParams(params); next.delete("create"); setParams(next, { replace: true }); } }, [groupType, kind, params, setParams]);

  const goals = useMemo(() => state.goals.filter((goal) => {
    const visibilityMatches = status === "archived" ? goal.visibility === "archived"
      : status === "trashed" ? goal.visibility === "trashed"
        : goal.visibility === "active" && (status === "all" || goal.status === status);
    return visibilityMatches && (!kind || goal.kind === kind) && (!groupType || actionGroupType(goal) === groupType);
  }), [groupType, kind, state.goals, status]);

  const groupTypeFilter = (id: string) => <><label className="field-label" htmlFor={id}>Typ grupy</label><select id={id} value={groupType ?? ""} onChange={(event) => { const next = new URLSearchParams(params); if (event.target.value) next.set("groupType", event.target.value); else next.delete("groupType"); setParams(next); }}><option value="">Każdy typ grupy</option><option value="category">Kategorie</option><option value="task">Zadania nadrzędne</option></select></>;

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
    <AppShell addAction={{ label: "Nowa grupa działań", shortLabel: "Grupa działań", ariaLabel: "Dodaj nową grupę działań", quickAdd: { mode: "goal", pinnedToToday: false, draftKey: "goals-list", groupType: groupType === "task" ? "task" : "category", goalKind: kind ?? undefined } }}>
      <PageHeading title="Grupy działań" eyebrow="Kategorie i zadania nadrzędne z działaniami" />
      <div className="goals-index">
      <Button className="mobile-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}><Settings2 />Filtry ({activeFilterCount})</Button>
      <div className="goal-toolbar">
        {statusButtons}
        <div className="goal-toolbar-side"><div className="goal-kind-filter">{groupTypeFilter("desktop-group-type")}</div>
          <label className="field-label goal-kind-filter">Rodzaj zadania<select aria-label="Rodzaj zadania" value={kind ?? ""} onChange={(event) => { if (event.target.value) params.set("kind", event.target.value); else params.delete("kind"); setParams(params); }}><option value="">Wszystkie rodzaje</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <Button onClick={() => setSettingsOpen(true)}><Settings2 />Szablony zadań</Button>
          {(kind || groupType || status !== "active") ? <Button variant="ghost" onClick={() => setParams({})}>Wyczyść filtry</Button> : null}
        </div>
      </div>
      <Modal open={filtersOpen} title={`Filtry grup działań (${activeFilterCount})`} onClose={() => setFiltersOpen(false)}>
        <div className="mobile-filter-sheet">{groupTypeFilter("mobile-group-type")}
          {statusButtons}
          <label className="field-label" htmlFor="mobile-goal-kind">Rodzaj zadania</label>
          <select id="mobile-goal-kind" value={kind ?? ""} onChange={(event) => { if (event.target.value) params.set("kind", event.target.value); else params.delete("kind"); setParams(params); }}><option value="">Wszystkie rodzaje</option>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <div className="modal-actions"><Button variant="ghost" disabled={!activeFilterCount} onClick={() => setParams({})}>Wyczyść filtry</Button><Button variant="primary" onClick={() => setFiltersOpen(false)}>Pokaż {goalCountLabel(goals.length)}</Button></div>
        </div>
      </Modal>
      <p className="results-summary">{goalCountLabel(goals.length)}{kind ? ` · typ: ${kindLabels[kind]}` : ""}</p>
      {storeLoading ? <ListSkeleton label="Ładowanie grup działań" /> : null}

      {goals.length ? <><div className="goal-list-columns" aria-hidden="true"><span>Grupa</span><span>Projekt</span><span>Następne Działanie</span></div><div className="goal-grid">{goals.map((goal) => {
        const type = actionGroupType(goal);
        const GroupIcon = type === "category" ? Layers3 : ListChecks;
        const isHistory = goal.visibility !== "active";
        const cardId = navigationCardId("goal", goal.id);
        const areaName = state.areas.find((item) => item.id === goal.areaId)?.name;
        const next = state.actions.find((action) => action.goalId === goal.id && action.isNext && ["ready", "in_progress"].includes(action.status));
        const blocked = state.actions.some((action) => action.goalId === goal.id && action.status === "blocked");
        const localToday = new Intl.DateTimeFormat("en-CA", { timeZone: state.workspaceTimezone }).format(new Date());
        const overdueCount = state.actions.filter((action) => action.goalId === goal.id && action.scheduledFor && action.scheduledFor < localToday && !["completed", "cancelled", "skipped"].includes(action.status)).length;
        const missingNext = !next && type === "task" && goal.status === "active";
        const hasSignals = blocked || overdueCount > 0 || missingNext;
        const card = <>
          <div className="goal-card-identity">
            <span className="goal-card-icon" data-priority={goal.priority}><GroupIcon aria-hidden="true" /></span>
            <div>
              <h2>{goal.title}</h2>
              <div className="goal-card-meta">
                <span>{actionGroupTypeLabels[type]}</span>
                <span className="goal-card-status" data-status={goal.status}>{statusLabels[goal.status]}</span>
                {goal.priority === "high" ? <span className="sr-only">Wysoki priorytet</span> : null}
              </div>
            </div>
          </div>
          <div className="goal-card-details">
            {areaName ? <span className="goal-card-project"><Folder aria-hidden="true" />{areaName}</span> : <span className="collection-desktop-placeholder goal-card-project">Bez Projektu</span>}
            {next || hasSignals ? <div className="goal-card-work">
              {next ? <span className="goal-card-next"><Flag aria-hidden="true" /><span className="sr-only">Następne Działanie</span>{next.title}</span> : null}
              {hasSignals ? <div className="goal-card-signals">
                {blocked ? <Badge tone="danger">Blokada</Badge> : null}
                {overdueCount > 0 ? <Badge tone="warning">{overdueCount} {polishPluralForm(overdueCount, "zaległe działanie", "zaległe działania", "zaległych działań")} w grupie</Badge> : null}
                {missingNext ? <Badge tone="warning">Brak następnego Działania</Badge> : null}
              </div> : null}
            </div> : null}
          </div>
          {!isHistory ? <ChevronRight className="goal-card-chevron" aria-hidden="true" /> : null}
        </>;
        return isHistory
          ? <Panel className="goal-card" key={goal.id}>{card}<Button onClick={() => void setGoalVisibility(goal.id, "active")}><RotateCcw aria-hidden="true" />Przywróć</Button></Panel>
          : <NavigationLink className="goal-card goal-card-link" key={goal.id} data-navigation-card-id={cardId} to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={[{ label: "Grupy działań", to: "/goals" }]} returnTo={locationAddress(location)} returnLabel="Wszystkie grupy" sourceCardId={cardId} aria-label={`Otwórz grupę: ${goal.title}`}>{card}</NavigationLink>;
      })}</div></> : <EmptyState icon={<Flag />} title="Nie ma tu jeszcze grup działań" detail={status === "active" ? "Użyj przycisku + w nagłówku i dodaj kategorię, np. UI/UX, albo zadanie nadrzędne." : "Zmień filtr albo przywróć grupę z archiwum."} action={status === "active" && !kind ? undefined : <Button onClick={() => setParams({})}>Wyczyść filtry</Button>} />}

      <CreationDialog open={settingsOpen} title="Własne szablony zadań" closeDisabled={templateSaving} onClose={() => { if (!templateLocked.current) setSettingsOpen(false); }}>
        <div className="quick-add"><CreationBody>
          <form id="goal-template-settings" onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }}><fieldset className="creation-fields" disabled={templateSaving}>
            <h3>{editingTemplateId ? "Edytuj własny szablon" : "Własny szablon zadania"}</h3><p>Gotowe propozycje pozostają niezmienne; własny szablon należy tylko do tej przestrzeni pracy.</p>
            <label className="field-label" htmlFor="template-name">Nazwa</label><input id="template-name" value={template.name} onChange={(event) => setTemplate((current) => ({ ...current, name: event.target.value }))} required />
            <label className="field-label" htmlFor="template-kind">Charakter</label><select id="template-kind" value={template.kind} onChange={(event) => setTemplate((current) => ({ ...current, kind: event.target.value as GoalKind }))}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label className="field-label" htmlFor="template-action">Domyślne pierwsze Działanie</label><input id="template-action" value={template.firstAction} onChange={(event) => setTemplate((current) => ({ ...current, firstAction: event.target.value }))} />
            {editingTemplateId ? <Button type="button" variant="ghost" onClick={() => { setEditingTemplateId(undefined); setTemplate({ name: "", kind: "custom", firstAction: "" }); }}>Anuluj edycję</Button> : null}
            {state.goalTemplates.filter((item) => !item.system && item.visibility === "active").map((item) => <div className="settings-item" key={item.id}><span>{item.name}</span><Button type="button" variant="ghost" onClick={() => { setEditingTemplateId(item.id); setTemplate({ name: item.name, kind: item.kind, firstAction: item.defaultActions[0]?.title ?? "" }); }}>Edytuj</Button><Button type="button" variant="ghost" onClick={() => void setGoalTemplateVisibility(item.id, "archived")}>Archiwizuj</Button></div>)}
          </fieldset></form>{templateError ? <p role="alert">{templateError}</p> : null}
        </CreationBody><CreationFooter><Button type="button" disabled={templateSaving} onClick={() => setSettingsOpen(false)}>Zamknij</Button><Button type="submit" form="goal-template-settings" loading={templateSaving} disabled={!template.name.trim()}>Zapisz szablon</Button></CreationFooter></div>
      </CreationDialog>
      </div>
    </AppShell>
  );
}
