import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { demoState } from "../data/demo";
import { emptyState } from "../data/empty";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { executeDomainCommand } from "../domain/commands";
import type { AppState, NewLearningGoalInput, NewProjectInput } from "../domain/types";
import { StoreContext, type AppStore, type CreatedProjectReference } from "./store-context";

const STORAGE_KEY = "command-center-state-v1";
const loadRepository = () => import("../data/supabaseRepository");

function cloneDemoState() {
  return structuredClone(demoState);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function loadDemoState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneDemoState();
    const parsed = JSON.parse(saved) as Partial<AppState>;
    const demo = cloneDemoState();
    return {
      ...demo,
      ...parsed,
      knowledge: parsed.knowledge ?? [],
      learningGoals: parsed.learningGoals ?? [],
      reviews: parsed.reviews ?? [],
      aiProposals: parsed.aiProposals ?? [],
      aiExecutions: parsed.aiExecutions ?? [],
      focusSessions: parsed.focusSessions ?? [],
      projects: (parsed.projects ?? demo.projects).map((project) => ({ ...project, commitmentStatus: project.commitmentStatus ?? "active" }))
    };
  } catch {
    return cloneDemoState();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [state, setState] = useState<AppState>(() => mode === "demo" ? loadDemoState() : structuredClone(emptyState));
  const [syncing, setSyncing] = useState(false);
  const [scratchpadStatus, setScratchpadStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [mutationError, setMutationError] = useState<string>();
  const [localHydrated, setLocalHydrated] = useState(false);
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);

  const remoteQuery = useQuery({
    queryKey: ["workspace-state", user?.id],
    enabled: mode === "supabase" && Boolean(user),
    queryFn: async () => (await loadRepository()).loadSupabaseState(user!.id)
  });

  useEffect(() => {
    if (mode !== "demo") return;
    let active = true;
    void localRepository.load().then((saved) => {
      if (!active) return;
      if (saved) setState(saved);
      setLocalHydrated(true);
    }).catch(() => setLocalHydrated(true));
    return () => { active = false; };
  }, [localRepository, mode]);

  useEffect(() => {
    if (mode !== "demo" || !localHydrated) return;
    void localRepository.save(state)
      .then(() => setScratchpadStatus((current) => current === "saving" ? "saved" : current))
      .catch((error: unknown) => {
        setScratchpadStatus((current) => current === "saving" ? "error" : current);
        setMutationError(errorMessage(error, "Nie udało się zapisać lokalnego Workspace."));
      });
  }, [localHydrated, localRepository, mode, state]);

  useEffect(() => {
    if (remoteQuery.data) setState(remoteQuery.data);
  }, [remoteQuery.data]);

  useEffect(() => {
    if (mode !== "supabase" || !state.focus.running || !state.focus.sessionId) return;
    const sessionId = state.focus.sessionId;
    const scratchpad = state.focus.scratchpad;
    const timer = window.setTimeout(() => {
      void loadRepository()
        .then((repository) => repository.updateScratchpadRemote(sessionId, scratchpad))
        .then(() => setScratchpadStatus("saved"))
        .catch((error: unknown) => {
          setScratchpadStatus("error");
          setMutationError(errorMessage(error, "Nie udało się zapisać scratchpadu."));
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [mode, state.focus.running, state.focus.scratchpad, state.focus.sessionId]);

  const runRemote = useCallback(async (operation: () => Promise<void>) => {
    setSyncing(true);
    setMutationError(undefined);
    try {
      await operation();
    } catch (error) {
      setMutationError(errorMessage(error, "Nie udało się zsynchronizować zmiany."));
      throw error;
    } finally {
      setSyncing(false);
    }
  }, []);

  const value = useMemo<AppStore>(() => ({
    state,
    mode,
    loading: mode === "supabase" && remoteQuery.isPending,
    syncing,
    scratchpadStatus,
    error: mutationError ?? (remoteQuery.error instanceof Error ? remoteQuery.error.message : undefined),
    async createProject(input: NewProjectInput) {
      const id = crypto.randomUUID();
      const reference: CreatedProjectReference = { projectId: id, workItemId: `${id}-work-item` };
      const nextState = executeDomainCommand(state, {
        type: "create_project",
        id,
        title: input.title,
        outcome: input.outcome,
        technology: input.technology,
        firstWorkItem: { id: `${id}-work-item`, title: input.firstWorkItemTitle, detail: input.firstWorkItemDescription },
        effortBudgetMinutes: input.effortBudgetMinutes,
        wipOverrideReason: input.wipOverrideReason
      });
      setState(nextState);
      if (mode === "demo") return reference;
      const workspaceId = state.workspaceId;
      if (!workspaceId) return reference;
      try {
        let savedReference = reference;
        await runRemote(async () => {
          const repository = await loadRepository();
          const projectId = await repository.createProjectRemote(workspaceId, input, id);
          const refreshed = await remoteQuery.refetch();
          const savedProject = refreshed.data?.projects.find((project) => project.id === projectId);
          if (savedProject?.workItems[0]) savedReference = { projectId, workItemId: savedProject.workItems[0].id };
        });
        return savedReference;
      } catch (error) {
        setState((current) => ({ ...current, projects: current.projects.filter((item) => item.id !== id) }));
        throw error;
      }
    },
    async setCommitmentStatus(projectId, status) {
      const previousProjects = state.projects;
      setState((current) => executeDomainCommand(current, { type: "set_commitment_status", projectId, status }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setCommitmentStatusRemote(projectId, status));
      } catch (error) {
        setState((current) => ({ ...current, projects: previousProjects }));
        throw error;
      }
    },
    setPrimaryCommitment(projectId) {
      setState((current) => executeDomainCommand(current, { type: "set_primary_commitment", projectId }));
    },
    setWorkItemStatus(projectId, workItemId, status, blocker) {
      setState((current) => executeDomainCommand(current, { type: "set_work_item_status", projectId, workItemId, status, blocker }));
    },
    updateCheckpoint(checkpointId, input) {
      setState((current) => executeDomainCommand(current, { type: "update_checkpoint", checkpointId, ...input, updatedAt: new Date().toISOString() }));
    },
    promoteScratchpad(sessionId, target, title, content) {
      setState((current) => executeDomainCommand(current, { type: "promote_scratchpad", sessionId, target, targetId: crypto.randomUUID(), title, content, createdAt: new Date().toISOString() }));
    },
    async createLearningGoal(input: NewLearningGoalInput) {
      const id = crypto.randomUUID();
      const goal = { id, title: input.title.trim(), criterion: input.criterion.trim(), status: "shaped" as const, skills: [input.skill.trim()] };
      setState((current) => ({ ...current, learningGoals: [...current.learningGoals, goal] }));
      if (mode === "demo") return;
      const workspaceId = state.workspaceId;
      if (!workspaceId) return;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          await repository.createLearningGoalRemote(workspaceId, input, id);
          await remoteQuery.refetch();
        });
      } catch (error) {
        setState((current) => ({ ...current, learningGoals: current.learningGoals.filter((item) => item.id !== id) }));
        throw error;
      }
    },
    async setLearningGoalStatus(goalId, status, reason) {
      const previous = state.learningGoals.find((goal) => goal.id === goalId);
      setState((current) => executeDomainCommand(current, { type: "set_learning_goal_status", goalId, status, reason, changedAt: new Date().toISOString() }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setLearningGoalStatusRemote(goalId, status, reason));
      } catch (error) {
        if (previous) setState((current) => ({ ...current, learningGoals: current.learningGoals.map((goal) => goal.id === goalId ? previous : goal) }));
        throw error;
      }
    },
    async capture(content, kind = "text") {
      const trimmed = content.trim();
      if (!trimmed) return;
      const optimisticId = crypto.randomUUID();
      const optimisticItem = { id: optimisticId, kind, content: trimmed, createdAt: new Date().toISOString(), status: "unprocessed" as const };
      setState((current) => ({ ...current, inbox: [optimisticItem, ...current.inbox] }));
      if (mode === "demo") return;
      const workspaceId = state.workspaceId;
      if (!workspaceId) {
        setMutationError("Brak aktywnego Workspace.");
        return;
      }
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          const saved = await repository.captureRemote(workspaceId, trimmed, kind, optimisticId);
          setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === optimisticId ? saved : item) }));
        });
      } catch {
        setState((current) => ({ ...current, inbox: current.inbox.filter((item) => item.id !== optimisticId) }));
      }
    },
    async resolveInbox(id) {
      setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === id ? { ...item, status: "resolved" } : item) }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          await repository.resolveInboxRemote(id);
        });
      } catch {
        setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === id ? { ...item, status: "unprocessed" } : item) }));
      }
    },
    triageInbox(id, target, title, detail, projectId) {
      setState((current) => executeDomainCommand(current, { type: "triage_inbox", inboxItemId: id, target, targetId: crypto.randomUUID(), title, detail, projectId, decidedAt: new Date().toISOString() }));
    },
    async setInboxStatus(id, status, snoozedUntil) {
      const previous = state.inbox.find((item) => item.id === id);
      setState((current) => executeDomainCommand(current, { type: "set_inbox_status", inboxItemId: id, status, snoozedUntil, changedAt: new Date().toISOString() }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setInboxStatusRemote(id, status, snoozedUntil));
      } catch (error) {
        if (previous) setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === id ? previous : item) }));
        throw error;
      }
    },
    createKnowledge(kind, title, detail, projectId, sourceUrl) {
      setState((current) => executeDomainCommand(current, { type: "create_knowledge", id: crypto.randomUUID(), kind, title, detail, projectId, sourceUrl, createdAt: new Date().toISOString() }));
    },
    async setVisibility(entityType, entityId, visibility) {
      const previousProject = entityType === "project" ? state.projects.find((item) => item.id === entityId) : undefined;
      const previousKnowledge = entityType === "knowledge" ? state.knowledge.find((item) => item.id === entityId) : undefined;
      setState((current) => executeDomainCommand(current, { type: "set_visibility", entityType, entityId, visibility, changedAt: new Date().toISOString() }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setEntityVisibilityRemote(entityId, visibility));
      } catch (error) {
        if (previousProject) setState((current) => ({ ...current, projects: current.projects.map((item) => item.id === entityId ? previousProject : item) }));
        if (previousKnowledge) setState((current) => ({ ...current, knowledge: current.knowledge.map((item) => item.id === entityId ? previousKnowledge : item) }));
        throw error;
      }
    },
    async startFocus(requestedWorkItemId) {
      const workItemId = requestedWorkItemId ?? state.focus.workItemId;
      const project = state.projects.find((item) => item.workItems.some((workItem) => workItem.id === workItemId));
      if (state.focus.running || !workItemId || !project) return false;
      const optimisticSessionId = crypto.randomUUID();
      const startedAt = Date.now();
      setState((current) => executeDomainCommand(current, {
        type: "start_focus",
        sessionId: optimisticSessionId,
        projectId: project.id,
        workItemId,
        startedAt: new Date(startedAt).toISOString()
      }));
      if (mode === "demo") return true;
      const workspaceId = state.workspaceId;
      if (!workspaceId) return false;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          const session = await repository.startFocusRemote(workspaceId, workItemId, optimisticSessionId);
          setState((current) => ({
            ...current,
            focus: { ...current.focus, sessionId: session.id, startedAt: session.startedAt },
            focusSessions: current.focusSessions.map((item) => item.id === optimisticSessionId ? { ...item, id: session.id, startedAt: new Date(session.startedAt).toISOString() } : item)
          }));
        });
        return true;
      } catch {
        setState((current) => ({ ...current, focusSessions: current.focusSessions.filter((item) => item.id !== optimisticSessionId), focus: { ...current.focus, running: false, sessionId: undefined, startedAt: undefined } }));
        return false;
      }
    },
    async pauseFocus(checkpoint) {
      const sessionId = state.focus.sessionId;
      if (!sessionId) return false;
      const optimisticCheckpointId = crypto.randomUUID();
      const endedAt = new Date().toISOString();
      const reason = checkpoint.reason ?? "paused";
      setState((current) => {
        const ended = executeDomainCommand(current, {
          type: "end_focus",
          sessionId,
          checkpointId: optimisticCheckpointId,
          reason,
          currentState: checkpoint.currentState,
          nextAction: checkpoint.nextAction,
          endedAt,
          branch: checkpoint.branch,
          file: checkpoint.file,
          sourceUrl: checkpoint.sourceUrl,
          blocker: checkpoint.blocker,
          note: checkpoint.note
        });
        return {
          ...ended,
          evidence: checkpoint.evidence ? [{ id: crypto.randomUUID(), learningGoalId: checkpoint.evidence.learningGoalId, title: checkpoint.evidence.title, detail: checkpoint.evidence.feedback, result: checkpoint.evidence.result, assessmentMethod: "self_review", accepted: true, createdAt: endedAt }, ...ended.evidence] : ended.evidence
        };
      });
      if (mode === "demo") return true;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          await repository.endFocusRemote(sessionId, reason, checkpoint.currentState, checkpoint.nextAction);
          if (checkpoint.evidence && state.workspaceId) await repository.recordLearningEvidenceRemote(state.workspaceId, sessionId, checkpoint.evidence);
          await remoteQuery.refetch();
        });
        return true;
      } catch {
        await remoteQuery.refetch();
        return false;
      }
    },
    updateScratchpad(scratchpad) {
      setScratchpadStatus("saving");
      setState((current) => ({ ...current, focus: { ...current.focus, scratchpad } }));
    },
    async setAIProposal(aiProposal) {
      const previous = state.aiProposal;
      const pendingProposal = state.aiProposals.find((proposal) => proposal.status === "pending");
      setState((current) => pendingProposal ? executeDomainCommand(current, {
        type: "decide_ai_proposal",
        proposalId: pendingProposal.id,
        decision: aiProposal === "approved" ? "approved" : "rejected",
        executionId: aiProposal === "approved" ? crypto.randomUUID() : undefined,
        decidedAt: new Date().toISOString()
      }) : { ...current, aiProposal });
      const proposalId = state.aiProposalId;
      if (mode === "demo" || !proposalId) return;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          await repository.decideAIProposalRemote(proposalId, aiProposal);
        });
      } catch {
        setState((current) => ({ ...current, aiProposal: previous }));
      }
    },
    executeAIExecution(executionId) {
      const changedAt = new Date().toISOString();
      setState((current) => {
        const running = executeDomainCommand(current, { type: "set_ai_execution_status", executionId, status: "running", changedAt });
        return executeDomainCommand(running, { type: "set_ai_execution_status", executionId, status: "succeeded", changedAt: new Date().toISOString() });
      });
    },
    async completeReview(summary = "", type = "weekly", answers = {}) {
      const completedAt = new Date().toISOString();
      const reviewId = crypto.randomUUID();
      setState((current) => executeDomainCommand(current, { type: "complete_review", reviewId, reviewType: type, templateVersion: 1, answers, summary, completedAt }));
      const workspaceId = state.workspaceId;
      if (mode === "demo" || !workspaceId || !user) return true;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          await repository.completeReviewRemote(workspaceId, summary);
        });
        return true;
      } catch {
        setState((current) => {
          const reviews = current.reviews.filter((review) => review.id !== reviewId);
          return { ...current, reviews, reviewCompletedAt: reviews.at(-1)?.completedAt };
        });
        return false;
      }
    },
    async exportData() {
      if (mode === "demo") {
        return { format: "developer-command-center/export", version: 1, exportedAt: new Date().toISOString(), mode: "demo", state };
      }
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace do eksportu.");
      const repository = await loadRepository();
      return repository.exportWorkspaceRemote(state.workspaceId);
    },
    async reload() {
      if (mode === "supabase") await remoteQuery.refetch();
    },
    resetDemo() {
      localStorage.removeItem(STORAGE_KEY);
      void localRepository.clear();
      setState(cloneDemoState());
    }
  }), [localRepository, mode, mutationError, remoteQuery, runRemote, scratchpadStatus, state, syncing, user]);

  if (mode === "supabase" && remoteQuery.isPending) {
    return <div className="app-loading" role="status"><span className="loading-mark">&gt;_</span><span>Ładowanie prywatnego Workspace…</span></div>;
  }
  if (mode === "supabase" && remoteQuery.isError && !remoteQuery.data) {
    const message = remoteQuery.error instanceof Error ? remoteQuery.error.message : "Nie udało się załadować Workspace.";
    return <div className="workspace-error" role="alert"><span className="loading-mark">!</span><h1>Nie udało się otworzyć Workspace</h1><p>{message}</p><button className="button button-primary" onClick={() => void remoteQuery.refetch()}>Spróbuj ponownie</button></div>;
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
