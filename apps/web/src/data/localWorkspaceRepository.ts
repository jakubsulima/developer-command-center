import { executeDomainCommand, type DomainCommand } from "../domain/commands";
import { migrateLegacyWorkspaceState } from "../domain/goals";
import type { AppState } from "../domain/types";
import { deriveWeeklyReview } from "../domain/weeklyReview";
import { isVisibleWorkspaceAction, isVisibleWorkspaceKnowledge, isVisibleWorkspaceProgress, withinDateRange, zonedStartOfDay } from "../domain/activity";
import { createDemoAIGoalReview } from "../domain/demoAIGoalReview";
import { createDemoAIInboxTriageProposal } from "../domain/demoAIInboxTriage";
import type { AIInboxTriageFeedbackRating, AIInboxTriageProposal } from "../domain/aiInboxTriage";
import { actionListSortDirection, actionListSortValue, matchesActionListFilter, type ActionListFilter } from "../domain/actionsList";
import { emptyState } from "./empty";
import { createKnowledgeFilter } from "../domain/knowledgeFilters";
import { decodeAIReviewSettings, type AIReviewSettings } from "../domain/aiReviewSettings";
import type { AIGoalReview, AIGoalReviewFreshness } from "../domain/aiGoalReview";
import { pageByCursor, type SearchResult, type WeeklyActivityDetail, type WorkspaceCore, type WorkspacePageItem, type WorkspacePageQuery, type WorkspaceRepository as CoreWorkspaceRepository } from "./workspaceRepository";

const DATABASE_NAME = "developer-command-center";
const STORE_NAME = "workspace";
const STATE_KEY = "active";
const FALLBACK_KEY = "command-center-local-workspace-v2";
const GOAL_REVIEW_KEY = "command-center-ai-goal-review-v1";
const SCHEMA_VERSION = 6;

interface StoredWorkspace {
  version: number;
  savedAt: string;
  state: AppState;
}

interface StoredDemoGoalReview {
  review: AIGoalReview;
  sourceSignature: string;
  cacheExpiresAt: string;
}

function demoGoalReviewSourceSignature(state: AppState) {
  return JSON.stringify({
    goals: state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"),
    criteria: state.goalCriteria,
    actions: state.actions.filter((action) => action.goalId),
    progress: state.progressEntries.slice(0, 250)
  });
}

export interface WorkspaceRepository extends CoreWorkspaceRepository {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  execute(command: DomainCommand): Promise<AppState>;
  export(): Promise<{ format: string; version: number; exportedAt: string; state: AppState }>;
  clear(): Promise<void>;
}

interface LocalRepositoryOptions {
  indexedDb: IDBFactory | undefined;
  storage: Storage;
}

function envelope(state: AppState): StoredWorkspace {
  return { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), state: structuredClone(state) };
}

function toWorkspaceCore(state: AppState): WorkspaceCore {
  const weekly = deriveWeeklyReview(state);
  return {
    workspaceId: state.workspaceId,
    workspaceTimezone: state.workspaceTimezone,
    aiReviewSettings: decodeAIReviewSettings(state.aiReviewSettings),
    areas: structuredClone(state.areas),
    projectCategories: structuredClone(state.projectCategories ?? []),
    goalTemplates: structuredClone(state.goalTemplates),
    goals: structuredClone(state.goals),
    goalCriteria: structuredClone(state.goalCriteria),
    actions: structuredClone(state.actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status))),
    legacyProjects: structuredClone(state.projects),
    recurringActionTemplates: structuredClone(state.recurringActionTemplates),
    knowledgeLinks: structuredClone(state.knowledgeLinks),
    counts: {
      inbox: state.inbox.filter((item) => item.status === "unprocessed").length,
      knowledge: state.knowledge.filter((item) => !item.archivedAt && !item.trashedAt).length,
      openActions: state.actions.filter((action) => !["completed", "cancelled", "skipped"].includes(action.status)).length,
      start: state.actions.filter((action) => action.pinnedToToday && !["completed", "cancelled", "skipped"].includes(action.status)).length
    },
    weeklySummary: {
      periodStart: weekly.startDate,
      periodEnd: weekly.endDate,
      completedActions: weekly.completedActions,
      focusMinutes: weekly.focusMinutes,
      knowledgeAdded: weekly.knowledgeAdded,
      progressUpdates: weekly.progressUpdates,
      recentReviews: structuredClone(state.reviews.slice(0, 4))
    }
  };
}

