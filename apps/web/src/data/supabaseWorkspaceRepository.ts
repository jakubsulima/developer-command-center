import type { FocusSessionRecord, KnowledgeItem } from "../domain/types";
import { getSupabase } from "../lib/supabase";
import type { Page, PageCursor, SearchResult, WorkspaceCore, WorkspaceExport, WorkspacePageItem, WorkspacePageQuery, WorkspaceRepository } from "./workspaceRepository";
import { AIGoalReviewError, decodeAIGoalReview, decodeAIGoalReviewContent, type AIGoalReviewFeedbackRating } from "../domain/aiGoalReview";
import { AIInboxTriageError, decodeAIInboxTriageProposal, type AIInboxTriageFeedbackRating } from "../domain/aiInboxTriage";

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
    areas: arrayPayload(root.areas, "WorkspaceCore.areas"),
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

function cursorParams(cursor?: PageCursor) {
  return { cursor_sort_value: cursor?.sortValue ?? null, cursor_id: cursor?.id ?? null };
}

const pageRpc: Record<WorkspacePageQuery["collection"], string> = {
  inbox: "get_inbox_page",
  knowledge: "get_knowledge_page",
  "goal-progress": "get_goal_progress_page",
  "completed-actions": "get_completed_actions_page",
  reviews: "get_reviews_page"
};

export function createSupabaseWorkspaceRepository(): WorkspaceRepository {
  return {
    async loadCore(userId) {
      const { data, error } = await getSupabase().rpc("get_workspace_core", { target_user_id: userId });
      if (error) throw new Error(`WorkspaceCore: ${error.message}`);
      const core = decodeWorkspaceCore(data);
      if (!core.workspaceId) return core;
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
    async loadPage(query) {
      const { data, error } = await getSupabase().rpc(pageRpc[query.collection], {
        target_workspace_id: query.workspaceId,
        ...(query.collection === "goal-progress" ? { target_goal_id: query.goalId ?? null } : {}),
        page_size: query.pageSize,
        ...cursorParams(query.cursor)
      });
      if (error) throw new Error(`WorkspacePage: ${error.message}`);
      return decodePage<WorkspacePageItem>(data, `WorkspacePage.${query.collection}`);
    },
    async loadKnowledgeItem(id): Promise<KnowledgeItem | undefined> {
      const { data, error } = await getSupabase().rpc("get_knowledge_item", { target_item_id: id });
      if (error) throw new Error(`KnowledgeItem: ${error.message}`);
      return (data ?? undefined) as KnowledgeItem | undefined;
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
      const { data, error } = await getSupabase().from("ai_goal_reviews")
        .select("id,period_start,period_end,provider,model,review_json,analyzed_goal_ids,omitted_goal_ids,created_at,cache_expires_at")
        .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) {
        if (error.code === "42P01" || /ai_goal_reviews.*does not exist/i.test(error.message)) return undefined;
        throw new AIGoalReviewError("WORKSPACE_NOT_AVAILABLE", "Nie udało się pobrać ostatniego Przeglądu AI.");
      }
      if (!data) return undefined;
      return decodeAIGoalReview({
        reviewId: data.id, status: "ready", cached: true,
        stale: new Date(data.cache_expires_at).getTime() <= Date.now(), generatedAt: data.created_at,
        periodStart: data.period_start, periodEnd: data.period_end, provider: data.provider, model: data.model,
        analyzedGoalIds: data.analyzed_goal_ids, omittedGoalIds: data.omitted_goal_ids,
        review: decodeAIGoalReviewContent(data.review_json)
      });
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
