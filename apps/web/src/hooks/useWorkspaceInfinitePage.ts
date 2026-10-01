import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useStore } from "../app/useStore";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { pageByCursor, type PageCursor, type WorkspacePageCollection, type WorkspacePageItem } from "../data/workspaceRepository";
import { actionListSortDirection, actionListSortValue, matchesActionListFilter, type ActionListFilter } from "../domain/actionsList";
import type { AppState, KnowledgeKind } from "../domain/types";
import type { ReadingStatus } from "../domain/types";
import type { KnowledgeVisibilityFilter } from "../domain/knowledgeFilters";
import { createKnowledgeFilter } from "../domain/knowledgeFilters";

const defaultPageSize: Record<WorkspacePageCollection, number> = {
  inbox: 50,
  knowledge: 50,
  "goal-progress": 25,
  "completed-actions": 50,
  actions: 30,
  reviews: 20
};

export interface WorkspacePageOptions { goalId?: string; actionFilter?: ActionListFilter; resourceFormat?: "book"; readingStatus?: ReadingStatus; knowledgeKind?: KnowledgeKind; searchText?: string; projectId?: string; knowledgeGoalId?: string; knowledgeVisibility?: KnowledgeVisibilityFilter }

const localKnowledgeRevisions = new WeakMap<AppState, string>();

function localKnowledgeRevision(state: AppState) {
  const cached = localKnowledgeRevisions.get(state);
  if (cached) return cached;
  const revision = JSON.stringify([
    state.knowledge,
    state.knowledgeLinks,
    state.actions.map((item) => [item.id, item.goalId, item.areaId]),
    state.areas.map((item) => [item.id, item.visibility]),
    state.goals.map((item) => [item.id, item.areaId]),
    state.recurringActionTemplates.map((item) => [item.id, item.goalId, item.areaId])
  ]);
  localKnowledgeRevisions.set(state, revision);
  return revision;
}

export function workspacePageQueryKey(collection: WorkspacePageCollection, mode: string, workspaceId: string | undefined, options: WorkspacePageOptions = {}) {
  return ["workspace-page", collection, mode, workspaceId, options.goalId, options.actionFilter?.view, options.actionFilter?.projectId, options.actionFilter?.goalId, options.actionFilter?.today, options.resourceFormat, options.readingStatus, options.knowledgeKind, options.searchText, options.projectId, options.knowledgeGoalId, options.knowledgeVisibility] as const;
}

export function useWorkspaceInfinitePage<T extends WorkspacePageItem>(collection: WorkspacePageCollection, pageSize = defaultPageSize[collection], options: WorkspacePageOptions = {}) {
  const { mode, state, loading } = useStore();
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);
  const localRevision = collection === "knowledge" && mode === "demo" ? localKnowledgeRevision(state) : undefined;
  return useInfiniteQuery({
    queryKey: localRevision === undefined
      ? workspacePageQueryKey(collection, mode, state.workspaceId, options)
      : [...workspacePageQueryKey(collection, mode, state.workspaceId, options), localRevision],
    enabled: !loading,
    initialPageParam: undefined as PageCursor | undefined,
    queryFn: async ({ pageParam }) => {
      if (mode === "demo" && collection === "actions" && options.actionFilter) {
        const actions = state.actions.filter((action) => matchesActionListFilter(state, action, options.actionFilter!));
        return pageByCursor(actions, pageSize, pageParam, (action) => actionListSortValue(action, options.actionFilter!.view), actionListSortDirection(options.actionFilter.view));
      }
      if (mode === "demo" && collection === "knowledge") {
        const filter = createKnowledgeFilter(state, {
          resourceFormat: options.resourceFormat,
          readingStatus: options.readingStatus,
          knowledgeKind: options.knowledgeKind,
          searchText: options.searchText,
          projectId: options.projectId,
          goalId: options.knowledgeGoalId,
          visibility: options.knowledgeVisibility
        });
        const filtered = state.knowledge.filter(filter);
        return {
          ...pageByCursor(filtered, pageSize, pageParam, (item) => item.updatedAt ?? item.createdAt ?? ""),
          totalCount: filtered.length
        };
      }
      const repository = mode === "demo" ? localRepository : createSupabaseWorkspaceRepository();
      return repository.loadPage({ workspaceId: state.workspaceId ?? "demo", collection, pageSize, goalId: options.goalId, actionFilter: options.actionFilter, resourceFormat: options.resourceFormat, readingStatus: options.readingStatus, knowledgeKind: options.knowledgeKind, searchText: options.searchText, projectId: options.projectId, knowledgeGoalId: options.knowledgeGoalId, knowledgeVisibility: options.knowledgeVisibility, cursor: pageParam });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => ({
      ...data,
      items: data.pages.flatMap((page) => page.items as T[]),
      totalCount: data.pages[0]?.totalCount
    })
  });
}

export function mergePagedItems<T extends { id: string }>(localItems: T[], pagedItems: T[]) {
  const merged = new Map<string, T>();
  for (const item of [...pagedItems, ...localItems]) merged.set(item.id, item);
  return [...merged.values()];
}

export function pageItemsFromState(collection: WorkspacePageCollection, state: AppState): WorkspacePageItem[] {
  if (collection === "inbox") return state.inbox;
  if (collection === "knowledge") return state.knowledge;
  if (collection === "goal-progress") return state.progressEntries;
  if (collection === "completed-actions") return state.actions.filter((action) => action.status === "completed");
  return state.reviews;
}
