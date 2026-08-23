import { createContext } from "react";
import type { ActionStatus, AppState, CommitmentStatus, FocusEndReason, GoalKind, InboxKind, InboxStatus, KnowledgeKind, MissedOccurrencePolicy, NewLearningGoalInput, NewProjectInput, RecurrenceRule, WorkItemStatus } from "../domain/types";
import type { AuthMode } from "../auth/auth-context";
import type { DraftSaveStatus } from "../hooks/usePersistentDraft";

export interface CheckpointInput {
  reason?: FocusEndReason;
  currentState: string;
  nextAction: string;
  branch?: string;
  file?: string;
  sourceUrl?: string;
  blocker?: string;
  note?: string;
  evidence?: { learningGoalId: string; title: string; result: "supports" | "reveals_gap" | "inconclusive"; feedback: string };
}

export interface CreatedProjectReference {
  projectId: string;
  workItemId: string;
}

export interface NewGoalInput {
  title: string;
  outcome: string;
  firstActionTitle?: string;
  firstActionDetail?: string;
  kind?: GoalKind;
  areaId?: string;
  templateId?: string;
  criteria?: string[];
}

export interface NewActionInput {
  title: string;
  detail?: string;
  goalId?: string;
  areaId?: string;
  scheduledFor?: string;
  pinnedToToday?: boolean;
}

export interface NewRecurringActionInput {
  title: string;
  detail?: string;
  goalId?: string;
  areaId?: string;
  timezone?: string;
  startsOn: string;
  rule: RecurrenceRule;
  missedPolicy?: MissedOccurrencePolicy;
  checklist?: string[];
}

export type NewInboxTriageIntent =
  | { kind: "goal"; title: string; outcome: string; firstActionTitle?: string }
  | { kind: "action"; title: string; detail?: string; goalId?: string; areaId?: string; pinnedToToday?: boolean }
  | { kind: "knowledge"; knowledgeKind: KnowledgeKind; title: string; detail: string; goalId?: string; sourceUrl?: string };

export interface AppStore {
  state: AppState;
  mode: AuthMode;
  loading: boolean;
  syncing: boolean;
  scratchpadStatus: DraftSaveStatus;
  error?: string;
  createGoal: (input: NewGoalInput) => Promise<string>;
  updateGoal: (goalId: string, changes: { title?: string; outcome?: string; areaId?: string | null; priority?: "low" | "normal" | "high"; targetDate?: string | null; criteria?: Array<{ id: string; title: string; completed: boolean }> }) => Promise<void>;
  createAction: (input: NewActionInput) => Promise<string>;
  updateAction: (actionId: string, changes: { title?: string; detail?: string; scheduledFor?: string | null; pinnedToToday?: boolean; goalId?: string | null; areaId?: string | null; position?: number; checklist?: Array<{ id: string; title: string; completed: boolean }> }) => Promise<void>;
  setActionStatus: (actionId: string, status: ActionStatus, blocker?: string) => Promise<void>;
  setNextAction: (goalId: string, actionId: string) => Promise<void>;
  addProgress: (goalId: string, kind: "note" | "decision" | "result" | "evidence" | "blocker", content: string, actionId?: string, knowledgeItemId?: string) => Promise<void>;
  createArea: (name: string, description?: string) => Promise<string>;
  updateArea: (areaId: string, changes: { name?: string; description?: string }) => Promise<void>;
  createGoalTemplate: (name: string, kind: GoalKind, defaultActions?: Array<{ title: string; detail?: string }>) => Promise<string>;
  updateGoalTemplate: (templateId: string, changes: { name?: string; kind?: GoalKind; defaultActions?: Array<{ title: string; detail?: string }> }) => Promise<void>;
  setGoalStatus: (goalId: string, status: "active" | "paused" | "achieved" | "abandoned", reason?: string) => Promise<void>;
  setGoalVisibility: (goalId: string, visibility: "active" | "archived" | "trashed") => Promise<void>;
  setAreaVisibility: (areaId: string, visibility: "active" | "archived" | "trashed") => Promise<void>;
  setGoalTemplateVisibility: (templateId: string, visibility: "active" | "archived" | "trashed") => Promise<void>;
  setRecurringStatus: (templateId: string, status: "active" | "paused" | "archived") => Promise<void>;
  createRecurringAction: (input: NewRecurringActionInput) => Promise<string>;
  updateRecurringAction: (templateId: string, changes: Partial<NewRecurringActionInput>, updateFutureActions?: boolean) => Promise<void>;
  materializeRecurring: (today?: string) => Promise<void>;
  linkKnowledge: (knowledgeItemId: string, target: { targetKnowledgeItemId?: string; areaId?: string; goalId?: string; actionId?: string; recurringTemplateId?: string }, meaning?: "material" | "result" | "decision" | "reference") => Promise<void>;
  unlinkKnowledge: (linkId: string) => Promise<void>;
  triageInboxIntent: (inboxItemId: string, intent: NewInboxTriageIntent) => Promise<void>;
  createProject: (input: NewProjectInput) => Promise<CreatedProjectReference>;
  setCommitmentStatus: (projectId: string, status: CommitmentStatus) => Promise<void>;
  setPrimaryCommitment: (projectId: string) => void;
  setWorkItemStatus: (projectId: string, workItemId: string, status: WorkItemStatus, blocker?: string) => void;
  updateCheckpoint: (checkpointId: string, input: Omit<CheckpointInput, "reason" | "evidence">) => void;
  promoteScratchpad: (sessionId: string, target: "note" | "decision" | "inbox", title: string, content: string) => void;
  createLearningGoal: (input: NewLearningGoalInput) => Promise<void>;
  setLearningGoalStatus: (goalId: string, status: "draft" | "shaped" | "achieved" | "abandoned", reason?: string) => Promise<void>;
  capture: (content: string, kind?: InboxKind) => Promise<void>;
  resolveInbox: (id: string) => Promise<void>;
  triageInbox: (id: string, target: KnowledgeKind, title: string, detail: string, projectId?: string) => void;
  setInboxStatus: (id: string, status: InboxStatus, snoozedUntil?: string) => Promise<void>;
  releaseDueInbox: (now?: Date) => Promise<void>;
  createKnowledge: (kind: KnowledgeKind, title: string, detail: string, goalId?: string, sourceUrl?: string, goalIds?: string[]) => Promise<string>;
  updateKnowledge: (knowledgeId: string, changes: { kind?: KnowledgeKind; title?: string; detail?: string; sourceUrl?: string | null; goalIds?: string[] }) => Promise<void>;
  setVisibility: (entityType: "project" | "knowledge", entityId: string, visibility: "active" | "archived" | "trashed") => Promise<void>;
  startFocus: (workItemId?: string) => Promise<boolean>;
  pauseFocus: (checkpoint: CheckpointInput) => Promise<boolean>;
  updateScratchpad: (value: string) => void;
  setAIProposal: (status: AppState["aiProposal"]) => Promise<void>;
  executeAIExecution: (executionId: string) => void;
  completeReview: (summary?: string, type?: "daily" | "weekly", answers?: Record<string, string>) => Promise<boolean>;
  exportData: () => Promise<unknown>;
  reload: () => Promise<void>;
  resetDemo: () => void;
}

export const StoreContext = createContext<AppStore | null>(null);
