import type { ActionStatus, AppState, CommitmentStatus, FocusEndReason, GoalKind, InboxStatus, KnowledgeKind, Project, RecurringActionTemplate, Visibility, WorkItemStatus } from "./types";

function normalizeKnowledgeSourceUrl(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("invalid_knowledge_source_url");
  }
  return normalized;
}

export type InboxTriageIntent =
  | { kind: "goal"; goalId: string; actionId?: string; title: string; outcome: string; firstActionTitle?: string }
  | { kind: "action"; actionId: string; title: string; detail?: string; goalId?: string; areaId?: string; pinnedToToday?: boolean }
  | { kind: "knowledge"; knowledgeId: string; linkId?: string; knowledgeKind: KnowledgeKind; title: string; detail: string; goalId?: string; sourceUrl?: string };

export type DomainCommand = {
  type: "triage_inbox_intent";
  inboxItemId: string;
  intent: InboxTriageIntent;
  decidedAt: string;
} | {
  type: "create_goal";
  goalId: string;
  actionId?: string;
  title: string;
  outcome: string;
  firstActionTitle?: string;
  firstActionDetail?: string;
  kind: GoalKind;
  areaId?: string;
  templateId?: string;
  criteria?: Array<{ id: string; title: string; completed: boolean }>;
  createdAt: string;
} | {
  type: "update_goal";
  goalId: string;
  title?: string;
  outcome?: string;
  areaId?: string | null;
  priority?: "low" | "normal" | "high";
  targetDate?: string | null;
  criteria?: Array<{ id: string; title: string; completed: boolean }>;
  changedAt: string;
} | {
  type: "create_action";
  id: string;
  title: string;
  detail?: string;
  goalId?: string;
  areaId?: string;
  scheduledFor?: string;
  pinnedToToday?: boolean;
  createdAt: string;
} | {
  type: "set_action_status";
  actionId: string;
  status: ActionStatus;
  blocker?: string;
  changedAt: string;
} | {
  type: "set_next_action";
  goalId: string;
  actionId: string;
} | {
  type: "update_action";
  actionId: string;
  expectedVersion?: number;
  title?: string;
  detail?: string;
  scheduledFor?: string | null;
  pinnedToToday?: boolean;
  goalId?: string | null;
  areaId?: string | null;
  position?: number;
  checklist?: Array<{ id: string; title: string; completed: boolean }>;
  changedAt: string;
} | {
  type: "add_progress";
  id: string;
  goalId: string;
  kind: "note" | "decision" | "result" | "evidence" | "blocker";
  content: string;
  actionId?: string;
  knowledgeItemId?: string;
  createdAt: string;
} | {
  type: "create_area";
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
} | {
  type: "update_area";
  areaId: string;
  name?: string;
  description?: string;
  changedAt: string;
} | {
  type: "create_goal_template";
  id: string;
  name: string;
  kind: GoalKind;
  outcomePrompt?: string;
  criterionPrompt?: string;
  defaultActions?: Array<{ title: string; detail?: string }>;
  createdAt: string;
} | {
  type: "update_goal_template";
  templateId: string;
  name?: string;
  kind?: GoalKind;
  defaultActions?: Array<{ title: string; detail?: string }>;
  changedAt: string;
} | {
  type: "set_goal_status";
  goalId: string;
  status: "active" | "paused" | "achieved" | "abandoned";
  reason?: string;
  progressId?: string;
  progressContent?: string;
  changedAt: string;
} | {
  type: "set_goal_visibility";
  goalId: string;
  visibility: Visibility;
  changedAt: string;
} | {
  type: "set_area_visibility";
  areaId: string;
  visibility: Visibility;
  changedAt: string;
} | {
  type: "set_goal_template_visibility";
  templateId: string;
  visibility: Visibility;
  changedAt: string;
} | {
  type: "set_recurring_status";
  templateId: string;
  status: "active" | "paused" | "archived";
  changedAt: string;
} | {
  type: "create_recurring_template";
  template: RecurringActionTemplate;
} | {
  type: "update_recurring_template";
  templateId: string;
  changes: Partial<Pick<RecurringActionTemplate, "title" | "detail" | "goalId" | "areaId" | "timezone" | "startsOn" | "rule" | "missedPolicy" | "checklist">>;
  updateFutureActions: boolean;
  effectiveFrom: string;
  changedAt: string;
} | {
  type: "link_knowledge";
  id: string;
  knowledgeItemId: string;
  areaId?: string;
  goalId?: string;
  actionId?: string;
  recurringTemplateId?: string;
  meaning: "material" | "result" | "decision" | "reference";
  createdAt: string;
} | {
  type: "unlink_knowledge";
  linkId: string;
} | {
  type: "create_project";
  id: string;
  title: string;
  outcome: string;
  technology: string;
  firstWorkItem: { id: string; title: string; detail: string };
  effortBudgetMinutes?: number;
  wipOverrideReason?: string;
} | {
  type: "triage_inbox";
  inboxItemId: string;
  target: KnowledgeKind;
  targetId: string;
  title: string;
  detail: string;
  decidedAt: string;
  projectId?: string;
} | {
  type: "update_checkpoint";
  checkpointId: string;
  currentState: string;
  nextAction: string;
  updatedAt: string;
  branch?: string;
  file?: string;
  sourceUrl?: string;
  blocker?: string;
  note?: string;
} | {
  type: "promote_scratchpad";
  sessionId: string;
  target: "note" | "decision" | "inbox";
  targetId: string;
  title: string;
  content: string;
  createdAt: string;
} | {
  type: "set_visibility";
  entityType: "project" | "knowledge";
  entityId: string;
  visibility: "active" | "archived" | "trashed";
  changedAt: string;
} | {
  type: "set_learning_goal_status";
  goalId: string;
  status: "draft" | "shaped" | "achieved" | "abandoned";
  reason?: string;
  changedAt?: string;
} | {
  type: "complete_review";
  reviewId: string;
  reviewType: "daily" | "weekly";
  templateVersion: number;
  answers: Record<string, string>;
  summary: string;
  completedAt: string;
} | {
  type: "decide_ai_proposal";
  proposalId: string;
  decision: "approved" | "rejected";
  executionId?: string;
  decidedAt: string;
} | {
  type: "set_inbox_status";
  inboxItemId: string;
  status: InboxStatus;
  changedAt: string;
  snoozedUntil?: string;
} | {
  type: "create_knowledge";
  id: string;
  kind: KnowledgeKind;
  title: string;
  detail: string;
  createdAt: string;
  projectId?: string;
  sourceUrl?: string;
  sourceInboxItemId?: string;
} | {
  type: "update_knowledge";
  knowledgeId: string;
  kind?: KnowledgeKind;
  title?: string;
  detail?: string;
  sourceUrl?: string | null;
  goalLinks?: Array<{ id: string; goalId: string }>;
  changedAt: string;
} | {
  type: "set_ai_execution_status";
  executionId: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  changedAt: string;
  error?: string;
} | {
  type: "set_commitment_status";
  projectId: string;
  status: CommitmentStatus;
} | {
  type: "set_primary_commitment";
  projectId: string;
} | {
  type: "set_work_item_status";
  projectId: string;
  workItemId: string;
  status: WorkItemStatus;
  blocker?: string;
} | {
  type: "start_focus";
  sessionId: string;
  projectId: string;
  workItemId: string;
  startedAt: string;
} | {
  type: "end_focus";
  sessionId: string;
  checkpointId?: string;
  reason: FocusEndReason;
  currentState?: string;
  nextAction?: string;
  endedAt: string;
  branch?: string;
  file?: string;
  sourceUrl?: string;
  blocker?: string;
  note?: string;
};

