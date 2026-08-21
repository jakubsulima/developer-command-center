import { Archive, BookMarked, FileCode2, FileText, FlaskConical, Inbox, Link2, MoreHorizontal, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Badge, Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import type { KnowledgeItem, KnowledgeKind } from "../domain/types";
import { useActionFeedback } from "../components/action-feedback-context";
import { MultiCombobox } from "../components/MultiCombobox";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { routeForEntity } from "../domain/routes";
import { KnowledgeInbox } from "./InboxPage";

const kinds = {
  artifact: { icon: FileCode2, label: "Rezultat" },
  decision: { icon: FileText, label: "Decyzja" },
  resource: { icon: Link2, label: "Materiał" },
  note: { icon: BookMarked, label: "Notatka" },
  investigation: { icon: FlaskConical, label: "Poszukiwanie" }
} as const;

type View = "active" | "archived" | "trashed";

export function KnowledgePage() {
  const { state, loading, createKnowledge, setVisibility } = useStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [query, setQuery] = useState("");
  const section = params.get("section") === "inbox" ? "inbox" : "library";
  const captureOpen = params.get("capture") === "true";
  const pending = state.inbox.filter((item) => item.status === "unprocessed").length;
  const kind = (params.get("kind") ?? "all") as KnowledgeKind | "all";
  const goalFilter = params.get("goal") ?? "";
  const areaFilter = params.get("area") ?? "";
  const [view, setView] = useState<View>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionsItemId, setActionsItemId] = useState<string>();
  const [form, setForm] = useState<{ kind: KnowledgeKind; title: string; detail: string; goalIds: string[]; sourceUrl: string }>({ kind: "note", title: "", detail: "", goalIds: [], sourceUrl: "" });
  const normalized = query.trim().toLocaleLowerCase("pl");
  useEffect(() => { const legacyId = section === "library" ? params.get("item") : null; if (legacyId) navigate(`/knowledge/${legacyId}`, { replace: true }); }, [navigate, params, section]);
  useEffect(() => {
    const next = new URLSearchParams(params); let changed = false;
    if (kind !== "all" && !Object.prototype.hasOwnProperty.call(kinds, kind)) { next.delete("kind"); changed = true; }
    if (goalFilter && !state.goals.some((goal) => goal.id === goalFilter)) { next.delete("goal"); changed = true; }
    if (areaFilter && !state.areas.some((area) => area.id === areaFilter)) { next.delete("area"); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [areaFilter, goalFilter, kind, params, setParams, state.areas, state.goals]);
  const results = state.knowledge.filter((item) => {
    const visible = view === "active" ? !item.archivedAt && !item.trashedAt : view === "archived" ? Boolean(item.archivedAt) && !item.trashedAt : Boolean(item.trashedAt);
    const links = state.knowledgeLinks.filter((link) => link.knowledgeItemId === item.id);
    const linkedToGoal = !goalFilter || links.some((link) => link.goalId === goalFilter || state.actions.some((action) => action.id === link.actionId && action.goalId === goalFilter));
    const linkedToArea = !areaFilter || links.some((link) => link.areaId === areaFilter || state.goals.some((goal) => goal.id === link.goalId && goal.areaId === areaFilter) || state.actions.some((action) => action.id === link.actionId && action.areaId === areaFilter));
    return visible && linkedToGoal && linkedToArea && (kind === "all" || item.type === kind) && (!normalized || `${item.title} ${item.detail}`.toLocaleLowerCase("pl").includes(normalized));
  });
  const create = async () => {
    if (!form.title.trim() || createSaving) return;
    setCreateSaving(true);
    setCreateError("");
    try {
      await createKnowledge(form.kind, form.title, form.detail, undefined, form.sourceUrl || undefined, form.goalIds);
      setForm({ kind: "note", title: "", detail: "", goalIds: [], sourceUrl: "" });
      setModalOpen(false);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Nie udało się zapisać elementu Wiedzy.");
    } finally {
      setCreateSaving(false);
    }
  };
  const changeVisibility = async (item: KnowledgeItem, visibility: "archived" | "trashed") => {
    const previous = item.trashedAt ? "trashed" : item.archivedAt ? "archived" : "active";
    await setVisibility("knowledge", item.id, visibility);
    notifyUndo({
      message: visibility === "archived" ? `„${item.title}” przeniesiono do Archiwum.` : `„${item.title}” przeniesiono do Kosza.`,
      undo: () => setVisibility("knowledge", item.id, previous)
    });
  };

  return (
    <AppShell>
      <PageHeading title="Wiedza" eyebrow="Twoja biblioteka materiałów, notatek i decyzji" />
      <div className="knowledge-section-bar">
        <div className="knowledge-section-tabs" role="tablist" aria-label="Obszary Wiedzy">
          <button type="button" role="tab" aria-selected={section === "library"} onClick={() => { params.delete("section"); params.delete("status"); params.delete("item"); params.delete("capture"); setParams(params); }}><BookMarked /><span>Biblioteka</span><small>{state.knowledge.filter((item) => !item.archivedAt && !item.trashedAt).length}</small></button>
          <button type="button" role="tab" aria-selected={section === "inbox"} onClick={() => { params.set("section", "inbox"); setParams(params); }}><Inbox /><span>Do przejrzenia</span>{pending > 0 ? <small>{pending}</small> : null}</button>
        </div>
        <button
          type="button"
          className="knowledge-add-trigger"
          aria-label={section === "library" ? "Nowy element" : captureOpen ? "Zamknij dodawanie" : "Dodaj do kolejki Wiedzy"}
          aria-expanded={section === "inbox" ? captureOpen : undefined}
          title={section === "library" ? "Nowy element Wiedzy" : captureOpen ? "Zamknij dodawanie" : "Dodaj do kolejki Wiedzy"}
          onClick={() => {
            if (section === "library") { setModalOpen(true); return; }
            const next = new URLSearchParams(params);
            if (captureOpen) next.delete("capture"); else next.set("capture", "true");
            setParams(next);
          }}
        ><Plus /></button>
      </div>
      {section === "inbox" ? <KnowledgeInbox /> : <>
      <div className="knowledge-controls">
        <div className="knowledge-toolbar">
          <div className="knowledge-search"><Search /><input type="search" aria-label="Szukaj w wiedzy" placeholder="Szukaj w bibliotece…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <label className="sr-only" htmlFor="knowledge-kind">Filtr typu</label>
          <select id="knowledge-kind" value={kind} onChange={(event) => { if (event.target.value === "all") params.delete("kind"); else params.set("kind", event.target.value); setParams(params); }}><option value="all">Wszystkie rodzaje</option>{Object.entries(kinds).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select>
        </div>
        <div className="knowledge-filter-row"><select aria-label="Filtr Celu" value={goalFilter} onChange={(event) => { if (event.target.value) params.set("goal", event.target.value); else params.delete("goal"); setParams(params); }}><option value="">Każdy Cel</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select><select aria-label="Filtr Obszaru" value={areaFilter} onChange={(event) => { if (event.target.value) params.set("area", event.target.value); else params.delete("area"); setParams(params); }}><option value="">Każdy Obszar</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
      </div>
      <div className="knowledge-view-row">
        <Tabs value={view} onValueChange={(value) => setView(value as View)} className="knowledge-views" aria-label="Widoczność obiektów">
        <TabsList className="knowledge-view-tabs h-auto">
          <TabsTrigger className="min-h-10" value="active">Aktywne</TabsTrigger>
          <TabsTrigger className="min-h-10" value="archived"><Archive />Archiwum</TabsTrigger>
          <TabsTrigger className="min-h-10" value="trashed"><Trash2 />Kosz</TabsTrigger>
        </TabsList>
        </Tabs>
        <p className="results-summary" aria-live="polite">{results.length} {results.length === 1 ? "element" : "elementów"}{kind !== "all" || goalFilter || areaFilter || normalized ? " · aktywne filtry" : ""}</p>
      </div>
      {loading ? <ListSkeleton label="Ładowanie Wiedzy" /> : null}
      {results.length ? (
        <div className="knowledge-library-surface"><div className="knowledge-list">
          {results.map((item) => {
            const { icon: Icon, label } = kinds[item.type];
            const mutationKey = `visibility:${item.id}`;
            const relationships = state.knowledgeLinks.filter((link) => link.knowledgeItemId === item.id).map((link) => state.goals.find((goal) => goal.id === link.goalId)?.title ?? state.actions.find((action) => action.id === link.actionId)?.title ?? state.knowledge.find((knowledge) => knowledge.id === link.targetKnowledgeItemId)?.title).filter(Boolean).join(" · ");
            return (
              <Panel className="entity-card" key={item.id}>
                <span className="knowledge-kind-icon" aria-hidden="true"><Icon /></span>
                <span className="knowledge-row-content"><Link className="knowledge-title-link entity-card-open" to={routeForEntity({ type: "knowledge", id: item.id })}><strong className="line-clamp-2">{item.title}</strong></Link><small className="line-clamp-2">{item.detail || "Bez dodatkowego opisu"}</small>{relationships || item.sourceInboxItemId ? <span className="knowledge-row-meta">{relationships ? <small className="line-clamp-1">Powiązane: {relationships}</small> : null}{item.sourceInboxItemId ? <small>Źródło: kolejka Wiedzy</small> : null}</span> : null}{mutation.error(mutationKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(mutationKey)} <button type="button" onClick={() => void mutation.retry(mutationKey)?.()}>Spróbuj ponownie</button></p> : null}</span>
                <Badge tone="neutral">{label}</Badge>
                <div className="knowledge-actions">
                  <Button variant="ghost" loading={mutation.isBusy(mutationKey)} aria-label={`Więcej opcji: ${item.title}`} title="Więcej opcji" onClick={() => setActionsItemId(item.id)}><MoreHorizontal /></Button>
                </div>
              </Panel>
            );
          })}
        </div></div>
      ) : <EmptyState icon={<BookMarked />} title={normalized ? "Brak pasujących obiektów" : `Brak obiektów: ${view === "active" ? "aktywne" : view === "archived" ? "Archiwum" : "Kosz"}`} detail={normalized ? "Spróbuj krótszego zapytania albo innego słowa." : "Notatki, materiały, decyzje, rezultaty i poszukiwania pojawią się tu po świadomym zapisaniu."} action={normalized || kind !== "all" || goalFilter || areaFilter ? <Button onClick={() => { setQuery(""); setParams({}); }}>Wyczyść filtry</Button> : <Button variant="primary" onClick={() => setModalOpen(true)}>Nowy element Wiedzy</Button>} />}
      <Modal open={Boolean(actionsItemId)} closeDisabled={Boolean(actionsItemId && mutation.isBusy(`visibility:${actionsItemId}`))} title="Wiedza — więcej opcji" onClose={() => setActionsItemId(undefined)}>{(() => {
        const item = state.knowledge.find((candidate) => candidate.id === actionsItemId);
        if (!item) return null;
        const mutationKey = `visibility:${item.id}`;
        const runAndClose = (operation: () => Promise<void>) => mutation.run(mutationKey, async () => { await operation(); setActionsItemId(undefined); });
        return <div className="mobile-action-sheet">
          {view === "active" ? <><Button loading={mutation.isBusy(mutationKey)} onClick={() => void runAndClose(() => changeVisibility(item, "archived"))}><Archive />Archiwizuj</Button><Button variant="danger" loading={mutation.isBusy(mutationKey)} onClick={() => void runAndClose(() => changeVisibility(item, "trashed"))}><Trash2 />Przenieś do Kosza</Button></> : null}
          {view === "archived" ? <><Button loading={mutation.isBusy(mutationKey)} onClick={() => void runAndClose(() => setVisibility("knowledge", item.id, "active"))}><RotateCcw />Przywróć</Button><Button variant="danger" loading={mutation.isBusy(mutationKey)} onClick={() => void runAndClose(() => changeVisibility(item, "trashed"))}><Trash2 />Przenieś do Kosza</Button></> : null}
          {view === "trashed" ? <Button loading={mutation.isBusy(mutationKey)} onClick={() => void runAndClose(() => setVisibility("knowledge", item.id, "active"))}><RotateCcw />Przywróć</Button> : null}
          {mutation.error(mutationKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(mutationKey)} <button type="button" onClick={() => void mutation.retry(mutationKey)?.()}>Spróbuj ponownie</button></p> : null}
        </div>;
      })()}</Modal>
      <Modal open={modalOpen} closeDisabled={createSaving} title="Nowy element Wiedzy" onClose={() => setModalOpen(false)}>
        <label className="field-label" htmlFor="knowledge-new-kind">Rodzaj</label>
        <select id="knowledge-new-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>{Object.entries(kinds).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select>
        <label className="field-label" htmlFor="knowledge-title">Tytuł / pytanie</label>
        <input id="knowledge-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        <label className="field-label" htmlFor="knowledge-detail">Treść</label>
        <textarea id="knowledge-detail" rows={5} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
        <span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span>
        <MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={form.goalIds} onChange={(goalIds) => setForm((current) => ({ ...current, goalIds }))} />
        {form.kind === "resource" && <><label className="field-label" htmlFor="knowledge-url">URL źródła</label><input id="knowledge-url" type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></>}
        {createError ? <p className="auth-message error" role="alert">{createError}</p> : null}
        <div className="modal-actions"><Button disabled={createSaving} onClick={() => setModalOpen(false)}>Anuluj</Button><Button variant="primary" loading={createSaving} disabled={!form.title.trim()} onClick={() => void create()}>Zapisz w Wiedzy</Button></div>
      </Modal>
      </>}
    </AppShell>
  );
}
