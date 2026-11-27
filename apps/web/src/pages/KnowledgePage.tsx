import { formatActionDate } from "../domain/actionPresentation";
import { useWorkspaceClock } from "../hooks/useWorkspaceClock";
import { localDateForTimeZone } from "../domain/activity";
import { Archive, BookMarked, FileText, Library, MoreHorizontal, PanelRightOpen, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell, PageHeading } from "../components/AppShell";
import { Modal } from "../components/Modal";
import { Button, EmptyState, ListSkeleton } from "../components/ui";
import { ActionFilterControl } from "../components/ActionFilterControl";
import type { InboxItem, KnowledgeItem, KnowledgeKind, ReadingStatus } from "../domain/types";
import { useActionFeedback } from "../components/action-feedback-context";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { routeForEntity } from "../domain/routes";
import { KnowledgeInbox } from "./InboxPage";
import { KnowledgeKindBadge } from "../components/KnowledgeKindBadge";
import { readingStatusLabels } from "../domain/labels";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { NavigationLink } from "../components/ContextNavigation";
import { locationAddress, navigationCardId, readNavigationRestore } from "../domain/navigation";
import { createKnowledgeFilter } from "../domain/knowledgeFilters";
import { filterableKnowledgeKinds, isFilterableKnowledgeKind } from "../domain/knowledge-kinds";
import { knowledgeKindLabels } from "../domain/labels";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { KnowledgePreview } from "../components/KnowledgePreview";
import { resolveKnowledgeProjectContexts } from "../domain/knowledge";
import { prepareKnowledgeNote } from "../domain/knowledgeNote";
import { safeHttpUrl } from "../domain/http-url";
import type { QuickAddRequest } from "../components/creationDraft";
import "../components/workspace-list.css";
import "./knowledge-workspace.css";

type View = "active" | "archived" | "trashed";
const filterKeys = ["kind", "format", "readingStatus", "revisit", "goal", "area"];

function knowledgeExcerpt(item: KnowledgeItem) {
  const detail = item.detail.trim();
  if (!detail) return "";
  const title = item.title.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl");
  if (item.type === "note" && prepareKnowledgeNote(detail).title.toLocaleLowerCase("pl") === title) {
    return detail.split(/\r?\n/).slice(1).join(" ").trim();
  }
  return detail.replace(/\s+/g, " ").toLocaleLowerCase("pl") === title ? "" : detail;
}