function pageItems(state: AppState, collection: WorkspacePageQuery["collection"], goalId?: string, actionFilter?: ActionListFilter): WorkspacePageItem[] {
  if (collection === "inbox") return state.inbox;
  if (collection === "knowledge") return state.knowledge;
  if (collection === "goal-progress") return state.progressEntries.filter((entry) => !goalId || entry.goalId === goalId);
  if (collection === "completed-actions") return state.actions.filter((action) => action.status === "completed");
  if (collection === "actions") return state.actions.filter((action) => actionFilter && matchesActionListFilter(state, action, actionFilter));
  return state.reviews;
}

function pageSortValue(item: WorkspacePageItem, collection: WorkspacePageQuery["collection"]) {
  if (collection === "weekly-activity") return (item as WeeklyActivityDetail).occurredAt;
  if (collection === "knowledge") return (item as AppState["knowledge"][number]).updatedAt ?? (item as AppState["knowledge"][number]).createdAt ?? "";
  if (collection === "actions") return actionListSortValue(item as AppState["actions"][number], "open");
  if (collection === "completed-actions") return (item as AppState["actions"][number]).completedAt ?? (item as AppState["actions"][number]).updatedAt ?? "";
  if (collection === "reviews") return (item as AppState["reviews"][number]).completedAt;
  if (collection === "goal-progress") return (item as AppState["progressEntries"][number]).createdAt;
  return (item as AppState["inbox"][number] | AppState["knowledge"][number]).createdAt ?? (item as AppState["knowledge"][number]).updatedAt ?? "";
}

function localWeeklyActivityItems(state: AppState, query: WorkspacePageQuery): WeeklyActivityDetail[] {
  const { activityKind, periodStart, periodEndExclusive, periodTimeZone } = query;
  if (!activityKind || !periodStart || !periodEndExclusive || !periodTimeZone) return [];
  const start = zonedStartOfDay(periodStart, periodTimeZone);
  const end = zonedStartOfDay(periodEndExclusive, periodTimeZone);
  const items: WeeklyActivityDetail[] = [];
  if (activityKind === "actions") {
    for (const action of state.actions) {
      const goal = action.goalId ? state.goals.find((candidate) => candidate.id === action.goalId) : undefined;
      const projectId = action.areaId ?? goal?.areaId;
      if (action.status !== "completed" || !isVisibleWorkspaceAction(state, action) || !withinDateRange(action.completedAt, start, end)) continue;
      if (query.activityGoalId && action.goalId !== query.activityGoalId) continue;
      if (query.activityProjectId && projectId !== query.activityProjectId) continue;
      items.push({ id: action.id, kind: activityKind, title: action.title, detail: action.detail, occurredAt: action.completedAt!, goalId: action.goalId, projectId });
    }
  } else if (activityKind === "knowledge") {
    for (const knowledge of state.knowledge) {
      const link = state.knowledgeLinks.find((candidate) => candidate.knowledgeItemId === knowledge.id);
      const goalId = link?.goalId;
      const goal = goalId ? state.goals.find((candidate) => candidate.id === goalId) : undefined;
      const projectId = knowledge.projectId ?? goal?.areaId;
      if (!isVisibleWorkspaceKnowledge(state, knowledge) || !withinDateRange(knowledge.createdAt, start, end)) continue;
      if (query.activityGoalId && goalId !== query.activityGoalId) continue;
      if (query.activityProjectId && projectId !== query.activityProjectId) continue;
      items.push({ id: knowledge.id, kind: activityKind, title: knowledge.title, detail: knowledge.detail, occurredAt: knowledge.createdAt!, goalId, projectId });
    }
  } else {
    for (const entry of state.progressEntries) {
      const goal = state.goals.find((candidate) => candidate.id === entry.goalId);
      if (!isVisibleWorkspaceProgress(state, entry) || !withinDateRange(entry.createdAt, start, end)) continue;
      if (query.activityGoalId && entry.goalId !== query.activityGoalId) continue;
      if (query.activityProjectId && goal?.areaId !== query.activityProjectId) continue;
      items.push({ id: entry.id, kind: activityKind, title: goal?.title ?? "Aktualizacja postępu", detail: entry.content, occurredAt: entry.createdAt, goalId: entry.goalId, projectId: goal?.areaId });
    }
  }
  return items;
}

export function pageLocalWeeklyActivity(state: AppState, query: WorkspacePageQuery) {
  const items = localWeeklyActivityItems(state, query);
  return { ...pageByCursor(items, query.pageSize, query.cursor, (item) => item.occurredAt), totalCount: items.length };
}

function openDatabase(factory: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexed_db_open_failed"));
  });
}

