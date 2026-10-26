import type { AppState, KnowledgeItem } from "../domain/types";
import { knowledgeUrlKey } from "../domain/http-url";
import { createKnowledgeFilter } from "../domain/knowledgeFilters";

export async function findKnowledgeSuggestions(state: AppState, mode: "demo" | "supabase", options: { url?: string; projectId?: string; excludedIds?: string[] }) {
  if (mode === "demo") {
    const key = knowledgeUrlKey(options.url);
    const filter = createKnowledgeFilter(state, { projectId: options.projectId });
    return state.knowledge.filter((item) => item.type === "resource" && !options.excludedIds?.includes(item.id) && !item.archivedAt && !item.trashedAt && (options.url ? item.type === "resource" && key && knowledgeUrlKey(item.sourceUrl) === key : filter(item)))
      .sort((a, b) => (b.updatedAt ?? b.createdAt ?? "").localeCompare(a.updatedAt ?? a.createdAt ?? "") || a.id.localeCompare(b.id)).slice(0, 6);
  }
  const { getSupabase } = await import("../lib/supabase");
  const { data, error } = await getSupabase().rpc("get_knowledge_suggestions", { target_workspace_id: state.workspaceId, target_source_url: options.url ?? null, target_project_id: options.projectId ?? null, excluded_item_ids: options.excludedIds ?? [] });
  if (error || !Array.isArray(data)) throw new Error("Nie udało się sprawdzić istniejącej Wiedzy. Możesz kontynuować zapis.");
  return data as KnowledgeItem[];
}
