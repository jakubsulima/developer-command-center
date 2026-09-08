import type { DomainCommand } from "../domain/commands";
import type { ActionListFilter } from "../domain/actionsList";
import type { AppState, FocusSessionRecord, GoalAction, GoalCriterion, GoalTemplate, Goal, InboxItem, KnowledgeItem, LegacyProjectRecord, RecurringActionTemplate, ReviewRecord, Area, KnowledgeLink } from "../domain/types";
import type { WeeklyReviewSummary } from "../domain/weeklyReview";
import type { AIGoalReview, AIGoalReviewFeedbackRating } from "../domain/aiGoalReview";
import type { AIInboxTriageFeedbackRating, AIInboxTriageProposal } from "../domain/aiInboxTriage";

export type WorkspaceIntent = DomainCommand;
export type WorkspaceIntentResult<Intent extends WorkspaceIntent> = Intent extends unknown ? AppState : never;

export interface WorkspaceSelection<T> {
  key: string;
  select: (state: AppState) => T;
}

export interface WorkspaceObservation<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
}

export type WorkspaceQuery =
  | { type: "core"; userId: string }
  | { type: "page"; query: WorkspacePageQuery }
  | { type: "knowledge-item"; id: string }
  | { type: "action-item"; id: string }
  | { type: "legacy-focus-session"; id: string }
  | { type: "search"; query: string; limit?: number }
  | { type: "export"; workspaceId: string };

export type WorkspaceQueryResult<Q extends WorkspaceQuery> =
  Q extends { type: "core" } ? WorkspaceCore
    : Q extends { type: "page" } ? Page<WorkspacePageItem>
    : Q extends { type: "knowledge-item" } ? KnowledgeItem | undefined
      : Q extends { type: "action-item" } ? GoalAction | undefined
        : Q extends { type: "legacy-focus-session" } ? FocusSessionRecord | undefined
          : Q extends { type: "search" } ? SearchResult[]
            : Q extends { type: "export" } ? WorkspaceExport
              : never;

/** Small caller-facing seam; adapters remain behind WorkspacePersistence. */
export interface Workspace {
  observe<T>(selection: WorkspaceSelection<T>): WorkspaceObservation<T>;
  query<Q extends WorkspaceQuery>(query: Q): Promise<WorkspaceQueryResult<Q>>;
  execute<C extends WorkspaceIntent>(intent: C): Promise<WorkspaceIntentResult<C>>;
}

export type PersistedQuery = WorkspaceQuery;
export type PersistedQueryResult<Q extends PersistedQuery> = WorkspaceQueryResult<Q>;

export interface CommandEnvelope<C extends WorkspaceIntent> {
  commandId: string;
  idempotencyKey: string;
  command: C;
}

export interface CommandReceipt<C extends WorkspaceIntent> {
  commandId: string;
  idempotencyKey: string;
  committedAt: string;
  result: WorkspaceIntentResult<C>;
}

export interface WorkspacePersistence {
  read<Q extends PersistedQuery>(query: Q): Promise<PersistedQueryResult<Q>>;
  commit<C extends WorkspaceIntent>(command: CommandEnvelope<C>): Promise<CommandReceipt<C>>;
}

export type WorkspaceErrorCategory =
  | "validation"
  | "not_found"
  | "access_denied"
  | "version_conflict"
  | "schema_incompatibility"
  | "unavailable_persistence";

export class WorkspaceError extends Error {
  public constructor(public readonly category: WorkspaceErrorCategory, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "WorkspaceError";
  }
}

export interface PageCursor {
  sortValue: string;
  id: string;
}

export interface Page<T> {
  items: T[];
  nextCursor?: PageCursor;
}

export type WorkspacePageCollection = "inbox" | "knowledge" | "goal-progress" | "completed-actions" | "actions" | "reviews";

export interface WorkspacePageQuery {
  workspaceId: string;
  collection: WorkspacePageCollection;
  pageSize: number;
  goalId?: string;
  actionFilter?: ActionListFilter;
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
  legacyProjects: LegacyProjectRecord[];
  recurringActionTemplates: RecurringActionTemplate[];
  knowledgeLinks: KnowledgeLink[];
  counts: {
    inbox: number;
    knowledge: number;
    openActions: number;
    start: number;
  };
  weeklySummary: {
    periodStart?: string;
    periodEnd?: string;
    completedActions: WeeklyReviewSummary["completedActions"];
    focusMinutes: WeeklyReviewSummary["focusMinutes"];
    knowledgeAdded: WeeklyReviewSummary["knowledgeAdded"];
    progressUpdates: WeeklyReviewSummary["progressUpdates"];
    recentReviews: ReviewRecord[];
  };
}

export type WorkspaceCommand = DomainCommand;
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
  loadAction(id: string): Promise<GoalAction | undefined>;
  loadLegacyFocusSession(id: string): Promise<FocusSessionRecord | undefined>;
  search(query: string, limit?: number): Promise<SearchResult[]>;
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

export function pageByCursor<T extends { id: string }>(items: T[], pageSize: number, cursor: PageCursor | undefined, sortValue: (item: T) => string, direction: "asc" | "desc" = "asc"): Page<T> {
  const compare = (left: T, right: T) => {
    const sortComparison = sortValue(left).localeCompare(sortValue(right));
    return (direction === "desc" ? -sortComparison : sortComparison) || (direction === "desc" ? right.id.localeCompare(left.id) : left.id.localeCompare(right.id));
  };
  const ordered = [...items].sort(compare);
  const afterCursor = cursor
    ? ordered.filter((item) => {
      const sortComparison = sortValue(item).localeCompare(cursor.sortValue);
      return direction === "desc"
        ? sortComparison < 0 || (sortComparison === 0 && item.id < cursor.id)
        : sortComparison > 0 || (sortComparison === 0 && item.id > cursor.id);
    })
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
