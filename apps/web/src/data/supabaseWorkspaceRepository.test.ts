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

  it("przekazuje jawny okres, strefę i filtry do stronicowanych szczegółów tygodnia", async () => {
    const rpc = vi.fn(async () => ({ data: { items: [{ id: "entry-1", kind: "actions", title: "Krok", detail: "", occurredAt: "2026-09-30T12:00:00Z" }], totalCount: 3, nextCursor: null }, error: null }));
    getClient.mockReturnValue({ rpc });
    const page = await createSupabaseWorkspaceRepository().loadPage({
      workspaceId: "10000000-0000-4000-8000-000000000001",
      collection: "weekly-activity",
      pageSize: 25,
      activityKind: "actions",
      periodStart: "2026-09-28",
      periodEndExclusive: "2026-10-05",
      periodTimeZone: "Europe/Warsaw",
      activityProjectId: "10000000-0000-4000-8000-000000000010",
      activityGoalId: "10000000-0000-4000-8000-000000000011"
    });

    expect(page).toMatchObject({ totalCount: 3, items: [{ id: "entry-1", title: "Krok" }] });
    expect(rpc).toHaveBeenCalledWith("get_weekly_activity_page", expect.objectContaining({
      target_activity_kind: "actions",
      period_start: "2026-09-28",
      period_end_exclusive: "2026-10-05",
      period_timezone: "Europe/Warsaw",
      target_project_id: "10000000-0000-4000-8000-000000000010",
      target_goal_id: "10000000-0000-4000-8000-000000000011",
      page_size: 25
    }));
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

describe("adapter Biblioteki Wiedzy Supabase", () => {
  beforeEach(() => getClient.mockReset());

  it("pomija nowe argumenty przy zwykłym odczycie, zgodnym ze starszą bazą", async () => {
    const rpc = vi.fn(async () => ({ data: { items: [], nextCursor: null }, error: null }));
    getClient.mockReturnValue({ rpc });
    await createSupabaseWorkspaceRepository().loadPage({ workspaceId: "workspace-1", collection: "knowledge", pageSize: 50 });
    expect(rpc).toHaveBeenCalledWith("get_knowledge_page", { target_workspace_id: "workspace-1", page_size: 50, cursor_sort_value: null, cursor_id: null });
  });

  it("wyjaśnia brak migracji przy użyciu nowych filtrów", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "PGRST202", message: "missing function" } }));
    getClient.mockReturnValue({ rpc });
    await expect(createSupabaseWorkspaceRepository().loadPage({ workspaceId: "workspace-1", collection: "knowledge", pageSize: 50, resourceFormat: "book" })).rejects.toThrow(/aktualizacji bazy/);
  });

  it("przekazuje filtry książek, statusu, rodzaju, autora i paginacji do RPC", async () => {
    const rpc = vi.fn(async () => ({ data: { items: [{ id: "book", type: "resource", title: "Model danych", resourceFormat: "book", resourceAuthor: "Autor", readingStatus: "reading" }], nextCursor: null, totalCount: 117 }, error: null }));
    getClient.mockReturnValue({ rpc });
    const page = await createSupabaseWorkspaceRepository().loadPage({
      workspaceId: "workspace-1", collection: "knowledge", pageSize: 20,
      resourceFormat: "book", readingStatus: "reading", knowledgeKind: "resource", searchText: "Autor",
      cursor: { sortValue: "2026-09-01T00:00:00.000Z", id: "book-0" }
    });

    expect(page.items[0]).toMatchObject({ resourceFormat: "book", resourceAuthor: "Autor", readingStatus: "reading" });
    expect(page.totalCount).toBe(117);
    expect(rpc).toHaveBeenCalledWith("get_knowledge_page", {
      target_workspace_id: "workspace-1", target_resource_format: "book", target_reading_status: "reading",
      target_knowledge_kind: "resource", target_search_text: "Autor", target_project_id: null, target_goal_id: null,
      target_visibility: null, page_size: 20,
      cursor_sort_value: "2026-09-01T00:00:00.000Z", cursor_id: "book-0"
    });
  });

  it("przekazuje filtry Projektu, Celu i widoczności przed paginacją", async () => {
    const rpc = vi.fn(async () => ({ data: { items: [], nextCursor: null, totalCount: 0 }, error: null }));
    getClient.mockReturnValue({ rpc });
    await createSupabaseWorkspaceRepository().loadPage({
      workspaceId: "workspace-1", collection: "knowledge", pageSize: 50,
      projectId: "project-1", knowledgeGoalId: "goal-1", knowledgeVisibility: "archived"
    });
    expect(rpc).toHaveBeenCalledWith("get_knowledge_page", {
      target_workspace_id: "workspace-1", target_project_id: "project-1", target_goal_id: "goal-1", target_visibility: "archived",
      target_resource_format: null, target_reading_status: null, target_knowledge_kind: null, target_search_text: null,
      page_size: 50, cursor_sort_value: null, cursor_id: null
    });
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

  it("wczytuje zapisany preset Projektu i propozycje kategorii", async () => {
    const rpc = vi.fn(async (name: string) => name === "get_workspace_core" ? {
      data: { ...core, areas: [{ id: "library", name: "Czytelnia", visibility: "active", createdAt: "now", updatedAt: "now" }], projectCategories: [{ id: "books", name: "Książki", color: "#000000" }] }, error: null
    } : { data: null, error: null });
    const from = vi.fn((table: string) => ({ select: () => table === "workspaces"
      ? { eq: () => ({ single: async () => ({ data: { ai_review_window_days: 28, ai_review_cache_hours: 72 }, error: null }) }) }
      : { eq: async () => table === "areas"
        ? { data: [{ id: "library", preset: "reading" }], error: null }
        : { data: [{ id: "books", default_preset: "reading" }], error: null } }
    }));
    getClient.mockReturnValue({ rpc, from });

    await expect(createSupabaseWorkspaceRepository().loadCore("user-1")).resolves.toMatchObject({
      areas: [{ id: "library", preset: "reading" }],
      projectCategories: [{ id: "books", defaultPreset: "reading" }]
    });
    expect(from).toHaveBeenCalledWith("areas");
    expect(from).toHaveBeenCalledWith("project_categories");
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
