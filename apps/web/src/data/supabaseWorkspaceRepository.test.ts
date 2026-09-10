import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseWorkspaceRepository } from "./supabaseWorkspaceRepository";

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("../lib/supabase", () => ({ getSupabase: getClient }));

describe("adapter listy Działań Supabase", () => {
  beforeEach(() => getClient.mockReset());

  it("przekazuje widok, filtry i kursor do RPC oraz dekoduje stronę", async () => {
    const rpc = vi.fn(async (name: string) => name === "get_actions_page"
      ? { data: { items: [{ id: "action-1", title: "Krok", status: "ready" }], nextCursor: { sortValue: "2026-09-08", id: "action-1" } }, error: null }
      : { data: { id: "action-1", title: "Krok", status: "ready" }, error: null });
    getClient.mockReturnValue({ rpc });
    const repository = createSupabaseWorkspaceRepository();

    const page = await repository.loadPage({
      workspaceId: "workspace-1",
      collection: "actions",
      pageSize: 30,
      actionFilter: { view: "overdue", projectId: "10000000-0000-4000-8000-000000000010", goalId: "10000000-0000-4000-8000-000000000011", today: "2026-09-08" },
      cursor: { sortValue: "2026-09-01", id: "action-0" }
    });
    const action = await repository.loadAction("action-1");

    expect(page).toEqual({ items: [{ id: "action-1", title: "Krok", status: "ready" }], nextCursor: { sortValue: "2026-09-08", id: "action-1" } });
    expect(action).toMatchObject({ id: "action-1", title: "Krok" });
    expect(rpc).toHaveBeenNthCalledWith(1, "get_actions_page", {
      target_workspace_id: "workspace-1",
      target_view: "overdue",
      target_project_id: "10000000-0000-4000-8000-000000000010",
      target_goal_id: "10000000-0000-4000-8000-000000000011",
      target_today: "2026-09-08",
      page_size: 30,
      cursor_sort_value: "2026-09-01",
      cursor_id: "action-0"
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "get_action_item", { target_action_id: "action-1" });
  });

  it("nie wysyła uszkodzonych identyfikatorów filtrów do Supabase", async () => {
    const rpc = vi.fn();
    getClient.mockReturnValue({ rpc });
    const page = await createSupabaseWorkspaceRepository().loadPage({ workspaceId: "workspace-1", collection: "actions", pageSize: 30, actionFilter: { view: "open", projectId: "stary-slug" } });
    expect(page).toEqual({ items: [], nextCursor: undefined });
    expect(rpc).not.toHaveBeenCalled();
  });
});
