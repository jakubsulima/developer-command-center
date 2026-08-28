import type { DomainCommand } from "../domain/commands";
import type { AppState, FocusSessionRecord, GoalAction, GoalCriterion, GoalTemplate, Goal, InboxItem, KnowledgeItem, Project, RecurringActionTemplate, ReviewRecord, Area, KnowledgeLink } from "../domain/types";
import type { WeeklyReviewSummary } from "../domain/weeklyReview";
import type { AIGoalReview, AIGoalReviewFeedbackRating } from "../domain/aiGoalReview";
import type { AIInboxTriageFeedbackRating, AIInboxTriageProposal } from "../domain/aiInboxTriage";

export interface PageCursor {
  sortValue: string;
  id: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: PageCursor;
}

export type WorkspacePageCollection = "inbox" | "knowledge" | "goal-progress" | "completed-actions" | "reviews";

export interface WorkspacePageQuery {
  workspaceId: string;
  collection: WorkspacePageCollection;
  pageSize: number;
  goalId?: string;
  cursor?: PageCursor;
}

export type GoalProgressPageItem = AppState["progressEntries"][number];
export type WorkspacePageItem = InboxItem | KnowledgeItem | GoalProgressPageItem | GoalAction | ReviewRecord;

export interface WorkspaceCore {
  workspaceId?: string;
  workspaceTimezone: string;
  areas: Area[];
  goalTemplates: GoalTemplate[];
  goals: Goal[];
  goalCriteria: GoalCriterion[];
  actions: GoalAction[];
  projects: Project[];
  recurringActionTemplates: RecurringActionTemplate[];
  knowledgeLinks: KnowledgeLink[];
  counts: {
    inbox: number;
    knowledge: number;
    openActions: number;
    start: number;
  };
  weeklySummary: Pick<WeeklyReviewSummary, "completedActions" | "focusMinutes" | "knowledgeAdded" | "progressUpdates"> & {
    recentReviews: ReviewRecord[];
  };
}

export type WorkspaceCommand = DomainCommand;
export type CommandResult = AppState;

export interface WorkspaceExport {
  format: string;
  version: number;
  exportedAt: string;
  mode?: "demo" | "supabase";
  state?: AppState;
  workspace?: unknown;
  tables?: Record<string, unknown>;
}

export interface WorkspaceRepository {
  loadCore(userId: string): Promise<WorkspaceCore>;
  loadPage(query: WorkspacePageQuery): Promise<Page<WorkspacePageItem>>;
  loadKnowledgeItem(id: string): Promise<KnowledgeItem | undefined>;
  loadLegacyFocusSession(id: string): Promise<FocusSessionRecord | undefined>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
  execute(command: WorkspaceCommand): Promise<CommandResult>;
  exportWorkspace(workspaceId: string): Promise<WorkspaceExport>;
  getLatestGoalReview(workspaceId: string): Promise<AIGoalReview | undefined>;
  requestGoalReview(workspaceId: string, forceRefresh?: boolean): Promise<AIGoalReview>;
  submitGoalReviewFeedback(workspaceId: string, reviewId: string, recommendationId: string | null, rating: AIGoalReviewFeedbackRating): Promise<void>;
  getLatestInboxTriageProposal(workspaceId: string, inboxItemId: string): Promise<AIInboxTriageProposal | undefined>;
  requestInboxTriageProposal(workspaceId: string, inboxItemId: string, forceRefresh?: boolean): Promise<AIInboxTriageProposal>;
  submitInboxTriageFeedback(workspaceId: string, proposalId: string, rating: AIInboxTriageFeedbackRating): Promise<void>;
}

export interface SearchResult {
  id: string;
  type: "goal" | "action" | "knowledge" | "project" | "inbox";
  title: string;
  detail?: string;
  route: string;
}

export function pageByCursor<T extends { id: string }>(items: T[], pageSize: number, cursor: PageCursor | undefined, sortValue: (item: T) => string): Page<T> {
  const ordered = [...items].sort((left, right) => sortValue(left).localeCompare(sortValue(right)) || left.id.localeCompare(right.id));
  const afterCursor = cursor
    ? ordered.filter((item) => sortValue(item) > cursor.sortValue || (sortValue(item) === cursor.sortValue && item.id > cursor.id))
    : ordered;
  const page = afterCursor.slice(0, pageSize + 1);
  const hasMore = page.length > pageSize;
  const visible = hasMore ? page.slice(0, pageSize) : page;
  const last = visible.at(-1);
  return {
    items: visible,
    nextCursor: hasMore && last ? { sortValue: sortValue(last), id: last.id } : undefined
  };
}
