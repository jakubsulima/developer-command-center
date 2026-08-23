export type ProjectStatus = "W trakcie" | "Zagrożony" | "Gotowy do decyzji";
export type ProjectDomainStatus = "draft" | "shaped" | "validating" | "completed" | "abandoned";
export type CommitmentStatus = "active" | "paused" | "released" | "fulfilled";
export type WorkItemStatus = "open" | "in_progress" | "blocked" | "completed" | "cancelled";
export type FocusEndReason = "paused" | "work_item_completed" | "stopped" | "interrupted";
export type InboxKind = "text" | "link" | "file" | "voice";
export type InboxStatus = "unprocessed" | "snoozed" | "resolved" | "discarded";
export type KnowledgeKind = "note" | "resource" | "decision" | "artifact" | "investigation";
export type KnowledgeRelationMeaning = "material" | "result" | "decision" | "reference";
export type GoalKind = "project" | "learning" | "personal" | "maintenance" | "custom";
export type GoalStatus = "active" | "paused" | "achieved" | "abandoned";
export type Visibility = "active" | "archived" | "trashed";
export type GoalPriority = "low" | "normal" | "high";
export type ActionStatus = "ready" | "in_progress" | "blocked" | "completed" | "skipped" | "cancelled";
export type ProgressKind = "note" | "decision" | "result" | "evidence" | "blocker";
export type RecurrenceUnit = "day" | "week" | "month";
export type MissedOccurrencePolicy = "skip_missed" | "carry_one";

