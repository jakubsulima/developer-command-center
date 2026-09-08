import { executeDomainCommand, type DomainCommand } from "../domain/commands";
import { migrateLegacyWorkspaceState } from "../domain/goals";
import type { AppState } from "../domain/types";
import { deriveWeeklyReview } from "../domain/weeklyReview";
import { createDemoAIGoalReview } from "../domain/demoAIGoalReview";
import { createDemoAIInboxTriageProposal } from "../domain/demoAIInboxTriage";
import type { AIInboxTriageFeedbackRating, AIInboxTriageProposal } from "../domain/aiInboxTriage";
import { actionListSortDirection, actionListSortValue, matchesActionListFilter, type ActionListFilter } from "../domain/actionsList";
import { emptyState } from "./empty";
import { pageByCursor, type SearchResult, type WorkspaceCore, type WorkspacePageItem, type WorkspacePageQuery, type WorkspaceRepository as CoreWorkspaceRepository } from "./workspaceRepository";

const DATABASE_NAME = "developer-command-center";
const STORE_NAME = "workspace";
const STATE_KEY = "active";
const FALLBACK_KEY = "command-center-local-workspace-v2";
const SCHEMA_VERSION = 4;

interface StoredWorkspace {
  version: number;
  savedAt: string;
  state: AppState;
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
    areas: structuredClone(state.areas),
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
  if (collection === "actions") return actionListSortValue(item as AppState["actions"][number], "open");
  if (collection === "completed-actions") return (item as AppState["actions"][number]).completedAt ?? (item as AppState["actions"][number]).updatedAt ?? "";
  if (collection === "reviews") return (item as AppState["reviews"][number]).completedAt;
  if (collection === "goal-progress") return (item as AppState["progressEntries"][number]).createdAt;
  return (item as AppState["inbox"][number] | AppState["knowledge"][number]).createdAt ?? (item as AppState["knowledge"][number]).updatedAt ?? "";
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
  let latestGoalReview: ReturnType<typeof createDemoAIGoalReview> | undefined;
  const inboxTriageProposals = new Map<string, AIInboxTriageProposal>();

  const load = async () => {
    const stored = indexedDb
      ? await readIndexedDb(indexedDb)
      : JSON.parse(storage.getItem(FALLBACK_KEY) ?? "null") as StoredWorkspace | null;
    if (!stored?.state) return null;
    const snapshot = structuredClone(stored.state);
    return stored.version < SCHEMA_VERSION ? migrateLegacyWorkspaceState(snapshot) : snapshot;
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
    },
    async loadCore() {
      return toWorkspaceCore(await load() ?? structuredClone(emptyState));
    },
    async loadPage(query: WorkspacePageQuery) {
      const state = await load() ?? structuredClone(emptyState);
      const items = pageItems(state, query.collection, query.goalId, query.actionFilter);
      if (query.collection === "actions" && query.actionFilter) {
        return pageByCursor(items, query.pageSize, query.cursor, (item) => actionListSortValue(item as AppState["actions"][number], query.actionFilter!.view), actionListSortDirection(query.actionFilter.view));
      }
      return pageByCursor(items, query.pageSize, query.cursor, (item) => pageSortValue(item, query.collection));
    },
    async loadAction(id) {
      return (await load())?.actions.find((action) => action.id === id);
    },
    async loadKnowledgeItem(id: string) {
      return (await load())?.knowledge.find((item) => item.id === id);
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
        ...state.knowledge.filter((item) => `${item.title} ${item.detail}`.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "knowledge" as const, title: item.title, detail: item.detail, route: `/knowledge/${item.id}` })),
        ...state.areas.filter((item) => item.visibility === "active" && `${item.name} ${item.description ?? ""}`.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "project" as const, title: item.name, detail: item.description, route: `/projects/${item.id}` })),
        ...state.inbox.filter((item) => item.content.toLocaleLowerCase().includes(normalized)).map((item) => ({ id: item.id, type: "inbox" as const, title: item.content, route: `/knowledge?section=inbox&item=${item.id}` }))
      ];
      return results.slice(0, Math.min(20, Math.max(1, limit)));
    },
    async exportWorkspace() {
      return this.export();
    },
    async getLatestGoalReview() {
      return latestGoalReview ? structuredClone(latestGoalReview) : undefined;
    },
    async requestGoalReview(_workspaceId, forceRefresh = false) {
      if (latestGoalReview && !forceRefresh) return { ...structuredClone(latestGoalReview), cached: true };
      latestGoalReview = createDemoAIGoalReview(await load() ?? structuredClone(emptyState));
      return structuredClone(latestGoalReview);
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
