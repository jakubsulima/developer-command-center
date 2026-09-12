import "./focus-detail.css";
import { useMemo, useState, type FormEvent } from "react";
import { BookMarked, CheckCircle2, ExternalLink, FolderKanban, Link2, Plus, RotateCcw, Flag, ListTodo, Repeat2, ChevronRight, Pencil } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { MultiCombobox } from "../components/MultiCombobox";
import { Button, EmptyState, Panel } from "../components/ui";
import type { KnowledgeKind } from "../domain/types";
import { knowledgeKindLabels as labels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { safeHttpUrl } from "../domain/http-url";
import { useActionFeedback } from "../components/action-feedback-context";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { KnowledgeKindBadge } from "../components/KnowledgeKindBadge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { ContextNavigation, NavigationLink } from "../components/ContextNavigation";
import { breadcrumbsForPage, locationAddress, navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import { resolveKnowledgeProjectContexts } from "../domain/knowledge";
import { creatableKnowledgeKinds, isCreatableKnowledgeKind, knowledgeKindGuidance } from "../domain/knowledge-kinds";
import { usePersistentDraft } from "../hooks/usePersistentDraft";
import { DraftStatus } from "../components/DraftStatus";
import { DraftConflictNotice } from "../components/DraftConflictNotice";
import { isDraftVersionConflict } from "../components/draftConflict";

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
  const formDraft = usePersistentDraft("knowledge-edit", { kind: (resolvedItem?.type ?? "note") as KnowledgeKind, title: resolvedItem?.title ?? "", detail: resolvedItem?.detail ?? "", sourceUrl: resolvedItem?.sourceUrl ?? "", goalIds: resolvedItem ? state.knowledgeLinks.filter((link) => link.knowledgeItemId === resolvedItem.id && link.goalId).map((link) => link.goalId!) : [] }, 450, { targetId: knowledgeId ?? "new", baseVersion: resolvedItem?.version, enabled: Boolean(resolvedItem) });
  const form = formDraft.value;
  const setForm = formDraft.setValue;
  const links = useMemo(() => state.knowledgeLinks.filter((link) => link.knowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
  const supportingLinks = useMemo(() => state.knowledgeLinks.filter((link) => link.targetKnowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
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
    try { await updateKnowledge(item.id, { kind: form.kind, title: form.title, detail: form.detail, sourceUrl: form.sourceUrl || null, goalIds: form.goalIds }, typeof formDraft.baseVersion === "number" ? formDraft.baseVersion : undefined); formDraft.clear(); setConflict(false); setEditing(false); }
    catch (caught) { if (isDraftVersionConflict(caught)) setConflict(true); setError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmian."); }
    finally { setSaving(false); }
  };
  const linkedTargets = links.filter((link) => !link.areaId).map((link) => ({ link, goal: state.goals.find((goal) => goal.id === link.goalId), action: state.actions.find((action) => action.id === link.actionId), series: state.recurringActionTemplates.find((series) => series.id === link.recurringTemplateId), knowledge: state.knowledge.find((candidate) => candidate.id === link.targetKnowledgeItemId) }));
  const supportingItems = supportingLinks.map((link) => ({ link, item: state.knowledge.find((candidate) => candidate.id === link.knowledgeItemId) })).filter((entry) => entry.item);
  const availableProjects = state.areas.filter((area) => area.visibility === "active" && !projectContexts.some((context) => context.project.id === area.id));
  const sourceInboxItem = state.inbox.find((inboxItem) => inboxItem.id === item.sourceInboxItemId);
  const sourceHref = safeHttpUrl(item.sourceUrl);
  const restoreKey = `knowledge-restore:${item.id}`;
  const restore = () => mutation.run(restoreKey, async () => {
    const previous = item.trashedAt ? "trashed" as const : "archived" as const;
    await setVisibility("knowledge", item.id, "active");
    notifyUndo({ message: `„${item.title}” przywrócono.`, undo: () => setVisibility("knowledge", item.id, previous) });
  });

  return <AppShell appearance="focus-detail"><div className="knowledge-detail-page">
    <ContextNavigation current={currentBreadcrumb} fallbackBreadcrumbs={fallbackBreadcrumbs} fallbackReturnTo="/knowledge" fallbackReturnLabel="Wróć do Wiedzy" />
    <div className="knowledge-detail-head"><div className="knowledge-detail-meta"><KnowledgeKindBadge kind={item.type} /><div className="button-row"><Button onClick={() => setEditing((value) => !value)}><Pencil />{editing ? "Zamknij edycję" : "Edytuj"}</Button>{item.archivedAt || item.trashedAt ? <Button loading={mutation.isBusy(restoreKey)} onClick={() => void restore()}><RotateCcw />Przywróć</Button> : null}</div></div><h1>{item.title}</h1><p>Zaktualizowano {item.updatedAt || item.createdAt ? new Date(item.updatedAt ?? item.createdAt!).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" }) : "—"}</p></div>
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
        <label className="field-label" htmlFor="knowledge-edit-detail">{editGuidance?.detailLabel ?? "Opis rezultatu"}{editGuidance && !editGuidance.detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label>
        <textarea id="knowledge-edit-detail" rows={12} required={editGuidance?.detailRequired} placeholder={editGuidance?.detailPlaceholder} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} />
        <span className="field-label">Powiązane Cele</span>
        <MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={form.goalIds} onChange={(goalIds) => setForm((current) => ({ ...current, goalIds }))} />
        {error ? <p className="auth-message error" role="alert">{error}</p> : null}{conflict ? <DraftConflictNotice onCopy={() => void navigator.clipboard?.writeText(`${form.title}\n${form.detail}`)} onOpenCurrent={() => { formDraft.clear(); setConflict(false); setEditing(false); }} /> : null}
        <div className="modal-actions"><DraftStatus status={formDraft.status} errorMessage={formDraft.errorMessage} onRetry={() => void formDraft.retry()} onCopy={() => void navigator.clipboard?.writeText(`${form.title}\n${form.detail}`)} />{formDraft.dirty ? <Button type="button" variant="ghost" onClick={formDraft.discard}>Odrzuć szkic</Button> : null}<Button type="button" disabled={saving} onClick={() => setEditing(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.title.trim() || Boolean(editGuidance?.detailRequired && !form.detail.trim())}>Zapisz zmiany</Button></div>
      </form> : <><div className="knowledge-body">{item.detail || <span className="muted-copy">Brak treści.</span>}</div>{sourceHref ? <a className="source-link" href={sourceHref} target="_blank" rel="noopener noreferrer">Otwórz źródło <ExternalLink /></a> : null}</>}
    </Panel></div><aside className="detail-aside">
      <Panel className="knowledge-connections" aria-labelledby="knowledge-connections-title"><h2 id="knowledge-connections-title">Powiązania</h2>
        <section className="knowledge-projects-panel" aria-label="Projekty"><h3 className="sr-only">Projekty</h3>
          {projectContexts.length > 1 ? <div className="cross-project-signal">Łączy {projectContexts.length} Projekty</div> : null}
          {projectContexts.map((context) => <div className="knowledge-context-row" key={context.project.id}><span className="knowledge-context-type"><FolderKanban /><span>Projekt</span></span><NavigationLink to={`/projects/${context.project.id}`} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel}>{context.project.name}<small>{[...context.sources].join(" · ")}</small></NavigationLink><ChevronRight className="knowledge-context-arrow" />{context.directLinks.map((link) => <Button key={link.id} variant="ghost" aria-label={`Odłącz Projekt: ${context.project.name}`} onClick={() => void mutation.run(`project-context:${item.id}`, () => unlinkKnowledge(link.id))}>×</Button>)}</div>)}
        </section>
{linkedTargets.map(({ link, goal, action, series, knowledge }) => <div className="knowledge-context-row" key={link.id} data-navigation-card-id={goal ? navigationCardId("goal", goal.id) : action ? navigationCardId("action", action.id) : knowledge ? navigationCardId("knowledge", knowledge.id) : undefined} tabIndex={goal || action || knowledge ? -1 : undefined}><span className="knowledge-context-type">{goal ? <Flag /> : action ? <ListTodo /> : series ? <Repeat2 /> : <BookMarked />}<span>{goal ? "Cel" : action ? "Działanie" : series ? "Rutyna" : "Wiedza"}<small>{link.meaning === "result" ? "Rezultat" : link.meaning === "decision" ? "Decyzja" : link.meaning === "material" ? "Materiał" : "Powiązanie"}</small></span></span>{goal ? <NavigationLink to={routeForEntity({ type: "goal", id: goal.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("goal", goal.id)}>{goal.title}</NavigationLink> : action ? <NavigationLink to={routeForEntity({ type: "action", id: action.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("action", action.id)}>{action.title}</NavigationLink> : series ? <NavigationLink to={`/?series=${series.id}`} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel}>{series.title}</NavigationLink> : knowledge ? <NavigationLink to={routeForEntity({ type: "knowledge", id: knowledge.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", knowledge.id)}>Potwierdza decyzję: {knowledge.title}</NavigationLink> : <span>Niedostępny obiekt</span>}<ChevronRight className="knowledge-context-arrow" />{!goal ? <Button variant="ghost" aria-label="Odłącz powiązanie" onClick={() => void unlinkKnowledge(link.id)}>×</Button> : null}</div>)}
        {!projectContexts.length && !linkedTargets.length ? <p className="muted-copy">Bez powiązań.</p> : null}
        <details className="detail-connect-disclosure knowledge-connect"><summary><Link2 />Połącz wiedzę</summary>
<div className="knowledge-project-connect"><h3>Połącz z projektem</h3><div className="inline-link"><select aria-label="Połącz z kolejnym Projektem" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Wybierz Projekt…</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><Button disabled={!projectId} loading={mutation.isBusy(`project-context:${item.id}`)} onClick={() => void mutation.run(`project-context:${item.id}`, async () => { await linkKnowledge(item.id, { areaId: projectId }, "reference"); setProjectId(""); })}><Plus />Połącz Projekt</Button></div></div>{mutation.error(`project-context:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`project-context:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`project-context:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}
          <Button variant="ghost" onClick={() => setEditing(true)}><Flag />Edytuj powiązane Cele</Button>
        </details>
      </Panel>
      {item.type === "decision" ? <Panel className="decision-evidence-panel"><h2><CheckCircle2 />Potwierdzenia decyzji</h2><p className="muted-copy">Dołącz materiał, notatkę lub wynik poszukiwania, który uzasadnia tę decyzję.</p>{supportingItems.map(({ link, item: supportingItem }) => <div className="linked-knowledge" key={link.id} data-navigation-card-id={navigationCardId("knowledge", supportingItem!.id)} tabIndex={-1}><NavigationLink to={routeForEntity({ type: "knowledge", id: supportingItem!.id })} breadcrumbs={breadcrumbs} returnTo={itemNavigation.returnTo} returnLabel={itemNavigation.returnLabel} sourceCardId={navigationCardId("knowledge", supportingItem!.id)}>{supportingItem!.title}</NavigationLink><Button variant="ghost" aria-label={`Odłącz potwierdzenie: ${supportingItem!.title}`} onClick={() => void unlinkKnowledge(link.id)}>×</Button></div>)}<details className="detail-connect-disclosure"><summary><Plus />Dodaj potwierdzenie</summary><div className="inline-link"><select aria-label="Materiał potwierdzający decyzję" value={supportingId} onChange={(event) => setSupportingId(event.target.value)}><option value="">Wybierz materiał…</option>{state.knowledge.filter((candidate) => candidate.id !== item.id && !candidate.archivedAt && !candidate.trashedAt && !supportingLinks.some((link) => link.knowledgeItemId === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{labels[candidate.type]} · {candidate.title}</option>)}</select><Button disabled={!supportingId} onClick={() => void mutation.run(`decision-evidence:${item.id}`, async () => { await linkKnowledge(supportingId, { targetKnowledgeItemId: item.id }, "material"); setSupportingId(""); })}><Plus />Dołącz</Button></div></details>{mutation.error(`decision-evidence:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`decision-evidence:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`decision-evidence:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}</Panel> : null}
{sourceInboxItem ? <Panel><h2>Pochodzenie</h2><p className="muted-copy">Zapisano ze Skrzynki; oryginał i sposób przetworzenia pozostają w historii.</p><Link className="history-link" to={routeForEntity({ type: "inbox", id: sourceInboxItem.id, status: sourceInboxItem.status })}><span>{sourceInboxItem.content}</span><span>Otwórz przechwycenie</span></Link></Panel> : null}</aside></div>
  </div></AppShell>;
}
