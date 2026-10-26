import { useLocation } from "react-router-dom";
import { NavigationLink } from "./ContextNavigation";
import { locationAddress } from "../domain/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useStore } from "../app/useStore";
import { useActionFeedback } from "./action-feedback-context";
import { findKnowledgeSuggestions } from "../data/knowledgeDiscovery";
import { knowledgeUrlKey } from "../domain/http-url";
import type { KnowledgeItem, KnowledgeRelationTarget } from "../domain/types";
import { Button } from "./ui";

export function KnowledgeSuggestions({ url, projectId, target, onUse }: { url?: string; projectId?: string; target?: KnowledgeRelationTarget; onUse?: (item: KnowledgeItem) => Promise<void> }) {
  const { state, mode, linkKnowledge, unlinkKnowledge } = useStore();
  const { notifyUndo } = useActionFeedback();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const location = useLocation();
  const excludedIds = target ? state.knowledgeLinks.filter((link) => Object.entries(target).every(([key, value]) => link[key as keyof typeof link] === value)).map((link) => link.knowledgeItemId).sort() : [];
  const revision = mode === "demo" ? state.knowledge.map((item) => `${item.id}:${item.version}:${item.updatedAt}`).join(",") : state.knowledgeLinks.map((link) => link.id).join(",");
  const [searchUrl, setSearchUrl] = useState(url);
  useEffect(() => { const timer = setTimeout(() => setSearchUrl(url),250); return () => clearTimeout(timer); }, [url]);
  const key = knowledgeUrlKey(searchUrl);
  const query = useQuery({ queryKey: ["knowledge-suggestions", mode, state.workspaceId, key, projectId, excludedIds, revision],
    enabled: Boolean(key || projectId), queryFn: () => findKnowledgeSuggestions(state, mode, { url: key ? searchUrl : undefined, projectId, excludedIds: key ? [] : excludedIds }), staleTime: 30_000 });
  const candidates = (query.data ?? []).filter((item) => key || !target || !state.knowledgeLinks.some((link) => link.knowledgeItemId === item.id && Object.entries(target).every(([key, value]) => link[key as keyof typeof link] === value)));
  const use = async (item: KnowledgeItem) => {
    if (busy) return;
    setBusy(item.id); setError("");
    try {
      if (onUse) await onUse(item);
      else if (target) {
        const linkId = await linkKnowledge(item.id, target, "material");
        notifyUndo({ message: "Materiał powiązany.", undo: () => unlinkKnowledge(linkId) });
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Nie udało się powiązać materiału."); }
    finally { setBusy(undefined); }
  };
  if (searchUrl !== url || !key && !projectId) return null;
  if (query.isError) return <p className="muted-copy">Nie udało się sprawdzić podpowiedzi. <Button variant="ghost" onClick={() => void query.refetch()}>Ponów</Button></p>;
  if (!candidates.length) return null;
  const limit = key ? 5 : 3;
  return <aside className="knowledge-suggestions"><strong>{key ? "Ten materiał jest już w Bibliotece" : "Wiedza z tego samego Projektu"}</strong>{candidates.slice(0, limit).map((item) => <div className="button-row" key={item.id}><NavigationLink to={`/knowledge/${encodeURIComponent(item.id)}`} breadcrumbs={[]} returnTo={locationAddress(location)} returnLabel="Wróć do kontekstu">{item.title}</NavigationLink>{onUse || target && !state.knowledgeLinks.some((link) => link.knowledgeItemId === item.id && Object.entries(target).every(([key,value]) => link[key as keyof typeof link] === value)) ? <Button type="button" loading={busy === item.id} disabled={Boolean(busy)} onClick={() => void use(item)}>Powiąż istniejący</Button> : null}</div>)}{candidates.length > limit ? <Link to={projectId ? `/knowledge?area=${encodeURIComponent(projectId)}` : `/knowledge?q=${encodeURIComponent(url ?? "")}`}>Zobacz więcej w Bibliotece</Link> : null}{key ? <p className="muted-copy">Możesz również zapisać osobny wpis.</p> : null}{error ? <p role="alert">{error}</p> : null}</aside>;
}
