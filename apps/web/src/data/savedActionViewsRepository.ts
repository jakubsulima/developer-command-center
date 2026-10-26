import { getSupabase } from "../lib/supabase";
import { validateSavedActionView, type SavedActionView } from "../domain/savedActionViews";
export async function loadSavedActionViews(workspaceId: string): Promise<SavedActionView[]> {
  const { data, error } = await getSupabase().from("saved_action_views").select("*").eq("workspace_id", workspaceId).order("position").order("id");
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return [];
    throw new Error("Nie udało się odczytać ulubionych widoków.");
  }
  return (data ?? []).map((row) => {
    const view: SavedActionView = { id: row.id, name: row.name, filters: row.filters, filterVersion: row.filter_version, position: row.position, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at };
    validateSavedActionView(view);
    return view;
  });
}
