import type { ActionStatus, AppState, GoalKind, InboxItem, InboxKind, KnowledgeKind, NewLearningGoalInput, NewProjectInput, Project, ProjectStatus, RecurringActionTemplate } from "../domain/types";
import type { NewActionInput, NewGoalInput, NewRecurringActionInput } from "../app/store-context";
import type { InboxTriageIntent } from "../domain/commands";
import { ensureGoalModel } from "../domain/goals";
import { getSupabase } from "../lib/supabase";
import { emptyState } from "./empty";

interface EntityRow { id: string; type: string; title: string; archived_at: string | null; trashed_at: string | null }
interface ProjectRow { entity_id: string; outcome: string; constraints_md: string; status: string }
interface RequirementRow { entity_id: string; project_id: string; description: string; status: string }
interface CommitmentRow { id: string; target_entity_id: string; status: string; is_primary: boolean; effort_budget_minutes: number | null }
interface WorkItemRow { entity_id: string; primary_context_entity_id: string; description: string; status: string; blocker: string | null }
interface InboxRow { id: string; kind: InboxKind; raw_content: string; status: string; created_at: string; snoozed_until?: string | null; discarded_at?: string | null }
interface SessionRow { id: string; work_item_id: string; started_at: string; ended_at: string | null; end_reason: "paused" | "work_item_completed" | "stopped" | "interrupted" | null; scratchpad: string }
interface CheckpointRow { id: string; work_item_id: string; current_state: string; next_action: string; branch: string | null; file_path: string | null; created_at: string }
interface EvidenceRow { entity_id: string; result: "supports" | "reveals_gap" | "inconclusive"; feedback: string; criterion: string; created_at: string }
interface LearningGoalRow { entity_id: string; demonstration_criterion: string; status: "draft" | "shaped" | "achieved" | "abandoned" }
interface SkillRow { entity_id: string }
interface GoalSkillRow { learning_goal_id: string; skill_id: string }
interface ProposalRow { id: string; status: "pending" | "approved" | "rejected"; created_at: string }
interface ReviewRow { completed_at: string }
interface GoalRow { id: string; title: string; outcome: string; kind: AppState["goals"][number]["kind"]; status: AppState["goals"][number]["status"]; priority: AppState["goals"][number]["priority"]; area_id: string | null; template_id: string | null; target_date: string | null; archived_at: string | null; trashed_at: string | null; legacy_source: "project" | "learning_goal" | null; created_at: string; updated_at: string }
interface AreaRow { id: string; name: string; description: string; color: string | null; archived_at: string | null; trashed_at: string | null; created_at: string; updated_at: string }
interface GoalTemplateRow { id: string; name: string; kind: AppState["goalTemplates"][number]["kind"]; outcome_prompt: string; criterion_prompt: string | null; default_actions: Array<{ title: string; detail?: string }>; is_system: boolean; archived_at: string | null; trashed_at: string | null; created_at: string; updated_at: string }
interface GoalCriterionRow { id: string; goal_id: string; title: string; completed: boolean; legacy_source_id: string | null }
interface ActionRow { id: string; version: number; goal_id: string | null; area_id: string | null; title: string; detail: string; status: ActionStatus; blocker: string | null; position: number; is_next: boolean; pinned_to_today: boolean; scheduled_for: string | null; completed_at: string | null; skipped_at: string | null; cancelled_at: string | null; recurring_template_id: string | null; occurrence_date: string | null; checklist: AppState["actions"][number]["checklist"]; legacy_source_id: string | null; created_at: string; updated_at: string }
interface ProgressRow { id: string; goal_id: string; action_id: string | null; knowledge_entity_id: string | null; kind: AppState["progressEntries"][number]["kind"]; content: string; legacy_source: "learning_evidence" | "checkpoint" | null; legacy_source_id: string | null; created_at: string }
interface RecurringRow { id: string; title: string; detail: string; goal_id: string | null; area_id: string | null; timezone: string; starts_on: string; recurrence_rule: RecurringActionTemplate["rule"]; missed_policy: RecurringActionTemplate["missedPolicy"]; status: RecurringActionTemplate["status"]; checklist: RecurringActionTemplate["checklist"]; last_materialized_on: string | null; skipped_occurrence_count: number; created_at: string; updated_at: string }
interface KnowledgeLinkRow { id: string; knowledge_entity_id: string; target_knowledge_entity_id: string | null; area_id: string | null; goal_id: string | null; action_id: string | null; recurring_template_id: string | null; meaning: AppState["knowledgeLinks"][number]["meaning"]; created_at: string }
interface KnowledgeContentRow { entity_id: string; detail: string; source_url: string | null; source_inbox_item_id: string | null; created_at: string; updated_at: string }