function initials(title: string) {
  return title.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function executeDomainCommand(state: AppState, command: DomainCommand): AppState {
  if (command.type === "update_recurring_template") {
    const template = state.recurringActionTemplates.find((item) => item.id === command.templateId);
    if (!template) throw new Error("recurring_template_not_found");
    if (command.changes.title !== undefined && !command.changes.title.trim()) throw new Error("recurring_title_required");
    const updated = {
      ...template,
      ...command.changes,
      title: command.changes.title?.trim() ?? template.title,
      detail: command.changes.detail?.trim() ?? template.detail,
      updatedAt: command.changedAt
    };
    const actions = command.updateFutureActions ? state.actions.map((action) => {
      const editable = action.recurringTemplateId === template.id && Boolean(action.occurrenceDate && action.occurrenceDate >= command.effectiveFrom) && !["completed", "skipped", "cancelled"].includes(action.status);
      return editable ? {
        ...action,
        title: updated.title,
        detail: updated.detail,
        goalId: updated.goalId,
        areaId: updated.areaId,
        checklist: updated.checklist.map((item, index) => ({ id: `${action.id}-check-${index}`, title: item.title, completed: false })),
        version: action.version + 1,
        updatedAt: command.changedAt
      } : action;
    }) : state.actions;
    return { ...state, recurringActionTemplates: state.recurringActionTemplates.map((item) => item.id === template.id ? updated : item), actions };
  }

  if (command.type === "set_goal_status") {
    if (!state.goals.some((goal) => goal.id === command.goalId)) throw new Error("goal_not_found");
    if (command.status === "abandoned" && !command.reason?.trim()) throw new Error("goal_abandon_reason_required");
    const progressEntries = command.progressId && command.progressContent?.trim() && !state.progressEntries.some((entry) => entry.id === command.progressId) ? [{
      id: command.progressId, goalId: command.goalId, kind: "decision" as const,
      content: command.progressContent.trim(), createdAt: command.changedAt
    }, ...state.progressEntries] : state.progressEntries;
    return { ...state, goals: state.goals.map((goal) => goal.id === command.goalId ? { ...goal, status: command.status, updatedAt: command.changedAt } : goal), progressEntries };
  }

  if (command.type === "update_area") {
    const area = state.areas.find((item) => item.id === command.areaId);
    if (!area) throw new Error("area_not_found");
    if (command.name !== undefined && !command.name.trim()) throw new Error("area_name_required");
    return { ...state, areas: state.areas.map((item) => item.id === area.id ? { ...item, name: command.name?.trim() ?? item.name, description: command.description?.trim() ?? item.description, updatedAt: command.changedAt } : item) };
  }

  if (command.type === "update_goal_template") {
    const template = state.goalTemplates.find((item) => item.id === command.templateId);
    if (!template) throw new Error("goal_template_not_found");
    if (template.system) throw new Error("system_template_is_immutable");
    if (command.name !== undefined && !command.name.trim()) throw new Error("template_name_required");
    return { ...state, goalTemplates: state.goalTemplates.map((item) => item.id === template.id ? {
      ...item,
      name: command.name?.trim() ?? item.name,
      kind: command.kind ?? item.kind,
      defaultActions: command.defaultActions?.filter((action) => action.title.trim()).map((action) => ({ title: action.title.trim(), detail: action.detail?.trim() })) ?? item.defaultActions,
      updatedAt: command.changedAt
    } : item) };
  }

  if (command.type === "triage_inbox_intent") {
    const source = state.inbox.find((item) => item.id === command.inboxItemId);
    if (!source) throw new Error("inbox_item_not_found");
    const targetId = command.intent.kind === "goal" ? command.intent.goalId : command.intent.kind === "action" ? command.intent.actionId : command.intent.knowledgeId;
    if (source.status === "resolved" && source.resolvedToIds?.includes(targetId)) return state;
    if (source.status !== "unprocessed") throw new Error("inbox_item_not_available");
    let next = state;
    if (command.intent.kind === "goal") next = executeDomainCommand(next, {
      type: "create_goal", goalId: command.intent.goalId, actionId: command.intent.actionId,
      title: command.intent.title, outcome: command.intent.outcome, firstActionTitle: command.intent.firstActionTitle,
      kind: "custom", createdAt: command.decidedAt
    });
    if (command.intent.kind === "action") next = executeDomainCommand(next, {
      type: "create_action", id: command.intent.actionId, title: command.intent.title, detail: command.intent.detail,
      goalId: command.intent.goalId, areaId: command.intent.areaId, pinnedToToday: command.intent.pinnedToToday, createdAt: command.decidedAt
    });
    if (command.intent.kind === "knowledge") {
      next = executeDomainCommand(next, {
        type: "create_knowledge", id: command.intent.knowledgeId, kind: command.intent.knowledgeKind,
        title: command.intent.title, detail: command.intent.detail, sourceUrl: command.intent.sourceUrl,
        sourceInboxItemId: source.id,
        createdAt: command.decidedAt
      });
      if (command.intent.goalId) next = executeDomainCommand(next, {
        type: "link_knowledge", id: command.intent.linkId ?? `${command.intent.knowledgeId}-${command.intent.goalId}`,
        knowledgeItemId: command.intent.knowledgeId, goalId: command.intent.goalId, meaning: command.intent.knowledgeKind === "decision" ? "decision" : command.intent.knowledgeKind === "artifact" ? "result" : "material", createdAt: command.decidedAt
      });
    }
    return { ...next, inbox: next.inbox.map((item) => item.id === source.id ? { ...item, status: "resolved", resolvedToIds: [...(item.resolvedToIds ?? []), targetId], snoozedUntil: undefined } : item) };
  }

  if (command.type === "set_recurring_status") {
    if (!state.recurringActionTemplates.some((template) => template.id === command.templateId)) throw new Error("recurring_template_not_found");
    return { ...state, recurringActionTemplates: state.recurringActionTemplates.map((template) => template.id === command.templateId ? { ...template, status: command.status, updatedAt: command.changedAt } : template) };
  }

  if (command.type === "set_goal_template_visibility") {
    const template = state.goalTemplates.find((item) => item.id === command.templateId);
    if (!template) throw new Error("goal_template_not_found");
    if (template.system) throw new Error("system_template_is_immutable");
    return { ...state, goalTemplates: state.goalTemplates.map((item) => item.id === command.templateId ? { ...item, visibility: command.visibility, updatedAt: command.changedAt } : item) };
  }

  if (command.type === "set_area_visibility") {
    if (!state.areas.some((area) => area.id === command.areaId)) throw new Error("area_not_found");
    return { ...state, areas: state.areas.map((area) => area.id === command.areaId ? { ...area, visibility: command.visibility, updatedAt: command.changedAt } : area) };
  }

  if (command.type === "unlink_knowledge") {
    return { ...state, knowledgeLinks: state.knowledgeLinks.filter((link) => link.id !== command.linkId) };
  }

  if (command.type === "link_knowledge") {
    if (!state.knowledge.some((item) => item.id === command.knowledgeItemId)) throw new Error("knowledge_item_not_found");
    if ([command.areaId, command.goalId, command.actionId, command.recurringTemplateId].filter(Boolean).length !== 1) throw new Error("knowledge_link_target_required");
    const duplicate = state.knowledgeLinks.some((link) => link.knowledgeItemId === command.knowledgeItemId
      && link.areaId === command.areaId && link.goalId === command.goalId && link.actionId === command.actionId
      && link.recurringTemplateId === command.recurringTemplateId && link.meaning === command.meaning);
    if (duplicate) return state;
    return { ...state, knowledgeLinks: [...state.knowledgeLinks, {
      id: command.id,
      knowledgeItemId: command.knowledgeItemId,
      areaId: command.areaId,
      goalId: command.goalId,
      actionId: command.actionId,
      recurringTemplateId: command.recurringTemplateId,
      meaning: command.meaning,
      createdAt: command.createdAt
    }] };
  }

  if (command.type === "create_recurring_template") {
    if (!command.template.title.trim()) throw new Error("recurring_title_required");
    if (command.template.rule.interval < 1) throw new Error("recurring_interval_invalid");
    if (state.recurringActionTemplates.some((item) => item.id === command.template.id)) return state;
    return { ...state, recurringActionTemplates: [...state.recurringActionTemplates, structuredClone(command.template)] };
  }

  if (command.type === "set_goal_visibility") {
    if (!state.goals.some((goal) => goal.id === command.goalId)) throw new Error("goal_not_found");
    return { ...state, goals: state.goals.map((goal) => goal.id === command.goalId ? { ...goal, visibility: command.visibility, updatedAt: command.changedAt } : goal) };
  }

  if (command.type === "create_goal_template") {
    const name = command.name.trim();
    if (!name) throw new Error("goal_template_name_required");
    if (state.goalTemplates.some((template) => template.id === command.id)) return state;
    return { ...state, goalTemplates: [...state.goalTemplates, {
      id: command.id,
      name,
      kind: command.kind,
      outcomePrompt: command.outcomePrompt?.trim() || "Co chcesz osiągnąć?",
      criterionPrompt: command.criterionPrompt?.trim() || undefined,
      defaultActions: (command.defaultActions ?? []).map((action) => ({ title: action.title.trim(), detail: action.detail?.trim() })).filter((action) => action.title),
      system: false,
      visibility: "active",
      createdAt: command.createdAt,
      updatedAt: command.createdAt
    }] };
  }

  if (command.type === "create_area") {
    const name = command.name.trim();
    if (!name) throw new Error("area_name_required");
    if (state.areas.some((area) => area.id === command.id)) return state;
    return { ...state, areas: [...state.areas, {
      id: command.id,
      name,
      description: command.description?.trim() || undefined,
      color: command.color,
      visibility: "active",
      createdAt: command.createdAt,
      updatedAt: command.createdAt
    }] };
  }

  if (command.type === "add_progress") {
    const content = command.content.trim();
    if (!state.goals.some((goal) => goal.id === command.goalId)) throw new Error("goal_not_found");
    if (!content) throw new Error("progress_content_required");
    if (state.progressEntries.some((entry) => entry.id === command.id)) return state;
    return { ...state, progressEntries: [{
      id: command.id,
      goalId: command.goalId,
      kind: command.kind,
      content,
      actionId: command.actionId,
      knowledgeItemId: command.knowledgeItemId,
      createdAt: command.createdAt
    }, ...state.progressEntries] };
  }

  if (command.type === "update_action") {
    const action = state.actions.find((item) => item.id === command.actionId);
    if (!action) throw new Error("action_not_found");
    if (command.expectedVersion !== undefined && action.version !== command.expectedVersion) throw new Error("action_version_conflict");
    if (command.title !== undefined && !command.title.trim()) throw new Error("action_title_required");
    return { ...state, actions: state.actions.map((item) => item.id === command.actionId ? {
      ...item,
      title: command.title?.trim() ?? item.title,
      detail: command.detail?.trim() ?? item.detail,
      scheduledFor: command.scheduledFor === null ? undefined : command.scheduledFor ?? item.scheduledFor,
      pinnedToToday: command.pinnedToToday ?? item.pinnedToToday,
      goalId: command.goalId === null ? undefined : command.goalId ?? item.goalId,
      areaId: command.areaId === null ? undefined : command.areaId ?? item.areaId,
      position: command.position ?? item.position,
      checklist: command.checklist ?? item.checklist,
      version: item.version + 1,
      updatedAt: command.changedAt
    } : item) };
  }

  if (command.type === "set_next_action") {
    const target = state.actions.find((action) => action.id === command.actionId && action.goalId === command.goalId);
    if (!target || !["ready", "in_progress"].includes(target.status)) throw new Error("next_action_not_ready");
    return { ...state, actions: state.actions.map((action) => action.goalId === command.goalId ? { ...action, isNext: action.id === command.actionId } : action) };
  }

  if (command.type === "set_action_status") {
    const action = state.actions.find((item) => item.id === command.actionId);
    if (!action) throw new Error("action_not_found");
    const blocker = command.blocker?.trim();
    if (command.status === "blocked" && !blocker) throw new Error("action_blocker_required");
    if (action.status === command.status && (command.status !== "blocked" || action.blocker === blocker)) return state;
    return {
      ...state,
      actions: state.actions.map((item) => item.id === command.actionId ? {
        ...item,
        status: command.status,
        blocker: command.status === "blocked" ? blocker : undefined,
        completedAt: command.status === "completed" ? command.changedAt : undefined,
        skippedAt: command.status === "skipped" ? command.changedAt : undefined,
        cancelledAt: command.status === "cancelled" ? command.changedAt : undefined,
        isNext: ["ready", "in_progress"].includes(command.status) ? item.isNext : false,
        version: item.version + 1,
        updatedAt: command.changedAt
      } : item),
      progressEntries: action.goalId && (command.status === "blocked" || action.status === "blocked") ? [{
        id: `${command.actionId}-${command.changedAt}`,
        goalId: action.goalId,
        actionId: action.id,
        kind: "blocker",
        content: command.status === "blocked" ? `Zablokowano: ${blocker}` : `Odblokowano. Poprzedni powód: ${action.blocker ?? "brak"}`,
        createdAt: command.changedAt
      }, ...state.progressEntries] : state.progressEntries
    };
  }

  if (command.type === "create_action") {
    const title = command.title.trim();
    if (!title) throw new Error("action_title_required");
    if (command.goalId && !state.goals.some((goal) => goal.id === command.goalId)) throw new Error("goal_not_found");
    if (state.actions.some((action) => action.id === command.id)) return state;
    const position = state.actions.filter((action) => action.goalId === command.goalId).length;
    return { ...state, actions: [...state.actions, {
      id: command.id,
      version: 1,
      title,
      detail: command.detail?.trim() ?? "",
      goalId: command.goalId,
      areaId: command.areaId,
      status: "ready",
      position,
      isNext: Boolean(command.goalId && !state.actions.some((action) => action.goalId === command.goalId && action.isNext && ["ready", "in_progress"].includes(action.status))),
      pinnedToToday: command.pinnedToToday ?? false,
      scheduledFor: command.scheduledFor,
      checklist: [],
      createdAt: command.createdAt,
      updatedAt: command.createdAt
    }] };
  }

  if (command.type === "create_goal") {
    const title = command.title.trim();
    const outcome = command.outcome.trim();
    const firstActionTitle = command.firstActionTitle?.trim();
    if (!title) throw new Error("goal_title_required");
    if (!outcome) throw new Error("goal_outcome_required");
    if (firstActionTitle && !command.actionId) throw new Error("action_id_required");
    const existing = state.goals.find((goal) => goal.id === command.goalId);
    if (existing) {
      if (existing.title === title && existing.outcome === outcome) return state;
      throw new Error("goal_id_conflict");
    }
    if (command.actionId && state.actions.some((action) => action.id === command.actionId)) throw new Error("action_id_conflict");

    return {
      ...state,
      goals: [...state.goals, {
        id: command.goalId,
        title,
        outcome,
        kind: command.kind,
        status: "active",
        visibility: "active",
        priority: "normal",
        areaId: command.areaId,
        templateId: command.templateId,
        createdAt: command.createdAt,
        updatedAt: command.createdAt
      }],
      goalCriteria: [...state.goalCriteria, ...(command.criteria ?? []).filter((criterion) => criterion.title.trim()).map((criterion) => ({ ...criterion, goalId: command.goalId, title: criterion.title.trim() }))],
      actions: firstActionTitle ? [...state.actions, {
        id: command.actionId!,
        version: 1,
        title: firstActionTitle,
        detail: command.firstActionDetail?.trim() ?? "",
        goalId: command.goalId,
        areaId: command.areaId,
        status: "ready",
        position: 0,
        isNext: true,
        pinnedToToday: false,
        checklist: [],
        createdAt: command.createdAt,
        updatedAt: command.createdAt
      }] : state.actions
    };
  }

  if (command.type === "update_goal") {
    const goal = state.goals.find((candidate) => candidate.id === command.goalId);
    if (!goal) throw new Error("goal_not_found");
    if (command.title !== undefined && !command.title.trim()) throw new Error("goal_title_required");
    if (command.outcome !== undefined && !command.outcome.trim()) throw new Error("goal_outcome_required");
    return { ...state,
      goals: state.goals.map((candidate) => candidate.id === goal.id ? { ...candidate, title: command.title?.trim() ?? candidate.title, outcome: command.outcome?.trim() ?? candidate.outcome, areaId: command.areaId === null ? undefined : command.areaId ?? candidate.areaId, priority: command.priority ?? candidate.priority, targetDate: command.targetDate === null ? undefined : command.targetDate ?? candidate.targetDate, updatedAt: command.changedAt } : candidate),
      goalCriteria: command.criteria ? [...state.goalCriteria.filter((criterion) => criterion.goalId !== goal.id), ...command.criteria.filter((criterion) => criterion.title.trim()).map((criterion) => ({ ...criterion, goalId: goal.id, title: criterion.title.trim() }))] : state.goalCriteria
    };
  }

  if (command.type === "set_ai_execution_status") {
    const execution = state.aiExecutions.find((item) => item.id === command.executionId);
    if (!execution) throw new Error("ai_execution_not_found");
    const proposal = state.aiProposals.find((item) => item.id === execution.proposalId);
    if (!proposal || proposal.status !== "approved") throw new Error("ai_proposal_not_approved");
    const allowed = execution.status === "queued" ? ["running", "cancelled"] : execution.status === "running" ? ["succeeded", "failed", "cancelled"] : [];
    if (!allowed.includes(command.status)) throw new Error("ai_execution_invalid_transition");
    const completed = ["succeeded", "failed", "cancelled"].includes(command.status);
    return {
      ...state,
      aiExecutions: state.aiExecutions.map((item) => item.id === execution.id ? {
        ...item,
        status: command.status,
        completedAt: completed ? command.changedAt : undefined,
        error: command.status === "failed" ? command.error?.trim() || "Nieznany błąd wykonania" : undefined
      } : item)
    };
  }

  if (command.type === "create_knowledge") {
    const title = command.title.trim();
    if (!title) throw new Error("knowledge_title_required");
    const sourceUrl = normalizeKnowledgeSourceUrl(command.sourceUrl);
    return {
      ...state,
      knowledge: [{
        id: command.id,
        type: command.kind,
        title,
        detail: command.detail.trim(),
        projectId: command.projectId,
        sourceUrl,
        sourceInboxItemId: command.sourceInboxItemId,
        status: command.kind === "investigation" ? "shaped" : undefined,
        question: command.kind === "investigation" ? title : undefined,
        createdAt: command.createdAt,
        updatedAt: command.createdAt
      }, ...state.knowledge]
    };
  }

  if (command.type === "update_knowledge") {
    const item = state.knowledge.find((candidate) => candidate.id === command.knowledgeId);
    if (!item) throw new Error("knowledge_not_found");
    if (command.title !== undefined && !command.title.trim()) throw new Error("knowledge_title_required");
    const knowledge = state.knowledge.map((candidate) => candidate.id === command.knowledgeId ? {
      ...candidate,
      type: command.kind ?? candidate.type,
      title: command.title?.trim() ?? candidate.title,
      detail: command.detail?.trim() ?? candidate.detail,
      sourceUrl: command.sourceUrl === null ? undefined : command.sourceUrl !== undefined ? normalizeKnowledgeSourceUrl(command.sourceUrl) : candidate.sourceUrl,
      updatedAt: command.changedAt
    } : candidate);
    const knowledgeLinks = command.goalLinks === undefined ? state.knowledgeLinks : [
      ...state.knowledgeLinks.filter((link) => link.knowledgeItemId !== command.knowledgeId || !link.goalId),
      ...command.goalLinks.map((link) => ({
        id: link.id,
        knowledgeItemId: command.knowledgeId,
        goalId: link.goalId,
        meaning: (command.kind ?? item.type) === "decision" ? "decision" as const : (command.kind ?? item.type) === "artifact" ? "result" as const : "reference" as const,
        createdAt: command.changedAt
      }))
    ];
    return { ...state, knowledge, knowledgeLinks };
  }

  if (command.type === "set_inbox_status") {
    if (!state.inbox.some((item) => item.id === command.inboxItemId)) throw new Error("inbox_item_not_found");
    if (command.status === "snoozed" && !command.snoozedUntil) throw new Error("snooze_date_required");
    return {
      ...state,
      inbox: state.inbox.map((item) => item.id === command.inboxItemId ? {
        ...item,
        status: command.status,
        snoozedUntil: command.status === "snoozed" ? command.snoozedUntil : undefined,
        discardedAt: command.status === "discarded" ? command.changedAt : undefined
      } : item)
    };
  }

  if (command.type === "decide_ai_proposal") {
    const proposal = state.aiProposals.find((item) => item.id === command.proposalId);
    if (!proposal) throw new Error("ai_proposal_not_found");
    if (proposal.status !== "pending") throw new Error("ai_proposal_not_pending");
    if (new Date(proposal.expiresAt).getTime() <= new Date(command.decidedAt).getTime()) {
      return { ...state, aiProposals: state.aiProposals.map((item) => item.id === proposal.id ? { ...item, status: "expired" } : item) };
    }
    if (command.decision === "approved" && !command.executionId) throw new Error("ai_execution_id_required");
    return {
      ...state,
      aiProposal: command.decision,
      aiProposals: state.aiProposals.map((item) => item.id === proposal.id ? { ...item, status: command.decision, decidedAt: command.decidedAt } : item),
      aiExecutions: command.decision === "approved" ? [...state.aiExecutions, {
        id: command.executionId!, proposalId: proposal.id, status: "queued", createdAt: command.decidedAt
      }] : state.aiExecutions
    };
  }

  if (command.type === "complete_review") {
    if (state.reviews.some((review) => review.id === command.reviewId)) return state;
    const review = {
      id: command.reviewId,
      type: command.reviewType,
      templateVersion: command.templateVersion,
      answers: structuredClone(command.answers),
      summary: command.summary.trim(),
      completedAt: command.completedAt
    };
    return { ...state, reviews: [...state.reviews, review], reviewCompletedAt: command.completedAt };
  }

  if (command.type === "set_learning_goal_status") {
    const goal = state.learningGoals.find((item) => item.id === command.goalId);
    if (!goal) throw new Error("learning_goal_not_found");
    if (command.status === "achieved") {
      const accepted = state.evidence.some((item) => item.learningGoalId === goal.id && item.result === "supports" && item.accepted);
      if (!accepted) throw new Error("accepted_supporting_evidence_required");
    }
    const reason = command.reason?.trim();
    if (command.status === "abandoned" && !reason) throw new Error("learning_goal_abandon_reason_required");
    return {
      ...state,
      learningGoals: state.learningGoals.map((item) => item.id === goal.id ? {
        ...item,
        status: command.status,
        abandonedReason: command.status === "abandoned" ? reason : undefined,
        achievedAt: command.status === "achieved" ? (command.changedAt ?? new Date().toISOString()) : item.achievedAt
      } : item)
    };
  }

  if (command.type === "set_visibility") {
    const visibility = {
      archivedAt: command.visibility === "archived" ? command.changedAt : undefined,
      trashedAt: command.visibility === "trashed" ? command.changedAt : undefined
    };
    if (command.entityType === "project") {
      if (!state.projects.some((item) => item.id === command.entityId)) throw new Error("project_not_found");
      return { ...state, projects: state.projects.map((item) => item.id === command.entityId ? { ...item, ...visibility } : item) };
    }
    if (!state.knowledge.some((item) => item.id === command.entityId)) throw new Error("knowledge_item_not_found");
    return { ...state, knowledge: state.knowledge.map((item) => item.id === command.entityId ? { ...item, ...visibility } : item) };
  }

  if (command.type === "promote_scratchpad") {
    const session = state.focusSessions.find((item) => item.id === command.sessionId);
    if (!session) throw new Error("focus_session_not_found");
    const content = command.content.trim();
    const title = command.title.trim();
    if (!content || !title) throw new Error("scratchpad_promotion_content_required");
    if (command.target === "inbox") {
      return {
        ...state,
        inbox: [{ id: command.targetId, kind: "text", content, createdAt: command.createdAt, status: "unprocessed", source: `focus:${session.id}` }, ...state.inbox]
      };
    }
    return {
      ...state,
      knowledge: [{
        id: command.targetId,
        type: command.target,
        title,
        detail: content,
        sourceSessionId: session.id,
        projectId: session.projectId,
        createdAt: command.createdAt,
        updatedAt: command.createdAt
      }, ...state.knowledge]
    };
  }

  if (command.type === "update_checkpoint") {
    const checkpoint = state.checkpoints.find((item) => item.id === command.checkpointId);
    if (!checkpoint) throw new Error("checkpoint_not_found");
    if (checkpoint.lockedAt) throw new Error("checkpoint_locked");
    const currentState = command.currentState.trim();
    const nextAction = command.nextAction.trim();
    if (!currentState || !nextAction) throw new Error("checkpoint_required");
    return {
      ...state,
      checkpoints: state.checkpoints.map((item) => item.id === command.checkpointId ? {
        ...item,
        currentState,
        nextAction,
        branch: command.branch?.trim() || undefined,
        file: command.file?.trim() || undefined,
        sourceUrl: command.sourceUrl?.trim() || undefined,
        blocker: command.blocker?.trim() || undefined,
        note: command.note?.trim() || undefined,
        updatedAt: command.updatedAt
      } : item)
    };
  }

  if (command.type === "triage_inbox") {
    const source = state.inbox.find((item) => item.id === command.inboxItemId);
    if (!source) throw new Error("inbox_item_not_found");
    const title = command.title.trim();
    if (!title) throw new Error("triage_title_required");
    const target = {
      id: command.targetId,
      type: command.target,
      title,
      detail: command.detail.trim(),
      sourceInboxItemId: source.id,
      sourceUrl: source.kind === "link" ? source.content : undefined,
      projectId: command.projectId,
      status: command.target === "investigation" ? "shaped" as const : undefined,
      question: command.target === "investigation" ? title : undefined,
      createdAt: command.decidedAt,
      updatedAt: command.decidedAt
    };
    return {
      ...state,
      inbox: state.inbox.map((item) => item.id === source.id ? {
        ...item,
        status: "resolved",
        snoozedUntil: undefined,
        resolvedToIds: [...(item.resolvedToIds ?? []), command.targetId]
      } : item),
      knowledge: [target, ...state.knowledge]
    };
  }

  if (command.type === "start_focus") {
    if (state.focus.running) throw new Error("focus_session_already_running");
    const project = state.projects.find((item) => item.id === command.projectId);
    const workItem = project?.workItems.find((item) => item.id === command.workItemId);
    if (!project || !workItem) throw new Error("focus_work_item_not_found");
    const startedAt = new Date(command.startedAt).getTime();
    return {
      ...state,
      checkpoints: state.checkpoints.map((checkpoint) => checkpoint.workItemId === command.workItemId && !checkpoint.lockedAt
        ? { ...checkpoint, lockedAt: command.startedAt }
        : checkpoint),
      projects: state.projects.map((item) => item.id === command.projectId ? {
        ...item,
        workItems: item.workItems.map((candidate) => candidate.id === command.workItemId && (candidate.status ?? "open") === "open"
          ? { ...candidate, status: "in_progress" }
          : candidate)
      } : item),
      focusSessions: [...state.focusSessions, {
        id: command.sessionId,
        projectId: command.projectId,
        workItemId: command.workItemId,
        startedAt: command.startedAt,
        scratchpad: ""
      }],
      focus: {
        sessionId: command.sessionId,
        running: true,
        startedAt,
        elapsedBeforeStart: 0,
        projectId: command.projectId,
        workItemId: command.workItemId,
        scratchpad: ""
      }
    };
  }

  if (command.type === "end_focus") {
    const session = state.focusSessions.find((item) => item.id === command.sessionId);
    if (!session) throw new Error("focus_session_not_found");
    if (session.endedAt) return state;
    const currentState = command.currentState?.trim();
    const nextAction = command.nextAction?.trim();
    if (command.reason !== "work_item_completed" && (!currentState || !nextAction)) throw new Error("checkpoint_required");
    const project = state.projects.find((item) => item.id === session.projectId);
    const workItem = project?.workItems.find((item) => item.id === session.workItemId);
    const elapsedMinutes = Math.max(0, Math.floor((new Date(command.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000));
    const checkpointExists = state.checkpoints.some((checkpoint) => checkpoint.sessionId === session.id);
    const checkpoint = command.reason !== "work_item_completed" && !checkpointExists ? {
      id: command.checkpointId ?? crypto.randomUUID(),
      projectId: session.projectId,
      workItemId: session.workItemId,
      sessionId: session.id,
      title: `Checkpoint: ${workItem?.title ?? "praca"}`,
      currentState: currentState!,
      nextAction: nextAction!,
      branch: command.branch?.trim() || undefined,
      file: command.file?.trim() || undefined,
      sourceUrl: command.sourceUrl?.trim() || undefined,
      blocker: command.blocker?.trim() || undefined,
      note: command.note?.trim() || undefined,
      createdAt: command.endedAt,
      updatedAt: command.endedAt
    } : undefined;
    return {
      ...state,
      checkpoints: checkpoint ? [checkpoint, ...state.checkpoints] : state.checkpoints,
      focusSessions: state.focusSessions.map((item) => item.id === session.id ? {
        ...item,
        endedAt: command.endedAt,
        endReason: command.reason,
        scratchpad: state.focus.scratchpad
      } : item),
      projects: state.projects.map((item) => item.id === session.projectId ? {
        ...item,
        usedMinutes: item.usedMinutes + elapsedMinutes,
        workItems: item.workItems.map((candidate) => candidate.id === session.workItemId && command.reason === "work_item_completed"
          ? { ...candidate, status: "completed", completed: true, blocker: undefined }
          : candidate)
      } : item),
      focus: {
        ...state.focus,
        running: false,
        startedAt: undefined,
        elapsedBeforeStart: state.focus.elapsedBeforeStart + elapsedMinutes * 60
      }
    };
  }

  if (command.type === "set_work_item_status") {
    return {
      ...state,
      projects: state.projects.map((project) => {
        if (project.id !== command.projectId) return project;
        const workItems = project.workItems.map((workItem) => workItem.id === command.workItemId ? {
          ...workItem,
          status: command.status,
          completed: command.status === "completed",
          blocker: command.status === "blocked" ? command.blocker?.trim() : undefined
        } : workItem);
        const blocker = workItems.find((workItem) => workItem.status === "blocked")?.blocker;
        const next = workItems.find((workItem) => ["in_progress", "open", "blocked"].includes(workItem.status ?? (workItem.completed ? "completed" : "open")));
        return {
          ...project,
          workItems,
          blocker,
          status: blocker ? "Zagrożony" : "W trakcie",
          nextStep: next?.title ?? "Zdefiniuj następny fizyczny krok"
        };
      })
    };
  }

  if (command.type === "set_primary_commitment") {
    const target = state.projects.find((project) => project.id === command.projectId);
    if (!target || target.commitmentStatus !== "active") return state;
    return {
      ...state,
      projects: state.projects.map((project) => ({ ...project, primary: project.id === command.projectId }))
    };
  }

  if (command.type === "set_commitment_status") {
    const projects = state.projects.map((project) => project.id === command.projectId
      ? { ...project, commitmentStatus: command.status, primary: command.status === "active" ? project.primary : false }
      : project);
    if (!projects.some((project) => project.commitmentStatus === "active" && project.primary)) {
      const fallback = projects.find((project) => project.commitmentStatus === "active");
      if (fallback) fallback.primary = true;
    }
    return { ...state, projects };
  }

  const activeCommitments = state.projects.filter((project) => project.commitmentStatus === "active").length;
  const overrideReason = command.wipOverrideReason?.trim();
  if (activeCommitments >= 3 && !overrideReason) throw new Error("wip_override_reason_required");

  const project: Project = {
    id: command.id,
    name: command.title.trim(),
    initials: initials(command.title),
    color: (["violet", "orange", "amber"] as const)[state.projects.length % 3] ?? "violet",
    technology: command.technology.trim() || "Projekt developerski",
    outcome: command.outcome.trim(),
    status: "W trakcie",
    domainStatus: "shaped",
    commitmentStatus: "active",
    commitmentOverrideReason: overrideReason,
    nextStep: command.firstWorkItem.title.trim(),
    primary: activeCommitments === 0,
    effortBudgetMinutes: command.effortBudgetMinutes,
    usedMinutes: 0,
    requirements: [],
    workItems: [{
      id: command.firstWorkItem.id,
      title: command.firstWorkItem.title.trim(),
      detail: command.firstWorkItem.detail.trim(),
      completed: false,
      status: "open"
    }]
  };

  return {
    ...state,
    projects: [...state.projects, project],
    focus: activeCommitments === 0
      ? { ...state.focus, projectId: project.id, workItemId: project.workItems[0]!.id }
      : state.focus
  };
}
