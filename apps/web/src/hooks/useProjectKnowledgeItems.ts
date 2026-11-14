import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../app/useStore";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import type { KnowledgeItem } from "../domain/types";
import { projectKnowledgeIds } from "../domain/projectModule";

/** Loads the complete shelf by its shared relation ids, independent of global pagination. */
export function useProjectKnowledgeItems(projectId: string) {
  const { mode, state } = useStore();
  const ids = useMemo(() => [...projectKnowledgeIds(state, projectId)].sort(), [projectId, state]);
  const scope = JSON.stringify([mode, state.workspaceId, projectId]);
  const [lastRead, setLastRead] = useState<{ scope: string; items: KnowledgeItem[] }>();
  const query = useQuery({
    queryKey: ["project-knowledge", mode, state.workspaceId, projectId, ids],
    enabled: Boolean(projectId),
    queryFn: async () => mode === "demo"
      ? state.knowledge.filter((item) => ids.includes(item.id))
      : createSupabaseWorkspaceRepository().loadKnowledgeItems(ids)
  });
  // A new relation changes the query key. Keep the last successful shelf while
  // its replacement loads (or fails), restricted to this exact data scope.
  useEffect(() => {
    if (query.data) setLastRead({ scope, items: query.data });
  }, [query.data, scope]);
  const readItems = query.data ?? (lastRead?.scope === scope ? lastRead.items : undefined);
  const items = useMemo(() => {
    const merged = new Map<string, KnowledgeItem>();
    for (const item of readItems ?? []) if (ids.includes(item.id)) merged.set(item.id, item);
    // The in-memory store contains optimistic creates and the newest edit.
    for (const item of state.knowledge) if (ids.includes(item.id)) merged.set(item.id, item);
    return [...merged.values()].filter((item) => !item.archivedAt && !item.trashedAt)
      .sort((left, right) => (right.updatedAt ?? right.createdAt ?? "").localeCompare(left.updatedAt ?? left.createdAt ?? "") || left.id.localeCompare(right.id));
  }, [ids, readItems, state.knowledge]);
  return { ...query, isPending: query.isPending && !readItems, items };
}
