import { Archive, BookMarked, Box, FileText, GitBranch, Inbox, Library, MoreHorizontal, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Button, EmptyState, ListSkeleton, Panel } from "../components/ui";
import type { KnowledgeItem, KnowledgeKind, ReadingStatus } from "../domain/types";
import { useActionFeedback } from "../components/action-feedback-context";
import { MultiCombobox } from "../components/MultiCombobox";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { routeForEntity } from "../domain/routes";
import { KnowledgeInbox } from "./InboxPage";
import { KnowledgeKindBadge } from "../components/KnowledgeKindBadge";
import { knowledgeDefaultRelationMeaning, polishCount, readingStatusLabels } from "../domain/labels";
import { entityCardVariants } from "../components/ui-variants";
import { mergePagedItems, useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId } from "../domain/navigation";
import { projectKnowledgeIds } from "../domain/projectModule";
import { filterableKnowledgeKinds, isFilterableKnowledgeKind, knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { knowledgeKindLabels } from "../domain/labels";
import { FormTransition } from "../components/FormTransition";
import { KnowledgeKindPicker } from "../components/KnowledgeKindPicker";
import { normalizeHttpUrl } from "../domain/http-url";

type View = "active" | "archived" | "trashed";

const knowledgeKindIcons = {
  note: FileText,
  resource: Library,
  decision: GitBranch,
  artifact: Box
} as const;

export function KnowledgePage() {
  const { state, loading, createKnowledge, setVisibility } = useStore();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const [query, setQuery] = useState("");
  const section = params.get("section") === "inbox" ? "inbox" : "library";
  const captureOpen = params.get("capture") === "true";
  const pending = state.inbox.filter((item) => item.status === "unprocessed").length;
  const kind = (params.get("kind") ?? "all") as KnowledgeKind | "all";
  const booksOnly = params.get("format") === "book";
  const statusParam = params.get("readingStatus");
  const readingStatus = (["to_read", "reading", "read", "paused", "abandoned"] as string[]).includes(statusParam ?? "") ? statusParam as ReadingStatus : undefined;
  const goalFilter = params.get("goal") ?? "";
  const areaFilter = params.get("area") ?? "";
  const [view, setView] = useState<View>("active");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionsItemId, setActionsItemId] = useState<string>();
  const normalized = query.trim().toLocaleLowerCase("pl");
  const [form, setForm] = useState<{ kind: CreatableKnowledgeKind; title: string; detail: string; goalIds: string[]; areaId: string; sourceUrl: string; isBook: boolean; resourceAuthor: string; readingStatus: ReadingStatus; sourceBookId: string }>({ kind: "note", title: "", detail: "", goalIds: [], areaId: "", sourceUrl: "", isBook: false, resourceAuthor: "", readingStatus: "to_read", sourceBookId: "" });
  const knowledgePage = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { resourceFormat: booksOnly ? "book" : undefined, readingStatus, knowledgeKind: booksOnly ? "resource" : kind === "all" ? undefined : kind, searchText: normalized });
  const booksPage = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { resourceFormat: "book" });
  const bookOptions = [...new Map([...(booksPage.data?.items ?? []), ...state.knowledge].filter((item) => item.resourceFormat === "book" && !item.archivedAt && !item.trashedAt).map((item) => [item.id, item])).values()];
  const advancedFilterCount = Number(Boolean(goalFilter)) + Number(Boolean(areaFilter)) + Number(Boolean(readingStatus)) + Number(booksOnly) + Number(view !== "active");
  const areaKnowledgeIds = useMemo(() => areaFilter ? projectKnowledgeIds(state, areaFilter) : undefined, [areaFilter, state]);
  useEffect(() => { const legacyId = section === "library" ? params.get("item") : null; if (legacyId) navigate(`/knowledge/${legacyId}`, { replace: true }); }, [navigate, params, section]);
  useEffect(() => {
    const next = new URLSearchParams(params); let changed = false;
    if (kind !== "all" && !isFilterableKnowledgeKind(kind)) { next.delete("kind"); changed = true; }
    if (statusParam && !readingStatus) { next.delete("readingStatus"); changed = true; }
    if (goalFilter && !state.goals.some((goal) => goal.id === goalFilter)) { next.delete("goal"); changed = true; }
    if (areaFilter && !state.areas.some((area) => area.id === areaFilter)) { next.delete("area"); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [areaFilter, goalFilter, kind, params, readingStatus, setParams, state.areas, state.goals, statusParam]);
  const knowledgeItems = mergePagedItems(state.knowledge, knowledgePage.data?.items ?? []);
  const results = knowledgeItems.filter((item) => {
    const visible = view === "active" ? !item.archivedAt && !item.trashedAt : view === "archived" ? Boolean(item.archivedAt) && !item.trashedAt : Boolean(item.trashedAt);
    const links = state.knowledgeLinks.filter((link) => link.knowledgeItemId === item.id);
    const linkedToGoal = !goalFilter || links.some((link) => link.goalId === goalFilter || state.actions.some((action) => action.id === link.actionId && action.goalId === goalFilter));
    const linkedToArea = !areaFilter || areaKnowledgeIds?.has(item.id);
    const matchesReadingState = (!booksOnly || item.resourceFormat === "book") && (!readingStatus || (item.resourceFormat === "book" && item.readingStatus === readingStatus));
    return visible && linkedToGoal && linkedToArea && matchesReadingState && (booksOnly || kind === "all" || item.type === kind) && (!normalized || `${item.title} ${item.detail} ${item.resourceAuthor ?? ""}`.toLocaleLowerCase("pl").includes(normalized));
  });
  const create = async (event?: FormEvent) => {
    event?.preventDefault();
    const guidance = knowledgeKindGuidance[form.kind];
    if (!form.title.trim() || (guidance.detailRequired && !form.detail.trim()) || createSaving) return;
    setCreateSaving(true);
    setCreateError("");
    try {
      const sourceUrl = form.kind === "resource" ? normalizeHttpUrl(form.sourceUrl) : undefined;
      const relations = [
        ...(form.areaId ? [{ meaning: knowledgeDefaultRelationMeaning(form.kind), target: { areaId: form.areaId } }] : []),
        ...form.goalIds.map((goalId) => ({ meaning: knowledgeDefaultRelationMeaning(form.kind), target: { goalId } })),
        ...(form.kind === "note" && form.sourceBookId ? [{ meaning: "source" as const, target: { targetKnowledgeItemId: form.sourceBookId } }] : [])
      ];
      const resourceFormat = form.kind === "resource" && form.isBook ? "book" : undefined;
      await createKnowledge({ kind: form.kind, title: form.title, detail: form.detail, sourceUrl, relations, resourceFormat, resourceAuthor: resourceFormat ? form.resourceAuthor : undefined, readingStatus: resourceFormat ? form.readingStatus : undefined });
      setForm({ kind: "note", title: "", detail: "", goalIds: [], areaId: "", sourceUrl: "", isBook: false, resourceAuthor: "", readingStatus: "to_read", sourceBookId: "" });
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
  const openContextualAdd = () => {
    if (section === "library") {
      setModalOpen(true);
      return;
    }
    const next = new URLSearchParams(params);
    if (captureOpen) next.delete("capture"); else next.set("capture", "true");
    setParams(next);
  };

  return (
    <AppShell addAction={{
      label: section === "library" ? "Nowa Wiedza" : captureOpen ? "Zamknij Skrzynkę" : "Do Skrzynki",
      shortLabel: section === "library" ? "Wiedza" : "Skrzynka",
      ariaLabel: section === "library" ? "Dodaj nowy element Wiedzy" : captureOpen ? "Zamknij dodawanie do Skrzynki" : "Dodaj do Skrzynki",
      active: section === "library" ? modalOpen : captureOpen,
      quickAdd: captureOpen || section === "library" ? undefined : { mode: "inbox", pinnedToToday: false, draftKey: "knowledge-inbox" },
      onClick: openContextualAdd
    }}>
      <div className="knowledge-page-heading"><PageHeading title="Wiedza" eyebrow="Biblioteka materiałów i Skrzynka do późniejszego przetworzenia" /></div>
      <div className="knowledge-section-bar">
        <div className="knowledge-section-tabs" role="tablist" aria-label="Widoki Wiedzy">
          <button type="button" role="tab" aria-selected={section === "library"} onClick={() => { params.delete("section"); params.delete("status"); params.delete("item"); params.delete("capture"); setParams(params); }}><BookMarked /><span>Biblioteka</span><small>{state.knowledge.filter((item) => !item.archivedAt && !item.trashedAt).length}</small></button>
          <button type="button" role="tab" aria-selected={section === "inbox"} onClick={() => { params.set("section", "inbox"); setParams(params); }}><Inbox /><span>Skrzynka</span>{pending > 0 ? <small>{pending}</small> : null}</button>
        </div>
      </div>
      {section === "inbox" ? <KnowledgeInbox /> : <>
      <div className="knowledge-controls">
        <div className="knowledge-filter-topbar">
          <div className="knowledge-search"><Search /><input type="search" aria-label="Szukaj w wiedzy" placeholder="Szukaj w bibliotece…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <Button className="knowledge-filter-toggle" variant="secondary" aria-expanded={filtersOpen} aria-controls="knowledge-advanced-filters" onClick={() => setFiltersOpen((current) => !current)}><SlidersHorizontal /><span>Filtry</span>{advancedFilterCount ? <small>{advancedFilterCount}</small> : null}</Button>
        </div>
        <div className="knowledge-kind-filters" role="group" aria-label="Rodzaj Wiedzy">
          <button type="button" aria-pressed={kind === "all" && !booksOnly} onClick={() => { params.delete("kind"); params.delete("format"); setParams(params); }}><BookMarked /><span>Wszystkie</span></button>
          <button type="button" aria-pressed={booksOnly} onClick={() => { params.delete("kind"); params.set("format", "book"); setParams(params); }}><BookMarked /><span>Książki</span></button>
          {filterableKnowledgeKinds.map((value) => {
            const Icon = knowledgeKindIcons[value];
            return <button key={value} type="button" aria-pressed={!booksOnly && kind === value} onClick={() => { params.delete("format"); params.set("kind", value); setParams(params); }}><Icon /><span>{knowledgeKindLabels[value]}</span></button>;
          })}
        </div>
        {filtersOpen ? <div className="knowledge-advanced-filters" id="knowledge-advanced-filters">
          <div className="knowledge-filter-fields">
            <label><span>Cel</span><select aria-label="Filtr Celu" value={goalFilter} onChange={(event) => { if (event.target.value) params.set("goal", event.target.value); else params.delete("goal"); setParams(params); }}><option value="">Każdy Cel</option>{state.goals.filter((goal) => goal.visibility === "active").map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>
            <label><span>Projekt</span><select aria-label="Filtr Projektu" value={areaFilter} onChange={(event) => { if (event.target.value) params.set("area", event.target.value); else params.delete("area"); setParams(params); }}><option value="">Każdy Projekt</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
            <label><span>Status czytania</span><select aria-label="Filtr statusu czytania" value={readingStatus ?? ""} onChange={(event) => { if (event.target.value) params.set("readingStatus", event.target.value); else params.delete("readingStatus"); setParams(params); }}><option value="">Każdy status</option>{Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="knowledge-visibility-filter">
            <span>Widok</span>
            <div role="group" aria-label="Widoczność obiektów">
              <button type="button" aria-pressed={view === "active"} onClick={() => setView("active")}>Aktywne</button>
              <button type="button" aria-pressed={view === "archived"} onClick={() => setView("archived")}><Archive />Archiwum</button>
              <button type="button" aria-pressed={view === "trashed"} onClick={() => setView("trashed")}><Trash2 />Kosz</button>
            </div>
          </div>
          {advancedFilterCount ? <Button className="knowledge-clear-advanced" variant="ghost" onClick={() => { setView("active"); params.delete("goal"); params.delete("area"); params.delete("readingStatus"); params.delete("format"); setParams(params); }}>Wyczyść dodatkowe filtry</Button> : null}
        </div> : null}
      </div>
      <div className="knowledge-view-row">
        <p className="results-summary" aria-live="polite">{polishCount(results.length, "element", "elementy", "elementów")}{view !== "active" ? ` · ${view === "archived" ? "Archiwum" : "Kosz"}` : ""}{kind !== "all" || goalFilter || areaFilter || normalized ? " · aktywne filtry" : ""}</p>
      </div>
      {loading || knowledgePage.isPending ? <ListSkeleton label="Ładowanie Wiedzy" /> : null}
      {knowledgePage.isError ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać Biblioteki Wiedzy. <button type="button" onClick={() => void knowledgePage.refetch()}>Spróbuj ponownie</button></p> : null}
      {results.length ? (
        <div className="knowledge-library-surface"><div className="knowledge-list">
          {results.map((item) => {
            const mutationKey = `visibility:${item.id}`;
            const relationCount = new Set(state.knowledgeLinks.filter((link) => link.knowledgeItemId === item.id).map((link) => link.targetKnowledgeItemId ? `knowledge:${link.targetKnowledgeItemId}` : link.areaId ? `project:${link.areaId}` : link.goalId ? `goal:${link.goalId}` : link.actionId ? `action:${link.actionId}` : `routine:${link.recurringTemplateId ?? ""}`)).size;
            const relationLabel = relationCount === 1 ? "1 powiązanie" : relationCount >= 2 && relationCount <= 4 ? `${relationCount} powiązania` : `${relationCount} powiązań`;
            const helper = [item.resourceAuthor, item.readingStatus ? readingStatusLabels[item.readingStatus] : undefined, item.sourceInboxItemId ? "Źródło: Skrzynka" : item.detail.trim() || (relationCount ? relationLabel : null)].filter(Boolean).join(" · ");
            return (
              <Panel className={`${entityCardVariants({ density: "compact" })} entity-card`} key={item.id} data-navigation-card-id={navigationCardId("knowledge", item.id)} tabIndex={-1}>
                <KnowledgeKindBadge kind={item.type} />
                <span className="knowledge-row-content"><NavigationLink className="knowledge-title-link entity-card-open" to={routeForEntity({ type: "knowledge", id: item.id })} breadcrumbs={[{ label: "Wiedza", to: "/knowledge" }]} returnTo={locationAddress(location)} returnLabel="Wróć do Wiedzy" sourceCardId={navigationCardId("knowledge", item.id)}><strong className="line-clamp-2">{item.title}</strong></NavigationLink>{helper ? <small className="knowledge-row-helper line-clamp-1">{helper}</small> : null}{mutation.error(mutationKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(mutationKey)} <button type="button" onClick={() => void mutation.retry(mutationKey)?.()}>Spróbuj ponownie</button></p> : null}</span>
                <div className="knowledge-actions">
                  <Button variant="ghost" loading={mutation.isBusy(mutationKey)} aria-label={`Więcej opcji: ${item.title}`} title="Więcej opcji" onClick={() => setActionsItemId(item.id)}><MoreHorizontal /></Button>
                </div>
              </Panel>
            );
          })}
        </div></div>
      ) : <EmptyState icon={<BookMarked />} title={normalized ? "Brak pasujących obiektów" : `Brak obiektów: ${view === "active" ? "aktywne" : view === "archived" ? "Archiwum" : "Kosz"}`} detail={normalized ? "Spróbuj krótszego zapytania albo innego słowa." : "Użyj przycisku Dodaj na dole, aby zapisać notatkę, materiał, decyzję lub rezultat."} action={normalized || kind !== "all" || goalFilter || areaFilter || view !== "active" ? <Button onClick={() => { setQuery(""); setView("active"); setParams({}); }}>Wyczyść filtry</Button> : undefined} />}
      {results.length && knowledgePage.hasNextPage ? <div className="list-pagination"><Button loading={knowledgePage.isFetchingNextPage} onClick={() => void knowledgePage.fetchNextPage()}>Załaduj starsze</Button></div> : null}
      {results.length && !knowledgePage.hasNextPage && !knowledgePage.isFetching ? <p className="muted-copy list-end">To wszystkie elementy w tym widoku.</p> : null}
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
      <Modal open={modalOpen} closeDisabled={createSaving} className="knowledge-create-modal" title="Dodaj do Biblioteki" onClose={() => setModalOpen(false)}>
        <form className="knowledge-create-form" noValidate onSubmit={(event) => void create(event)}>
        <div className="knowledge-create-body" data-modal-scroll-body>
        <p className="modal-intro">Wybierz rodzaj na podstawie tego, jak chcesz później użyć tego wpisu.</p>
        <KnowledgeKindPicker
          value={form.kind}
          onChange={(kind) => setForm((current) => ({ ...current, kind, isBook: kind === "resource" ? current.isBook : false }))}
          name="new-knowledge-kind"
        />
        <FormTransition stateKey={form.kind}>
        <label className="field-label" htmlFor="knowledge-title">{knowledgeKindGuidance[form.kind].titleLabel}</label>
        <input id="knowledge-title" placeholder={knowledgeKindGuidance[form.kind].titlePlaceholder} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
        {form.kind === "resource" ? <><label className="field-label" htmlFor="knowledge-url">Link do źródła <span className="optional-label">opcjonalnie</span></label><input id="knowledge-url" type="url" placeholder="https://…" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /><label className="checkbox-field"><input type="checkbox" checked={form.isBook} onChange={(event) => setForm((current) => ({ ...current, isBook: event.target.checked }))} /><span>To książka</span></label>{form.isBook ? <><label className="field-label" htmlFor="knowledge-author">Autor <span className="optional-label">opcjonalnie</span></label><input id="knowledge-author" value={form.resourceAuthor} onChange={(event) => setForm((current) => ({ ...current, resourceAuthor: event.target.value }))} /><label className="field-label" htmlFor="knowledge-reading-status">Status czytania</label><select id="knowledge-reading-status" value={form.readingStatus} onChange={(event) => setForm((current) => ({ ...current, readingStatus: event.target.value as ReadingStatus }))}>{Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></> : null}</> : null}
        <label className="field-label" htmlFor="knowledge-detail">{knowledgeKindGuidance[form.kind].detailLabel}{!knowledgeKindGuidance[form.kind].detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label>
        <textarea id="knowledge-detail" rows={4} required={knowledgeKindGuidance[form.kind].detailRequired} placeholder={knowledgeKindGuidance[form.kind].detailPlaceholder} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
          <span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span>
        <MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={form.goalIds} onChange={(goalIds) => setForm((current) => ({ ...current, goalIds }))} />
        <label className="field-label" htmlFor="knowledge-project">Powiązany Projekt <span className="optional-label">opcjonalnie</span></label>
        <select id="knowledge-project" value={form.areaId} onChange={(event) => setForm((current) => ({ ...current, areaId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        {form.kind === "note" ? <><label className="field-label" htmlFor="knowledge-source-book">Notatka do książki <span className="optional-label">opcjonalnie</span></label><select id="knowledge-source-book" value={form.sourceBookId} onChange={(event) => setForm((current) => ({ ...current, sourceBookId: event.target.value }))}><option value="">Bez źródłowej książki</option>{bookOptions.map((book) => <option key={book.id} value={book.id}>{book.title}{book.resourceAuthor ? ` · ${book.resourceAuthor}` : ""}</option>)}</select>{booksPage.hasNextPage ? <Button type="button" variant="ghost" loading={booksPage.isFetchingNextPage} onClick={() => void booksPage.fetchNextPage()}>Załaduj starsze książki</Button> : null}</> : null}
        {createError ? <p className="auth-message error" role="alert">{createError}</p> : null}
        </FormTransition>
        </div>
        <div className="modal-actions"><Button type="button" disabled={createSaving} onClick={() => setModalOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={createSaving} disabled={!form.title.trim() || (knowledgeKindGuidance[form.kind].detailRequired && !form.detail.trim())}>{knowledgeKindGuidance[form.kind].saveLabel}</Button></div>
        </form>
      </Modal>
      </>}
    </AppShell>
  );
}
