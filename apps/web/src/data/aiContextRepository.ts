import type { ContextRequest } from "../../../../packages/ai-context/src/index";
import { validateContextRequest } from "../../../../packages/ai-context/src/index";
import { selectLocalContextData, type ContextData } from "../domain/aiContext";
import type { AppState } from "../domain/types";
export async function loadContextData(state: AppState, mode: "demo" | "supabase", request: ContextRequest): Promise<ContextData> {
  validateContextRequest(request);
  if (mode === "demo") return selectLocalContextData(state,request);
  const { getSupabase } = await import("../lib/supabase");
  const { data, error } = await getSupabase().rpc("get_ai_context_data", { target_workspace_id: state.workspaceId, target_type: request.target.type, target_id: request.target.id, include_project: request.selection.includeProject, include_goal: request.selection.includeGoal, include_progress: request.selection.includeProgress, include_knowledge: request.selection.includeKnowledge, extra_knowledge_ids: request.selection.extraKnowledgeIds, excluded_source_ids: request.selection.excludedSourceIds });
  if (error) throw new Error("Nie udało się odczytać kontekstu. Sprawdź dostęp do obiektu i dostępność migracji, następnie spróbuj ponownie.");
  if (!data || typeof data.workspaceId !== "string" || ![data.areas,data.goals,data.goalCriteria,data.actions,data.progressEntries,data.knowledge].every(Array.isArray)) throw new Error("Serwer zwrócił nieprawidłowy kontekst.");
  return data as ContextData;
}
