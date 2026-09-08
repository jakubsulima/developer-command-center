import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useStore } from "../app/useStore";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { pageByCursor, type PageCursor, type WorkspacePageCollection, type WorkspacePageItem } from "../data/workspaceRepository";
import { actionListSortDirection, actionListSortValue, matchesActionListFilter, type ActionListFilter } from "../domain/actionsList";
import type { AppState } from "../domain/types";

const defaultPageSize: Record<WorkspacePageCollection, number> = {
  inbox: 50,
  knowledge: 50,
  "goal-progress": 25,
  "completed-actions": 50,
  actions: 30,
  reviews: 20
};

export function workspacePageQueryKey(collection: WorkspacePageCollection, mode: string, workspaceId: string | undefined, options: { goalId?: string; actionFilter?: ActionListFilter } = {}) {
  return ["workspace-page", collection, mode, workspaceId, options.goalId, options.actionFilter?.view, options.actionFilter?.projectId, options.actionFilter?.goalId, options.actionFilter?.today] as const;
}

export function useWorkspaceInfinitePage<T extends WorkspacePageItem>(collection: WorkspacePageCollection, pageSize = defaultPageSize[collection], options: { goalId?: string; actionFilter?: ActionListFilter } = {}) {
  const { mode, state, loading } = useStore();
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);
  return useInfiniteQuery({
    queryKey: workspacePageQueryKey(collection, mode, state.workspaceId, options),
    enabled: !loading,
    initialPageParam: undefined as PageCursor | undefined,
    queryFn: async ({ pageParam }) => {
      if (mode === "demo" && collection === "actions" && options.actionFilter) {
        const actions = state.actions.filter((action) => matchesActionListFilter(state, action, options.actionFilter!));
        return pageByCursor(actions, pageSize, pageParam, (action) => actionListSortValue(action, options.actionFilter!.view), actionListSortDirection(options.actionFilter.view));
      }
      const repository = mode === "demo" ? localRepository : createSupabaseWorkspaceRepository();
      return repository.loadPage({ workspaceId: state.workspaceId ?? "demo", collection, pageSize, goalId: options.goalId, actionFilter: options.actionFilter, cursor: pageParam });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => ({
      ...data,
      items: data.pages.flatMap((page) => page.items as T[])
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