export interface Area {
  id: string;
  name: string;
  description?: string;
  color?: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

export interface GoalTemplate {
  id: string;
  name: string;
  kind: GoalKind;
  outcomePrompt: string;
  criterionPrompt?: string;
  defaultActions: Array<{ title: string; detail?: string }>;
  system: boolean;
  visibility: Visibility;
  createdAt?: string;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  outcome: string;
  kind: GoalKind;
  status: GoalStatus;
  visibility: Visibility;
  priority: GoalPriority;
  areaId?: string;
  templateId?: string;
  targetDate?: string;
  createdAt?: string;
  updatedAt?: string;
  legacySource?: "project" | "learning_goal";
}

export interface GoalCriterion {
  id: string;
  goalId: string;
  title: string;
  completed: boolean;
  legacySourceId?: string;
}

export interface ActionChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface GoalAction {
  id: string;
  version: number;
  title: string;
  detail: string;
  goalId?: string;
  areaId?: string;
  status: ActionStatus;
  blocker?: string;
  position: number;
  isNext: boolean;
  pinnedToToday: boolean;
  scheduledFor?: string;
  completedAt?: string;
  skippedAt?: string;
  cancelledAt?: string;
  recurringTemplateId?: string;
  occurrenceDate?: string;
  checklist: ActionChecklistItem[];
  createdAt?: string;
  updatedAt?: string;
  legacySourceId?: string;
}

export interface ProgressEntry {
  id: string;
  goalId: string;
  kind: ProgressKind;
  content: string;
  actionId?: string;
  knowledgeItemId?: string;
  createdAt: string;
  legacySource?: "learning_evidence" | "checkpoint";
  legacySourceId?: string;
}

export interface RecurrenceRule {
  unit: RecurrenceUnit;
  interval: number;
  weekdays?: number[];
  dayOfMonth?: number;
  endsOn?: string;
}

export interface RecurringActionTemplate {
  id: string;
  title: string;
  detail: string;
  goalId?: string;
  areaId?: string;
  timezone: string;
  startsOn: string;
  rule: RecurrenceRule;
  missedPolicy: MissedOccurrencePolicy;
  status: "active" | "paused" | "archived";
  checklist: Array<{ title: string }>;
  lastMaterializedOn?: string;
  skippedOccurrenceCount: number;
  sourceTemplateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLink {
  id: string;
  knowledgeItemId: string;
  targetKnowledgeItemId?: string;
  areaId?: string;
  goalId?: string;
  actionId?: string;
  recurringTemplateId?: string;
  meaning: KnowledgeRelationMeaning;
  createdAt: string;
}

/** Exactly one target is required for every Knowledge relation. */
export type KnowledgeRelationTarget =
  | { targetKnowledgeItemId: string; areaId?: never; goalId?: never; actionId?: never; recurringTemplateId?: never }
  | { targetKnowledgeItemId?: never; areaId: string; goalId?: never; actionId?: never; recurringTemplateId?: never }
  | { targetKnowledgeItemId?: never; areaId?: never; goalId: string; actionId?: never; recurringTemplateId?: never }
  | { targetKnowledgeItemId?: never; areaId?: never; goalId?: never; actionId: string; recurringTemplateId?: never }
  | { targetKnowledgeItemId?: never; areaId?: never; goalId?: never; actionId?: never; recurringTemplateId: string };

export interface KnowledgeRelationInput {
  id?: string;
  meaning: KnowledgeRelationMeaning;
  target: KnowledgeRelationTarget;
}

export interface CreateKnowledgeInput {
  kind: KnowledgeKind;
  title: string;
  detail: string;
  sourceUrl?: string;
  projectId?: string;
  sourceInboxItemId?: string;
  relations?: KnowledgeRelationInput[];
}

export type ActionResultInput =
  | { kind: "new"; title: string; detail: string; sourceUrl?: string }
  | { kind: "existing"; knowledgeItemId: string };

export interface NewProjectInput {
  title: string;
  outcome: string;
  technology: string;
  firstWorkItemTitle: string;
  firstWorkItemDescription: string;
  effortBudgetMinutes?: number;
  wipOverrideReason?: string;
}

export interface WorkItem {
  id: string;
  title: string;
  detail: string;
  completed: boolean;
  status?: WorkItemStatus;
  blocker?: string;
}

export interface Project {
  id: string;
  name: string;
  initials: string;
  color: "violet" | "orange" | "amber";
  technology: string;
  outcome: string;
  status: ProjectStatus;
  domainStatus?: ProjectDomainStatus;
  commitmentStatus?: CommitmentStatus;
  commitmentOverrideReason?: string;
  nextStep: string;
  blocker?: string;
  primary: boolean;
  effortBudgetMinutes?: number;
  usedMinutes: number;
  archivedAt?: string;
  trashedAt?: string;
  requirements: Array<{ id: string; title: string; status: "accepted" | "validated" | "proposed" }>;
  workItems: WorkItem[];
}

export interface Checkpoint {
  id: string;
  projectId: string;
  workItemId?: string;
  sessionId?: string;
  title: string;
  currentState: string;
  nextAction: string;
  branch?: string;
  file?: string;
  sourceUrl?: string;
  blocker?: string;
  artifactId?: string;
  note?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FocusSessionRecord {
  id: string;
  projectId: string;
  workItemId: string;
  startedAt: string;
  endedAt?: string;
  endReason?: FocusEndReason;
  scratchpad: string;
  invalidatedAt?: string;
}

export interface InboxItem {
  id: string;
  kind: InboxKind;
  content: string;
  createdAt: string;
  status: InboxStatus;
  source?: string;
  resolvedToIds?: string[];
  snoozedUntil?: string;
  discardedAt?: string;
}

export interface LearningEvidence {
  id: string;
  learningGoalId?: string;
  title: string;
  detail: string;
  result: "supports" | "reveals_gap" | "inconclusive";
  assessmentMethod?: "self_review" | "automated_test" | "human_feedback" | "ai_review";
  accepted?: boolean;
  artifactId?: string;
  createdAt: string;
}

export interface LearningGoal {
  id: string;
  title: string;
  criterion: string;
  status: "draft" | "shaped" | "achieved" | "abandoned";
  skills: string[];
  abandonedReason?: string;
  achievedAt?: string;
}

export interface NewLearningGoalInput { title: string; criterion: string; skill: string }

export interface KnowledgeItem {
  id: string;
  type: KnowledgeKind;
  title: string;
  detail: string;
  sourceInboxItemId?: string;
  sourceSessionId?: string;
  sourceUrl?: string;
  projectId?: string;
  status?: "draft" | "shaped" | "concluded" | "abandoned";
  question?: string;
  conclusion?: string;
  confidence?: "low" | "medium" | "high";
  archivedAt?: string;
  trashedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewRecord {
  id: string;
  type: "daily" | "weekly";
  templateVersion: number;
  answers: Record<string, string>;
  summary: string;
  completedAt: string;
}

export interface AIProposalRecord {
  id: string;
  command: string;
  preview: string;
  sources: string[];
  risk: "low" | "medium" | "high";
  expectedVersions: Record<string, number>;
  expiresAt: string;
  status: "pending" | "approved" | "rejected" | "expired" | "superseded";
  decidedAt?: string;
}

export interface AIExecutionRecord {
  id: string;
  proposalId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface FocusState {
  sessionId?: string;
  running: boolean;
  startedAt?: number;
  elapsedBeforeStart: number;
  projectId: string;
  workItemId: string;
  scratchpad: string;
}

export interface AppState {
  workspaceId?: string;
  workspaceTimezone: string;
  areas: Area[];
  goalTemplates: GoalTemplate[];
  goals: Goal[];
  goalCriteria: GoalCriterion[];
  actions: GoalAction[];
  progressEntries: ProgressEntry[];
  recurringActionTemplates: RecurringActionTemplate[];
  knowledgeLinks: KnowledgeLink[];
  projects: Project[];
  checkpoints: Checkpoint[];
  inbox: InboxItem[];
  evidence: LearningEvidence[];
  learningGoals: LearningGoal[];
  knowledge: KnowledgeItem[];
  reviews: ReviewRecord[];
  aiProposals: AIProposalRecord[];
  aiExecutions: AIExecutionRecord[];
  focusSessions: FocusSessionRecord[];
  focus: FocusState;
  aiProposal: "pending" | "approved" | "rejected";
  aiProposalId?: string;
  reviewCompletedAt?: string;
}
