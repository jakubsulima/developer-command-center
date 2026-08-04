import type { AppState, CommitmentStatus, FocusEndReason, InboxStatus, KnowledgeKind, Project, WorkItemStatus } from "./types";

export type DomainCommand = {
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
    return {
      ...state,
      knowledge: [{
        id: command.id,
        type: command.kind,
        title,
        detail: command.detail.trim(),
        projectId: command.projectId,
        sourceUrl: command.sourceUrl?.trim() || undefined,
        status: command.kind === "investigation" ? "shaped" : undefined,
        question: command.kind === "investigation" ? title : undefined,
        createdAt: command.createdAt,
        updatedAt: command.createdAt
      }, ...state.knowledge]
    };
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
