import type { AppState, KnowledgeItem, KnowledgeKind, ReadingStatus } from "./types";
import { projectKnowledgeIds } from "./projectModule";

export type KnowledgeVisibilityFilter = "active" | "archived" | "trashed";

export interface KnowledgeFilters {
  resourceFormat?: "book";
  readingStatus?: ReadingStatus;
  knowledgeKind?: KnowledgeKind;
  searchText?: string;
  projectId?: string;
  goalId?: string;
  visibility?: KnowledgeVisibilityFilter;
}

export function knowledgeVisibility(item: KnowledgeItem): KnowledgeVisibilityFilter {
  if (item.trashedAt) return "trashed";
  if (item.archivedAt) return "archived";
  return "active";
}

/** Shared list semantics; project membership follows projectKnowledgeIds exactly. */
export function createKnowledgeFilter(state: AppState, filters: KnowledgeFilters = {}) {
  const normalizedSearch = filters.searchText?.trim().toLocaleLowerCase("pl");
  const projectIds = filters.projectId ? projectKnowledgeIds(state, filters.projectId) : undefined;
  const goalActionIds = filters.goalId ? new Set(state.actions.filter((action) => action.goalId === filters.goalId).map((action) => action.id)) : undefined;
  const linksByKnowledge = new Map<string, typeof state.knowledgeLinks>();
  if (filters.goalId) for (const link of state.knowledgeLinks) {
    if (link.goalId !== filters.goalId && !(link.actionId && goalActionIds?.has(link.actionId))) continue;
    const links = linksByKnowledge.get(link.knowledgeItemId) ?? [];
    links.push(link);
    linksByKnowledge.set(link.knowledgeItemId, links);
  }

  return (item: KnowledgeItem) => knowledgeVisibility(item) === (filters.visibility ?? "active")
      && (!filters.resourceFormat || item.resourceFormat === filters.resourceFormat)
      && (!filters.readingStatus || (item.resourceFormat === "book" && item.readingStatus === filters.readingStatus))
      && (!filters.knowledgeKind || item.type === filters.knowledgeKind)
      && (!filters.projectId || projectIds?.has(item.id))
      && (!filters.goalId || linksByKnowledge.has(item.id))
      && (!normalizedSearch || `${item.title} ${item.detail} ${item.resourceAuthor ?? ""}`.toLocaleLowerCase("pl").includes(normalizedSearch));
}

export function matchesKnowledgeFilters(state: AppState, item: KnowledgeItem, filters: KnowledgeFilters = {}) {
  return createKnowledgeFilter(state, filters)(item);
}
