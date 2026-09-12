import { useMemo, useState } from "react";
import { Link2, Plus, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../app/useStore";
import type { GoalAction, KnowledgeKind, KnowledgeRelationMeaning } from "../domain/types";
import { knowledgeDefaultRelationMeaning, knowledgeKindLabels, knowledgeRelationMeaningLabels } from "../domain/labels";
import { knowledgeKindGuidance, type CreatableKnowledgeKind } from "../domain/knowledge-kinds";
import { routeForEntity } from "../domain/routes";
import { Button, Panel } from "./ui";
import { Modal } from "./Modal";
import { KnowledgeKindBadge } from "./KnowledgeKindBadge";
import { useKeyedMutation } from "../hooks/useKeyedMutation";
import { NavigationLink } from "./ContextNavigation";
import { navigationCardId, type NavigationBreadcrumb } from "../domain/navigation";
import { KnowledgeKindPicker } from "./KnowledgeKindPicker";
import { normalizeHttpUrl } from "../domain/http-url";

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

export function ActionKnowledgeRelations({ action, navigation, variant = "compact", onAddResult }: { action: GoalAction; navigation?: { breadcrumbs: NavigationBreadcrumb[]; returnTo: string; returnLabel: string }; variant?: "compact" | "detail"; onAddResult?: () => void }) {
  const { state, createKnowledge, linkKnowledge, unlinkKnowledge } = useStore();
  const mutation = useKeyedMutation();
  const location = useLocation();
  const [selectedId, setSelectedId] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Partial<Record<KnowledgeRelationMeaning, boolean>>>({});
  const [meaning, setMeaning] = useState<KnowledgeRelationMeaning>("reference");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "note" as CreatableKnowledgeKind, title: "", detail: "", sourceUrl: "", meaning: "reference" as KnowledgeRelationMeaning });
  const links = state.knowledgeLinks.filter((link) => link.actionId === action.id);
  const restoreCardId = location.state && typeof location.state === "object" && "navigationRestore" in location.state && typeof location.state.navigationRestore === "object" && location.state.navigationRestore && "sourceCardId" in location.state.navigationRestore && typeof location.state.navigationRestore.sourceCardId === "string" ? location.state.navigationRestore.sourceCardId : undefined;
  const [expanded, setExpanded] = useState(() => variant === "detail" || Boolean(restoreCardId && links.some((link) => navigationCardId("knowledge", link.knowledgeItemId) === restoreCardId)));
  const available = state.knowledge.filter((item) => !item.archivedAt && !item.trashedAt && !links.some((link) => link.knowledgeItemId === item.id));
  const selected = state.knowledge.find((item) => item.id === selectedId);
  const roleOptions = useMemo<KnowledgeRelationMeaning[]>(() => selected ? allowedMeanings(selected.type) : ["material", "reference"], [selected]);

  const connect = () => mutation.run(`action-relations:${action.id}`, async () => { if (!selectedId) return; await linkKnowledge(selectedId, { actionId: action.id }, meaning); setSelectedId(""); });
  const create = () => mutation.run(`action-relations:${action.id}`, async () => { if (!form.title.trim() || (knowledgeKindGuidance[form.kind].detailRequired && !form.detail.trim())) return; await createKnowledge({ kind: form.kind, title: form.title, detail: form.detail, sourceUrl: form.kind === "resource" ? normalizeHttpUrl(form.sourceUrl) : undefined, relations: [{ meaning: form.meaning, target: { actionId: action.id } }] }); setOpen(false); setForm({ kind: "note", title: "", detail: "", sourceUrl: "", meaning: "reference" }); });

  const renderLink = (link: typeof links[number]) => { const item = state.knowledge.find((candidate) => candidate.id === link.knowledgeItemId); return <span className="action-relation-chip" key={link.id} data-navigation-card-id={item ? navigationCardId("knowledge", item.id) : undefined} tabIndex={item ? -1 : undefined}>{item ? navigation ? <NavigationLink to={routeForEntity({ type: "knowledge", id: item.id })} breadcrumbs={navigation.breadcrumbs} returnTo={navigation.returnTo} returnLabel={navigation.returnLabel} sourceCardId={navigationCardId("knowledge", item.id)}><KnowledgeKindBadge kind={item.type} compact /><span>{item.title}</span></NavigationLink> : <Link to={routeForEntity({ type: "knowledge", id: item.id })}><KnowledgeKindBadge kind={item.type} compact /><span>{item.title}</span></Link> : <span>Niedostępna Wiedza</span>}<Button variant="ghost" aria-label={`Odłącz ${item?.title ?? "Wiedzę"} od Działania`} onClick={() => void mutation.run(`action-relations:${action.id}`, () => unlinkKnowledge(link.id))}><X /></Button></span>; };
  const emptyLabels: Record<KnowledgeRelationMeaning, string> = { material: "Brak materiałów", result: "Brak rezultatów", decision: "Brak decyzji", reference: "Brak innych powiązań" };
  const renderGroup = (group: typeof groups[number]) => {
    const groupLinks = links.filter((link) => link.meaning === group.meaning);
    const showAll = expandedGroups[group.meaning] ?? groupLinks.some((link) => navigationCardId("knowledge", link.knowledgeItemId) === restoreCardId);
    const visibleLinks = showAll ? groupLinks : groupLinks.slice(0, 3);
    return <div className={`action-relation-group${!groupLinks.length ? " is-empty" : ""}`} key={group.meaning}>
      <strong>{group.label}</strong><div className="action-relation-items">
        {groupLinks.length ? visibleLinks.map(renderLink) : group.meaning === "result" && onAddResult ? null : <span className="action-relation-empty">{emptyLabels[group.meaning]}</span>}
        {groupLinks.length > 3 ? <Button variant="ghost" aria-expanded={showAll} onClick={() => setExpandedGroups((current) => ({ ...current, [group.meaning]: !showAll }))}>{showAll ? "Pokaż mniej" : `Pokaż wszystkie (${groupLinks.length})`}</Button> : null}
        {group.meaning === "result" && onAddResult ? <Button variant="ghost" onClick={onAddResult}><Plus />Dodaj rezultat</Button> : null}
      </div>
    </div>;
  };
  if (variant === "detail") return <section className="action-relations-detail" aria-labelledby={`action-relations-${action.id}`}>
    <h2 className="sr-only" id={`action-relations-${action.id}`}>Wiedza Działania</h2>
    <div className="action-relations-detail-groups">{groups.filter((group) => group.meaning === "material" || group.meaning === "result" || links.some((link) => link.meaning === group.meaning)).map(renderGroup)}</div>
    {mutation.error(`action-relations:${action.id}`) ? <p className="inline-mutation-error" role="alert">{mutation.error(`action-relations:${action.id}`)} <button type="button" onClick={() => void mutation.retry(`action-relations:${action.id}`)?.()}>Spróbuj ponownie</button></p> : null}
    <details className="detail-connect-disclosure"><summary><Plus />Połącz wiedzę</summary>
      <Button variant="ghost" onClick={() => { setMeaning("material"); setForm((current) => ({ ...current, meaning: "material" })); setOpen(true); }}><Plus />Dodaj materiał</Button>
    <div className="action-relation-connect action-relation-connect-detail"><select aria-label={`Podepnij Wiedzę do Działania: ${action.title}`} value={selectedId} onChange={(event) => { const next = state.knowledge.find((item) => item.id === event.target.value); setSelectedId(event.target.value); setMeaning(next ? knowledgeDefaultRelationMeaning(next.type) : "reference"); }}><option value="">Podepnij istniejącą Wiedzę…</option>{available.map((item) => <option key={item.id} value={item.id}>{knowledgeKindLabels[item.type]} · {item.title}</option>)}</select>{selectedId ? <select aria-label="Rola relacji Wiedzy" value={meaning} onChange={(event) => setMeaning(event.target.value as KnowledgeRelationMeaning)}>{roleOptions.map((option) => <option key={option} value={option}>{knowledgeRelationMeaningLabels[option]}</option>)}</select> : null}<Button disabled={!selectedId} loading={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => void connect()}>Połącz</Button></div>
    </details>
    <Modal open={open} className="knowledge-create-modal" closeDisabled={mutation.isBusy(`action-relations:${action.id}`)} title={`Nowa Wiedza dla: ${action.title}`} onClose={() => setOpen(false)}><form noValidate onSubmit={(event) => { event.preventDefault(); void create(); }}><KnowledgeKindPicker value={form.kind} name={`action-new-kind-${action.id}`} onChange={(kind) => setForm((current) => ({ ...current, kind, meaning: knowledgeDefaultRelationMeaning(kind) }))} /><label className="field-label" htmlFor={`action-new-title-${action.id}`}>{knowledgeKindGuidance[form.kind].titleLabel}</label><input id={`action-new-title-${action.id}`} placeholder={knowledgeKindGuidance[form.kind].titlePlaceholder} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />{form.kind === "resource" ? <><label className="field-label" htmlFor={`action-new-url-${action.id}`}>Link do źródła <span className="optional-label">opcjonalnie</span></label><input id={`action-new-url-${action.id}`} type="url" placeholder="https://…" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></> : null}<label className="field-label" htmlFor={`action-new-detail-${action.id}`}>{knowledgeKindGuidance[form.kind].detailLabel}{!knowledgeKindGuidance[form.kind].detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label><textarea id={`action-new-detail-${action.id}`} rows={4} required={knowledgeKindGuidance[form.kind].detailRequired} placeholder={knowledgeKindGuidance[form.kind].detailPlaceholder} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /><label className="field-label" htmlFor={`action-new-meaning-${action.id}`}>Rola wobec Działania</label><select id={`action-new-meaning-${action.id}`} value={form.meaning} onChange={(event) => setForm((current) => ({ ...current, meaning: event.target.value as KnowledgeRelationMeaning }))}>{allowedMeanings(form.kind).map((option) => <option key={option} value={option}>{knowledgeRelationMeaningLabels[option]}</option>)}</select><div className="modal-actions"><Button type="button" disabled={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => setOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" disabled={!form.title.trim() || (knowledgeKindGuidance[form.kind].detailRequired && !form.detail.trim())} loading={mutation.isBusy(`action-relations:${action.id}`)}>{knowledgeKindGuidance[form.kind].saveLabel}</Button></div></form></Modal>
  </section>;
  return <Panel className="action-relations-panel" aria-labelledby={`action-relations-${action.id}`}>
    <div className="action-relations-heading"><h3 id={`action-relations-${action.id}`}><Link2 />Wiedza Działania</h3><Button variant="ghost" className={`action-relations-toggle${links.length ? "" : " action-relations-toggle-empty"}`} aria-label={links.length ? `Wiedza · ${links.length}` : "Dodaj materiał"} aria-expanded={expanded} aria-controls={`action-relations-content-${action.id}`} onClick={() => setExpanded((current) => !current)}>{links.length ? `Wiedza · ${links.length}` : "Dodaj materiał"}</Button></div>
    {expanded ? <div id={`action-relations-content-${action.id}`}>
      <div className="action-relations-expanded-heading"><span className="muted-copy">Powiązania i źródła Działania</span><Button variant="ghost" onClick={() => setOpen(true)}><Plus />Nowa</Button></div>
      {links.length ? groups.map((group) => { const groupLinks = links.filter((link) => link.meaning === group.meaning); if (!groupLinks.length) return null; return <div className="action-relation-group" key={group.meaning}><strong>{group.label}</strong>{groupLinks.map(renderLink)}</div>; }) : <p className="muted-copy action-relations-empty">Brak powiązanej Wiedzy.</p>}
      <div className="action-relation-connect"><select aria-label={`Podepnij Wiedzę do Działania: ${action.title}`} value={selectedId} onChange={(event) => { const next = state.knowledge.find((item) => item.id === event.target.value); setSelectedId(event.target.value); setMeaning(next ? knowledgeDefaultRelationMeaning(next.type) : "reference"); }}><option value="">Podepnij istniejącą…</option>{available.map((item) => <option key={item.id} value={item.id}>{knowledgeKindLabels[item.type]} · {item.title}</option>)}</select>{selectedId ? <select aria-label="Rola relacji Wiedzy" value={meaning} onChange={(event) => setMeaning(event.target.value as KnowledgeRelationMeaning)}>{roleOptions.map((option) => <option key={option} value={option}>{knowledgeRelationMeaningLabels[option]}</option>)}</select> : null}<Button disabled={!selectedId} loading={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => void connect()}>Połącz</Button></div>
    </div> : null}
    <Modal open={open} className="knowledge-create-modal" closeDisabled={mutation.isBusy(`action-relations:${action.id}`)} title={`Nowa Wiedza dla: ${action.title}`} onClose={() => setOpen(false)}><form noValidate onSubmit={(event) => { event.preventDefault(); void create(); }}><KnowledgeKindPicker value={form.kind} name={`action-new-kind-${action.id}`} onChange={(kind) => setForm((current) => ({ ...current, kind, meaning: knowledgeDefaultRelationMeaning(kind) }))} /><label className="field-label" htmlFor={`action-new-title-${action.id}`}>{knowledgeKindGuidance[form.kind].titleLabel}</label><input id={`action-new-title-${action.id}`} placeholder={knowledgeKindGuidance[form.kind].titlePlaceholder} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />{form.kind === "resource" ? <><label className="field-label" htmlFor={`action-new-url-${action.id}`}>Link do źródła <span className="optional-label">opcjonalnie</span></label><input id={`action-new-url-${action.id}`} type="url" placeholder="https://…" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></> : null}<label className="field-label" htmlFor={`action-new-detail-${action.id}`}>{knowledgeKindGuidance[form.kind].detailLabel}{!knowledgeKindGuidance[form.kind].detailRequired ? <span className="optional-label"> opcjonalnie</span> : null}</label><textarea id={`action-new-detail-${action.id}`} rows={4} required={knowledgeKindGuidance[form.kind].detailRequired} placeholder={knowledgeKindGuidance[form.kind].detailPlaceholder} value={form.detail} onChange={(event) => setForm((current) => ({ ...current, detail: event.target.value }))} /><label className="field-label" htmlFor={`action-new-meaning-${action.id}`}>Rola wobec Działania</label><select id={`action-new-meaning-${action.id}`} value={form.meaning} onChange={(event) => setForm((current) => ({ ...current, meaning: event.target.value as KnowledgeRelationMeaning }))}>{allowedMeanings(form.kind).map((option) => <option key={option} value={option}>{knowledgeRelationMeaningLabels[option]}</option>)}</select><div className="modal-actions"><Button type="button" disabled={mutation.isBusy(`action-relations:${action.id}`)} onClick={() => setOpen(false)}>Anuluj</Button><Button type="submit" variant="primary" disabled={!form.title.trim() || (knowledgeKindGuidance[form.kind].detailRequired && !form.detail.trim())} loading={mutation.isBusy(`action-relations:${action.id}`)}>{knowledgeKindGuidance[form.kind].saveLabel}</Button></div></form></Modal>
  </Panel>;
}
