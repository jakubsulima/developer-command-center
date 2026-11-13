import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useStore } from "../app/useStore";
import { safeHttpUrl } from "../domain/http-url";
import { resolveKnowledgeProjectContexts } from "../domain/knowledge";
import { readingStatusLabels } from "../domain/labels";
import { navigationCardId } from "../domain/navigation";
import { readingPositionLabel } from "../domain/readingProgress";
import type { KnowledgeItem } from "../domain/types";
import { NavigationLink } from "./ContextNavigation";
import { KnowledgeKindBadge } from "./KnowledgeKindBadge";
import { PreviewPanel } from "./PreviewPanel";

export function KnowledgePreview({ item, sourceBook, returnTo, onClose }: {
  item: KnowledgeItem;
  sourceBook?: KnowledgeItem;
  returnTo: string;
  onClose: () => void;
}) {
  const { state } = useStore();
  const breadcrumbs = [{ label: "Wiedza", to: returnTo }];
  const navigation = { breadcrumbs, returnTo, returnLabel: "Wróć do Wiedzy", sourceCardId: navigationCardId("knowledge", item.id) };
  const projectIds = new Set(resolveKnowledgeProjectContexts(state, item.id).map((context) => context.projectId));
  const projects = state.areas.filter((project) => projectIds.has(project.id));
  const goalIds = new Set(state.knowledgeLinks.filter((link) => link.knowledgeItemId === item.id && link.goalId).map((link) => link.goalId));
  const goals = state.goals.filter((goal) => goalIds.has(goal.id));
  const sourceHref = safeHttpUrl(item.sourceUrl);

  return <PreviewPanel id="knowledge-preview" className="knowledge-preview" label="Podgląd Wiedzy" title={item.title} focusKey={item.id} onClose={onClose}>
    <div className="knowledge-preview-meta"><KnowledgeKindBadge kind={item.type} />{item.resourceFormat === "book" ? <span>Książka</span> : null}{item.trashedAt ? <span>W Koszu</span> : item.archivedAt ? <span>W Archiwum</span> : null}</div>
    {item.resourceFormat === "book" ? <p className="knowledge-preview-book">{[item.resourceAuthor, item.readingStatus ? readingStatusLabels[item.readingStatus] : undefined, readingPositionLabel(item)].filter(Boolean).join(" · ")}</p> : null}
    {sourceBook ? <NavigationLink className="knowledge-preview-source" to={`/knowledge/${encodeURIComponent(sourceBook.id)}`} {...navigation}>Źródło: {sourceBook.title}<ArrowUpRight aria-hidden="true" /></NavigationLink> : null}
    <section className="knowledge-preview-content" aria-label="Treść Wiedzy"><h3>Treść</h3><div className="knowledge-preview-body">{item.detail || "Brak treści. Szczegóły możesz dodać w pełnym widoku."}</div></section>
    {sourceHref ? <a className="knowledge-preview-source" href={sourceHref} target="_blank" rel="noopener noreferrer">Otwórz źródło<ExternalLink aria-hidden="true" /></a> : null}
    {projects.length || goals.length ? <section className="knowledge-preview-context"><h3>Powiązania</h3>{projects.map((project) => <NavigationLink key={project.id} to={`/projects/${encodeURIComponent(project.id)}`} {...navigation}><span>Projekt</span>{project.name}<ArrowUpRight aria-hidden="true" /></NavigationLink>)}{goals.map((goal) => <NavigationLink key={goal.id} to={`/goals/${encodeURIComponent(goal.id)}`} {...navigation}><span>Cel</span>{goal.title}<ArrowUpRight aria-hidden="true" /></NavigationLink>)}</section> : null}
    <div className="desktop-preview-footer"><NavigationLink className="button button-secondary" to={`/knowledge/${encodeURIComponent(item.id)}`} {...navigation}>Otwórz pełny widok<ArrowUpRight aria-hidden="true" /></NavigationLink></div>
  </PreviewPanel>;
}
