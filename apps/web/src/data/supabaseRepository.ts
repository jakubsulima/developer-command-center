import type { AppState, InboxItem, InboxKind, KnowledgeKind, NewLearningGoalInput, NewProjectInput, Project, ProjectStatus } from "../domain/types";
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

  const [entitiesResult, projectsResult, requirementsResult, commitmentsResult, workItemsResult, inboxResult, sessionsResult, checkpointsResult, evidenceResult, goalsResult, skillsResult, goalSkillsResult, proposalsResult, reviewsResult] = await Promise.all([
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
    client.from("reviews").select("completed_at").order("completed_at", { ascending: false }).limit(1)
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

  return {
    ...emptyState,
    workspaceId,
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
      .map((item) => ({ id: item.id, type: item.type, title: item.title, detail: "Obiekt w prywatnym Workspace", archivedAt: item.archived_at ?? undefined, trashedAt: item.trashed_at ?? undefined })),
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
  };
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

export async function setCommitmentStatusRemote(projectId: string, status: "active" | "paused" | "released" | "fulfilled") {
  dataOrThrow(await getSupabase().rpc("set_commitment_status", { target_project_id: projectId, target_status: status, command_idempotency_key: crypto.randomUUID() }), "Zmiana Commitmentu");
}

export async function setLearningGoalStatusRemote(goalId: string, status: "draft" | "shaped" | "achieved" | "abandoned", reason?: string) {
  dataOrThrow(await getSupabase().rpc("set_learning_goal_status", { target_goal_id: goalId, target_status: status, change_reason: reason ?? null, command_idempotency_key: crypto.randomUUID() }), "Zmiana Learning Goalu");
}

const exportTables = [
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
