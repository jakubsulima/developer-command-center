import { createContext } from "react";
import type { AppState, CommitmentStatus, FocusEndReason, InboxKind, InboxStatus, KnowledgeKind, NewLearningGoalInput, NewProjectInput, WorkItemStatus } from "../domain/types";
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

export interface AppStore {
  state: AppState;
  mode: AuthMode;
  loading: boolean;
  syncing: boolean;
  scratchpadStatus: DraftSaveStatus;
  error?: string;
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
  createKnowledge: (kind: KnowledgeKind, title: string, detail: string, projectId?: string, sourceUrl?: string) => void;
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
