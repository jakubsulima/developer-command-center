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

  it("pobiera kolejkę oczekujących z datami sprawdzenia", async () => {
    const rpc = vi.fn(async () => ({ data: { items: [{ id: "action-1", title: "Czekam", status: "blocked", reviewOn: "2026-09-09" }], nextCursor: null }, error: null }));
    const inQuery = vi.fn(async () => ({ data: [{ id: "action-1", review_on: "2026-09-09" }], error: null }));
    getClient.mockReturnValue({ rpc, from: vi.fn(() => ({ select: () => ({ in: inQuery }) })) });
    const page = await createSupabaseWorkspaceRepository().loadPage({ workspaceId: "workspace-1", collection: "actions", pageSize: 30, actionFilter: { view: "waiting", today: "2026-09-09" } });
    expect(rpc).toHaveBeenCalledWith("get_waiting_actions_page", expect.objectContaining({ target_view: "waiting", target_today: "2026-09-09" }));
    expect(inQuery).toHaveBeenCalledWith("id", ["action-1"]);
    expect(page.items[0]).toMatchObject({ id: "action-1", reviewOn: "2026-09-09" });
  });
});

describe("ustawienia Przeglądu AI w Supabase", () => {
  beforeEach(() => getClient.mockReset());

  const core = {
    workspaceId: "workspace-1", workspaceTimezone: "Europe/Warsaw", areas: [], goalTemplates: [], goals: [],
    goalCriteria: [], actions: [], legacyProjects: [], recurringActionTemplates: [], knowledgeLinks: [],
    counts: { inbox: 0, knowledge: 0, openActions: 0, start: 0 },
    weeklySummary: { completedActions: 0, focusMinutes: 0, knowledgeAdded: 0, progressUpdates: 0, recentReviews: [] }
  };

  it("odczytuje wyłącznie dwa pola z tabeli po pobraniu Workspace", async () => {
    const single = vi.fn(async () => ({ data: { ai_review_window_days: 14, ai_review_cache_hours: 168 }, error: null }));
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const rpc = vi.fn(async (name: string) => name === "get_workspace_core" ? { data: core, error: null } : { data: null, error: null });
    const from = vi.fn(() => ({ select }));
    getClient.mockReturnValue({ rpc, from });

    await expect(createSupabaseWorkspaceRepository().loadCore("user-1")).resolves.toMatchObject({ aiReviewSettings: { windowDays: 14, cacheHours: 168 } });
    expect(from).toHaveBeenCalledWith("workspaces");
    expect(select).toHaveBeenCalledWith("ai_review_window_days,ai_review_cache_hours");
    expect(eq).toHaveBeenCalledWith("id", "workspace-1");
    expect(rpc).toHaveBeenNthCalledWith(1, "get_workspace_core", { target_user_id: "user-1" });
  });

  it("używa domyślnych wartości tylko dla brakujących kolumn i zapisuje wyłącznie wybrane pola", async () => {
    const single = vi.fn(async () => ({ data: null, error: { code: "42703", message: "column missing" } }));
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    const rpc = vi.fn(async (name: string) => name === "get_workspace_core" ? { data: core, error: null } : { data: null, error: null });
    getClient.mockReturnValue({ rpc, from: vi.fn(() => ({ select })) });
    await expect(createSupabaseWorkspaceRepository().loadCore("user-1")).resolves.toMatchObject({ aiReviewSettings: { windowDays: 28, cacheHours: 72 } });

    const savedRow = { ai_review_window_days: 7, ai_review_cache_hours: 24 };
    const saveSingle = vi.fn(async () => ({ data: savedRow, error: null }));
    const saveSelect = vi.fn(() => ({ single: saveSingle }));
    const saveEq = vi.fn(() => ({ select: saveSelect }));
    const update = vi.fn(() => ({ eq: saveEq }));
    getClient.mockReturnValue({ from: vi.fn(() => ({ update })) });
    await expect(createSupabaseWorkspaceRepository().saveAIReviewSettings("workspace-1", { windowDays: 7, cacheHours: 24 })).resolves.toEqual({ windowDays: 7, cacheHours: 24 });
    expect(update).toHaveBeenCalledWith({ ai_review_window_days: 7, ai_review_cache_hours: 24 });
    expect(saveEq).toHaveBeenCalledWith("id", "workspace-1");
    expect(saveSelect).toHaveBeenCalledWith("ai_review_window_days,ai_review_cache_hours");
  });

  it("nie ukrywa błędu odczytu spoza zgodności kolumn", async () => {
    const single = vi.fn(async () => ({ data: null, error: { code: "42501", message: "permission denied" } }));
    const eq = vi.fn(() => ({ single }));
    const rpc = vi.fn(async (name: string) => name === "get_workspace_core" ? { data: core, error: null } : { data: null, error: null });
    getClient.mockReturnValue({ rpc, from: vi.fn(() => ({ select: () => ({ eq }) })) });
    await expect(createSupabaseWorkspaceRepository().loadCore("user-1")).rejects.toThrow(/permission denied/);
  });

  it("odczytuje wynik wraz ze stanem aktualności przez wyłącznie tryb latest", async () => {
    const payload = {
      review: {
        reviewId: "review-1", status: "ready", cached: true, generatedAt: "2026-09-24T10:00:00.000Z",
        periodStart: "2026-08-28", periodEnd: "2026-09-24", windowDays: 28, provider: "openai", model: "gpt-test",
        analyzedGoalIds: [], omittedGoalIds: [],
        review: { schemaVersion: 1, headline: "Warto wrócić do planu", summary: "Wynik", overallStatus: "insufficient_data", recommendations: [], checks: [{ id: "check-1", question: "Co blokuje postęp?", whyItMatters: "Brakuje danych.", goalIds: [], signalKeys: [] }], goalAssessments: [] }
      },
      freshness: "source_changed",
      checkedAt: "2026-09-25T10:00:00.000Z"
    };
    const invoke = vi.fn(async () => ({ data: payload, error: null }));
    getClient.mockReturnValue({ functions: { invoke } });

    await expect(createSupabaseWorkspaceRepository().getLatestGoalReview("workspace-1")).resolves.toMatchObject({
      freshness: "source_changed",
      checkedAt: payload.checkedAt,
      review: { reviewId: "review-1", stale: true, windowDays: 28 }
    });
    expect(invoke).toHaveBeenCalledWith("ai-goal-review", { body: { workspaceId: "workspace-1", operation: "latest" } });
  });
});