function dataOrThrow<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label}: brak danych`);
  return result.data;
}

function isMissingInboxLifecycleColumn(error: { code?: string; message: string } | null) {
  return error?.code === "42703"
    && /(?:snoozed_until|discarded_at)/i.test(error.message)
    || /column inbox_items\.(?:snoozed_until|discarded_at) does not exist/i.test(error?.message ?? "");
}

async function loadInboxRows(client: ReturnType<typeof getSupabase>) {
  const currentSchema = await client
    .from("inbox_items")
    .select("id,kind,raw_content,status,created_at,snoozed_until,discarded_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (!isMissingInboxLifecycleColumn(currentSchema.error)) return currentSchema;

  // Keep Workspace readable while a deployment is briefly behind the application.
  return client
    .from("inbox_items")
    .select("id,kind,raw_content,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
}

function initials(title: string) {
  return title.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function projectStatus(project: ProjectRow, commitment: CommitmentRow | undefined, blocker?: string): ProjectStatus {
  if (blocker) return "Zagrożony";
  if (!commitment || commitment.status === "paused" || project.status === "draft") return "Gotowy do decyzji";
  return "W trakcie";
}

function constraintTechnology(value: string) {
  const match = value.match(/(?:stack|technologie):\s*([^\n]+)/i);
  return match?.[1]?.trim() || "Projekt developerski";
}

export async function loadSupabaseState(userId: string): Promise<AppState> {
  const client = getSupabase();
  const membership = dataOrThrow(
    await client.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).maybeSingle(),
    "Nie udało się odczytać Workspace"
  ) as { workspace_id: string } | null;
  if (!membership) throw new Error("Użytkownik nie ma przypisanego Workspace.");
  const workspaceId = membership.workspace_id;
  const workspace = dataOrThrow(
    await client.from("workspaces").select("timezone").eq("id", workspaceId).single(),
    "Nie udało się odczytać ustawień Workspace"
  ) as { timezone: string | null };

  const [entitiesResult, projectsResult, requirementsResult, commitmentsResult, workItemsResult, inboxResult, sessionsResult, checkpointsResult, evidenceResult, goalsResult, skillsResult, goalSkillsResult, proposalsResult, reviewsResult, unifiedGoalsResult, areasResult, templatesResult, criteriaResult, actionsResult, progressResult, recurringResult, knowledgeLinksResult, knowledgeContentsResult] = await Promise.all([
    client.from("entities").select("id,type,title,archived_at,trashed_at"),
    client.from("projects").select("entity_id,outcome,constraints_md,status"),
    client.from("requirements").select("entity_id,project_id,description,status"),
    client.from("commitments").select("id,target_entity_id,status,is_primary,effort_budget_minutes"),
    client.from("work_items").select("entity_id,primary_context_entity_id,description,status,blocker"),
    loadInboxRows(client),
    client.from("focus_sessions").select("id,work_item_id,started_at,ended_at,end_reason,scratchpad").order("started_at", { ascending: false }).limit(200),
    client.from("context_checkpoints").select("id,work_item_id,current_state,next_action,branch,file_path,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("learning_evidence").select("entity_id,result,feedback,criterion,created_at").order("created_at", { ascending: false }).limit(100),
    client.from("learning_goals").select("entity_id,demonstration_criterion,status"),
    client.from("skills").select("entity_id"),
    client.from("learning_goal_skills").select("learning_goal_id,skill_id"),
    client.from("ai_proposals").select("id,status,created_at").in("status", ["pending", "approved", "rejected"]).order("created_at", { ascending: false }).limit(1),
    client.from("reviews").select("completed_at").order("completed_at", { ascending: false }).limit(1),
    client.from("goals").select("id,title,outcome,kind,status,priority,area_id,template_id,target_date,archived_at,trashed_at,legacy_source,created_at,updated_at"),
    client.from("areas").select("id,name,description,color,archived_at,trashed_at,created_at,updated_at"),
    client.from("goal_templates").select("id,name,kind,outcome_prompt,criterion_prompt,default_actions,is_system,archived_at,trashed_at,created_at,updated_at"),
    client.from("goal_criteria").select("id,goal_id,title,completed,legacy_source_id").order("position"),
    client.from("actions").select("id,version,goal_id,area_id,title,detail,status,blocker,position,is_next,pinned_to_today,scheduled_for,completed_at,skipped_at,cancelled_at,recurring_template_id,occurrence_date,checklist,legacy_source_id,created_at,updated_at").order("position"),
    client.from("progress_entries").select("id,goal_id,action_id,knowledge_entity_id,kind,content,legacy_source,legacy_source_id,created_at").order("created_at", { ascending: false }).limit(500),
    client.from("recurring_action_templates").select("id,title,detail,goal_id,area_id,timezone,starts_on,recurrence_rule,missed_policy,status,checklist,last_materialized_on,skipped_occurrence_count,created_at,updated_at"),
    client.from("knowledge_links").select("id,knowledge_entity_id,target_knowledge_entity_id,area_id,goal_id,action_id,recurring_template_id,meaning,created_at"),
    client.from("knowledge_items").select("entity_id,detail,source_url,source_inbox_item_id,created_at,updated_at")
  ]);

  const entities = dataOrThrow(entitiesResult, "Encje") as EntityRow[];
  const projectRows = dataOrThrow(projectsResult, "Projekty") as ProjectRow[];
  const requirements = dataOrThrow(requirementsResult, "Wymagania") as RequirementRow[];
  const commitments = dataOrThrow(commitmentsResult, "Commitments") as CommitmentRow[];
  const workItems = dataOrThrow(workItemsResult, "Work items") as WorkItemRow[];
  const inboxRows = dataOrThrow(inboxResult, "Inbox") as InboxRow[];
  const sessions = dataOrThrow(sessionsResult, "Focus sessions") as SessionRow[];
  const checkpointRows = dataOrThrow(checkpointsResult, "Checkpointy") as CheckpointRow[];
  const evidenceRows = dataOrThrow(evidenceResult, "Learning evidence") as EvidenceRow[];
  const goalRows = dataOrThrow(goalsResult, "Learning goals") as LearningGoalRow[];
  const skillRows = dataOrThrow(skillsResult, "Skills") as SkillRow[];
  const goalSkillRows = dataOrThrow(goalSkillsResult, "Learning goal skills") as GoalSkillRow[];
  const proposals = dataOrThrow(proposalsResult, "AI proposals") as ProposalRow[];
  const reviews = dataOrThrow(reviewsResult, "Reviews") as ReviewRow[];
  const unifiedGoals = dataOrThrow(unifiedGoalsResult, "Cele") as GoalRow[];
  const areas = dataOrThrow(areasResult, "Obszary") as AreaRow[];
  const templates = dataOrThrow(templatesResult, "Szablony Celów") as GoalTemplateRow[];
  const criteria = dataOrThrow(criteriaResult, "Kryteria Celów") as GoalCriterionRow[];
  const actionRows = dataOrThrow(actionsResult, "Działania") as ActionRow[];
  const progressRows = dataOrThrow(progressResult, "Postęp Celów") as ProgressRow[];
  const recurringRows = dataOrThrow(recurringResult, "Działania cykliczne") as RecurringRow[];
  const knowledgeLinkRows = dataOrThrow(knowledgeLinksResult, "Powiązania Wiedzy") as KnowledgeLinkRow[];
  const knowledgeContents = dataOrThrow(knowledgeContentsResult, "Treść Wiedzy") as KnowledgeContentRow[];
  const knowledgeContentMap = new Map(knowledgeContents.map((item) => [item.entity_id, item]));
  const entityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const workItemMap = new Map(workItems.map((item) => [item.entity_id, item]));
  const colors: Project["color"][] = ["violet", "orange", "amber"];

  const projects: Project[] = projectRows.map((project, index) => {
    const entity = entityMap.get(project.entity_id);
    const commitment = commitments.find((item) => item.target_entity_id === project.entity_id);
    const projectWork = workItems.filter((item) => item.primary_context_entity_id === project.entity_id);
    const next = projectWork.find((item) => item.status === "in_progress") ?? projectWork.find((item) => item.status === "open" || item.status === "blocked");
    const blocker = projectWork.find((item) => item.blocker)?.blocker ?? undefined;
    const usedMinutes = sessions.reduce((total, session) => {
      const sessionItem = workItemMap.get(session.work_item_id);
      if (sessionItem?.primary_context_entity_id !== project.entity_id || !session.ended_at) return total;
      return total + Math.max(0, Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000));
    }, 0);
    return {
      id: project.entity_id,
      name: entity?.title ?? "Projekt bez nazwy",
      initials: initials(entity?.title ?? "Projekt"),
      color: colors[index % colors.length] ?? "violet",
      technology: constraintTechnology(project.constraints_md),
      outcome: project.outcome,
      status: projectStatus(project, commitment, blocker),
      commitmentStatus: commitment?.status as Project["commitmentStatus"],
      nextStep: next ? entityMap.get(next.entity_id)?.title ?? next.description : "Zdefiniuj następny fizyczny krok",
      blocker,
      primary: commitment?.is_primary ?? false,
      effortBudgetMinutes: commitment?.effort_budget_minutes ?? undefined,
      usedMinutes,
      archivedAt: entity?.archived_at ?? undefined,
      trashedAt: entity?.trashed_at ?? undefined,
      requirements: requirements
        .filter((item) => item.project_id === project.entity_id && ["accepted", "validated", "proposed"].includes(item.status))
        .map((item) => ({ id: item.entity_id, title: entityMap.get(item.entity_id)?.title ?? item.description, status: item.status as "accepted" | "validated" | "proposed" })),
      workItems: projectWork.map((item) => ({
        id: item.entity_id,
        title: entityMap.get(item.entity_id)?.title ?? "Work item",
        detail: item.description,
        completed: item.status === "completed"
      }))
    };
  });

  const runningSession = sessions.find((session) => !session.ended_at);
  const primaryProject = projects.find((project) => project.primary) ?? projects[0];
  const selectedWorkItem = runningSession ? workItemMap.get(runningSession.work_item_id) : workItems.find((item) => item.primary_context_entity_id === primaryProject?.id && ["open", "in_progress"].includes(item.status));
  const selectedProjectId = selectedWorkItem?.primary_context_entity_id ?? primaryProject?.id ?? "";
  const proposal = proposals[0];

  return ensureGoalModel({
    ...emptyState,
    workspaceId,
    workspaceTimezone: workspace.timezone || "Europe/Warsaw",
    areas: areas.map((area) => ({ id: area.id, name: area.name, description: area.description, color: area.color ?? undefined, visibility: area.trashed_at ? "trashed" : area.archived_at ? "archived" : "active", createdAt: area.created_at, updatedAt: area.updated_at })),
    goalTemplates: templates.map((template) => ({ id: template.id, name: template.name, kind: template.kind, outcomePrompt: template.outcome_prompt, criterionPrompt: template.criterion_prompt ?? undefined, defaultActions: template.default_actions, system: template.is_system, visibility: template.trashed_at ? "trashed" : template.archived_at ? "archived" : "active", createdAt: template.created_at, updatedAt: template.updated_at })),
    goals: unifiedGoals.map((goal) => ({ id: goal.id, title: goal.title, outcome: goal.outcome, kind: goal.kind, status: goal.status, priority: goal.priority, areaId: goal.area_id ?? undefined, templateId: goal.template_id ?? undefined, targetDate: goal.target_date ?? undefined, visibility: goal.trashed_at ? "trashed" : goal.archived_at ? "archived" : "active", legacySource: goal.legacy_source ?? undefined, createdAt: goal.created_at, updatedAt: goal.updated_at })),
    goalCriteria: criteria.map((criterion) => ({ id: criterion.id, goalId: criterion.goal_id, title: criterion.title, completed: criterion.completed, legacySourceId: criterion.legacy_source_id ?? undefined })),
    actions: actionRows.map((action) => ({ id: action.id, version: action.version, goalId: action.goal_id ?? undefined, areaId: action.area_id ?? undefined, title: action.title, detail: action.detail, status: action.status, blocker: action.blocker ?? undefined, position: action.position, isNext: action.is_next, pinnedToToday: action.pinned_to_today, scheduledFor: action.scheduled_for ?? undefined, completedAt: action.completed_at ?? undefined, skippedAt: action.skipped_at ?? undefined, cancelledAt: action.cancelled_at ?? undefined, recurringTemplateId: action.recurring_template_id ?? undefined, occurrenceDate: action.occurrence_date ?? undefined, checklist: action.checklist, legacySourceId: action.legacy_source_id ?? undefined, createdAt: action.created_at, updatedAt: action.updated_at })),
    progressEntries: progressRows.map((entry) => ({ id: entry.id, goalId: entry.goal_id, actionId: entry.action_id ?? undefined, knowledgeItemId: entry.knowledge_entity_id ?? undefined, kind: entry.kind, content: entry.content, legacySource: entry.legacy_source ?? undefined, legacySourceId: entry.legacy_source_id ?? undefined, createdAt: entry.created_at })),
    recurringActionTemplates: recurringRows.map((template) => ({ id: template.id, title: template.title, detail: template.detail, goalId: template.goal_id ?? undefined, areaId: template.area_id ?? undefined, timezone: template.timezone, startsOn: template.starts_on, rule: template.recurrence_rule, missedPolicy: template.missed_policy, status: template.status, checklist: template.checklist, lastMaterializedOn: template.last_materialized_on ?? undefined, skippedOccurrenceCount: template.skipped_occurrence_count, createdAt: template.created_at, updatedAt: template.updated_at })),
    knowledgeLinks: knowledgeLinkRows.map((link) => ({ id: link.id, knowledgeItemId: link.knowledge_entity_id, targetKnowledgeItemId: link.target_knowledge_entity_id ?? undefined, areaId: link.area_id ?? undefined, goalId: link.goal_id ?? undefined, actionId: link.action_id ?? undefined, recurringTemplateId: link.recurring_template_id ?? undefined, meaning: link.meaning, createdAt: link.created_at })),
    projects,
    inbox: inboxRows.map((item) => ({ id: item.id, kind: item.kind, content: item.raw_content, createdAt: item.created_at, status: item.status as InboxItem["status"], snoozedUntil: item.snoozed_until ?? undefined, discardedAt: item.discarded_at ?? undefined })),
    checkpoints: checkpointRows.map((item) => {
      const workItem = workItemMap.get(item.work_item_id);
      return {
        id: item.id,
        projectId: workItem?.primary_context_entity_id ?? "",
        title: `Checkpoint: ${entityMap.get(item.work_item_id)?.title ?? "praca"}`,
        currentState: item.current_state,
        nextAction: item.next_action,
        branch: item.branch ?? undefined,
        file: item.file_path ?? undefined,
        createdAt: item.created_at
      };
    }),
    evidence: evidenceRows.map((item) => ({
      id: item.entity_id,
      title: entityMap.get(item.entity_id)?.title ?? "Dowód nauki",
      detail: item.feedback || item.criterion,
      result: item.result,
      createdAt: item.created_at
    })),
    learningGoals: goalRows.map((goal) => ({
      id: goal.entity_id,
      title: entityMap.get(goal.entity_id)?.title ?? "Learning Goal",
      criterion: goal.demonstration_criterion,
      status: goal.status,
      skills: goalSkillRows.filter((link) => link.learning_goal_id === goal.entity_id && skillRows.some((skill) => skill.entity_id === link.skill_id)).map((link) => entityMap.get(link.skill_id)?.title ?? "Skill")
    })),
    knowledge: entities
      .filter((item): item is EntityRow & { type: KnowledgeKind } => ["note", "resource", "decision", "artifact", "investigation"].includes(item.type))
      .map((item) => { const content = knowledgeContentMap.get(item.id); return { id: item.id, type: item.type, title: item.title, detail: content?.detail ?? "", sourceUrl: content?.source_url ?? undefined, sourceInboxItemId: content?.source_inbox_item_id ?? undefined, archivedAt: item.archived_at ?? undefined, trashedAt: item.trashed_at ?? undefined, createdAt: content?.created_at, updatedAt: content?.updated_at }; }),
    focusSessions: sessions.map((session) => ({
      id: session.id,
      projectId: workItemMap.get(session.work_item_id)?.primary_context_entity_id ?? "",
      workItemId: session.work_item_id,
      startedAt: session.started_at,
      endedAt: session.ended_at ?? undefined,
      endReason: session.end_reason ?? undefined,
      scratchpad: session.scratchpad
    })),
    focus: {
      sessionId: runningSession?.id,
      running: Boolean(runningSession),
      startedAt: runningSession ? new Date(runningSession.started_at).getTime() : undefined,
      elapsedBeforeStart: 0,
      projectId: selectedProjectId,
      workItemId: runningSession?.work_item_id ?? selectedWorkItem?.entity_id ?? "",
      scratchpad: runningSession?.scratchpad ?? ""
    },
    aiProposal: proposal?.status ?? "rejected",
    aiProposalId: proposal?.id,
    aiProposals: proposal ? [{ id: proposal.id, command: "remote_command", preview: "Propozycja zapisana w Workspace", sources: [], risk: "low", expectedVersions: {}, expiresAt: "2099-01-01T00:00:00.000Z", status: proposal.status }] : [],
    aiExecutions: [],
    reviews: reviews.map((review, index) => ({ id: `remote-review-${index}-${review.completed_at}`, type: "weekly", templateVersion: 1, answers: {}, summary: "", completedAt: review.completed_at })),
    reviewCompletedAt: reviews[0]?.completed_at
  });
}

export async function captureRemote(workspaceId: string, content: string, kind: InboxKind, idempotencyKey: string): Promise<InboxItem> {
  const result = await getSupabase().rpc("capture_item", {
    target_workspace_id: workspaceId,
    capture_content: content,
    capture_kind: kind,
    command_idempotency_key: idempotencyKey
  });
  const row = dataOrThrow(result, "Capture") as unknown as InboxRow;
  return { id: row.id, kind: row.kind, content: row.raw_content, createdAt: row.created_at, status: "unprocessed" };
}

export async function resolveInboxRemote(id: string) {
  dataOrThrow(await getSupabase().rpc("resolve_inbox_item", { target_inbox_item_id: id, command_idempotency_key: crypto.randomUUID() }), "Triage Inbox");
}

export async function startFocusRemote(workspaceId: string, workItemId: string, idempotencyKey: string) {
  const data = dataOrThrow(await getSupabase().rpc("start_focus_session", {
    target_workspace_id: workspaceId,
    target_work_item_id: workItemId,
    command_idempotency_key: idempotencyKey
  }), "Start Focus Session") as unknown as SessionRow;
  return { id: data.id, startedAt: new Date(data.started_at).getTime() };
}

export async function endFocusRemote(sessionId: string, reason: "paused" | "work_item_completed" | "stopped" | "interrupted", currentState: string, nextAction: string) {
  dataOrThrow(await getSupabase().rpc("end_focus_session", {
    target_session_id: sessionId,
    reason,
    checkpoint_current_state: currentState,
    checkpoint_next_action: nextAction
  }), "End Focus Session");
}

export async function recordLearningEvidenceRemote(workspaceId: string, sessionId: string, evidence: { learningGoalId: string; title: string; result: "supports" | "reveals_gap" | "inconclusive"; feedback: string }) {
  dataOrThrow(await getSupabase().rpc("record_learning_evidence", {
    target_workspace_id: workspaceId,
    target_learning_goal_id: evidence.learningGoalId,
    target_focus_session_id: sessionId,
    evidence_title: evidence.title,
    evidence_result: evidence.result,
    evidence_feedback: evidence.feedback,
    command_idempotency_key: crypto.randomUUID()
  }), "Zapis Learning Evidence");
}

export async function updateScratchpadRemote(sessionId: string, scratchpad: string) {
  dataOrThrow(await getSupabase().from("focus_sessions").update({ scratchpad }).eq("id", sessionId).select("id").single(), "Zapis scratchpadu");
}

export async function decideAIProposalRemote(proposalId: string, status: AppState["aiProposal"]) {
  if (status === "approved") {
    dataOrThrow(await getSupabase().rpc("approve_ai_proposal", { target_proposal_id: proposalId, command_idempotency_key: crypto.randomUUID() }), "Zatwierdzenie AI Proposal");
    return;
  }
  dataOrThrow(await getSupabase().rpc("reject_ai_proposal", { target_proposal_id: proposalId, command_idempotency_key: crypto.randomUUID() }), "Odrzucenie AI Proposal");
}

export async function completeReviewRemote(workspaceId: string, summary: string) {
  dataOrThrow(await getSupabase().rpc("complete_weekly_review", {
    target_workspace_id: workspaceId,
    review_summary: summary,
    command_idempotency_key: crypto.randomUUID()
  }), "Zapis Review");
}

export async function createProjectRemote(workspaceId: string, input: NewProjectInput, idempotencyKey: string) {
  const projectId = dataOrThrow(await getSupabase().rpc("create_shaped_project", {
    target_workspace_id: workspaceId,
    project_title: input.title,
    project_outcome: input.outcome,
    project_technology: input.technology,
    first_work_item_title: input.firstWorkItemTitle,
    first_work_item_description: input.firstWorkItemDescription,
    effort_budget_minutes: input.effortBudgetMinutes ?? null,
    command_idempotency_key: idempotencyKey
  }), "Utworzenie projektu");
  return projectId as unknown as string;
}

export async function createGoalRemote(workspaceId: string, goalId: string, actionId: string | undefined, input: NewGoalInput, criteria: Array<{ id: string; title: string; completed: boolean }>, idempotencyKey: string) {
  return dataOrThrow(await getSupabase().rpc("create_goal_with_action_v2", {
    target_workspace_id: workspaceId,
    target_goal_id: goalId,
    target_action_id: actionId ?? null,
    goal_title: input.title,
    goal_outcome: input.outcome,
    goal_kind: input.kind ?? "custom",
    target_area_id: input.areaId ?? null,
    first_action_title: input.firstActionTitle ?? null,
    first_action_detail: input.firstActionDetail ?? null,
    goal_criteria: criteria,
    command_idempotency_key: idempotencyKey
  }), "Utworzenie Celu");
}

export async function updateGoalRemote(goalId: string, changes: { title?: string; outcome?: string; areaId?: string | null; priority?: "low" | "normal" | "high"; targetDate?: string | null; criteria?: Array<{ id: string; title: string; completed: boolean }> }) {
  dataOrThrow(await getSupabase().rpc("update_goal_details", { target_goal_id: goalId, goal_changes: changes, command_idempotency_key: crypto.randomUUID() }), "Edycja Celu");
}

export async function createActionRemote(workspaceId: string, id: string, input: NewActionInput) {
  dataOrThrow(await getSupabase().rpc("create_action_item", {
    target_workspace_id: workspaceId,
    target_action_id: id,
    target_goal_id: input.goalId ?? null,
    target_area_id: input.areaId ?? null,
    action_title: input.title,
    action_detail: input.detail ?? "",
    action_scheduled_for: input.scheduledFor ?? null,
    action_pinned_to_today: input.pinnedToToday ?? false,
    command_idempotency_key: crypto.randomUUID()
  }), "Utworzenie Działania");
}

export async function updateActionRemote(actionId: string, expectedVersion: number, changes: { title?: string; detail?: string; scheduledFor?: string | null; pinnedToToday?: boolean; goalId?: string | null; areaId?: string | null; position?: number; checklist?: Array<{ id: string; title: string; completed: boolean }> }) {
  dataOrThrow(await getSupabase().rpc("update_action_checked", {
    target_action_id: actionId,
    expected_version: expectedVersion,
    action_changes: changes,
    command_idempotency_key: crypto.randomUUID()
  }), "Edycja Działania");
}

export async function setActionStatusRemote(actionId: string, status: ActionStatus, blocker?: string) {
  dataOrThrow(await getSupabase().rpc("set_action_status_checked", {
    target_action_id: actionId,
    target_status: status,
    target_blocker: blocker?.trim() ?? null,
    command_idempotency_key: crypto.randomUUID()
  }), "Zmiana stanu Działania");
}

export async function setNextActionRemote(goalId: string, actionId: string) {
  dataOrThrow(await getSupabase().rpc("set_next_action_checked", {
    target_goal_id: goalId,
    target_action_id: actionId,
    command_idempotency_key: crypto.randomUUID()
  }), "Wybór następnego Działania");
}

export async function addProgressRemote(workspaceId: string, id: string, goalId: string, kind: string, content: string, actionId?: string, knowledgeItemId?: string) {
  dataOrThrow(await getSupabase().from("progress_entries").insert({
    id, workspace_id: workspaceId, goal_id: goalId, kind, content: content.trim(),
    action_id: actionId ?? null, knowledge_entity_id: knowledgeItemId ?? null
  }).select("id").single(), "Aktualizacja postępu");
}

export async function createAreaRemote(workspaceId: string, id: string, name: string, description?: string) {
  dataOrThrow(await getSupabase().from("areas").insert({ id, workspace_id: workspaceId, name: name.trim(), description: description?.trim() ?? "" }).select("id").single(), "Utworzenie Obszaru");
}

export async function updateAreaRemote(areaId: string, changes: { name?: string; description?: string }) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.name !== undefined) payload.name = changes.name.trim();
  if (changes.description !== undefined) payload.description = changes.description.trim();
  dataOrThrow(await getSupabase().from("areas").update(payload).eq("id", areaId).select("id").single(), "Edycja Obszaru");
}

export async function createGoalTemplateRemote(workspaceId: string, id: string, name: string, kind: GoalKind, defaultActions?: Array<{ title: string; detail?: string }>) {
  dataOrThrow(await getSupabase().from("goal_templates").insert({
    id, workspace_id: workspaceId, name: name.trim(), kind, default_actions: defaultActions ?? [], is_system: false
  }).select("id").single(), "Utworzenie szablonu Celu");
}

export async function updateGoalTemplateRemote(templateId: string, changes: { name?: string; kind?: GoalKind; defaultActions?: Array<{ title: string; detail?: string }> }) {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.name !== undefined) payload.name = changes.name.trim();
  if (changes.kind !== undefined) payload.kind = changes.kind;
  if (changes.defaultActions !== undefined) payload.default_actions = changes.defaultActions;
  dataOrThrow(await getSupabase().from("goal_templates").update(payload).eq("id", templateId).eq("is_system", false).select("id").single(), "Edycja szablonu Celu");
}

export async function setGoalStatusRemote(goalId: string, status: "active" | "paused" | "achieved" | "abandoned", reason: string | undefined, progressId: string, progressContent: string) {
  dataOrThrow(await getSupabase().rpc("set_goal_outcome_status", { target_goal_id: goalId, target_status: status, change_reason: reason ?? null, target_progress_id: progressId, target_progress_content: progressContent, command_idempotency_key: crypto.randomUUID() }), "Zmiana stanu Celu");
}

export async function setGoalVisibilityRemote(goalId: string, visibility: "active" | "archived" | "trashed") {
  dataOrThrow(await getSupabase().rpc("set_goal_visibility_checked", {
    target_goal_id: goalId,
    target_visibility: visibility,
    command_idempotency_key: crypto.randomUUID()
  }), "Zmiana widoczności Celu");
}

export async function setAreaVisibilityRemote(areaId: string, visibility: "active" | "archived" | "trashed") {
  dataOrThrow(await getSupabase().from("areas").update({ archived_at: visibility === "archived" ? new Date().toISOString() : null, trashed_at: visibility === "trashed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", areaId).select("id").single(), "Zmiana widoczności Obszaru");
}

export async function setGoalTemplateVisibilityRemote(templateId: string, visibility: "active" | "archived" | "trashed") {
  dataOrThrow(await getSupabase().from("goal_templates").update({ archived_at: visibility === "archived" ? new Date().toISOString() : null, trashed_at: visibility === "trashed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", templateId).eq("is_system", false).select("id").single(), "Zmiana widoczności szablonu");
}

export async function setRecurringStatusRemote(templateId: string, status: "active" | "paused" | "archived") {
  dataOrThrow(await getSupabase().rpc("set_recurring_action_template_status", {
    target_template_id: templateId,
    target_status: status,
    command_idempotency_key: crypto.randomUUID()
  }), "Zmiana stanu serii");
}

export async function createRecurringTemplateRemote(workspaceId: string, template: RecurringActionTemplate) {
  dataOrThrow(await getSupabase().rpc("create_recurring_action_template", {
    target_workspace_id: workspaceId,
    target_template_id: template.id,
    template_data: {
      title: template.title, detail: template.detail, goalId: template.goalId ?? null,
      areaId: template.areaId ?? null, timezone: template.timezone, startsOn: template.startsOn,
      rule: template.rule, missedPolicy: template.missedPolicy, checklist: template.checklist
    },
    command_idempotency_key: crypto.randomUUID()
  }), "Utworzenie serii cyklicznej");
}

export async function updateRecurringTemplateRemote(templateId: string, changes: Partial<NewRecurringActionInput>, updateFutureActions: boolean, effectiveFrom: string) {
  const payload: Record<string, unknown> = {};
  if (changes.title !== undefined) payload.title = changes.title.trim();
  if (changes.detail !== undefined) payload.detail = changes.detail.trim();
  if (changes.goalId !== undefined) payload.goalId = changes.goalId ?? null;
  if (changes.areaId !== undefined) payload.areaId = changes.areaId ?? null;
  if (changes.timezone !== undefined) payload.timezone = changes.timezone;
  if (changes.startsOn !== undefined) payload.startsOn = changes.startsOn;
  if (changes.rule !== undefined) payload.rule = changes.rule;
  if (changes.missedPolicy !== undefined) payload.missedPolicy = changes.missedPolicy;
  if (changes.checklist !== undefined) payload.checklist = changes.checklist.map((title) => ({ title }));
  dataOrThrow(await getSupabase().rpc("update_recurring_action_template", {
    target_template_id: templateId,
    template_changes: payload,
    update_future_actions: updateFutureActions,
    effective_from: effectiveFrom,
    command_idempotency_key: crypto.randomUUID()
  }), "Edycja serii cyklicznej");
}

export async function materializeRecurringOccurrenceRemote(workspaceId: string, templateId: string, actionId: string, occurrenceDate: string, idempotencyKey: string) {
  return dataOrThrow(await getSupabase().rpc("materialize_recurring_occurrence", {
    target_workspace_id: workspaceId,
    target_template_id: templateId,
    target_action_id: actionId,
    target_occurrence_date: occurrenceDate,
    command_idempotency_key: idempotencyKey
  }), "Utworzenie wystąpienia cyklicznego");
}

export async function linkKnowledgeRemote(workspaceId: string, id: string, knowledgeItemId: string, target: { targetKnowledgeItemId?: string; areaId?: string; goalId?: string; actionId?: string; recurringTemplateId?: string }, meaning: string) {
  dataOrThrow(await getSupabase().from("knowledge_links").insert({
    id, workspace_id: workspaceId, knowledge_entity_id: knowledgeItemId,
    target_knowledge_entity_id: target.targetKnowledgeItemId ?? null,
    area_id: target.areaId ?? null, goal_id: target.goalId ?? null, action_id: target.actionId ?? null,
    recurring_template_id: target.recurringTemplateId ?? null, meaning
  }).select("id").single(), "Powiązanie Wiedzy");
}

export async function unlinkKnowledgeRemote(linkId: string) {
  const result = await getSupabase().from("knowledge_links").delete().eq("id", linkId);
  if (result.error) throw new Error(`Odłączenie Wiedzy: ${result.error.message}`);
}

export async function createKnowledgeRemote(workspaceId: string, id: string, kind: KnowledgeKind, title: string, detail: string, sourceUrl?: string, goalLinks: Array<{ id: string; goalId: string }> = [], meaning: "material" | "result" | "decision" | "reference" = "reference") {
  return dataOrThrow(await getSupabase().rpc("create_knowledge_with_goal_links", {
    target_workspace_id: workspaceId,
    target_knowledge_id: id,
    knowledge_kind: kind,
    knowledge_title: title,
    knowledge_detail: detail,
    knowledge_source_url: sourceUrl ?? null,
    goal_links: goalLinks,
    link_meaning: meaning,
    command_idempotency_key: id
  }), "Utworzenie elementu Wiedzy");
}

export async function updateKnowledgeRemote(knowledgeId: string, changes: { kind?: KnowledgeKind; title?: string; detail?: string; sourceUrl?: string | null }, goalLinks?: Array<{ id: string; goalId: string }>) {
  dataOrThrow(await getSupabase().rpc("update_knowledge_item", {
    target_knowledge_id: knowledgeId,
    knowledge_changes: changes,
    goal_links: goalLinks,
    command_idempotency_key: crypto.randomUUID()
  }), "Edycja Wiedzy");
}

export async function triageInboxIntentRemote(workspaceId: string, inboxItemId: string, intent: InboxTriageIntent, idempotencyKey: string) {
  return dataOrThrow(await getSupabase().rpc("triage_inbox_intent", {
    target_workspace_id: workspaceId,
    target_inbox_item_id: inboxItemId,
    target_intent: intent,
    command_idempotency_key: idempotencyKey
  }), "Przetworzenie Inboxu");
}

export async function createLearningGoalRemote(workspaceId: string, input: NewLearningGoalInput, idempotencyKey: string) {
  return dataOrThrow(await getSupabase().rpc("create_learning_goal", {
    target_workspace_id: workspaceId,
    goal_title: input.title,
    goal_criterion: input.criterion,
    skill_title: input.skill,
    command_idempotency_key: idempotencyKey
  }), "Utworzenie Learning Goal");
}

export async function setEntityVisibilityRemote(entityId: string, visibility: "active" | "archived" | "trashed") {
  dataOrThrow(await getSupabase().rpc("set_entity_visibility", { target_entity_id: entityId, target_visibility: visibility, command_idempotency_key: crypto.randomUUID() }), "Zmiana widoczności");
}

export async function setInboxStatusRemote(id: string, status: InboxItem["status"], snoozedUntil?: string) {
  dataOrThrow(await getSupabase().rpc("set_inbox_item_status", { target_inbox_item_id: id, target_status: status, target_snoozed_until: snoozedUntil ?? null, command_idempotency_key: crypto.randomUUID() }), "Zmiana statusu Inbox Itemu");
}

export async function releaseDueInboxItemsRemote(workspaceId: string) {
  dataOrThrow(await getSupabase().rpc("release_due_inbox_items", { target_workspace_id: workspaceId, command_idempotency_key: crypto.randomUUID() }), "Przywrócenie odłożonych elementów Inboxu");
}

export async function setCommitmentStatusRemote(projectId: string, status: "active" | "paused" | "released" | "fulfilled") {
  dataOrThrow(await getSupabase().rpc("set_commitment_status", { target_project_id: projectId, target_status: status, command_idempotency_key: crypto.randomUUID() }), "Zmiana Commitmentu");
}

export async function setLearningGoalStatusRemote(goalId: string, status: "draft" | "shaped" | "achieved" | "abandoned", reason?: string) {
  dataOrThrow(await getSupabase().rpc("set_learning_goal_status", { target_goal_id: goalId, target_status: status, change_reason: reason ?? null, command_idempotency_key: crypto.randomUUID() }), "Zmiana Learning Goalu");
}

const exportTables = [
  "areas", "goal_templates", "goals", "goal_criteria", "actions", "progress_entries",
  "recurring_action_templates", "knowledge_links", "knowledge_items",
  "workspace_members", "entities", "projects", "requirements", "commitments", "work_items",
  "inbox_items", "focus_sessions", "context_checkpoints", "skills", "learning_goals",
  "learning_goal_skills", "learning_evidence", "entity_links", "reviews", "ai_proposals",
  "ai_executions", "activity_events"
] as const;

export async function exportWorkspaceRemote(workspaceId: string) {
  const client = getSupabase();
  const workspaceResult = await client.from("workspaces").select("*").eq("id", workspaceId).single();
  const workspace = dataOrThrow(workspaceResult, "Eksport Workspace");
  const results = await Promise.all(exportTables.map(async (table) => {
    const result = await client.from(table).select("*").eq("workspace_id", workspaceId);
    return [table, dataOrThrow(result, `Eksport ${table}`)] as const;
  }));
  return {
    format: "developer-command-center/export",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace,
    tables: Object.fromEntries(results)
  };
}
