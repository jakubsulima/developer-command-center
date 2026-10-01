import "./focus-detail.css";
import { useMemo, useState, type FormEvent } from "react";
import { BookMarked, CheckCircle2, ExternalLink, FolderKanban, Link2, Plus, RotateCcw, Flag, ListTodo, Repeat2, ChevronRight, Pencil } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { MultiCombobox } from "../components/MultiCombobox";
import { Button, EmptyState, Panel } from "../components/ui";
import type { KnowledgeItem, KnowledgeKind, ReadingStatus } from "../domain/types";
import { knowledgeKindLabels as labels, readingStatusLabels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { safeHttpUrl } from "../domain/http-url";
import { useActionFeedback } from "../components/action-feedback-context";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { KnowledgeKindBadge } from "../components/KnowledgeKindBadge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, navigationCardId, readNavigationState, type NavigationBreadcrumb } from "../domain/navigation";
import { resolveKnowledgeProjectContexts } from "../domain/knowledge";
import { creatableKnowledgeKinds, isCreatableKnowledgeKind, knowledgeKindGuidance } from "../domain/knowledge-kinds";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { DraftStatus } from "../components/DraftStatus";
import { DraftConflictNotice } from "../components/DraftConflictNotice";
import { isDraftVersionConflict } from "../components/draftConflict";
import { requestAppQuickAdd } from "../components/appQuickAddRequest";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import { KnowledgeNoteFields } from "../components/KnowledgeNoteFields";
import { prepareKnowledgeNote } from "../domain/knowledgeNote";

type BookNoteDraft = { content: string; title: string; projectId: string; goalIds: string[]; idempotencyKey: string };

function BookNoteComposer({ book, defaultProjectId, onClose }: { book: KnowledgeItem; defaultProjectId: string; onClose: () => void }) {
  const { state, createKnowledge } = useStore();
  const initial = useMemo<BookNoteDraft>(() => ({ content: "", title: "", projectId: defaultProjectId, goalIds: [], idempotencyKey: crypto.randomUUID() }), [defaultProjectId]);
  const draft = usePersistentDraft<BookNoteDraft>("book-knowledge-note", initial, 450, { targetId: book.id });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (draft.flush()) onClose(); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.value.content.trim() || saving || book.trashedAt) return;
    setSaving(true); setError("");
    try {
      const note = prepareKnowledgeNote(draft.value.content, draft.value.title);
      await createKnowledge({ idempotencyKey: draft.value.idempotencyKey, kind: "note", title: note.title, detail: note.detail, relations: [
        { meaning: "source", target: { targetKnowledgeItemId: book.id } },
        ...(draft.value.projectId ? [{ meaning: "reference" as const, target: { areaId: draft.value.projectId } }] : []),
        ...draft.value.goalIds.map((goalId) => ({ meaning: "reference" as const, target: { goalId } }))
      ] });
      if (!draft.clear({ content: "", title: "", projectId: draft.value.projectId, goalIds: [], idempotencyKey: crypto.randomUUID() })) {
        setError("Notatka została zapisana, ale jej szkic pozostał na tym urządzeniu. Ponów zapis lub skopiuj treść.");
        return;
      }
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zapisać notatki."); }
    finally { setSaving(false); }
  };
  return <form className="book-note-composer" onSubmit={(event) => void save(event)}>
    <KnowledgeNoteFields idPrefix={`book-note-${book.id}`} content={draft.value.content} onContentChange={(content) => draft.setValue((current) => ({ ...current, content }))} title={draft.value.title} onTitleChange={(title) => draft.setValue((current) => ({ ...current, title }))} context={`Źródło · ${book.title}`} disabled={saving}>
      <label className="field-label" htmlFor={`book-note-project-${book.id}`}>Projekt <span className="optional-label">opcjonalnie</span></label>
      <select id={`book-note-project-${book.id}`} value={draft.value.projectId} disabled={saving} onChange={(event) => draft.setValue((current) => ({ ...current, projectId: event.target.value }))}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
      <span className="field-label">Powiązane Cele <span className="optional-label">możesz wybrać kilka</span></span>
      <MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={draft.value.goalIds} onChange={(goalIds) => draft.setValue((current) => ({ ...current, goalIds }))} />
    </KnowledgeNoteFields>
    <DraftStatus status={draft.status} restored={draft.restored} errorMessage={draft.errorMessage} onRetry={() => void draft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${draft.value.title}\n${draft.value.content}`)} />
    {draft.dirty ? <Button type="button" variant="ghost" disabled={saving} onClick={() => draft.discard()}>Odrzuć szkic</Button> : null}
    {error ? <p className="inline-mutation-error" role="alert">{error}</p> : null}
    <div className="button-row"><Button type="button" disabled={saving} onClick={close}>Zamknij</Button><Button type="submit" variant="primary" loading={saving} disabled={!draft.value.content.trim() || Boolean(book.trashedAt)}>Zapisz notatkę</Button></div>
  </form>;
}

export function KnowledgeDetailPage() {
  const { knowledgeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { state, mode, updateKnowledge, linkKnowledge, unlinkKnowledge, setVisibility } = useStore();
  const { user } = useAuth();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const localItem = state.knowledge.find((candidate) => candidate.id === knowledgeId);
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);
  const itemQuery = useQuery({
    queryKey: ["knowledge-item", knowledgeId, mode, user?.id],
    enabled: Boolean(knowledgeId && !localItem),
    queryFn: async () => (mode === "demo"
      ? await localRepository.loadKnowledgeItem(knowledgeId!)
      : await (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository().loadKnowledgeItem(knowledgeId!)) ?? null
  });
  const resolvedItem = localItem ?? itemQuery.data;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [supportingId, setSupportingId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [sourceNoteQuery, setSourceNoteQuery] = useState("");
  const [sourceNoteToLink, setSourceNoteToLink] = useState("");
  const navigationReturn = readNavigationState(location.state)?.returnTo;
  const contextualProjectId = navigationReturn?.match(/^\/projects\/([^/?#]+)/)?.[1];
  const activeContextProjectId = state.areas.find((area) => area.visibility === "active" && area.id === (contextualProjectId ? decodeURIComponent(contextualProjectId) : undefined))?.id ?? "";
  const [bookProjectId, setBookProjectId] = useState(activeContextProjectId);
  const formDraft = usePersistentDraft("knowledge-edit", { kind: (resolvedItem?.type ?? "note") as KnowledgeKind, title: resolvedItem?.title ?? "", detail: resolvedItem?.detail ?? "", sourceUrl: resolvedItem?.sourceUrl ?? "", isBook: resolvedItem?.resourceFormat === "book", resourceAuthor: resolvedItem?.resourceAuthor ?? "", readingStatus: (resolvedItem?.readingStatus ?? "to_read") as ReadingStatus, goalIds: resolvedItem ? state.knowledgeLinks.filter((link) => link.knowledgeItemId === resolvedItem.id && link.goalId).map((link) => link.goalId!) : [] }, 450, { targetId: knowledgeId ?? "new", baseVersion: resolvedItem?.version, enabled: Boolean(resolvedItem) });
  const form = formDraft.value;
  const setForm = formDraft.setValue;
  const links = useMemo(() => state.knowledgeLinks.filter((link) => link.knowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
  const supportingLinks = useMemo(() => state.knowledgeLinks.filter((link) => link.targetKnowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
  const sourceNoteIds = useMemo(() => supportingLinks.filter((link) => link.meaning === "source").map((link) => link.knowledgeItemId), [supportingLinks]);
  const relatedIds = useMemo(() => [...new Set([...sourceNoteIds, ...links.flatMap((link) => link.targetKnowledgeItemId ? [link.targetKnowledgeItemId] : [])])].sort(), [sourceNoteIds, links]);
  const sourceNotesQuery = useQuery({
    queryKey: ["knowledge-related", mode, state.workspaceId, knowledgeId, relatedIds],
    enabled: Boolean(resolvedItem && relatedIds.length),
    queryFn: async () => mode === "demo" ? state.knowledge.filter((candidate) => relatedIds.includes(candidate.id))
      : (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository().loadKnowledgeItems(relatedIds)
  });
  const existingNotesQuery = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { knowledgeKind: "note" });
  const projectContexts = useMemo(() => {
    const contexts = new Map<string, { project: typeof state.areas[number]; directLinks: typeof links; sources: Set<string> }>();
    for (const context of resolveKnowledgeProjectContexts(state, knowledgeId ?? "")) {
      const project = state.areas.find((area) => area.id === context.projectId);
      if (!project) continue;
      const current = contexts.get(project.id) ?? { project, directLinks: [], sources: new Set<string>() };
      current.sources.add(context.source === "direct" ? "bezpośrednio" : context.source === "goal" ? "przez Cel" : context.source === "action" ? "przez Działanie" : "przez Rutynę");
      current.directLinks = links.filter((link) => link.areaId === project.id);
      contexts.set(project.id, current);
    }
    return [...contexts.values()];
  }, [knowledgeId, links, state]);
  if (!localItem && itemQuery.isPending) return <AppShell><EmptyState icon={<BookMarked />} title="Ładowanie Wiedzy" detail="Pobieram element…" /></AppShell>;
  if (!localItem && itemQuery.isError) return <AppShell><EmptyState icon={<BookMarked />} title="Nie udało się wczytać Wiedzy" detail="Sprawdź połączenie i spróbuj ponownie." action={<Button onClick={() => void itemQuery.refetch()}>Spróbuj ponownie</Button>} /></AppShell>;
  if (!resolvedItem) return <AppShell><EmptyState icon={<BookMarked />} title="Nie znaleziono elementu Wiedzy" detail="Element nie istnieje albo nie jest dostępny w tej przestrzeni pracy." action={<Button onClick={() => navigate("/knowledge")}>Wróć do Wiedzy</Button>} /></AppShell>;
  const item = resolvedItem;
  const editableKind = isCreatableKnowledgeKind(form.kind) ? form.kind : undefined;
  const editGuidance = editableKind ? knowledgeKindGuidance[editableKind] : undefined;
  const fallbackBreadcrumbs: NavigationBreadcrumb[] = [{ label: "Wiedza", to: "/knowledge" }];
  const knowledgeRoute = `/knowledge/${encodeURIComponent(item.id)}`;
  const currentBreadcrumb = { label: `Wiedza: ${item.title}`, to: knowledgeRoute };
  const breadcrumbs = breadcrumbsForPage(location.state, fallbackBreadcrumbs, currentBreadcrumb);
  const itemNavigation = { breadcrumbs, returnTo: locationAddress(location), returnLabel: `Wiedza: ${item.title}` };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (editGuidance?.detailRequired && !form.detail.trim()) return;
    setSaving(true); setError("");
    const resourceFormat = form.kind === "resource" && form.isBook ? "book" : null;
    try { await updateKnowledge(item.id, { kind: form.kind, title: form.title, detail: form.detail, sourceUrl: form.sourceUrl || null, resourceFormat, resourceAuthor: resourceFormat ? form.resourceAuthor : undefined, readingStatus: resourceFormat ? form.readingStatus : undefined, goalIds: form.goalIds }, typeof formDraft.baseVersion === "number" ? formDraft.baseVersion : undefined); formDraft.clear(); setConflict(false); setEditing(false); }
    catch (caught) { if (isDraftVersionConflict(caught)) setConflict(true); setError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmian."); }
    finally { setSaving(false); }
  };
  const openBookQuickAdd = (mode: "goal" | "action") => requestAppQuickAdd({
    mode, areaId: bookProjectId || undefined, materialKnowledgeIds: [item.id], pinnedToToday: false,
    draftKey: `book-${item.id}-${mode}-${bookProjectId || "global"}`
  });
  const relatedItemById = new Map([...(sourceNotesQuery.data ?? []), ...state.knowledge].map((candidate) => [candidate.id, candidate]));
  const linkedTargets = links.filter((link) => !link.areaId).map((link) => ({ link, goal: state.goals.find((goal) => goal.id === link.goalId), action: state.actions.find((action) => action.id === link.actionId), series: state.recurringActionTemplates.find((series) => series.id === link.recurringTemplateId), knowledge: link.targetKnowledgeItemId ? relatedItemById.get(link.targetKnowledgeItemId) : undefined }));
  const supportItemById = new Map([...(sourceNotesQuery.data ?? []), ...state.knowledge].map((candidate) => [candidate.id, candidate]));
  const sourceNotes = supportingLinks.filter((link) => link.meaning === "source").map((link) => ({ link, item: supportItemById.get(link.knowledgeItemId) })).filter((entry): entry is { link: typeof supportingLinks[number]; item: KnowledgeItem } => Boolean(entry.item))
    .filter(({ item: sourceNote }) => !sourceNote.archivedAt && !sourceNote.trashedAt && (!sourceNoteQuery.trim() || `${sourceNote.title}\n${sourceNote.detail}`.toLocaleLowerCase("pl").includes(sourceNoteQuery.trim().toLocaleLowerCase("pl"))))
    .sort((a, b) => (b.item.updatedAt ?? b.item.createdAt ?? "").localeCompare(a.item.updatedAt ?? a.item.createdAt ?? "") || a.item.id.localeCompare(b.item.id));
  const linkedSourceNoteIds = new Set(supportingLinks.filter((link) => link.meaning === "source").map((link) => link.knowledgeItemId));
  const existingSourceNoteCandidates = [...new Map([...(existingNotesQuery.data?.items ?? []), ...state.knowledge]
    .filter((candidate) => candidate.type === "note" && !candidate.archivedAt && !candidate.trashedAt && !linkedSourceNoteIds.has(candidate.id))
    .map((candidate) => [candidate.id, candidate])).values()];
  const supportingItems = supportingLinks.filter((link) => link.meaning !== "source").map((link) => ({ link, item: supportItemById.get(link.knowledgeItemId) })).filter((entry) => entry.item);
  const availableProjects = state.areas.filter((area) => area.visibility === "active" && !projectContexts.some((context) => context.project.id === area.id));
  const sourceInboxItem = state.inbox.find((inboxItem) => inboxItem.id === item.sourceInboxItemId);
  const sourceHref = safeHttpUrl(item.sourceUrl);
  const restoreKey = `knowledge-restore:${item.id}`;
  const restore = () => mutation.run(restoreKey, async () => {
    const previous = item.trashedAt ? "trashed" as const : "archived" as const;
    await setVisibility("knowledge", item.id, "active");
    notifyUndo({ message: `„${item.title}” przywrócono.`, undo: () => setVisibility("knowledge", item.id, previous) });
  });
  const readingStatusKey = `book-reading-status:${item.id}`;
  const changeReadingStatus = (readingStatus: ReadingStatus) => {
    const previous = item.readingStatus ?? "to_read";
    if (readingStatus === previous) return;
    void mutation.run(readingStatusKey, async () => {
      await updateKnowledge(item.id, { readingStatus }, item.version);
      notifyUndo({ message: `Status książki zmieniono na „${readingStatusLabels[readingStatus]}”.`, undo: () => updateKnowledge(item.id, { readingStatus: previous }, typeof item.version === "number" ? item.version + 1 : undefined) });
    });
  };

  return <AppShell appearance="focus-detail"><div className="knowledge-detail-page">
    <ContextNavigation current={currentBreadcrumb} fallbackBreadcrumbs={fallbackBreadcrumbs} fallbackReturnTo="/knowledge" fallbackReturnLabel="Wróć do Wiedzy" showBack />
    <div className="knowledge-detail-head"><div className="knowledge-detail-meta"><KnowledgeKindBadge kind={item.type} /><div className="button-row"><Button onClick={() => setEditing((value) => !value)}><Pencil />{editing ? "Zamknij edycję" : "Edytuj"}</Button>{item.archivedAt || item.trashedAt ? <Button loading={mutation.isBusy(restoreKey)} onClick={() => void restore()}><RotateCcw />Przywróć</Button> : null}</div></div><h1>{item.title}</h1>{item.resourceFormat === "book" ? <><div className="book-reading-status-control"><label htmlFor="book-reading-status">Status czytania</label><select id="book-reading-status" value={item.readingStatus ?? "to_read"} disabled={mutation.isBusy(readingStatusKey)} onChange={(event) => changeReadingStatus(event.target.value as ReadingStatus)}>{Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>{[item.resourceAuthor].filter(Boolean).map((author) => <p key={author}>{author}</p>)}{mutation.error(readingStatusKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(readingStatusKey)} <button type="button" onClick={() => void mutation.retry(readingStatusKey)?.()}>Spróbuj ponownie</button></p> : null}</> : null}<p>Zaktualizowano {item.updatedAt || item.createdAt ? new Date(item.updatedAt ?? item.createdAt!).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "—"}</p></div>
    {mutation.error(restoreKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(restoreKey)} <button type="button" onClick={() => void mutation.retry(restoreKey)?.()}>Spróbuj ponownie</button></p> : null}
    <div className="goal-detail-grid"><div className="detail-main"><Panel>
      {editing ? <form onSubmit={save}>
        {item.type === "artifact" ? <div className="knowledge-kind-readonly"><KnowledgeKindBadge kind="artifact" /><span><strong>Rezultat Działania</strong><small>Ten rodzaj jest nadawany podczas ukończenia Działania.</small></span></div> : <>
          <label className="field-label" htmlFor="knowledge-edit-kind">Rodzaj</label>
          <select id="knowledge-edit-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>
            {item.type === "investigation" ? <option value="investigation">Poszukiwanie (historyczne)</option> : null}
            {creatableKnowledgeKinds.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
          {item.type === "investigation" ? <p className="field-help">Nowe poszukiwania zapisuj jako Działania. Ten historyczny wpis możesz zmienić w Notatkę, Materiał lub Decyzję.</p> : null}
        </>}
        <label className="field-label" htmlFor="knowledge-edit-title">{editGuidance?.titleLabel ?? "Tytuł rezultatu"}</label>
        <input id="knowledge-edit-title" placeholder={editGuidance?.titlePlaceholder} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
        {(form.kind === "resource" || form.sourceUrl) ? <><label className="field-label" htmlFor="knowledge-edit-url">Link do źródła <span className="optional-label">opcjonalnie</span></label><input id="knowledge-edit-url" type="url" placeholder="https://…" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></> : null}
        {form.kind === "resource" ? <><label className="checkbox-field"><input type="checkbox" checked={form.isBook} onChange={(event) => setForm((current) => ({ ...current, isBook: event.target.checked }))} /><span>To książka</span></label>{form.isBook ? <><label className="field-label" htmlFor="knowledge-edit-author">Autor <span className="optional-label">opcjonalnie</span></label><input id="knowledge-edit-author" value={form.resourceAuthor} onChange={(event) => setForm((current) => ({ ...current, resourceAuthor: event.target.value }))} /><label className="field-label" htmlFor="knowledge-edit-reading-status">Status czytania</label><select id="knowledge-edit-reading-status" value={form.readingStatus} onChange={(event) => setForm((current) => ({ ...current, readingStatus: event.target.value as ReadingStatus }))}>{Object.entries(readingStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></> : null}</> : null}
        <label className="field-label" htmlFor="knowledge-edit-detail">{editGuidance?.detailLabel ?? "Opis rezultatu"}{editGuidance && !editGuidance.detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label>
        <textarea id="knowledge-edit-detail" rows={12} required={editGuidance?.detailRequired} placeholder={editGuidance?.detailPlaceholder} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
        <span className="field-label">Powiązane Cele</span>
        <MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={form.goalIds} onChange={(goalIds) => setForm((current) => ({ ...current, goalIds }))} />
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}{conflict ? <DraftConflictNotice onCopy={() => void navigator.clipboard?.writeText(`${form.title}\n${form.detail}`)} onOpenCurrent={() => { formDraft.clear(); setConflict(false); setEditing(false); }} /> : null}
        <div className="modal-actions"><DraftStatus status={formDraft.status} errorMessage={formDraft.errorMessage} onRetry={() => void formDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${form.title}\n${form.detail}`)} />{formDraft.dirty ? <Button type="button" variant="ghost" onClick={formDraft.discard}>Odrzuć szkic</Button> : null}<Button type="button" disabled={saving} onClick={() => setEditing(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.title.trim() || Boolean(editGuidance?.detailRequired && !form.detail.trim())}>Zapisz zmiany</Button></div>
      </form> : <><div className="knowledge-body">{item.detail || <span className="muted-copy">{item.type === "resource" && sourceHref ? "Opis nie został dodany." : "Brak treści."}</span>}</div>{sourceHref ? <a className="source-link" href={sourceHref} target="_blank" rel="noopener noreferrer">Otwórz źródło <ExternalLink /></a> : null}</>}
    </Panel>
      {item.resourceFormat === "book" ? <Panel className="book-reading-notes" aria-labelledby="book-notes-heading"><div className="section-heading"><div><h2 id="book-notes-heading">Notatki do książki</h2><span>Każda notatka zachowuje link do tej książki.</span></div>{!item.trashedAt && !noteOpen ? <Button onClick={() => setNoteOpen(true)}><Plus />Zapisz myśl</Button> : null}</div>
        {noteOpen && !item.trashedAt ? <BookNoteComposer key={item.id} book={item} defaultProjectId={activeContextProjectId} onClose={() => setNoteOpen(false)} /> : null}
        <label className="knowledge-search book-note-search"><span className="sr-only">Szukaj w notatkach książki</span><input type="search" aria-label="Szukaj w notatkach książki" placeholder="Szukaj w notatkach…" value={sourceNoteQuery} onChange={(event) => setSourceNoteQuery(event.target.value)} /></label>
        {sourceNotesQuery.isLoading ? <p className="muted-copy">Ładowanie notatek…</p> : null}
        {sourceNotesQuery.isError ? <p className="auth-message error" role="alert">Nie udało się wczytać notatek. <button type="button" onClick={() => void sourceNotesQuery.refetch()}>Spróbuj ponownie</button></p> : null}
        {sourceNotes.map(({ link, item: sourceNote }) => {
          const firstLine = sourceNote.detail.split("\n").find((line) => line.trim())?.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl");
          const titleIsFirstLine = Boolean(firstLine && firstLine === sourceNote.title.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl"));
          const displayDetail = titleIsFirstLine ? sourceNote.detail.replace(/^\s*[^\n]*\n?/, "").trim() : sourceNote.detail;
          const long = displayDetail.length > 600 || displayDetail.split("\n").length > 8;
          const preview = long ? `${displayDetail.slice(0, 520).trimEnd()}…` : displayDetail;
          return <article className="book-note-card" key={link.id} data-navigation-card-id={navigationCardId("knowledge", sourceNote.id)} tabIndex={-1}>
            <NavigationLink to={routeForEntity({ type: "knowledge", id: sourceNote.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", sourceNote.id)}>{sourceNote.title}</NavigationLink>
            {preview ? <p>{preview}</p> : null}
            {long ? <details><summary>Pokaż więcej</summary><p>{displayDetail}</p></details> : null}
            <div className="book-note-card-footer"><small>{new Date(sourceNote.updatedAt ?? sourceNote.createdAt ?? 0).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</small><Button variant="ghost" aria-label={`Odłącz notatkę: ${sourceNote.title}`} onClick={() => void unlinkKnowledge(link.id)}>Odłącz</Button></div>
          </article>;
        })}
        {!sourceNotes.length && !sourceNotesQuery.isLoading && !sourceNotesQuery.isError ? <p className="muted-copy">{sourceNoteQuery.trim() ? "Brak pasujących notatek." : "Ta książka nie ma jeszcze notatek."}</p> : null}
        {item.trashedAt ? <p className="muted-copy">Książka w Koszu pozostaje źródłem istniejących notatek. Przywróć ją, aby zapisać nową myśl lub utworzyć powiązanie.</p> : null}
      </Panel> : null}
    </div><aside className="detail-aside">
      <Panel className="knowledge-connections" aria-labelledby="knowledge-connections-title"><h2 id="knowledge-connections-title">Powiązania</h2>
        <section className="knowledge-projects-panel" aria-label="Projekty"><h3 className="sr-only">Projekty</h3>
          {projectContexts.length > 1 ? <div className="cross-project-signal">Łączy {projectContexts.length} Projekty</div> : null}
          {projectContexts.map((context) => <div className="knowledge-context-row" key={context.project.id}><span className="knowledge-context-type"><FolderKanban /><span>Projekt</span></span><NavigationLink to={`/projects/${context.project.id}`} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel}>{context.project.name}<small>{[...context.sources].join(" · ")}</small></NavigationLink><ChevronRight className="knowledge-context-arrow" />{context.directLinks.map((link) => <Button key={link.id} variant="ghost" aria-label={`Odłącz Projekt: ${context.project.name}`} onClick={() => void mutation.run(`project-context:${item.id}`, () => unlinkKnowledge(link.id))}>×</Button>)}</div>)}
        </section>
{sourceNotesQuery.isError ? <p role="alert">Nie udało się wczytać powiązanej Wiedzy. <Button onClick={() => void sourceNotesQuery.refetch()}>Spróbuj ponownie</Button></p> : null}
{linkedTargets.map(({ link, goal, action, series, knowledge }) => <div className="knowledge-context-row" key={link.id} data-navigation-card-id={goal ? navigationCardId("goal", goal.id) : action ? navigationCardId("action", action.id) : knowledge ? navigationCardId("knowledge", knowledge.id) : undefined} tabIndex={goal || action || knowledge ? -1 : undefined}><span className="knowledge-context-type">{goal ? <Flag /> : action ? <ListTodo /> : series ? <Repeat2 /> : <BookMarked />}<span>{goal ? "Cel" : action ? "Działanie" : series ? "Rutyna" : "Wiedza"}<small>{link.meaning === "result" ? "Rezultat" : link.meaning === "decision" ? "Decyzja" : link.meaning === "material" ? "Materiał" : link.meaning === "source" ? "Źródło" : "Powiązanie"}</small></span></span>{goal ? <NavigationLink to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("goal", goal.id)}>{goal.title}</NavigationLink> : action ? <NavigationLink to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("action", action.id)}>{action.title}</NavigationLink> : series ? <NavigationLink to={`/?series=${series.id}`} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel}>{series.title}</NavigationLink> : knowledge ? <NavigationLink to={routeForEntity({ type: "knowledge", id: knowledge.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", knowledge.id)}>{link.meaning === "source" ? `Źródło: ${knowledge.title}` : `Powiązana Wiedza: ${knowledge.title}`}</NavigationLink> : <span>{sourceNotesQuery.isFetching ? "Ładowanie powiązania…" : "Niedostępny obiekt"}</span>}<ChevronRight className="knowledge-context-arrow" />{!goal ? <Button variant="ghost" aria-label="Odłącz powiązanie" onClick={() => void unlinkKnowledge(link.id)}>×</Button> : null}</div>)}
        {!projectContexts.length && !linkedTargets.length ? <p className="muted-copy">Bez powiązań.</p> : null}
        <details className="detail-connect-disclosure knowledge-connect"><summary><Link2 />Połącz wiedzę</summary>
<div className="knowledge-project-connect"><h3>Połącz z projektem</h3><div className="inline-link"><select aria-label="Połącz z kolejnym Projektem" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Wybierz Projekt…</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><Button disabled={!projectId} loading={mutation.isBusy(`project-context:${item.id}`)} onClick={() => void mutation.run(`project-context:${item.id}`, async () => { await linkKnowledge(item.id, { areaId: projectId }, "reference"); setProjectId(""); })}><Plus />Połącz Projekt</Button></div></div>{mutation.error(`project-context:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`project-context:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`project-context:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}
          <Button variant="ghost" onClick={() => setEditing(true)}><Flag />Edytuj powiązane Cele</Button>
        </details>
      </Panel>
      {item.resourceFormat === "book" && !item.trashedAt ? <Panel className="book-source-note-connect"><h2>Połącz notatkę</h2><p className="muted-copy">Dołącz istniejącą notatkę do tej książki.</p><div className="inline-link"><select aria-label="Połącz istniejącą notatkę z książką" value={sourceNoteToLink} onChange={(event) => setSourceNoteToLink(event.target.value)}><option value="">Wybierz istniejącą notatkę…</option>{existingSourceNoteCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select><Button disabled={!sourceNoteToLink} loading={mutation.isBusy(`book-source-note:${item.id}`)} onClick={() => void mutation.run(`book-source-note:${item.id}`, async () => { await linkKnowledge(sourceNoteToLink, { targetKnowledgeItemId: item.id }, "source"); setSourceNoteToLink(""); })}><Link2 />Połącz</Button></div>{existingNotesQuery.hasNextPage ? <Button variant="ghost" loading={existingNotesQuery.isFetchingNextPage} onClick={() => void existingNotesQuery.fetchNextPage()}>Wczytaj więcej notatek</Button> : null}{existingNotesQuery.isError ? <p className="auth-message error" role="alert">Nie udało się wczytać biblioteki notatek. <button type="button" onClick={() => void existingNotesQuery.refetch()}>Spróbuj ponownie</button></p> : null}</Panel> : null}
      {item.resourceFormat === "book" && !item.trashedAt ? <Panel className="book-work-links"><h2>Połącz z pracą</h2><p className="muted-copy">Działania korzystają ze Startu, a Cele pozostają niezależne od statusu czytania.</p><label className="field-label" htmlFor="book-work-project">Projekt <span className="optional-label">opcjonalnie</span></label><select id="book-work-project" value={bookProjectId} onChange={(event) => setBookProjectId(event.target.value)}><option value="">Bez Projektu</option>{state.areas.filter((area) => area.visibility === "active").map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select><div className="button-row"><Button onClick={() => openBookQuickAdd("action")}><ListTodo />Nowe Działanie</Button><Button variant="secondary" onClick={() => openBookQuickAdd("goal")}><Flag />Nowy Cel</Button></div></Panel> : null}
      {item.type === "decision" ? <Panel className="decision-evidence-panel"><h2><CheckCircle2 />Potwierdzenia decyzji</h2><p className="muted-copy">Dołącz materiał, notatkę lub wynik poszukiwania, który uzasadnia tę decyzję.</p>{supportingItems.map(({ link, item: supportingItem }) => <div className="linked-knowledge" key={link.id} data-navigation-card-id={navigationCardId("knowledge", supportingItem!.id)} tabIndex={-1}><NavigationLink to={routeForEntity({ type: "knowledge", id: supportingItem!.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", supportingItem!.id)}>{supportingItem!.title}</NavigationLink><Button variant="ghost" aria-label={`Odłącz potwierdzenie: ${supportingItem!.title}`} onClick={() => void unlinkKnowledge(link.id)}>×</Button></div>)}<details className="detail-connect-disclosure"><summary><Plus />Dodaj potwierdzenie</summary><div className="inline-link"><select aria-label="Materiał potwierdzający decyzję" value={supportingId} onChange={(event) => setSupportingId(event.target.value)}><option value="">Wybierz materiał…</option>{state.knowledge.filter((candidate) => candidate.id !== item.id && !candidate.archivedAt && !candidate.trashedAt && !supportingLinks.some((link) => link.knowledgeItemId === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{labels[candidate.type]} · {candidate.title}</option>)}</select><Button disabled={!supportingId} onClick={() => void mutation.run(`decision-evidence:${item.id}`, async () => { await linkKnowledge(supportingId, { targetKnowledgeItemId: item.id }, "material"); setSupportingId(""); })}><Plus />Dołącz</Button></div></details>{mutation.error(`decision-evidence:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`decision-evidence:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`decision-evidence:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}</Panel> : null}
{sourceInboxItem ? <Panel><h2>Pochodzenie</h2><p className="muted-copy">Zapisano ze Skrzynki; oryginał i sposób przetworzenia pozostają w historii.</p><Link className="history-link" to={routeForEntity({ type: "inbox", id: sourceInboxItem.id, status: sourceInboxItem.status })}><span>{sourceInboxItem.content}</span><span>Otwórz przechwycenie</span></Link></Panel> : null}</aside></div>
  </div></AppShell>;
}
