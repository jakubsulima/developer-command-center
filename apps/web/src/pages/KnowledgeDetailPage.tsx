import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, BookMarked, CheckCircle2, ExternalLink, FolderKanban, Link2, Plus, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

export function KnowledgeDetailPage() {
  const { knowledgeId } = useParams();
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
  const [supportingId, setSupportingId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [form, setForm] = useState({ kind: "note" as KnowledgeKind, title: "", detail: "", sourceUrl: "", goalIds: [] as string[] });
  useEffect(() => {
    if (resolvedItem) setForm({ kind: resolvedItem.type, title: resolvedItem.title, detail: resolvedItem.detail, sourceUrl: resolvedItem.sourceUrl ?? "", goalIds: state.knowledgeLinks.filter((link) => link.knowledgeItemId === resolvedItem.id && link.goalId).map((link) => link.goalId!) });
  }, [resolvedItem, state.knowledgeLinks]);
  const links = useMemo(() => state.knowledgeLinks.filter((link) => link.knowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
  const supportingLinks = useMemo(() => state.knowledgeLinks.filter((link) => link.targetKnowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
  const projectContexts = useMemo(() => {
    const contexts = new Map<string, { project: typeof state.areas[number]; directLinks: typeof links; sources: Set<string> }>();
    const add = (areaId: string | undefined, source: string, directLink?: typeof links[number]) => {
      const project = state.areas.find((area) => area.id === areaId);
      if (!project) return;
      const current = contexts.get(project.id) ?? { project, directLinks: [], sources: new Set<string>() };
      current.sources.add(source);
      if (directLink) current.directLinks.push(directLink);
      contexts.set(project.id, current);
    };
    for (const link of links) {
      if (link.areaId) add(link.areaId, "bezpośrednio", link);
      if (link.goalId) add(state.goals.find((goal) => goal.id === link.goalId)?.areaId, "przez Cel");
      if (link.actionId) {
        const action = state.actions.find((candidate) => candidate.id === link.actionId);
        add(action?.areaId ?? state.goals.find((goal) => goal.id === action?.goalId)?.areaId, "przez Działanie");
      }
      if (link.recurringTemplateId) {
        const series = state.recurringActionTemplates.find((candidate) => candidate.id === link.recurringTemplateId);
        add(series?.areaId ?? state.goals.find((goal) => goal.id === series?.goalId)?.areaId, "przez Rutynę");
      }
    }
    return [...contexts.values()];
  }, [links, state]);
  if (!localItem && itemQuery.isPending) return <AppShell><EmptyState icon={<BookMarked />} title="Ładowanie Wiedzy" detail="Pobieram element…" /></AppShell>;
  if (!resolvedItem) return <AppShell><EmptyState icon={<BookMarked />} title="Nie znaleziono elementu Wiedzy" detail="Element nie istnieje albo nie jest dostępny w tym Workspace." action={<Button onClick={() => navigate("/knowledge")}>Wróć do Wiedzy</Button>} /></AppShell>;
  const item = resolvedItem;

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await updateKnowledge(item.id, { kind: form.kind, title: form.title, detail: form.detail, sourceUrl: form.sourceUrl || null, goalIds: form.goalIds }); setEditing(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmian."); }
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

  return <AppShell>
    <button className="back-link" onClick={() => navigate("/knowledge")}><ArrowLeft />Wróć do Wiedzy</button>
    <div className="knowledge-detail-head"><div><KnowledgeKindBadge kind={item.type} /><h1>{item.title}</h1><p>Zaktualizowano {new Date(item.updatedAt ?? item.createdAt ?? Date.now()).toLocaleString("pl-PL")}</p></div><div className="button-row"><Button onClick={() => setEditing((value) => !value)}>{editing ? "Zamknij edycję" : "Edytuj"}</Button>{item.archivedAt || item.trashedAt ? <Button loading={mutation.isBusy(restoreKey)} onClick={() => void restore()}><RotateCcw />Przywróć</Button> : null}</div></div>
    {mutation.error(restoreKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(restoreKey)} <button type="button" onClick={() => void mutation.retry(restoreKey)?.()}>Spróbuj ponownie</button></p> : null}
    <div className="goal-detail-grid"><div className="detail-main"><Panel>
      {editing ? <form onSubmit={save}><label className="field-label" htmlFor="knowledge-edit-kind">Rodzaj</label><select id="knowledge-edit-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="field-label" htmlFor="knowledge-edit-title">Tytuł</label><input id="knowledge-edit-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} autoFocus required /><label className="field-label" htmlFor="knowledge-edit-detail">Treść</label><textarea id="knowledge-edit-detail" rows={12} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /><label className="field-label" htmlFor="knowledge-edit-url">URL źródła</label><input id="knowledge-edit-url" type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /><span className="field-label">Powiązane Cele</span><MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={form.goalIds} onChange={(goalIds) => setForm((current) => ({ ...current, goalIds }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" disabled={saving} onClick={() => setEditing(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.title.trim()}>Zapisz zmiany</Button></div></form> : <><div className="knowledge-body">{item.detail || <span className="muted-copy">Brak treści.</span>}</div>{sourceHref ? <a className="source-link" href={sourceHref} target="_blank" rel="noopener noreferrer">Otwórz źródło <ExternalLink /></a> : null}</>}
    </Panel></div><aside className="detail-aside">
      <Panel className="knowledge-projects-panel"><h2><FolderKanban />Projekty i transfer wiedzy</h2><p className="muted-copy">Ten sam wniosek może pracować w kilku Projektach bez kopiowania treści.</p>{projectContexts.length > 1 ? <div className="cross-project-signal">Łączy {projectContexts.length} Projekty</div> : null}{projectContexts.map((context) => <div className="linked-knowledge linked-project-context" key={context.project.id}><span><Link to={`/projects/${context.project.id}`}>{context.project.name}</Link><small>{[...context.sources].join(" · ")}</small></span>{context.directLinks.map((link) => <Button key={link.id} variant="ghost" aria-label={`Odłącz Projekt: ${context.project.name}`} onClick={() => void mutation.run(`project-context:${item.id}`, () => unlinkKnowledge(link.id))}>×</Button>)}</div>)}{!projectContexts.length ? <p className="muted-copy">Nie połączono jeszcze z żadnym Projektem.</p> : null}<div className="inline-link"><select aria-label="Połącz z kolejnym Projektem" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Wybierz Projekt…</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><Button disabled={!projectId} loading={mutation.isBusy(`project-context:${item.id}`)} onClick={() => void mutation.run(`project-context:${item.id}`, async () => { await linkKnowledge(item.id, { areaId: projectId }, "reference"); setProjectId(""); })}><Plus />Połącz Projekt</Button></div>{mutation.error(`project-context:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`project-context:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`project-context:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}</Panel>
      {item.type === "decision" ? <Panel className="decision-evidence-panel"><h2><CheckCircle2 />Potwierdzenia decyzji</h2><p className="muted-copy">Dołącz materiał, notatkę lub wynik poszukiwania, który uzasadnia tę decyzję.</p>{supportingItems.map(({ link, item: supportingItem }) => <div className="linked-knowledge" key={link.id}><Link to={routeForEntity({ type: "knowledge", id: supportingItem!.id })}>{supportingItem!.title}</Link><Button variant="ghost" aria-label={`Odłącz potwierdzenie: ${supportingItem!.title}`} onClick={() => void unlinkKnowledge(link.id)}>×</Button></div>)}<div className="inline-link"><select aria-label="Materiał potwierdzający decyzję" value={supportingId} onChange={(event) => setSupportingId(event.target.value)}><option value="">Wybierz materiał…</option>{state.knowledge.filter((candidate) => candidate.id !== item.id && !candidate.archivedAt && !candidate.trashedAt && !supportingLinks.some((link) => link.knowledgeItemId === candidate.id)).map((candidate) => <option key={candidate.id} value={candidate.id}>{labels[candidate.type]} · {candidate.title}</option>)}</select><Button disabled={!supportingId} onClick={() => void mutation.run(`decision-evidence:${item.id}`, async () => { await linkKnowledge(supportingId, { targetKnowledgeItemId: item.id }, "material"); setSupportingId(""); })}><Plus />Dołącz</Button></div>{mutation.error(`decision-evidence:${item.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`decision-evidence:${item.id}`)} <button type="button" onClick={() => void mutation.retry(`decision-evidence:${item.id}`)?.()}>Spróbuj ponownie</button></p> : null}</Panel> : null}
      <Panel><h2><Link2 />Powiązania</h2>{linkedTargets.map(({ link, goal, action, series, knowledge }) => <div className="linked-knowledge" key={link.id}><span className="relation-meaning">{link.meaning === "result" ? "Rezultat Działania" : link.meaning === "decision" ? "Decyzja" : link.meaning === "material" ? "Materiał" : "Pozostałe"}</span>{goal ? <Link to={routeForEntity({ type: "goal", id: goal.id })}>{goal.title}</Link> : action ? <Link to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })}>{action.title}</Link> : series ? <Link to={`/?series=${series.id}`}>{series.title}</Link> : knowledge ? <Link to={routeForEntity({ type: "knowledge", id: knowledge.id })}>Potwierdza decyzję: {knowledge.title}</Link> : <span>Niedostępny obiekt</span>}{!goal ? <Button variant="ghost" aria-label="Odłącz powiązanie" onClick={() => void unlinkKnowledge(link.id)}>×</Button> : null}</div>)}{!links.length ? <p className="muted-copy">Bez powiązań.</p> : null}<p className="muted-copy">Powiązania z Celami edytujesz atomowo razem z treścią.</p></Panel>{sourceInboxItem ? <Panel><h2>Pochodzenie</h2><p className="muted-copy">Zapisano ze Skrzynki; oryginał i sposób przetworzenia pozostają w historii.</p><Link className="history-link" to={routeForEntity({ type: "inbox", id: sourceInboxItem.id, status: sourceInboxItem.status })}><span>{sourceInboxItem.content}</span><span>Otwórz przechwycenie</span></Link></Panel> : null}</aside></div>
  </AppShell>;
}
