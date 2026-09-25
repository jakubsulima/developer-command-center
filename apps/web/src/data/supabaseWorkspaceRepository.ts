import type { FocusSessionRecord, GoalAction, KnowledgeItem } from "../domain/types";
import { getSupabase } from "../lib/supabase";
import type { Page, PageCursor, SearchResult, WorkspaceCore, WorkspaceExport, WorkspacePageItem, WorkspacePageQuery, WorkspaceRepository } from "./workspaceRepository";
import { AIGoalReviewError, decodeAIGoalReview, type AIGoalReviewFeedbackRating, type AIGoalReviewFreshness } from "../domain/aiGoalReview";
import { AIInboxTriageError, decodeAIInboxTriageProposal, type AIInboxTriageFeedbackRating } from "../domain/aiInboxTriage";
import { decodeAIReviewSettings } from "../domain/aiReviewSettings";

function objectPayload(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: nieprawidłowy JSON`);
  return value as Record<string, unknown>;
}

function arrayPayload<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label}: oczekiwano tablicy`);
  return value as T[];
}

function stringPayload(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label}: oczekiwano tekstu`);
  return value;
}

function optionalStringPayload(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function withActionReviewDates(actions: GoalAction[]): Promise<GoalAction[]> {
  const ids = actions.filter((action) => action.status === "blocked").map((action) => action.id);
  if (!ids.length) return actions;
  const { data, error } = await getSupabase().from("actions").select("id,review_on").in("id", ids);
  if (error) {
    if (error.code === "42703") return actions;
    throw new Error(`ActionReviewDates: ${error.message}`);
  }
  const dates = new Map((data ?? []).map((row) => [row.id, row.review_on]));
  return actions.map((action) => ({ ...action, reviewOn: dates.get(action.id) ?? action.reviewOn ?? undefined }));
}

function decodeWeeklySummary(value: unknown, label = "WorkspaceCore.weeklySummary") {
  const weeklySummary = objectPayload(value, label);
  return {
    periodStart: optionalStringPayload(weeklySummary.periodStart),
    periodEnd: optionalStringPayload(weeklySummary.periodEnd),
    completedActions: Number(weeklySummary.completedActions ?? 0),
    focusMinutes: Number(weeklySummary.focusMinutes ?? 0),
    knowledgeAdded: Number(weeklySummary.knowledgeAdded ?? 0),
    progressUpdates: Number(weeklySummary.progressUpdates ?? 0)
  };
}

export function decodeWorkspaceCore(payload: unknown): WorkspaceCore {
  const root = objectPayload(payload, "WorkspaceCore");
  const counts = objectPayload(root.counts, "WorkspaceCore.counts");
  const weeklySummaryPayload = objectPayload(root.weeklySummary, "WorkspaceCore.weeklySummary");
  const weeklySummary = decodeWeeklySummary(weeklySummaryPayload);
  return {
    workspaceId: typeof root.workspaceId === "string" ? root.workspaceId : undefined,
    workspaceTimezone: stringPayload(root.workspaceTimezone, "WorkspaceCore.workspaceTimezone"),
    aiReviewSettings: decodeAIReviewSettings(root.aiReviewSettings),
    areas: arrayPayload(root.areas, "WorkspaceCore.areas"),
    projectCategories: arrayPayload(root.projectCategories ?? [], "WorkspaceCore.projectCategories"),
    goalTemplates: arrayPayload(root.goalTemplates, "WorkspaceCore.goalTemplates"),
    goals: arrayPayload(root.goals, "WorkspaceCore.goals"),
    goalCriteria: arrayPayload(root.goalCriteria, "WorkspaceCore.goalCriteria"),
    actions: arrayPayload(root.actions, "WorkspaceCore.actions"),
    legacyProjects: arrayPayload(root.legacyProjects ?? root.projects, "WorkspaceCore.legacyProjects"),
    recurringActionTemplates: arrayPayload(root.recurringActionTemplates, "WorkspaceCore.recurringActionTemplates"),
    knowledgeLinks: arrayPayload(root.knowledgeLinks, "WorkspaceCore.knowledgeLinks"),
    counts: {
      inbox: Number(counts.inbox ?? 0),
      knowledge: Number(counts.knowledge ?? 0),
      openActions: Number(counts.openActions ?? 0),
      start: Number(counts.start ?? 0)
    },
    weeklySummary: {
      ...weeklySummary,
      recentReviews: arrayPayload(weeklySummaryPayload.recentReviews, "WorkspaceCore.weeklySummary.recentReviews")
    }
  };
}

function decodePage<T>(payload: unknown, label: string): Page<T> {
  const root = objectPayload(payload, label);
  const cursor = root.nextCursor;
  return {
    items: arrayPayload<T>(root.items, `${label}.items`),
    nextCursor: cursor && typeof cursor === "object" ? {
      sortValue: stringPayload((cursor as Record<string, unknown>).sortValue, `${label}.nextCursor.sortValue`),
      id: stringPayload((cursor as Record<string, unknown>).id, `${label}.nextCursor.id`)
    } : undefined
  };
}

function decodeLatestGoalReview(payload: unknown) {
  const root = objectPayload(payload, "AIGoalReviewLatest");
  const freshness = root.freshness;
  if (!(["none", "current", "source_changed", "expired", "configuration_changed", "unknown"] as unknown[]).includes(freshness)) {
    throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "Nieprawidłowy status aktualności Przeglądu AI.");
  }
  if (typeof root.checkedAt !== "string") throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "Brak czasu sprawdzenia Przeglądu AI.");
  const review = root.review === null ? null : decodeAIGoalReview(root.review);
  if ((freshness === "none") !== (review === null)) throw new AIGoalReviewError("INVALID_MODEL_OUTPUT", "Status Przeglądu AI nie pasuje do wyniku.");
  return { review: review ? { ...review, stale: freshness !== "current" } : null, freshness: freshness as AIGoalReviewFreshness, checkedAt: root.checkedAt };
}

function cursorParams(cursor?: PageCursor) {
  return { cursor_sort_value: cursor?.sortValue ?? null, cursor_id: cursor?.id ?? null };
}

const pageRpc: Record<WorkspacePageQuery["collection"], string> = {
  inbox: "get_inbox_page",
  knowledge: "get_knowledge_page",
  "goal-progress": "get_goal_progress_page",
  "completed-actions": "get_completed_actions_page",
  actions: "get_actions_page",
  reviews: "get_reviews_page"
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string | undefined) => !value || uuidPattern.test(value);

export function createSupabaseWorkspaceRepository(): WorkspaceRepository {
  return {
    async loadCore(userId) {
      const { data, error } = await getSupabase().rpc("get_workspace_core", { target_user_id: userId });
      if (error) throw new Error(`WorkspaceCore: ${error.message}`);
      const core = decodeWorkspaceCore(data);
      if (!core.workspaceId) return core;
      const settingsResult = await getSupabase().from("workspaces")
        .select("ai_review_window_days,ai_review_cache_hours")
        .eq("id", core.workspaceId)
        .single();
      if (settingsResult.error) {
        if (settingsResult.error.code === "42703") core.aiReviewSettings = decodeAIReviewSettings(undefined);
        else throw new Error(`WorkspaceSettings: ${settingsResult.error.message}`);
      } else {
        if (!settingsResult.data) throw new Error("WorkspaceSettings: brak dostępnego Workspace.");
        core.aiReviewSettings = decodeAIReviewSettings(settingsResult.data);
      }
      core.actions = await withActionReviewDates(core.actions);
      try {
        const weekly = await getSupabase().rpc("get_workspace_weekly_summary", { target_workspace_id: core.workspaceId });
        if (!weekly.error && weekly.data && typeof weekly.data === "object" && !Array.isArray(weekly.data) && Object.hasOwn(weekly.data, "completedActions")) {
          core.weeklySummary = { ...core.weeklySummary, ...decodeWeeklySummary(weekly.data, "WorkspaceWeeklySummary") };
        }
      } catch {
        // Additive compatibility: older deployments keep the core aggregate.
      }
      return core;
    },
    async saveAIReviewSettings(workspaceId, settings) {
      const validated = decodeAIReviewSettings(settings);
      const { data, error } = await getSupabase().from("workspaces")
        .update({ ai_review_window_days: validated.windowDays, ai_review_cache_hours: validated.cacheHours })
        .eq("id", workspaceId)
        .select("ai_review_window_days,ai_review_cache_hours")
        .single();
      if (error || !data) throw new Error(`WorkspaceSettings: ${error?.message ?? "brak dostępnego Workspace"}`);
      return decodeAIReviewSettings(data);
    },
    async loadPage(query) {
      if (query.collection === "actions" && (!isUuid(query.actionFilter?.projectId) || !isUuid(query.actionFilter?.goalId))) {
        return { items: [], nextCursor: undefined } as Page<WorkspacePageItem>;
      }
      const { data, error } = await getSupabase().rpc(query.collection === "actions" && query.actionFilter?.view === "waiting" ? "get_waiting_actions_page" : pageRpc[query.collection], {
        target_workspace_id: query.workspaceId,
        ...(query.collection === "goal-progress" ? { target_goal_id: query.goalId ?? null } : {}),
        ...(query.collection === "actions" ? {
          target_view: query.actionFilter?.view ?? "open",
          target_project_id: query.actionFilter?.projectId ?? null,
          target_goal_id: query.actionFilter?.goalId ?? null,
          target_today: query.actionFilter?.today ?? null
        } : {}),
        page_size: query.pageSize,
        ...cursorParams(query.cursor)
      });
      if (error) throw new Error(`WorkspacePage: ${error.message}`);
      const page = decodePage<WorkspacePageItem>(data, `WorkspacePage.${query.collection}`);
      if (query.collection === "actions") return { ...page, items: await withActionReviewDates(page.items as GoalAction[]) };
      return page;
    },
    async loadKnowledgeItem(id): Promise<KnowledgeItem | undefined> {
      const { data, error } = await getSupabase().rpc("get_knowledge_item", { target_item_id: id });
      if (error) throw new Error(`KnowledgeItem: ${error.message}`);
      return (data ?? undefined) as KnowledgeItem | undefined;
    },
    async loadAction(id): Promise<GoalAction | undefined> {
      const { data, error } = await getSupabase().rpc("get_action_item", { target_action_id: id });
      if (error) throw new Error(`ActionItem: ${error.message}`);
      if (!data) return undefined;
      return (await withActionReviewDates([data as GoalAction]))[0];
    },
    async loadLegacyFocusSession(id): Promise<FocusSessionRecord | undefined> {
      const { data, error } = await getSupabase().rpc("get_legacy_focus_session", { target_session_id: id });
      if (error) throw new Error(`LegacyFocusSession: ${error.message}`);
      return (data ?? undefined) as FocusSessionRecord | undefined;
    },
    async search(query, limit = 20): Promise<SearchResult[]> {
      if (query.trim().length < 2) return [];
      const { data, error } = await getSupabase().rpc("search_workspace", { search_query: query.trim(), result_limit: Math.min(limit, 20) });
      if (error) throw new Error(`WorkspaceSearch: ${error.message}`);
      return arrayPayload<SearchResult>(data, "WorkspaceSearch");
    },
    async exportWorkspace(workspaceId): Promise<WorkspaceExport> {
      const { exportWorkspaceRemote } = await import("./supabaseRepository");
      return exportWorkspaceRemote(workspaceId) as Promise<WorkspaceExport>;
    },
    async getLatestGoalReview(workspaceId) {
      const { data, error } = await getSupabase().functions.invoke("ai-goal-review", { body: { workspaceId, operation: "latest" } });
      if (error) {
        const context = (error as { context?: Response }).context;
        let code = "WORKSPACE_NOT_AVAILABLE";
        let message = "Nie udało się sprawdzić aktualności Przeglądu AI.";
        if (context) try {
          const payload = await context.clone().json() as { error?: { code?: string; message?: string } };
          code = payload.error?.code ?? code;
          message = payload.error?.message ?? message;
        } catch { /* zachowaj stabilny błąd odczytu */ }
        throw new AIGoalReviewError(code, message);
      }
      return decodeLatestGoalReview(data);
    },
    async requestGoalReview(workspaceId, forceRefresh = false) {
      const { data, error } = await getSupabase().functions.invoke("ai-goal-review", { body: { workspaceId, forceRefresh } });
      if (error) {
        const context = (error as { context?: Response }).context;
        let code = "PROVIDER_REJECTED";
        let message = "Nie udało się wygenerować Przeglądu AI.";
        if (context) {
          try {
            const payload = await context.clone().json() as { error?: { code?: string; message?: string } };
            code = payload.error?.code ?? code;
            message = payload.error?.message ?? message;
          } catch { /* zachowaj stabilny błąd */ }
        }
        throw new AIGoalReviewError(code, message);
      }
      return decodeAIGoalReview(data);
    },
    async submitGoalReviewFeedback(workspaceId, reviewId, recommendationId, rating: AIGoalReviewFeedbackRating) {
      const { error } = await getSupabase().rpc("set_ai_goal_review_feedback", { target_workspace_id: workspaceId, target_review_id: reviewId, target_recommendation_id: recommendationId, target_rating: rating });
      if (error) throw new AIGoalReviewError("WORKSPACE_NOT_AVAILABLE", "Nie udało się zapisać oceny.");
    },
    async getLatestInboxTriageProposal(workspaceId, inboxItemId) {
      const { data, error } = await getSupabase().from("ai_inbox_triage_proposals")
        .select("id,inbox_item_id,provider,model,proposal_json,created_at")
        .eq("workspace_id", workspaceId).eq("inbox_item_id", inboxItemId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) {
        if (error.code === "42P01" || /ai_inbox_triage_proposals.*does not exist/i.test(error.message)) return undefined;
        throw new AIInboxTriageError("WORKSPACE_NOT_AVAILABLE", "Nie udało się pobrać propozycji AI.");
      }
      if (!data) return undefined;
      return decodeAIInboxTriageProposal({ proposalId: data.id, inboxItemId: data.inbox_item_id, status: "ready", cached: true, generatedAt: data.created_at, provider: data.provider, model: data.model, proposal: data.proposal_json });
    },
    async requestInboxTriageProposal(workspaceId, inboxItemId, forceRefresh = false) {
      const { data, error } = await getSupabase().functions.invoke("ai-inbox-triage", { body: { workspaceId, inboxItemId, forceRefresh } });
      if (error) {
        const context = (error as { context?: Response }).context;
        let code = "PROVIDER_REJECTED"; let message = "Nie udało się przygotować propozycji AI.";
        if (context) {
          try { const payload = await context.clone().json() as { error?: { code?: string; message?: string } }; code = payload.error?.code ?? code; message = payload.error?.message ?? message; } catch { /* stabilny błąd */ }
        }
        throw new AIInboxTriageError(code, message);
      }
      return decodeAIInboxTriageProposal(data);
    },
    async submitInboxTriageFeedback(workspaceId, proposalId, rating: AIInboxTriageFeedbackRating) {
      const { error } = await getSupabase().rpc("set_ai_inbox_triage_feedback", { target_workspace_id: workspaceId, target_proposal_id: proposalId, target_rating: rating });
      if (error) throw new AIInboxTriageError("WORKSPACE_NOT_AVAILABLE", "Nie udało się zapisać oceny propozycji.");
    }
  };
}
