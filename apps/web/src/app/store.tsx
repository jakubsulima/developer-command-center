import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { demoState } from "../data/demo";
import { emptyState } from "../data/empty";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { executeDomainCommand, type InboxTriageIntent } from "../domain/commands";
import { ensureGoalModel } from "../domain/goals";
import { materializeRecurringActions } from "../domain/recurrence";
import { normalizeCapture } from "../domain/capture";
import { releaseDueInboxItems } from "../domain/inbox";
import type { ActionResultInput, AppState, CreateKnowledgeInput, NewLearningGoalInput, NewProjectInput } from "../domain/types";
import { StoreContext, type AppStore, type CreatedProjectReference } from "./store-context";
import { markStartupPhase, recordStartupTiming } from "../lib/startupMetrics";

const STORAGE_KEY = "command-center-state-v1";
const loadRepository = () => import("../data/supabaseRepository");

function cloneDemoState() {
  return ensureGoalModel(structuredClone(demoState));
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
    return ensureGoalModel({
      ...demo,
      ...parsed,
      knowledge: parsed.knowledge ?? [],
      learningGoals: parsed.learningGoals ?? [],
      reviews: parsed.reviews ?? [],
      aiProposals: parsed.aiProposals ?? [],
      aiExecutions: parsed.aiExecutions ?? [],
      focusSessions: parsed.focusSessions ?? [],
      projects: (parsed.projects ?? demo.projects).map((project) => ({ ...project, commitmentStatus: project.commitmentStatus ?? "active" }))
    });
  } catch {
    return cloneDemoState();
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const legacyMigrationRef = useRef(mode === "demo" && Boolean(localStorage.getItem(STORAGE_KEY)));
  const [state, setState] = useState<AppState>(() => mode === "demo" ? loadDemoState() : structuredClone(emptyState));
  const stateRef = useRef(state);
  stateRef.current = state;
  const [syncing, setSyncing] = useState(false);
  const [scratchpadStatus, setScratchpadStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [mutationError, setMutationError] = useState<string>();
  const [localHydrated, setLocalHydrated] = useState(legacyMigrationRef.current);
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);

  const remoteQuery = useQuery({
    queryKey: ["workspace-state", user?.id],
    enabled: mode === "supabase" && Boolean(user),
    queryFn: async () => {
      const startedAt = performance.now();
      try {
        return await (await loadRepository()).loadSupabaseState(user!.id);
      } finally {
        recordStartupTiming("supabase-workspace", performance.now() - startedAt);
      }
    }
  });

  useEffect(() => {
    if (mode === "demo" && localHydrated) markStartupPhase("workspace-resolved");
    if (mode === "supabase" && remoteQuery.data) markStartupPhase("workspace-resolved");
  }, [localHydrated, mode, remoteQuery.data]);

  useEffect(() => {
    if (mode !== "demo") return;
    // The old localStorage payload is a one-time migration source. Prefer it over
    // IndexedDB so an older workspace cannot be overwritten during hydration.
    if (legacyMigrationRef.current) return;
    let active = true;
    void localRepository.load().then((saved) => {
      if (!active) return;
      if (saved) setState(ensureGoalModel(saved));
      setLocalHydrated(true);
    }).catch(() => setLocalHydrated(true));
    return () => { active = false; };
  }, [localRepository, mode]);

  useEffect(() => {
    if (mode !== "demo" || !localHydrated) return;
    void localRepository.save(state)
      .then(() => {
        localStorage.removeItem(STORAGE_KEY);
        setScratchpadStatus((current) => current === "saving" ? "saved" : current);
      })
      .catch((error: unknown) => {
        setScratchpadStatus((current) => current === "saving" ? "error" : current);
        setMutationError(errorMessage(error, "Nie udało się zapisać lokalnego Workspace."));
      });
  }, [localHydrated, localRepository, mode, state]);

  useEffect(() => {
    if (remoteQuery.data) {
      const hydrated = ensureGoalModel(remoteQuery.data);
      stateRef.current = hydrated;
      setState(hydrated);
    }
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

  const ensureWorkspaceState = useCallback(async () => {
    const current = stateRef.current;
    if (mode !== "supabase" || current.workspaceId) return current;

    const refreshed = await remoteQuery.refetch();
    if (refreshed.error) throw refreshed.error;
    if (!refreshed.data?.workspaceId) {
      throw new Error("Użytkownik nie ma przypisanego Workspace.");
    }

    const hydrated = ensureGoalModel(refreshed.data);
    stateRef.current = hydrated;
    setState(hydrated);
    return hydrated;
  }, [mode, remoteQuery]);

  const value = useMemo<AppStore>(() => ({
    state,
    mode,
    loading: mode === "supabase" ? remoteQuery.isPending : !localHydrated,
    syncing,
    scratchpadStatus,
    error: mutationError ?? (remoteQuery.error instanceof Error ? remoteQuery.error.message : undefined),
    async createGoal(input) {
      const previous = await ensureWorkspaceState();
      const goalId = crypto.randomUUID();
      const actionId = input.firstActionTitle?.trim() ? crypto.randomUUID() : undefined;
      const criteria = (input.criteria ?? []).filter((title) => title.trim()).map((title) => ({ id: crypto.randomUUID(), title, completed: false }));
      const createdAt = new Date().toISOString();
      const next = executeDomainCommand(previous, {
        type: "create_goal",
        goalId,
        actionId,
        title: input.title,
        outcome: input.outcome,
        firstActionTitle: input.firstActionTitle,
        firstActionDetail: input.firstActionDetail,
        kind: input.kind ?? "custom",
        areaId: input.areaId,
        templateId: input.templateId,
        criteria,
        createdAt
      });
      stateRef.current = next;
      setState(next);
      if (mode === "demo") return goalId;
      try {
        await runRemote(async () => (await loadRepository()).createGoalRemote(previous.workspaceId!, goalId, actionId, input, criteria, goalId));
        return goalId;
      } catch (error) {
        stateRef.current = previous;
        setState(previous);
        throw error;
      }
    },
    async updateGoal(goalId, changes) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "update_goal", goalId, ...changes, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).updateGoalRemote(goalId, changes)); }
      catch (error) { setState(previous); throw error; }
    },
    async createAction(input) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "create_action", id, ...input, createdAt }));
      if (mode === "demo") return id;
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).createActionRemote(state.workspaceId!, id, input));
        return id;
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async updateAction(actionId, changes) {
      const previous = state;
      const changedAt = new Date().toISOString();
      const expectedVersion = previous.actions.find((action) => action.id === actionId)?.version;
      setState((current) => executeDomainCommand(current, { type: "update_action", actionId, expectedVersion, ...changes, changedAt }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).updateActionRemote(actionId, expectedVersion ?? 1, changes));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async setActionStatus(actionId, status, blocker) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "set_action_status", actionId, status, blocker, changedAt }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setActionStatusRemote(actionId, status, blocker));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async setNextAction(goalId, actionId) {
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "set_next_action", goalId, actionId }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setNextActionRemote(goalId, actionId));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async addProgress(goalId, kind, content, actionId, knowledgeItemId) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "add_progress", id, goalId, kind, content, actionId, knowledgeItemId, createdAt }));
      if (mode === "demo") return;
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).addProgressRemote(state.workspaceId!, id, goalId, kind, content, actionId, knowledgeItemId));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async createArea(name, description) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "create_area", id, name, description, createdAt }));
      if (mode === "demo") return id;
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).createAreaRemote(state.workspaceId!, id, name, description));
        return id;
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async updateArea(areaId, changes) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "update_area", areaId, ...changes, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).updateAreaRemote(areaId, changes)); }
      catch (error) { setState(previous); throw error; }
    },
    async createGoalTemplate(name, kind, defaultActions) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "create_goal_template", id, name, kind, defaultActions, createdAt }));
      if (mode === "demo") return id;
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).createGoalTemplateRemote(state.workspaceId!, id, name, kind, defaultActions));
        return id;
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async updateGoalTemplate(templateId, changes) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "update_goal_template", templateId, ...changes, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).updateGoalTemplateRemote(templateId, changes)); }
      catch (error) { setState(previous); throw error; }
    },
    async setGoalStatus(goalId, status, reason) {
      const previous = state;
      const changedAt = new Date().toISOString();
      const progressId = crypto.randomUUID();
      const progressContent = status === "achieved" ? "Cel oznaczono jako osiągnięty po świadomym potwierdzeniu." : status === "abandoned" ? `Cel porzucono. Powód: ${reason?.trim()}` : status === "paused" ? "Cel wstrzymano." : "Cel wznowiono.";
      setState((current) => executeDomainCommand(current, { type: "set_goal_status", goalId, status, reason, progressId, progressContent, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).setGoalStatusRemote(goalId, status, reason, progressId, progressContent)); }
      catch (error) { setState(previous); throw error; }
    },
    async setGoalVisibility(goalId, visibility) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "set_goal_visibility", goalId, visibility, changedAt }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).setGoalVisibilityRemote(goalId, visibility));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async setAreaVisibility(areaId, visibility) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "set_area_visibility", areaId, visibility, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).setAreaVisibilityRemote(areaId, visibility)); }
      catch (error) { setState(previous); throw error; }
    },
    async setGoalTemplateVisibility(templateId, visibility) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "set_goal_template_visibility", templateId, visibility, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).setGoalTemplateVisibilityRemote(templateId, visibility)); }
      catch (error) { setState(previous); throw error; }
    },
    async setRecurringStatus(templateId, status) {
      const previous = state;
      const changedAt = new Date().toISOString();
      setState((current) => executeDomainCommand(current, { type: "set_recurring_status", templateId, status, changedAt }));
      if (mode === "demo") return;
      try { await runRemote(async () => (await loadRepository()).setRecurringStatusRemote(templateId, status)); }
      catch (error) { setState(previous); throw error; }
    },
    async createRecurringAction(input) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const template = {
        id,
        title: input.title.trim(),
        detail: input.detail?.trim() ?? "",
        goalId: input.goalId,
        areaId: input.areaId,
        timezone: input.timezone ?? "Europe/Warsaw",
        startsOn: input.startsOn,
        rule: input.rule,
        missedPolicy: input.missedPolicy ?? "skip_missed" as const,
        status: "active" as const,
        checklist: (input.checklist ?? []).filter(Boolean).map((title) => ({ title: title.trim() })),
        skippedOccurrenceCount: 0,
        createdAt: now,
        updatedAt: now
      };
      const previous = stateRef.current;
      const next = executeDomainCommand(previous, { type: "create_recurring_template", template });
      stateRef.current = next;
      setState(next);
      if (mode === "demo") return id;
      if (!previous.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).createRecurringTemplateRemote(previous.workspaceId!, template));
        return id;
      } catch (error) {
        stateRef.current = previous;
        setState(previous);
        throw error;
      }
    },
    async updateRecurringAction(templateId, changes, updateFutureActions = true) {
      const previous = stateRef.current;
      const changedAt = new Date().toISOString();
      const current = previous.recurringActionTemplates.find((item) => item.id === templateId);
      if (!current) throw new Error("Nie znaleziono serii cyklicznej.");
      const normalized = {
        ...changes,
        checklist: changes.checklist?.filter(Boolean).map((title) => ({ title: title.trim() }))
      };
      const next = executeDomainCommand(previous, {
        type: "update_recurring_template",
        templateId,
        changes: normalized,
        updateFutureActions,
        effectiveFrom: changes.startsOn ?? new Date().toISOString().slice(0, 10),
        changedAt
      });
      stateRef.current = next;
      setState(next);
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).updateRecurringTemplateRemote(templateId, changes, updateFutureActions, changes.startsOn ?? new Date().toISOString().slice(0, 10)));
      } catch (error) {
        stateRef.current = previous;
        setState(previous);
        throw error;
      }
    },
    async materializeRecurring(today = new Date().toISOString().slice(0, 10)) {
      const previous = stateRef.current;
      const next = materializeRecurringActions(previous, today);
      const created = next.actions.filter((action) => !previous.actions.some((current) => current.id === action.id) && action.recurringTemplateId && action.occurrenceDate);
      stateRef.current = next;
      setState(next);
      if (mode === "demo" || !previous.workspaceId) return;
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          await Promise.all(created.map((action) => repository.materializeRecurringOccurrenceRemote(previous.workspaceId!, action.recurringTemplateId!, crypto.randomUUID(), action.occurrenceDate!, crypto.randomUUID())));
        });
      } catch (error) {
        stateRef.current = previous;
        setState(previous);
        throw error;
      }
    },
    async linkKnowledge(knowledgeItemId, target, meaning = "reference") {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "link_knowledge", id, knowledgeItemId, ...target, meaning, createdAt }));
      if (mode === "demo") return;
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).linkKnowledgeRemote(state.workspaceId!, id, knowledgeItemId, target, meaning));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async unlinkKnowledge(linkId) {
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "unlink_knowledge", linkId }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).unlinkKnowledgeRemote(linkId));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
    async triageInboxIntent(inboxItemId, input) {
      const decidedAt = new Date().toISOString();
      const intent: InboxTriageIntent = input.kind === "goal" ? {
        ...input, goalId: crypto.randomUUID(), actionId: input.firstActionTitle?.trim() ? crypto.randomUUID() : undefined
      } : input.kind === "action" ? { ...input, actionId: crypto.randomUUID() } : {
        ...input, knowledgeId: crypto.randomUUID(), linkId: input.goalId ? crypto.randomUUID() : undefined
      };
      const previous = state;
      setState((current) => executeDomainCommand(current, { type: "triage_inbox_intent", inboxItemId, intent, decidedAt }));
      if (mode === "demo") return;
      if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => (await loadRepository()).triageInboxIntentRemote(state.workspaceId!, inboxItemId, intent, inboxItemId));
      } catch (error) {
        setState(previous);
        throw error;
      }
    },
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
      const normalized = normalizeCapture(content, kind);
      const trimmed = normalized.content;
      kind = normalized.kind;
      const optimisticId = crypto.randomUUID();
      const optimisticItem = { id: optimisticId, kind, content: trimmed, createdAt: new Date().toISOString(), status: "unprocessed" as const };
      setState((current) => ({ ...current, inbox: [optimisticItem, ...current.inbox] }));
      if (mode === "demo") return;
      const workspaceId = state.workspaceId;
      if (!workspaceId) {
        const error = new Error("Brak aktywnego Workspace.");
        setMutationError(error.message);
        throw error;
      }
      try {
        await runRemote(async () => {
          const repository = await loadRepository();
          const saved = await repository.captureRemote(workspaceId, trimmed, kind, optimisticId);
          setState((current) => ({ ...current, inbox: current.inbox.map((item) => item.id === optimisticId ? saved : item) }));
        });
      } catch (error) {
        setState((current) => ({ ...current, inbox: current.inbox.filter((item) => item.id !== optimisticId) }));
        throw error;
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
    async releaseDueInbox(now = new Date()) {
      const previous = stateRef.current;
      const released = releaseDueInboxItems(previous, now);
      if (released === previous) return;
      setState(released);
      if (mode === "demo" || !previous.workspaceId) return;
      try { await runRemote(async () => { await (await loadRepository()).releaseDueInboxItemsRemote(previous.workspaceId!); }); }
      catch (error) { setState(previous); throw error; }
    },
    async createKnowledge(input: CreateKnowledgeInput) {
      const id = crypto.randomUUID();
      const previous = state;
      const relations = (input.relations ?? []).map((relation) => ({ ...relation, id: relation.id ?? crypto.randomUUID() }));
      setState((current) => {
        const createdAt = new Date().toISOString();
        const created = executeDomainCommand(current, { type: "create_knowledge", id, kind: input.kind, title: input.title, detail: input.detail, sourceUrl: input.sourceUrl, projectId: input.projectId, sourceInboxItemId: input.sourceInboxItemId, createdAt });
        return relations.reduce((next, relation) => executeDomainCommand(next, { type: "link_knowledge", id: relation.id!, knowledgeItemId: id, ...relation.target, meaning: relation.meaning, createdAt }), created);
      });
      if (mode === "supabase") {
        if (!state.workspaceId) throw new Error("Brak aktywnego Workspace.");
        try {
          await runRemote(async () => {
            const repository = await loadRepository();
            await repository.createKnowledgeRemote(state.workspaceId!, id, input, relations);
          });
        } catch (error) {
          setState(previous);
          throw error;
        }
      }
      return id;
    },
    async recordActionResult(actionId: string, result: ActionResultInput) {
      const previous = stateRef.current;
      const existingLink = previous.knowledgeLinks.find((link) => link.actionId === actionId && link.meaning === "result");
      if (existingLink) return existingLink.knowledgeItemId;
      const action = previous.actions.find((candidate) => candidate.id === actionId);
      if (!action) throw new Error("action_not_found");
      const knowledgeId = result.kind === "existing" ? result.knowledgeItemId : crypto.randomUUID();
      const linkId = crypto.randomUUID();
      const progressId = action.goalId ? crypto.randomUUID() : undefined;
      const createdAt = new Date().toISOString();
      const next = executeDomainCommand(previous, { type: "record_action_result", actionId, result, knowledgeId, linkId, progressId, createdAt });
      stateRef.current = next;
      setState(next);
      if (mode === "demo") return knowledgeId;
      if (!previous.workspaceId) throw new Error("Brak aktywnego Workspace.");
      try {
        await runRemote(async () => {
          await (await loadRepository()).recordActionResultRemote(previous.workspaceId!, actionId, result, knowledgeId, linkId, progressId);
        });
        return knowledgeId;
      } catch (error) {
        stateRef.current = previous;
        setState(previous);
        throw error;
      }
    },
    async updateKnowledge(knowledgeId, changes) {
      const previous = state;
      const changedAt = new Date().toISOString();
      const goalLinks = changes.goalIds === undefined ? undefined : [...new Set(changes.goalIds)].map((goalId) => ({
        id: previous.knowledgeLinks.find((link) => link.knowledgeItemId === knowledgeId && link.goalId === goalId)?.id ?? crypto.randomUUID(),
        goalId
      }));
      const { goalIds: _goalIds, ...knowledgeChanges } = changes;
      void _goalIds;
      setState((current) => executeDomainCommand(current, { type: "update_knowledge", knowledgeId, ...knowledgeChanges, goalLinks, changedAt }));
      if (mode === "demo") return;
      try {
        await runRemote(async () => (await loadRepository()).updateKnowledgeRemote(knowledgeId, knowledgeChanges, goalLinks));
      } catch (error) {
        setState(previous);
        throw error;
      }
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
      if (mode === "demo") {
        setState((current) => releaseDueInboxItems(current, new Date()));
        return;
      }
      if (state.workspaceId) await runRemote(async () => { await (await loadRepository()).releaseDueInboxItemsRemote(state.workspaceId!); });
      await remoteQuery.refetch();
    },
    resetDemo() {
      localStorage.removeItem(STORAGE_KEY);
      void localRepository.clear();
      setState(cloneDemoState());
    }
  }), [ensureWorkspaceState, localHydrated, localRepository, mode, mutationError, remoteQuery, runRemote, scratchpadStatus, state, syncing, user]);

  if (mode === "supabase" && remoteQuery.isPending) {
    return <div className="app-loading" role="status"><span className="loading-mark">&gt;_</span><span>Ładowanie Workspace…</span></div>;
  }
  if (mode === "demo" && !localHydrated) {
    return <div className="app-loading" role="status"><span className="loading-mark">&gt;_</span><span>Ładowanie Workspace…</span></div>;
  }
  if (mode === "supabase" && remoteQuery.isError && !remoteQuery.data) {
    const message = remoteQuery.error instanceof Error ? remoteQuery.error.message : "Nie udało się załadować Workspace.";
    return <div className="workspace-error" role="alert"><span className="loading-mark">!</span><h1>Nie udało się otworzyć Workspace</h1><p>{message}</p><button className="button button-primary" onClick={() => void remoteQuery.refetch()}>Spróbuj ponownie</button></div>;
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