export function KnowledgePage() {
  const { state, loading, setVisibility } = useStore();
  const { user, mode } = useAuth();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const address = locationAddress(location);
  const navigate = useNavigate();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const query = params.get("q") ?? "";
  const changeFilters = (change: (next: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace });
  };
  const setFilter = (key: string, value: string, replace = false) => changeFilters((next) => {
    if (value) next.set(key, value); else next.delete(key);
  }, replace);
  const clearFilters = () => changeFilters((next) => ["q", ...filterKeys].forEach((key) => next.delete(key)));
  const section = params.get("section") === "inbox" ? "inbox" : "library";
  const kind = (params.get("kind") ?? "all") as KnowledgeKind | "all";
  const now = useWorkspaceClock();
  const revisitOnOrBefore = params.get("revisit") === "due" ? localDateForTimeZone(now, state.workspaceTimezone) : undefined;
  const booksOnly = params.get("format") === "book";
  const statusParam = params.get("readingStatus");
  const readingStatus = (["to_read", "reading", "read", "paused", "abandoned"] as string[]).includes(statusParam ?? "") ? statusParam as ReadingStatus : undefined;
  const goalFilter = params.get("goal") ?? "";
  const areaFilter = params.get("area") ?? "";
  const project = state.areas.find((area) => area.id === areaFilter);
  const group = state.goals.find((goal) => goal.id === goalFilter);
  const viewParam = params.get("visibility");
  const view: View = viewParam === "archived" || viewParam === "trashed" ? viewParam : "active";
  const [filterDraft, setFilterDraft] = useState<{ search: string; params: URLSearchParams }>();
  const pendingFilters = filterDraft?.search === location.search ? filterDraft.params : undefined;
  const filterFields = pendingFilters ?? params;
  const draftBooksOnly = filterFields.get("format") === "book";
  const changeFilterDraft = (change: (next: URLSearchParams) => void) => setFilterDraft((current) => {
    if (!current) return current;
    const next = new URLSearchParams(current.params);
    change(next);
    return { ...current, params: next };
  });
  const setDraftFilter = (key: string, value: string) => changeFilterDraft((next) => {
    if (value) next.set(key, value); else next.delete(key);
  });
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [actionsItemId, setActionsItemId] = useState<string>();
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const [createdItems, setCreatedItems] = useState<{ workspaceId: string | undefined; ids: string[] }>({ workspaceId: state.workspaceId, ids: [] });
  const [debouncedQuery, setDebouncedQuery] = useState(() => params.get("q") ?? "");
  const normalized = debouncedQuery.trim().toLocaleLowerCase("pl");
  const knowledgePage = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { revisitOnOrBefore, resourceFormat: booksOnly ? "book" : undefined, readingStatus, knowledgeKind: booksOnly ? "resource" : kind === "all" ? undefined : kind, searchText: normalized, projectId: areaFilter || undefined, knowledgeGoalId: goalFilter || undefined, knowledgeVisibility: view });
  const newInboxPage = useWorkspaceInfinitePage<InboxItem>("inbox", 50, { inboxStatus: "unprocessed" });
  const newInboxCount = newInboxPage.data?.totalCount;
  const advancedFilters = [
    !booksOnly && kind !== "all" && isFilterableKnowledgeKind(kind) ? { label: knowledgeKindLabels[kind], keys: ["kind"] } : null,
    booksOnly ? { label: "Książki", keys: ["format", "readingStatus"] } : null,
    booksOnly && readingStatus ? { label: readingStatusLabels[readingStatus], keys: ["readingStatus"] } : null,
    revisitOnOrBefore ? { label: "Do powrotu", keys: ["revisit"] } : null,
    project ? { label: `Projekt: ${project.name}`, keys: ["area"] } : null,
    group ? { label: `Grupa działań: ${group.title}`, keys: ["goal"] } : null,

  ].filter((filter) => filter !== null);
  const hasFilters = Boolean(query.trim() || advancedFilters.length);
  useEffect(() => { const legacyId = section === "library" ? params.get("item") : null; if (legacyId) navigate(`/knowledge/${legacyId}`, { replace: true }); }, [navigate, params, section]);
  useEffect(() => {
    const next = new URLSearchParams(params); let changed = false;
    if (kind !== "all" && !isFilterableKnowledgeKind(kind)) { next.delete("kind"); changed = true; }
    if (booksOnly && next.has("kind")) { next.delete("kind"); changed = true; }
    if (statusParam && (!readingStatus || !booksOnly)) { next.delete("readingStatus"); changed = true; }
    if (viewParam && !["active", "archived", "trashed"].includes(viewParam)) { next.delete("visibility"); changed = true; }
    if (!loading && goalFilter && !group) { next.delete("goal"); changed = true; }
    if (!loading && areaFilter && !project) { next.delete("area"); changed = true; }
    if (changed) setParams(next, { replace: true });
  }, [areaFilter, booksOnly, goalFilter, group, kind, loading, params, project, readingStatus, setParams, statusParam, viewParam]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => { const receive = (event: Event) => { const { id, mode } = (event as CustomEvent<{ id: string; mode: string }>).detail; if (mode === "library") setCreatedItems((current) => ({ workspaceId: state.workspaceId, ids: [...current.ids, id] })); }; window.addEventListener("creation:succeeded", receive); return () => window.removeEventListener("creation:succeeded", receive); }, [state.workspaceId]);
  const knowledgeItems = useMemo(() => {
    const localById = new Map(state.knowledge.map((item) => [item.id, item]));
    const merged = new Map((knowledgePage.data?.items ?? (knowledgePage.isPending ? [] : state.knowledge)).map((pageItem) => {
      const localItem = localById.get(pageItem.id);
      return [pageItem.id, localItem && (localItem.version ?? 0) > (pageItem.version ?? 0) ? localItem : pageItem];
    }));
    // Keep successful creates visible even when the ascending cursor has not reached them.
    // Do not merge unrelated cached records that may no longer match the server page.
    if (createdItems.workspaceId === state.workspaceId) for (const id of createdItems.ids) {
      const item = localById.get(id);
      if (item && !merged.has(id)) merged.set(id, item);
    }
    return [...merged.values()];
  }, [createdItems, knowledgePage.data, knowledgePage.isPending, state.knowledge, state.workspaceId]);
  const sourceByNote = useMemo(() => new Map(state.knowledgeLinks.flatMap((link) => link.meaning === "source" && link.targetKnowledgeItemId ? [[link.knowledgeItemId, link.targetKnowledgeItemId] as const] : [])), [state.knowledgeLinks]);
  const sourceBookIds = [...new Set(knowledgeItems.flatMap((item) => {
    const source = item.type === "note" && sourceByNote.get(item.id);
    return source ? [source] : [];
  }))].sort();
  const sourceBooksQuery = useQuery({
    queryKey: ["knowledge-source-books", mode, state.workspaceId, user?.id, sourceBookIds],
    enabled: sourceBookIds.length > 0,
    queryFn: async () => mode === "demo" ? state.knowledge.filter((item) => sourceBookIds.includes(item.id))
      : (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository().loadKnowledgeItems(sourceBookIds)
  });
  const sourceBooksById = new Map([...(sourceBooksQuery.data ?? []), ...state.knowledge].map((item) => [item.id, item]));
  const matches = useMemo(() => createKnowledgeFilter(state, {
    resourceFormat: booksOnly ? "book" : undefined,
    readingStatus,
    revisitOnOrBefore,
    knowledgeKind: booksOnly ? "resource" : kind === "all" ? undefined : kind,
    searchText: normalized,
    projectId: areaFilter || undefined,
    goalId: goalFilter || undefined,
    visibility: view
  }), [areaFilter, booksOnly, goalFilter, kind, normalized, readingStatus, revisitOnOrBefore, state, view]);
  const results = knowledgeItems.filter(matches).sort((left, right) => (revisitOnOrBefore ? left.revisitOn ?? "" : left.updatedAt ?? left.createdAt ?? "").localeCompare(revisitOnOrBefore ? right.revisitOn ?? "" : right.updatedAt ?? right.createdAt ?? "") || left.id.localeCompare(right.id));
  const totalCount = knowledgePage.data?.totalCount ?? results.length;
  const hasPartialResults = results.length > 0 && results.length < totalCount;
  const restoreCardId = readNavigationRestore(address)?.sourceCardId;
  const restoreItemId = restoreCardId?.startsWith("knowledge-") ? restoreCardId.slice("knowledge-".length) : undefined;
  const restoreItem = restoreItemId ? state.knowledge.find((item) => item.id === restoreItemId) : undefined;
  const needsRestorePage = section === "library" && Boolean(restoreItemId && !results.some((item) => item.id === restoreItemId) && (!restoreItem || matches(restoreItem)) && knowledgePage.hasNextPage && !knowledgePage.isFetchNextPageError);
  const { fetchNextPage, isFetching } = knowledgePage;
  useEffect(() => {
    if (needsRestorePage && !isFetching && fetchNextPage) void fetchNextPage();
  }, [fetchNextPage, isFetching, needsRestorePage]);
  const previewItem = results.find((item) => item.id === params.get("preview"));
  const previewSourceId = previewItem && sourceByNote.get(previewItem.id);
  const openPreview = (item: KnowledgeItem, trigger: HTMLElement) => {
    previewTriggerRef.current = trigger;
    const next = new URLSearchParams(params);
    next.set("preview", item.id);
    setParams(next, { replace: true });
  };
  const closePreview = () => {
    const next = new URLSearchParams(params);
    next.delete("preview");
    setParams(next, { replace: true });
    const fallback = Array.from(document.querySelectorAll<HTMLElement>(".knowledge-title-link")).find((link) => link.closest("[data-navigation-card-id]")?.getAttribute("data-navigation-card-id") === (previewItem ? navigationCardId("knowledge", previewItem.id) : undefined));
    const trigger = previewTriggerRef.current?.isConnected ? previewTriggerRef.current : fallback;
    trigger?.focus({ preventScroll: true });
  };
  const changeVisibility = async (item: KnowledgeItem, visibility: "archived" | "trashed") => {
    const previous = item.trashedAt ? "trashed" : item.archivedAt ? "archived" : "active";
    await setVisibility("knowledge", item.id, visibility);
    notifyUndo({
      event: visibility === "archived" ? "archived" : "changed",
      message: visibility === "archived" ? `„${item.title}” przeniesiono do Archiwum.` : `„${item.title}” przeniesiono do Kosza.`,
      undo: () => setVisibility("knowledge", item.id, previous),
      action: { label: visibility === "archived" ? "Otwórz archiwum" : "Otwórz kosz", onClick: () => {
        setParams(new URLSearchParams({ visibility }));
      } }
    });
  };
  const creationRequest: QuickAddRequest = { mode: section === "library" ? "library" : "inbox", libraryKind: booksOnly || kind === "resource" ? "resource" : kind === "decision" ? "decision" : "note", isBook: booksOnly, readingStatus, areaId: areaFilter || undefined, goalId: goalFilter || undefined, draftKey: section === "library" ? "knowledge-library" : "knowledge-inbox" };
  const creationMenu = [
    { label: "Dodaj notatkę", icon: <FileText />, request: { ...creationRequest, directLibraryEntry: true, libraryKind: "note" as const, isBook: false, readingStatus: undefined } },
    { label: "Dodaj materiał", icon: <Library />, request: { ...creationRequest, directLibraryEntry: true, libraryKind: "resource" as const } },
    { label: "Wybierz rodzaj lub wznów szkic", icon: <BookMarked />, request: creationRequest }
  ];
  const switchSection = (target: "library" | "inbox") => changeFilters((next) => {
    if (target === "inbox") next.set("section", "inbox");
    else for (const key of ["section", "status", "item", "capture", "organize"]) next.delete(key);
  });

  return (
    <AppShell navigationReady={section === "inbox" || (!knowledgePage.isPending && !needsRestorePage)} addAction={{ label: section === "library" ? "Dodaj do Biblioteki" : "Do Skrzynki", shortLabel: section === "library" ? "Wiedza" : "Skrzynka", ariaLabel: section === "library" ? "Dodaj nowy element Wiedzy" : "Dodaj do Skrzynki", quickAdd: creationRequest, menu: section === "library" ? creationMenu : undefined }}>

      <PageHeading title="Wiedza" />
      <div className="knowledge-top-tabs" role="tablist" aria-label="Widoki Wiedzy" onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const target = event.key === "Home" ? "library" : event.key === "End" ? "inbox" : section === "library" ? "inbox" : "library";
          event.currentTarget.querySelector<HTMLElement>(`#knowledge-tab-${target}`)?.focus();
          if (target !== section) switchSection(target);
        }}>
          <button type="button" role="tab" id="knowledge-tab-library" aria-controls="knowledge-section" aria-selected={section === "library"} tabIndex={section === "library" ? 0 : -1} onClick={() => { if (section !== "library") switchSection("library"); }}>Biblioteka</button>
          <button type="button" role="tab" id="knowledge-tab-inbox" aria-controls="knowledge-section" aria-selected={section === "inbox"} tabIndex={section === "inbox" ? 0 : -1} onClick={() => { if (section !== "inbox") switchSection("inbox"); }}>Skrzynka{newInboxCount ? <small><span className="sr-only">Nowe wpisy: </span>{newInboxCount}</small> : null}</button>
      </div>
      <div id="knowledge-section" role="tabpanel" aria-labelledby={`knowledge-tab-${section}`}>
      {section === "inbox" ? <KnowledgeInbox /> : <>
      <div className={`knowledge-workspace${previewItem ? " has-preview" : ""}`} onKeyDown={(event) => {
        if (event.key === "Escape" && previewItem && !document.querySelector('[aria-modal="true"]')) { event.preventDefault(); closePreview(); }
      }}>
      <div className="knowledge-collection">
      <section className="knowledge-library-toolbar" aria-label="Filtry Biblioteki">
        <div className="knowledge-visibility" role="group" aria-label="Widoczność Biblioteki">
          {([["active", "Aktywne"], ["archived", "Archiwum"], ["trashed", "Kosz"]] as const).map(([value, label]) => <Button key={value} variant={view === value ? "secondary" : "ghost"} aria-pressed={view === value} onClick={() => changeFilters((next) => {
            if (value === "active") next.delete("visibility");
            else next.set("visibility", value);
            next.delete("preview");
          })}>{label}</Button>)}
        </div>
        <div className="knowledge-search-bar">
          <div className="knowledge-search-field"><Search aria-hidden="true" /><input type="search" aria-label="Szukaj w wiedzy" placeholder="Szukaj wpisu…" value={query} onChange={(event) => setFilter("q", event.target.value, true)} /></div>
          <ActionFilterControl inline triggerRef={filterButtonRef} label="Filtry" dialogTitle="Filtry Biblioteki"
            ariaLabel={advancedFilters.length ? `Filtry Biblioteki, aktywne: ${advancedFilters.length}` : "Filtry Biblioteki"} active={advancedFilters.length > 0} open={Boolean(pendingFilters)}
            onOpenChange={(open) => setFilterDraft(open ? { search: location.search, params: new URLSearchParams(params) } : undefined)}
            footer={<>
              <Button variant="ghost" disabled={!filterKeys.some((key) => filterFields.has(key))} onClick={() => changeFilterDraft((next) => filterKeys.forEach((key) => next.delete(key)))}>Resetuj</Button>
              <Button variant="primary" onClick={() => {
                if (pendingFilters && pendingFilters.toString() !== params.toString()) setParams(pendingFilters);
                setFilterDraft(undefined);
              }}>Pokaż wyniki</Button>
            </>}>
            <div className="knowledge-filter-fields">
              <label><span>Rodzaj</span><select aria-label="Rodzaj Wiedzy" value={draftBooksOnly ? "book" : filterFields.get("kind") ?? "all"} onChange={(event) => changeFilterDraft((next) => {
                const value = event.target.value;
                for (const key of ["kind", "format", "readingStatus"]) next.delete(key);
                if (value === "book") next.set("format", "book");
                else if (value !== "all") next.set("kind", value);
              })}>
                <option value="all">Wszystkie rodzaje</option>
                {filterableKnowledgeKinds.map((value) => <option key={value} value={value}>{knowledgeKindLabels[value]}</option>)}
                <option value="book">Książki</option>
              </select></label>
              {draftBooksOnly ? <label className="knowledge-reading-filter"><span>Status czytania</span><select aria-label="Filtr statusu czytania" value={filterFields.get("readingStatus") ?? ""} onChange={(event) => setDraftFilter("readingStatus", event.target.value)}>
                <option value="">Wszystkie statusy</option>{Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label> : null}
              <label><span>Projekt</span><select aria-label="Filtr Projektu" value={filterFields.get("area") ?? ""} onChange={(event) => setDraftFilter("area", event.target.value)}>
                <option value="">Wszystkie projekty</option>{state.areas.filter((area) => area.visibility === "active" || area.id === areaFilter).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select></label>
              <label><span>Grupa działań</span><select aria-label="Filtr grupy" value={filterFields.get("goal") ?? ""} onChange={(event) => setDraftFilter("goal", event.target.value)}>
                <option value="">Wszystkie grupy</option>{state.goals.filter((goal) => goal.visibility === "active" || goal.id === goalFilter).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
              </select></label>
            </div>
            <label className="checkbox-field knowledge-revisit-filter"><input type="checkbox" checked={filterFields.get("revisit") === "due"} onChange={(event) => setDraftFilter("revisit", event.target.checked ? "due" : "")} /><span>Tylko wpisy do powrotu</span></label>
          </ActionFilterControl>
        </div>
        {hasFilters ? <div className="knowledge-results-summary">
          {advancedFilters.length ? <div className="knowledge-active-filters" role="group" aria-label="Aktywne filtry">
            {advancedFilters.map(({ label, keys }) => <Button key={keys[0]} className="knowledge-filter-chip" variant="ghost" aria-label={`Usuń filtr: ${label}`} onClick={() => {
              filterButtonRef.current?.focus({ preventScroll: true });
              changeFilters((next) => keys.forEach((key) => next.delete(key)));
            }}><span>{label}</span><X aria-hidden="true" /></Button>)}
          </div> : null}
          <Button className="knowledge-reset-filters" variant="ghost" onClick={() => {
            filterButtonRef.current?.focus({ preventScroll: true });
            clearFilters();
          }}>Wyczyść filtry</Button>
        </div> : null}
      </section>
      <p className={hasPartialResults ? "knowledge-result-count" : "sr-only"} role="status">
        {!loading && !knowledgePage.isPending && (!knowledgePage.isError || knowledgePage.data)
          ? hasPartialResults ? `${results.length} z ${totalCount} wyników` : `Wyniki: ${results.length}`
          : ""}
      </p>
      {loading || knowledgePage.isPending ? <ListSkeleton label="Ładowanie Wiedzy" /> : null}
      {knowledgePage.isError && !knowledgePage.data ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać Biblioteki Wiedzy. <button type="button" onClick={() => void knowledgePage.refetch()}>Spróbuj ponownie</button></p> : null}
      {knowledgePage.isFetchNextPageError ? <p className="inline-mutation-error" role="alert">Nie udało się pobrać kolejnej strony. Dotychczasowe wyniki pozostają dostępne. <button type="button" onClick={() => void knowledgePage.fetchNextPage()}>Ponów tę stronę</button></p> : null}
      {results.length ? (
        <ul className="workspace-list knowledge-result-list" role="list" aria-label="Wyniki w Bibliotece">
          {results.map((item) => {
            const mutationKey = `visibility:${item.id}`;
            const sourceId = sourceByNote.get(item.id);
            const sourceBook = sourceId ? sourceBooksById.get(sourceId) : undefined;
            const projectContexts = resolveKnowledgeProjectContexts(state, item.id);
            const projectIds = new Set(projectContexts.map((context) => context.projectId));
            const namedProjects = state.areas.filter((area) => projectIds.has(area.id)).map((area) => area.name);
            const onlyGroup = !namedProjects.length && state.knowledgeLinks.find((link) => link.knowledgeItemId === item.id && link.goalId)?.goalId;
            const groupTitle = onlyGroup && state.goals.find((group) => group.id === onlyGroup)?.title;
            const excerpt = knowledgeExcerpt(item);
            const sourceHref = safeHttpUrl(item.sourceUrl) ?? (/^\S+$/.test(excerpt) ? safeHttpUrl(excerpt) : undefined);
            const projectLabel = namedProjects.length ? `${namedProjects[0]}${namedProjects.length > 1 ? ` +${namedProjects.length - 1}` : ""}` : groupTitle;
            const bookContext = item.resourceFormat === "book" && [item.resourceAuthor, item.readingStatus && readingStatusLabels[item.readingStatus]].filter(Boolean).join(" · ");
            const revisitContext = item.revisitOn && `Powrót: ${formatActionDate(item.revisitOn, state.workspaceTimezone)}`;
            const inboxContext = item.sourceInboxItemId && "Źródło: Skrzynka";
            const context = revisitContext || inboxContext || bookContext || projectLabel || (sourceHref && new URL(sourceHref).hostname) || excerpt;
            return <li className="workspace-list-row knowledge-result-row" key={item.id} data-navigation-card-id={navigationCardId("knowledge", item.id)} data-preview-selected={previewItem?.id === item.id || undefined} tabIndex={-1}>
              <div className="knowledge-result-content">
                <NavigationLink className="knowledge-title-link" to={routeForEntity({ type: "knowledge", id: item.id })} breadcrumbs={[{ label: "Wiedza", to: address }]} returnTo={address} returnLabel="Wróć do Wiedzy" sourceCardId={navigationCardId("knowledge", item.id)} onClick={(event) => {
                  if (window.matchMedia("(min-width: 1440px)").matches && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
                    event.preventDefault();
                    openPreview(item, event.currentTarget);
                  }
                }}><strong className="line-clamp-2">{item.title}</strong></NavigationLink>
                <div className="knowledge-result-meta">
                  {item.resourceFormat === "book" ? <span className="knowledge-result-book"><BookMarked aria-hidden="true" />Książka</span> : <KnowledgeKindBadge kind={item.type} compact />}
                  {sourceBook && !revisitOnOrBefore ? <NavigationLink className="knowledge-result-source line-clamp-1" to={routeForEntity({ type: "knowledge", id: sourceBook.id })} breadcrumbs={[{ label: "Wiedza", to: address }]} returnTo={address} returnLabel="Wróć do Wiedzy" sourceCardId={navigationCardId("knowledge", item.id)}>Źródło: {sourceBook.title}</NavigationLink> : context ? <span className="line-clamp-1">{context}</span> : null}
                </div>
                {mutation.error(mutationKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(mutationKey)} <button type="button" onClick={() => void mutation.retry(mutationKey)?.()}>Spróbuj ponownie</button></p> : null}
              </div>
              <div className="knowledge-result-actions">
                <button type="button" className="button button-ghost knowledge-preview-trigger" aria-label={`Podejrzyj Wiedzę: ${item.title}`} title="Podgląd" aria-expanded={previewItem?.id === item.id} aria-controls={previewItem ? "knowledge-preview" : undefined} onClick={(event) => openPreview(item, event.currentTarget)}><PanelRightOpen aria-hidden="true" /><span>Podgląd</span></button>
                <Button variant="ghost" className="knowledge-row-menu" loading={mutation.isBusy(mutationKey)} aria-label={`Więcej opcji: ${item.title}`} title="Więcej opcji" onClick={() => setActionsItemId(item.id)}><MoreHorizontal aria-hidden="true" /></Button>
              </div>
            </li>;
          })}
        </ul>
      ) : !knowledgePage.isPending && !knowledgePage.isError ? <EmptyState icon={<BookMarked />}
        title={hasFilters ? "Brak pasujących wpisów" : view === "archived" ? "Archiwum jest puste" : view === "trashed" ? "Kosz jest pusty" : "Biblioteka jest pusta"}
        detail={hasFilters ? "Zmień frazę lub filtry." : view === "active" ? "Dodaj notatkę, materiał lub decyzję." : "Wróć do aktywnych wpisów, aby zobaczyć Bibliotekę."}
      /> : null}
      {results.length && knowledgePage.hasNextPage ? <div className="list-pagination"><Button loading={knowledgePage.isFetchingNextPage} onClick={() => void knowledgePage.fetchNextPage()}>Wczytaj więcej</Button></div> : null}
      </div>
      {previewItem ? <KnowledgePreview item={previewItem} sourceBook={previewSourceId ? sourceBooksById.get(previewSourceId) : undefined} returnTo={address} onClose={closePreview} /> : null}
      </div>
      <Modal open={Boolean(actionsItemId)} closeDisabled={Boolean(actionsItemId && mutation.isBusy(`visibility:${actionsItemId}`))} title="Wiedza — więcej opcji" onClose={() => setActionsItemId(undefined)}>{(() => {
        const item = knowledgeItems.find((candidate) => candidate.id === actionsItemId);
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

      </>}
      </div>
    </AppShell>
  );
}
