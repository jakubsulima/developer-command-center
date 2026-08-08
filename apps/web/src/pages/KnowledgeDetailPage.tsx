import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, BookMarked, ExternalLink, Link2, RotateCcw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../app/useStore";
import { AppShell } from "../components/AppShell";
import { MultiCombobox } from "../components/MultiCombobox";
import { Badge, Button, EmptyState, Panel } from "../components/ui";
import type { KnowledgeKind } from "../domain/types";
import { knowledgeKindLabels as labels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { useActionFeedback } from "../components/action-feedback-context";
import { useKeyedMutation } from "../hooks/useKeyedMutation";

export function KnowledgeDetailPage() {
  const { knowledgeId } = useParams();
  const navigate = useNavigate();
  const { state, updateKnowledge, unlinkKnowledge, setVisibility } = useStore();
  const { notifyUndo } = useActionFeedback();
  const mutation = useKeyedMutation();
  const item = state.knowledge.find((candidate) => candidate.id === knowledgeId);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ kind: "note" as KnowledgeKind, title: "", detail: "", sourceUrl: "", goalIds: [] as string[] });
  useEffect(() => {
    if (item) setForm({ kind: item.type, title: item.title, detail: item.detail, sourceUrl: item.sourceUrl ?? "", goalIds: state.knowledgeLinks.filter((link) => link.knowledgeItemId === item.id && link.goalId).map((link) => link.goalId!) });
  }, [item, state.knowledgeLinks]);
  const links = useMemo(() => state.knowledgeLinks.filter((link) => link.knowledgeItemId === knowledgeId), [knowledgeId, state.knowledgeLinks]);
  if (!item) return <AppShell><EmptyState icon={<BookMarked />} title="Nie znaleziono elementu Wiedzy" detail="Element nie istnieje albo nie jest dostępny w tym Workspace." action={<Button onClick={() => navigate("/knowledge")}>Wróć do Wiedzy</Button>} /></AppShell>;

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try { await updateKnowledge(item.id, { kind: form.kind, title: form.title, detail: form.detail, sourceUrl: form.sourceUrl || null, goalIds: form.goalIds }); setEditing(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się zapisać zmian."); }
    finally { setSaving(false); }
  };
  const linkedTargets = links.map((link) => ({ link, goal: state.goals.find((goal) => goal.id === link.goalId), action: state.actions.find((action) => action.id === link.actionId), series: state.recurringActionTemplates.find((series) => series.id === link.recurringTemplateId) }));
  const sourceInboxItem = state.inbox.find((inboxItem) => inboxItem.id === item.sourceInboxItemId);
  const restoreKey = `knowledge-restore:${item.id}`;
  const restore = () => mutation.run(restoreKey, async () => {
    const previous = item.trashedAt ? "trashed" as const : "archived" as const;
    await setVisibility("knowledge", item.id, "active");
    notifyUndo({ message: `„${item.title}” przywrócono.`, undo: () => setVisibility("knowledge", item.id, previous) });
  });

  return <AppShell>
    <button className="back-link" onClick={() => navigate("/knowledge")}><ArrowLeft />Wróć do Wiedzy</button>
    <div className="knowledge-detail-head"><div><Badge tone="neutral">{labels[item.type]}</Badge><h1>{item.title}</h1><p>Zaktualizowano {new Date(item.updatedAt ?? item.createdAt ?? Date.now()).toLocaleString("pl-PL")}</p></div><div className="button-row"><Button onClick={() => setEditing((value) => !value)}>{editing ? "Zamknij edycję" : "Edytuj"}</Button>{item.archivedAt || item.trashedAt ? <Button loading={mutation.isBusy(restoreKey)} onClick={() => void restore()}><RotateCcw />Przywróć</Button> : null}</div></div>
    {mutation.error(restoreKey) ? <p className="inline-mutation-error" role="alert">{mutation.error(restoreKey)} <button type="button" onClick={() => void mutation.retry(restoreKey)?.()}>Spróbuj ponownie</button></p> : null}
    <div className="goal-detail-grid"><div className="detail-main"><Panel>
      {editing ? <form onSubmit={save}><label className="field-label" htmlFor="knowledge-edit-kind">Rodzaj</label><select id="knowledge-edit-kind" value={form.kind} onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as KnowledgeKind }))}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><label className="field-label" htmlFor="knowledge-edit-title">Tytuł</label><input id="knowledge-edit-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} autoFocus required /><label className="field-label" htmlFor="knowledge-edit-detail">Treść</label><textarea id="knowledge-edit-detail" rows={12} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /><label className="field-label" htmlFor="knowledge-edit-url">URL źródła</label><input id="knowledge-edit-url" type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /><span className="field-label">Powiązane Cele</span><MultiCombobox label="Powiązane Cele" options={state.goals.filter((goal) => goal.visibility === "active").map((goal) => ({ id: goal.id, label: goal.title }))} value={form.goalIds} onChange={(goalIds) => setForm((current) => ({ ...current, goalIds }))} />{error ? <p className="auth-message error" role="alert">{error}</p> : null}<div className="modal-actions"><Button type="button" disabled={saving} onClick={() => setEditing(false)}>Anuluj</Button><Button type="submit" variant="primary" loading={saving} disabled={!form.title.trim()}>Zapisz zmiany</Button></div></form> : <><div className="knowledge-body">{item.detail || <span className="muted-copy">Brak treści.</span>}</div>{item.sourceUrl ? <a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Otwórz źródło <ExternalLink /></a> : null}</>}
    </Panel></div><aside className="detail-aside"><Panel><h2><Link2 />Powiązania</h2>{linkedTargets.map(({ link, goal, action, series }) => <div className="linked-knowledge" key={link.id}>{goal ? <Link to={routeForEntity({ type: "goal", id: goal.id })}>{goal.title}</Link> : action ? <Link to={routeForEntity({ type: "action", id: action.id, goalId: action.goalId })}>{action.title}</Link> : series ? <Link to={`/?series=${series.id}`}>{series.title}</Link> : <span>Niedostępny obiekt</span>}{!goal ? <Button variant="ghost" aria-label="Odłącz powiązanie" onClick={() => void unlinkKnowledge(link.id)}>×</Button> : null}</div>)}{!links.length ? <p className="muted-copy">Bez powiązań.</p> : null}<p className="muted-copy">Powiązania z Celami edytujesz atomowo razem z treścią.</p></Panel>{sourceInboxItem ? <Panel><h2>Pochodzenie</h2><p className="muted-copy">Zapisano z Inboxu; oryginał i jego decyzja pozostają w historii.</p><Link className="history-link" to={routeForEntity({ type: "inbox", id: sourceInboxItem.id, status: sourceInboxItem.status })}><span>{sourceInboxItem.content}</span><span>Otwórz wpis</span></Link></Panel> : null}</aside></div>
  </AppShell>;
}