async function readIndexedDb(factory: IDBFactory) {
  const database = await openDatabase(factory);
  return new Promise<StoredWorkspace | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve((request.result as StoredWorkspace | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("indexed_db_read_failed"));
    transaction.oncomplete = () => database.close();
  });
}

async function writeIndexedDb(factory: IDBFactory, value: StoredWorkspace | null) {
  const database = await openDatabase(factory);
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    if (value) store.put(value, STATE_KEY);
    else store.delete(STATE_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("indexed_db_write_failed")); };
  });
}

export function createLocalWorkspaceRepository(options: LocalRepositoryOptions = {
  indexedDb: globalThis.indexedDB,
  storage: globalThis.localStorage
}): WorkspaceRepository {
  const { indexedDb, storage } = options;
  const inboxTriageProposals = new Map<string, AIInboxTriageProposal>();

  const readStoredGoalReview = (): StoredDemoGoalReview | undefined => {
    try {
      const value = JSON.parse(storage.getItem(GOAL_REVIEW_KEY) ?? "null") as StoredDemoGoalReview | null;
      return value?.review && typeof value.sourceSignature === "string" && typeof value.cacheExpiresAt === "string" ? value : undefined;
    } catch { return undefined; }
  };

  const readLatestDemoGoalReview = async () => {
    const state = await load() ?? structuredClone(emptyState);
    const settings = decodeAIReviewSettings(state.aiReviewSettings);
    const stored = readStoredGoalReview();
    const checkedAt = new Date().toISOString();
    if (!stored) return { review: null, freshness: "none" as const, checkedAt };
    let freshness: AIGoalReviewFreshness;
    if (stored.review.windowDays !== settings.windowDays) freshness = "configuration_changed";
    else if (stored.sourceSignature !== demoGoalReviewSourceSignature(state)) freshness = "source_changed";
    else {
      const expiry = Math.min(Date.parse(stored.cacheExpiresAt), Date.parse(stored.review.generatedAt) + settings.cacheHours * 3_600_000);
      freshness = Number.isFinite(expiry) && Date.parse(checkedAt) < expiry ? "current" : "expired";
    }
    return { review: { ...structuredClone(stored.review), cached: true, stale: freshness !== "current" }, freshness, checkedAt };
  };

  const load = async () => {
    const stored = indexedDb
      ? await readIndexedDb(indexedDb)
      : JSON.parse(storage.getItem(FALLBACK_KEY) ?? "null") as StoredWorkspace | null;
    if (!stored?.state) return null;
    const snapshot = structuredClone(stored.state);
    const migrated = stored.version < SCHEMA_VERSION ? migrateLegacyWorkspaceState(snapshot) : snapshot;
    return { ...migrated, aiReviewSettings: decodeAIReviewSettings(migrated.aiReviewSettings) };
  };

  const save = async (state: AppState) => {
    const stored = envelope(state);
    if (indexedDb) await writeIndexedDb(indexedDb, stored);
    else storage.setItem(FALLBACK_KEY, JSON.stringify(stored));
  };

  return {
    load,
    save,
    async execute(command: DomainCommand) {
      const current = await load() ?? structuredClone(emptyState);
      const next = executeDomainCommand(current, command);
      await save(next);
      return next;
    },
    async export() {
      return {
        format: "developer-command-center/export",
        version: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        state: await load() ?? structuredClone(emptyState)
      };
    },
    async clear() {
      if (indexedDb) await writeIndexedDb(indexedDb, null);
      else storage.removeItem(FALLBACK_KEY);
      storage.removeItem(GOAL_REVIEW_KEY);
    },
    async loadCore() {
      return toWorkspaceCore(await load() ?? structuredClone(emptyState));
    },
    async saveAIReviewSettings(_workspaceId: string, settings: AIReviewSettings) {
      const validated = decodeAIReviewSettings(settings);
      const current = await load() ?? structuredClone(emptyState);
      await save({ ...current, aiReviewSettings: validated });
      return validated;
    },
    async loadPage(query: WorkspacePageQuery) {
      const state = await load() ?? structuredClone(emptyState);
      if (query.collection === "weekly-activity") {
        return pageLocalWeeklyActivity(state, query);
      }
      let items = pageItems(state, query.collection, query.goalId, query.actionFilter);
      let totalCount: number | undefined;
      if (query.collection === "knowledge") {
        const filter = createKnowledgeFilter(state, {
          resourceFormat: query.resourceFormat,
          readingStatus: query.readingStatus,
          knowledgeKind: query.knowledgeKind,
          searchText: query.searchText,
          projectId: query.projectId,
          goalId: query.knowledgeGoalId,
          visibility: query.knowledgeVisibility
        });
        items = (items as AppState["knowledge"]).filter(filter);
        totalCount = items.length;
      }
      if (query.collection === "actions" && query.actionFilter) {
        return pageByCursor(items, query.pageSize, query.cursor, (item) => actionListSortValue(item as AppState["actions"][number], query.actionFilter!.view), actionListSortDirection(query.actionFilter.view));
      }
      return { ...pageByCursor(items, query.pageSize, query.cursor, (item) => pageSortValue(item, query.collection)), totalCount };
    },
    async loadAction(id) {
      return (await load())?.actions.find((action) => action.id === id);
    },
    async loadKnowledgeItem(id: string) {
      return (await load())?.knowledge.find((item) => item.id === id);
    },
    async loadKnowledgeItems(ids: string[]) {
      const wanted = new Set(ids);
      return (await load())?.knowledge.filter((item) => wanted.has(item.id)) ?? [];
    },
    async loadLegacyFocusSession(id: string) {
      return (await load())?.focusSessions.find((session) => session.id === id);
    },
    async search(query: string, limit = 20): Promise<SearchResult[]> {
      const normalized = query.trim().toLocaleLowerCase();
      if (normalized.length < 2) return [];
      const state = await load() ?? structuredClone(emptyState);
      const results: SearchResult[] = [
        ...state.goals.filter((item) => `${item.title} ${item.outcome}`.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "goal" as const, title: item.title, detail: item.outcome, route: `/goals/${item.id}` })),
        ...state.actions.filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "action" as const, title: item.title, detail: item.detail, route: `/actions/${item.id}` })),
        ...state.knowledge.filter((item) => `${item.title} ${item.detail} ${item.resourceAuthor ?? ""}`.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "knowledge" as const, title: item.title, detail: item.detail, route: `/knowledge/${item.id}` })),
        ...state.areas.filter((item) => item.visibility === "active" && `${item.name} ${item.description ?? ""}`.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "project" as const, title: item.name, detail: item.description, route: `/projects/${item.id}` })),
        ...state.inbox.filter((item) => item.content.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "inbox" as const, title: item.content, route: `/knowledge?section=inbox&item=${item.id}` }))
      ];
      return results.slice(0, Math.min(20, Math.max(1, limit)));
    },
    async exportWorkspace() {
      return this.export();
    },
    async getLatestGoalReview() {
      return readLatestDemoGoalReview();
    },
    async requestGoalReview(_workspaceId, forceRefresh = false) {
      const current = await load() ?? structuredClone(emptyState);
      if (!forceRefresh) {
        const latest = await readLatestDemoGoalReview();
        if (latest.review && latest.freshness === "current") return { ...latest.review, cached: true };
      }
      const settings = decodeAIReviewSettings(current.aiReviewSettings);
      const review = createDemoAIGoalReview(current);
      storage.setItem(GOAL_REVIEW_KEY, JSON.stringify({
        review,
        sourceSignature: demoGoalReviewSourceSignature(current),
        cacheExpiresAt: new Date(Date.parse(review.generatedAt) + settings.cacheHours * 3_600_000).toISOString()
      } satisfies StoredDemoGoalReview));
      return structuredClone(review);
    },
    async submitGoalReviewFeedback() {
      // Demo zachowuje kontrakt bez wysyłania i trwałego śledzenia oceny.
    },
    async getLatestInboxTriageProposal(_workspaceId, inboxItemId) {
      return inboxTriageProposals.get(inboxItemId);
    },
    async requestInboxTriageProposal(_workspaceId, inboxItemId, forceRefresh = false) {
      const state = await load() ?? structuredClone(emptyState);
      const item = state.inbox.find((candidate) => candidate.id === inboxItemId);
      if (!item || item.status !== "unprocessed") throw new Error("INBOX_ITEM_NOT_AVAILABLE");
      const cached = !forceRefresh ? inboxTriageProposals.get(inboxItemId) : undefined;
      if (cached) return { ...structuredClone(cached), cached: true };
      const proposal = createDemoAIInboxTriageProposal(state, item);
      inboxTriageProposals.set(inboxItemId, proposal);
      return structuredClone(proposal);
    },
    async submitInboxTriageFeedback(_workspaceId, proposalId, rating: AIInboxTriageFeedbackRating) {
      void rating;
      if (![...inboxTriageProposals.values()].some((proposal) => proposal.proposalId === proposalId)) throw new Error("PROPOSAL_NOT_FOUND");
    }
  };
}
