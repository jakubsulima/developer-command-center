import { useMemo, useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import type { GoalAction, KnowledgeKind, KnowledgeRelationMeaning } from "../domain/types";
import { knowledgeDefaultRelationMeaning, knowledgeKindLabels, knowledgeRelationMeaningLabels } from "../domain/labels";
import { routeForEntity } from "../domain/routes";
import { Button, Panel } from "./ui";
import { Modal } from "./Modal";
import { KnowledgeKindBadge } from "./KnowledgeKindBadge";
import { useKeyedMutation } from "../hooks/useKeyedMutation";

const groups: Array<{ meaning: KnowledgeRelationMeaning; label: string }> = [
  { meaning: "material", label: "Materiały" },
  { meaning: "result", label: "Rezultaty" },
  { meaning: "decision", label: "Decyzje" },
  { meaning: "reference", label: "Pozostałe" }
];

function allowedMeanings(kind: KnowledgeKind): KnowledgeRelationMeaning[] {
  if (kind === "artifact") return ["result", "material", "reference"];
  if (kind === "decision") return ["decision", "material", "reference"];
  return ["material", "reference"];
}

export function ActionKnowledgeRelations({ action }: { action: GoalAction }) {
  const { state, createKnowledge, linkKnowledge, unlinkKnowledge } = useStore();
  const mutation = useKeyedMutation();
  const [selectedId, setSelectedId] = useState("");
  const [meaning, setMeaning] = useState<KnowledgeRelationMeaning>("reference");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "note" as KnowledgeKind, title: "", detail: "", meaning: "reference" as KnowledgeRelationMeaning });
  const links = state.knowledgeLinks.filter((link) => link.actionId === action.id);
  const available = state.knowledge.filter((item) => !item.archivedAt && !item.trashedAt && !links.some((link) => link.knowledgeItemId === item.id));
  const selected = state.knowledge.find((item) => item.id === selectedId);
  const roleOptions = useMemo<KnowledgeRelationMeaning[]>(() => selected ? allowedMeanings(selected.type) : ["material", "reference"], [selected]);

  const connect = () => mutation.run(`action-relations:${action.id}`, async () => { if (!selectedId) return; await linkKnowledge(selectedId, { actionId: action.id }, meaning); setSelectedId(""); });
  const create = () => mutation.run(`action-relations:${action.id}`, async () => { if (!form.title.trim()) return; await createKnowledge({ kind: form.kind, title: form.title, detail: form.detail, relations: [{ meaning: form.meaning, target: { actionId: action.id } }] }); setOpen(false); setForm({ kind: "note", title: "", detail: "", meaning: "reference" }); });

  return <Panel className="action-relations-panel" aria-labelledby={`action-relations-${action.id}`}>
    <div className="action-relations-heading"><h3 id={`action-relations-${action.id}`}><Link2 />Wiedza Działania</h3><Button variant="ghost" onClick={() => setOpen(true)}><Plus />Nowa</Button></div>
    {groups.map((group) => { const groupLinks = links.filter((link) => link.meaning === group.meaning); return <div className="action-relation-group" key={group.meaning}><strong>{group.label}</strong>{groupLinks.length ? groupLinks.map((link) => { const item = state.knowledge.find((candidate) => candidate.id === link.knowledgeItemId); return <span className="action-relation-chip" key={link.id}>{item ? <Link to={routeForEntity({ type: "knowledge", id: item.id })}><KnowledgeKindBadge kind={item.type} compact /><span>{item.title}</span></Link> : <span>Niedostępna Wiedza</span>}<Button variant="ghost" aria-label={`Odłącz ${item?.title ?? "Wiedzę"} od Działania`} onClick={() => void mutation.run(`action-relations:${action.id}`, () => unlinkKnowledge(link.id))}><X /></Button></span>; }) : <span className="muted-copy">Brak</span>}</div>; })}
    <div className="action-relation-connect"><select aria-label={`Podepnij Wiedzę do Działania: ${action.title}`} value={selectedId} onChange={(event) => { const next = state.knowledge.find((item) => item.id === event.target.value); setSelectedId(event.target.value); setMeaning(next ? knowledgeDefaultRelationMeaning(next.type) : "reference"); }}><option value="">Podepnij istniejącą…</option>{available.map((item) => <option key={item.id} value={item.id}>{knowledgeKindLabels[item.type]} · {item.title}</option>)}</select>{selectedId ? <select aria-label="Rola relacji Wiedzy" value={meaning} onChange={(event) => setMeaning(event.target.value as KnowledgeRelationMeaning)}>{roleOptions.map((option) => <option key={option} value={option}>{knowledgeRelationMeaningLabels[option]}</option>)}</select> : null}<Button disabled={!selectedId} loading={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => void connect()}>Połącz</Button></div>
    <Modal open={open} closeDisabled={mutation.isBusy(`action-relations:${action.id}`)} title={`Nowa Wiedza dla: ${action.title}`} onClose={() => setOpen(false)}><label className="field-label" htmlFor={`action-new-kind-${action.id}`}>Typ</label><select id={`action-new-kind-${action.id}`} value={form.kind} onChange={(event) => { const kind = event.target.value as KnowledgeKind; setForm((current) => ({ ...current, kind, meaning: knowledgeDefaultRelationMeaning(kind) })); }}>{Object.entries(knowledgeKindLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select><label className="field-label" htmlFor={`action-new-title-${action.id}`}>Tytuł</label><input id={`action-new-title-${action.id}`} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} autoFocus /><label className="field-label" htmlFor={`action-new-detail-${action.id}`}>Treść</label><textarea id={`action-new-detail-${action.id}`} rows={4} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /><label className="field-label" htmlFor={`action-new-meaning-${action.id}`}>Rola wobec Działania</label><select id={`action-new-meaning-${action.id}`} value={form.meaning} onChange={(event) => setForm((current) => ({ ...current, meaning: event.target.value as KnowledgeRelationMeaning }))}>{allowedMeanings(form.kind).map((option) => <option key={option} value={option}>{knowledgeRelationMeaningLabels[option]}</option>)}</select><div className="modal-actions"><Button type="button" disabled={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => setOpen(false)}>Anuluj</Button><Button type="button" variant="primary" disabled={!form.title.trim()} loading={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => void create()}>Zapisz Wiedzę</Button></div></Modal>
  </Panel>;
}
