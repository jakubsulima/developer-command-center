import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { demoState } from "../data/demo";
import { emptyState } from "../data/empty";
import { createLocalWorkspaceRepository } from "../data/localWorkspaceRepository";
import { executeDomainCommand, type InboxTriageIntent } from "../domain/commands";
import { ensureGoalModel, migrateLegacyWorkspaceState } from "../domain/goals";
import { materializeRecurringActions } from "../domain/recurrence";
import { normalizeCapture } from "../domain/capture";
import { releaseDueInboxItems } from "../domain/inbox";
import type { ActionResultInput, AppState, CreateKnowledgeInput, NewLearningGoalInput, NewProjectInput } from "../domain/types";
import { StoreContext, type AppStore, type CreatedProjectReference } from "./store-context";
import { WorkspaceMutationCoordinator } from "./workspaceMutationCoordinator";
import { markStartupPhase, recordStartupTiming } from "../lib/startupMetrics";
import type { AIGoalReview } from "../domain/aiGoalReview";
import { AIGoalReviewError } from "../domain/aiGoalReview";
import { AppErrorReporter } from "../lib/appErrorReporter";
import type { AIInboxTriageFeedbackRating } from "../domain/aiInboxTriage";

const STORAGE_KEY = "command-center-state-v1";
const loadRepository = () => import("../data/supabaseRepository");

type MutationScope = { collection: keyof AppState; ids: string[] };

function operationTypeFromMutationKey(key: string) {
  const type = key.split(":", 1)[0]?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return type || "workspace";
}

function restoreMutationScopes(current: AppState, previous: AppState, scopes: MutationScope[]) {
  let next = current;
  for (const scope of scopes) {
    const ids = new Set(scope.ids);
    const previousItems = previous[scope.collection];
    const currentItems = current[scope.collection];
    if (!Array.isArray(previousItems) || !Array.isArray(currentItems)) continue;
    const previousById = new Map((previousItems as Array<{ id: string }>).map((item) => [item.id, item]));
    const currentIds = new Set((currentItems as Array<{ id: string }>).map((item) => item.id));
    next = {
      ...next,
      [scope.collection]: [
        ...(currentItems as Array<{ id: string }>).filter((item) => !ids.has(item.id) || previousById.has(item.id)).map((item) => previousById.get(item.id) ?? item),
        ...(previousItems as Array<{ id: string }>).filter((item) => ids.has(item.id) && !currentIds.has(item.id))
      ]
    } as AppState;
  }
  return next;
}

function runScopedCommand(
  coordinator: WorkspaceMutationCoordinator<AppState>,
  getState: () => AppState,
  key: string,
  command: Parameters<typeof executeDomainCommand>[1],
  scopes: MutationScope[],
  persist: () => Promise<void>
) {
  let previous: AppState;
  return coordinator.run({
    key,
    apply: () => {
      previous = getState();
      const nextState = executeDomainCommand(previous, command);
      return {
        nextState,
        rollback: (current) => restoreMutationScopes(current, previous, scopes),
        reapply: (fresh) => executeDomainCommand(fresh, command)
      };
    },
    persist
  });
}


function cloneDemoState() {
  return ensureGoalModel(structuredClone(demoState));
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
  const [localHydrated, setLocalHydrated] = useState(legacyMigrationRef.current);
  const localRepository = useMemo(() => createLocalWorkspaceRepository(), []);
  const mutationCoordinator = useMemo(() => new WorkspaceMutationCoordinator<AppState>({
    getState: () => stateRef.current,
    setState: (next) => {
      stateRef.current = next;
      setState(next);
    },
    onError: (key, error) => AppErrorReporter.report(error, "mutation", { operationType: operationTypeFromMutationKey(key) })
  }), []);
  const syncState = useSyncExternalStore(mutationCoordinator.subscribe, mutationCoordinator.getSyncState, mutationCoordinator.getSyncState);
  const [aiGoalReview, setAIGoalReview] = useState<AIGoalReview>();
  const [aiGoalReviewStatus, setAIGoalReviewStatus] = useState<"idle" | "loading" | "refreshing" | "ready" | "error">("idle");
  const [aiGoalReviewError, setAIGoalReviewError] = useState<{ code: string; message: string }>();
  const aiReviewSignatureRef = useRef<string | undefined>(undefined);

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
      if (saved) setState(migrateLegacyWorkspaceState(saved));
      setLocalHydrated(true);
    }).catch(() => setLocalHydrated(true));
    return () => { active = false; };
  }, [localRepository, mode]);

  useEffect(() => {
    if (mode !== "demo" || !localHydrated) return;
    void localRepository.save(state)
      .then(() => {
        localStorage.removeItem(STORAGE_KEY);
      })
      .catch((error: unknown) => {
        mutationCoordinator.recordError("workspace", error, "Nie udało się zapisać lokalnego Workspace.");
      });
  }, [localHydrated, localRepository, mode, mutationCoordinator, state]);

  useEffect(() => {
    if (remoteQuery.data) {
      const hydrated = migrateLegacyWorkspaceState(remoteQuery.data);
      mutationCoordinator.refresh(hydrated);
    }
  }, [mutationCoordinator, remoteQuery.data]);

  const aiReviewSignature = useMemo(() => JSON.stringify({
    goals: state.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"),
    criteria: state.goalCriteria,
    actions: state.actions.filter((action) => action.goalId),
    progress: state.progressEntries.slice(0, 250)
  }), [state.actions, state.goalCriteria, state.goals, state.progressEntries]);

  useEffect(() => {
    if (aiGoalReview && aiReviewSignatureRef.current && aiReviewSignatureRef.current !== aiReviewSignature && !aiGoalReview.stale) {
      setAIGoalReview({ ...aiGoalReview, stale: true });
    }
  }, [aiGoalReview, aiReviewSignature]);

  useEffect(() => {
    if (!state.workspaceId || aiGoalReviewStatus !== "idle") return;
    let active = true;
    const repositoryPromise = mode === "demo" ? Promise.resolve(localRepository) : import("../data/supabaseWorkspaceRepository").then((module) => module.createSupabaseWorkspaceRepository());
    void repositoryPromise.then((repository) => repository.getLatestGoalReview(state.workspaceId!)).then((review) => {
      if (!active || !review) return;
      aiReviewSignatureRef.current = aiReviewSignature;
      setAIGoalReview(review);
      setAIGoalReviewStatus("ready");
    }).catch(() => { /* AI pozostaje opcjonalne i nie blokuje Workspace. */ });
    return () => { active = false; };
  }, [aiGoalReviewStatus, aiReviewSignature, localRepository, mode, state.workspaceId]);


  const runRemote = useCallback(async (operation: () => Promise<void>, key = "workspace") => {
    mutationCoordinator.clearError(key);
    try {
      await operation();
    } catch (error) {
      mutationCoordinator.recordError(key, error, "Nie udało się zsynchronizować zmiany.");
      if (key === "workspace") AppErrorReporter.report(error, "mutation", { operationType: "workspace" });
      throw error;
    }
  }, [mutationCoordinator]);

  const ensureWorkspaceState = useCallback(async () => {
    const current = stateRef.current;
    if (mode !== "supabase" || current.workspaceId) return current;

    const refreshed = await remoteQuery.refetch();
    if (refreshed.error) throw refreshed.error;
    if (!refreshed.data?.workspaceId) {
      throw new Error("Użytkownik nie ma przypisanego Workspace.");
    }

    const hydrated = migrateLegacyWorkspaceState(refreshed.data);
    stateRef.current = hydrated;
    setState(hydrated);
    return hydrated;
  }, [mode, remoteQuery]);

  const value = useMemo<AppStore>(() => ({
    state,
    mode,
    loading: mode === "supabase" ? remoteQuery.isPending : !localHydrated,
    syncState,
    aiGoalReview,
    aiGoalReviewStatus,
    aiGoalReviewError,
    async requestGoalReview(forceRefresh = false) {
      const current = await ensureWorkspaceState();
      const workspaceId = current.workspaceId ?? (mode === "demo" ? "demo" : undefined);
      if (!workspaceId) throw new Error("Brak aktywnego Workspace.");
      setAIGoalReviewStatus(aiGoalReview ? "refreshing" : "loading");
      setAIGoalReviewError(undefined);
      try {
        const repository = mode === "demo" ? localRepository : (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository();
        const review = await repository.requestGoalReview(workspaceId, forceRefresh);
        aiReviewSignatureRef.current = JSON.stringify({ goals: stateRef.current.goals.filter((goal) => goal.status === "active" && goal.visibility === "active"), criteria: stateRef.current.goalCriteria, actions: stateRef.current.actions.filter((action) => action.goalId), progress: stateRef.current.progressEntries.slice(0, 250) });
        setAIGoalReview(review);
        setAIGoalReviewStatus("ready");
      } catch (error) {
        const code = error instanceof AIGoalReviewError ? error.code : (error as { code?: string })?.code ?? "PROVIDER_REJECTED";
        const message = error instanceof Error ? error.message : "Nie udało się wygenerować Przeglądu AI.";
        setAIGoalReviewError({ code, message });
        setAIGoalReviewStatus("error");
      }
    },
    async submitGoalReviewFeedback(recommendationId, rating) {
      if (!aiGoalReview || !state.workspaceId) return;
      const repository = mode === "demo" ? localRepository : (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository();
      await repository.submitGoalReviewFeedback(state.workspaceId, aiGoalReview.reviewId, recommendationId, rating);
    },
    async requestInboxTriageProposal(inboxItemId, forceRefresh = false) {
      const current = await ensureWorkspaceState();
      const workspaceId = current.workspaceId ?? (mode === "demo" ? "demo" : undefined);
      if (!workspaceId) throw new Error("Brak aktywnego Workspace.");
      const repository = mode === "demo" ? localRepository : (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository();
      return repository.requestInboxTriageProposal(workspaceId, inboxItemId, forceRefresh);
    },
    async submitInboxTriageFeedback(proposalId, rating: AIInboxTriageFeedbackRating) {
      const current = await ensureWorkspaceState();
      const workspaceId = current.workspaceId ?? (mode === "demo" ? "demo" : undefined);
      if (!workspaceId) return;
      const repository = mode === "demo" ? localRepository : (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository();
      await repository.submitInboxTriageFeedback(workspaceId, proposalId, rating);
    },
    async search(query, limit = 20) {
      if (mode === "demo") return localRepository.search(query, limit);
      return (await import("../data/supabaseWorkspaceRepository")).createSupabaseWorkspaceRepository().search(query, limit);
    },
    async createGoal(input) {
      await ensureWorkspaceState();
      const goalId = crypto.randomUUID();
      const actionId = input.firstActionTitle?.trim() ? crypto.randomUUID() : undefined;
      const criteria = (input.criteria ?? []).filter((title) => title.trim()).map((title) => ({ id: crypto.randomUUID(), title, completed: false }));
      const createdAt = new Date().toISOString();
      const command = {
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
      } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal:${goalId}`, command, [
        { collection: "goals", ids: [goalId] },
        { collection: "actions", ids: actionId ? [actionId] : [] },
        { collection: "goalCriteria", ids: criteria.map((item) => item.id) }
      ], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).createGoalRemote(stateRef.current.workspaceId!, goalId, actionId, input, criteria, goalId), `goal:${goalId}`);
      });
      return goalId;
    },
    async updateGoal(goalId, changes) {
      const changedAt = new Date().toISOString();
      const command = { type: "update_goal", goalId, ...changes, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal:${goalId}`, command, [{ collection: "goals", ids: [goalId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).updateGoalRemote(goalId, changes), `goal:${goalId}`);
      });
    },
    async createAction(input) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const command = { type: "create_action", id, ...input, createdAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `action:${id}`, command, [{ collection: "actions", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).createActionRemote(stateRef.current.workspaceId!, id, input), `action:${id}`);
      });
      return id;
    },
    async updateAction(actionId, changes) {
      await ensureWorkspaceState();
      let expectedVersion = 1;
      let failed = false;
      await mutationCoordinator.run({
        key: `action:${actionId}`,
        apply: () => {
          const previousAction = stateRef.current.actions.find((action) => action.id === actionId);
          expectedVersion = previousAction?.version ?? 1;
          const changedAt = new Date().toISOString();
          const nextState = executeDomainCommand(stateRef.current, { type: "update_action", actionId, expectedVersion, ...changes, changedAt });
          const optimisticAction = nextState.actions.find((action) => action.id === actionId);
          return {
            nextState,
            rollback: (current: AppState) => previousAction ? { ...current, actions: current.actions.map((action) => action.id === actionId ? previousAction : action) } : current,
            reapply: (fresh: AppState) => optimisticAction ? { ...fresh, actions: fresh.actions.map((action) => action.id === actionId ? optimisticAction : action) } : fresh
          };
        },
        persist: async () => {
          if (mode === "demo") return;
          try {
            await runRemote(async () => (await loadRepository()).updateActionRemote(actionId, expectedVersion, changes), `action:${actionId}`);
          } catch (error) {
            failed = true;
            throw error;
          }
        },
        reconcile: async () => {
          if (!failed) return undefined;
          const refreshed = await remoteQuery.refetch();
          return refreshed.data ? migrateLegacyWorkspaceState(refreshed.data) : undefined;
        }
      });
    },
    async setActionStatus(actionId, status, blocker) {
      const changedAt = new Date().toISOString();
      const command = { type: "set_action_status", actionId, status, blocker, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `action:${actionId}`, command, [{ collection: "actions", ids: [actionId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setActionStatusRemote(actionId, status, blocker), `action:${actionId}`);
      });
    },
    async setNextAction(goalId, actionId) {
      const command = { type: "set_next_action", goalId, actionId } as const;
      const affected = stateRef.current.actions.filter((action) => action.goalId === goalId && (action.isNext || action.id === actionId)).map((action) => action.id);
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal:${goalId}:next-action`, command, [{ collection: "actions", ids: affected }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setNextActionRemote(goalId, actionId), `goal:${goalId}:next-action`);
      });
    },
    async addProgress(goalId, kind, content, actionId, knowledgeItemId) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const command = { type: "add_progress", id, goalId, kind, content, actionId, knowledgeItemId, createdAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `progress:${id}`, command, [{ collection: "progressEntries", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).addProgressRemote(stateRef.current.workspaceId!, id, goalId, kind, content, actionId, knowledgeItemId), `progress:${id}`);
      });
    },
    async createArea(name, description) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const command = { type: "create_area", id, name, description, createdAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `area:${id}`, command, [{ collection: "areas", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).createAreaRemote(stateRef.current.workspaceId!, id, name, description), `area:${id}`);
      });
      return id;
    },
    async updateArea(areaId, changes) {
      const changedAt = new Date().toISOString();
      const command = { type: "update_area", areaId, ...changes, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `area:${areaId}`, command, [{ collection: "areas", ids: [areaId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).updateAreaRemote(areaId, changes), `area:${areaId}`);
      });
    },
    async createGoalTemplate(name, kind, defaultActions) {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const command = { type: "create_goal_template", id, name, kind, defaultActions, createdAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal-template:${id}`, command, [{ collection: "goalTemplates", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).createGoalTemplateRemote(stateRef.current.workspaceId!, id, name, kind, defaultActions), `goal-template:${id}`);
      });
      return id;
    },
    async updateGoalTemplate(templateId, changes) {
      const changedAt = new Date().toISOString();
      const command = { type: "update_goal_template", templateId, ...changes, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal-template:${templateId}`, command, [{ collection: "goalTemplates", ids: [templateId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).updateGoalTemplateRemote(templateId, changes), `goal-template:${templateId}`);
      });
    },
    async setGoalStatus(goalId, status, reason) {
      const changedAt = new Date().toISOString();
      const progressId = crypto.randomUUID();
      const progressContent = status === "achieved" ? "Cel oznaczono jako osiągnięty po świadomym potwierdzeniu." : status === "abandoned" ? `Cel porzucono. Powód: ${reason?.trim()}` : status === "paused" ? "Cel wstrzymano." : "Cel wznowiono.";
      const command = { type: "set_goal_status", goalId, status, reason, progressId, progressContent, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal:${goalId}`, command, [{ collection: "goals", ids: [goalId] }, { collection: "progressEntries", ids: [progressId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setGoalStatusRemote(goalId, status, reason, progressId, progressContent), `goal:${goalId}`);
      });
    },
    async setGoalVisibility(goalId, visibility) {
      const changedAt = new Date().toISOString();
      const command = { type: "set_goal_visibility", goalId, visibility, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal:${goalId}`, command, [{ collection: "goals", ids: [goalId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setGoalVisibilityRemote(goalId, visibility), `goal:${goalId}`);
      });
    },
    async setAreaVisibility(areaId, visibility) {
      const changedAt = new Date().toISOString();
      const command = { type: "set_area_visibility", areaId, visibility, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `area:${areaId}`, command, [{ collection: "areas", ids: [areaId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setAreaVisibilityRemote(areaId, visibility), `area:${areaId}`);
      });
    },
    async setGoalTemplateVisibility(templateId, visibility) {
      const changedAt = new Date().toISOString();
      const command = { type: "set_goal_template_visibility", templateId, visibility, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `goal-template:${templateId}`, command, [{ collection: "goalTemplates", ids: [templateId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setGoalTemplateVisibilityRemote(templateId, visibility), `goal-template:${templateId}`);
      });
    },
    async setRecurringStatus(templateId, status) {
      const changedAt = new Date().toISOString();
      const command = { type: "set_recurring_status", templateId, status, changedAt } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `routine:${templateId}`, command, [{ collection: "recurringActionTemplates", ids: [templateId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setRecurringStatusRemote(templateId, status), `routine:${templateId}`);
      });
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
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `routine:${id}`, { type: "create_recurring_template", template }, [{ collection: "recurringActionTemplates", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).createRecurringTemplateRemote(stateRef.current.workspaceId!, template), `routine:${id}`);
      });
      return id;
    },
    async updateRecurringAction(templateId, changes, updateFutureActions = true) {
      await ensureWorkspaceState();
      const previous = stateRef.current;
      const changedAt = new Date().toISOString();
      const current = previous.recurringActionTemplates.find((item) => item.id === templateId);
      if (!current) throw new Error("Nie znaleziono serii cyklicznej.");
      const normalized = {
        ...changes,
        checklist: changes.checklist?.filter(Boolean).map((title) => ({ title: title.trim() }))
      };
      const command = {
        type: "update_recurring_template",
        templateId,
        changes: normalized,
        updateFutureActions,
        effectiveFrom: changes.startsOn ?? new Date().toISOString().slice(0, 10),
        changedAt
      } as const;
      const affectedActions = updateFutureActions
        ? previous.actions.filter((action) => action.recurringTemplateId === templateId).map((action) => action.id)
        : [];
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `routine:${templateId}`, command, [
        { collection: "recurringActionTemplates", ids: [templateId] },
        { collection: "actions", ids: affectedActions }
      ], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).updateRecurringTemplateRemote(templateId, changes, updateFutureActions, command.effectiveFrom), `routine:${templateId}`);
      });
    },
    async materializeRecurring(today = new Date().toISOString().slice(0, 10)) {
      await ensureWorkspaceState();
      let created: AppState["actions"] = [];
      await mutationCoordinator.run({
        key: "routine:materialize",
        apply: () => {
          const previous = stateRef.current;
          const next = materializeRecurringActions(previous, today);
          created = next.actions.filter((action) => !previous.actions.some((current) => current.id === action.id) && action.recurringTemplateId && action.occurrenceDate);
          const createdIds = new Set(created.map((action) => action.id));
          return {
            nextState: next,
            rollback: (current: AppState) => restoreMutationScopes(current, previous, [{ collection: "actions", ids: [...createdIds] }]),
            reapply: (fresh: AppState) => materializeRecurringActions(fresh, today)
          };
        },
        persist: async () => {
          if (mode === "demo" || !stateRef.current.workspaceId) return;
          await runRemote(async () => {
            const repository = await loadRepository();
            await Promise.all(created.map((action) => repository.materializeRecurringOccurrenceRemote(stateRef.current.workspaceId!, action.recurringTemplateId!, crypto.randomUUID(), action.occurrenceDate!, crypto.randomUUID())));
          }, "routine:materialize");
        }
      });
    },
    async linkKnowledge(knowledgeItemId, target, meaning = "reference") {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `knowledge-link:${id}`, { type: "link_knowledge", id, knowledgeItemId, ...target, meaning, createdAt }, [{ collection: "knowledgeLinks", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).linkKnowledgeRemote(stateRef.current.workspaceId!, id, knowledgeItemId, target, meaning), `knowledge-link:${id}`);
      });
    },
    async unlinkKnowledge(linkId) {
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `knowledge-link:${linkId}`, { type: "unlink_knowledge", linkId }, [{ collection: "knowledgeLinks", ids: [linkId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).unlinkKnowledgeRemote(linkId), `knowledge-link:${linkId}`);
      });
    },
    async triageInboxIntent(inboxItemId, input) {
      const decidedAt = new Date().toISOString();
      const intent: InboxTriageIntent = input.kind === "goal" ? {
        ...input, goalId: crypto.randomUUID(), actionId: input.firstActionTitle?.trim() ? crypto.randomUUID() : undefined
      } : input.kind === "action" ? { ...input, actionId: crypto.randomUUID() } : {
        ...input, knowledgeId: crypto.randomUUID(), linkId: input.goalId || input.projectId ? crypto.randomUUID() : undefined
      };
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const scopes: MutationScope[] = [{ collection: "inbox", ids: [inboxItemId] }];
      if (intent.kind === "goal") scopes.push({ collection: "goals", ids: [intent.goalId] }, { collection: "actions", ids: intent.actionId ? [intent.actionId] : [] });
      if (intent.kind === "action") scopes.push({ collection: "actions", ids: [intent.actionId] });
      if (intent.kind === "knowledge") scopes.push({ collection: "knowledge", ids: [intent.knowledgeId] }, { collection: "knowledgeLinks", ids: intent.linkId ? [intent.linkId] : [] });
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `inbox:${inboxItemId}`, { type: "triage_inbox_intent", inboxItemId, intent, decidedAt }, scopes, async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).triageInboxIntentRemote(stateRef.current.workspaceId!, inboxItemId, intent, inboxItemId), `inbox:${inboxItemId}`);
      });
    },
    async createProject(input: NewProjectInput) {
      const id = crypto.randomUUID();
      const reference: CreatedProjectReference = { projectId: id, workItemId: `${id}-work-item` };
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const command = {
        type: "create_project",
        id,
        title: input.title,
        outcome: input.outcome,
        technology: input.technology,
        firstWorkItem: { id: `${id}-work-item`, title: input.firstWorkItemTitle, detail: input.firstWorkItemDescription },
        effortBudgetMinutes: input.effortBudgetMinutes,
        wipOverrideReason: input.wipOverrideReason
      } as const;
      let savedReference = reference;
      await mutationCoordinator.run({
        key: `project:${id}`,
        apply: () => {
          const previous = stateRef.current;
          return {
            nextState: executeDomainCommand(previous, command),
            rollback: (currentState: AppState) => restoreMutationScopes(currentState, previous, [{ collection: "projects", ids: [id] }]),
            reapply: (fresh: AppState) => executeDomainCommand(fresh, command)
          };
        },
        persist: async () => {
          if (mode === "demo") return;
          await runRemote(async () => {
            const repository = await loadRepository();
            const projectId = await repository.createProjectRemote(stateRef.current.workspaceId!, input, id);
            const refreshed = await remoteQuery.refetch();
            const savedProject = refreshed.data?.projects.find((project) => project.id === projectId);
            if (savedProject?.workItems[0]) savedReference = { projectId, workItemId: savedProject.workItems[0].id };
          }, `project:${id}`);
        }
      });
      return savedReference;
    },
    async setCommitmentStatus(projectId, status) {
      await ensureWorkspaceState();
      const command = { type: "set_commitment_status", projectId, status } as const;
      const affected = stateRef.current.projects.filter((project) => project.id === projectId || project.primary || project.commitmentStatus === "active").map((project) => project.id);
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `project:${projectId}:commitment`, command, [{ collection: "projects", ids: affected }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setCommitmentStatusRemote(projectId, status), `project:${projectId}:commitment`);
      });
    },
    setPrimaryCommitment(projectId) {
      setState((current) => executeDomainCommand(current, { type: "set_primary_commitment", projectId }));
    },
    async createLearningGoal(input: NewLearningGoalInput) {
      const id = crypto.randomUUID();
      const goal = { id, title: input.title.trim(), criterion: input.criterion.trim(), status: "shaped" as const, skills: [input.skill.trim()] };
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      await mutationCoordinator.run({
        key: `learning-goal:${id}`,
        apply: () => {
          const previous = stateRef.current;
          return {
            nextState: { ...previous, learningGoals: [...previous.learningGoals, goal] },
            rollback: (currentState: AppState) => restoreMutationScopes(currentState, previous, [{ collection: "learningGoals", ids: [id] }]),
            reapply: (fresh: AppState) => ({ ...fresh, learningGoals: [...fresh.learningGoals, goal] })
          };
        },
        persist: async () => {
          if (mode !== "demo") await runRemote(async () => {
            const repository = await loadRepository();
            await repository.createLearningGoalRemote(stateRef.current.workspaceId!, input, id);
            await remoteQuery.refetch();
          }, `learning-goal:${id}`);
        }
      });
    },
    async setLearningGoalStatus(goalId, status, reason) {
      await ensureWorkspaceState();
      const command = { type: "set_learning_goal_status", goalId, status, reason, changedAt: new Date().toISOString() } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `learning-goal:${goalId}`, command, [{ collection: "learningGoals", ids: [goalId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setLearningGoalStatusRemote(goalId, status, reason), `learning-goal:${goalId}`);
      });
    },
    async capture(content, kind = "text") {
      const normalized = normalizeCapture(content, kind);
      const trimmed = normalized.content;
      kind = normalized.kind;
      const optimisticId = crypto.randomUUID();
      const optimisticItem = { id: optimisticId, kind, content: trimmed, createdAt: new Date().toISOString(), status: "unprocessed" as const };
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      await mutationCoordinator.run({
        key: `inbox:${optimisticId}`,
        apply: () => {
          const previous = stateRef.current;
          return {
            nextState: { ...previous, inbox: [optimisticItem, ...previous.inbox] },
            rollback: (currentState: AppState) => restoreMutationScopes(currentState, previous, [{ collection: "inbox", ids: [optimisticId] }]),
            reapply: (fresh: AppState) => ({ ...fresh, inbox: fresh.inbox.some((item) => item.id === optimisticId) ? fresh.inbox : [optimisticItem, ...fresh.inbox] })
          };
        },
        persist: async () => {
          if (mode !== "demo") await runRemote(async () => { await (await loadRepository()).captureRemote(stateRef.current.workspaceId!, trimmed, kind, optimisticId); }, `inbox:${optimisticId}`);
        }
      });
    },
    async resolveInbox(id) {
      await ensureWorkspaceState();
      try {
        await mutationCoordinator.run({
          key: `inbox:${id}`,
          apply: () => {
            const previous = stateRef.current;
            return {
              nextState: { ...previous, inbox: previous.inbox.map((item) => item.id === id ? { ...item, status: "resolved" } : item) },
              rollback: (currentState: AppState) => restoreMutationScopes(currentState, previous, [{ collection: "inbox", ids: [id] }]),
              reapply: (fresh: AppState) => ({ ...fresh, inbox: fresh.inbox.map((item) => item.id === id ? { ...item, status: "resolved" } : item) })
            };
          },
          persist: async () => {
            if (mode !== "demo") await runRemote(async () => { await (await loadRepository()).resolveInboxRemote(id); }, `inbox:${id}`);
          }
        });
      } catch {
        // The coordinator records the keyed error; this legacy action keeps its void-style API.
      }
    },
    triageInbox(id, target, title, detail, projectId) {
      setState((current) => executeDomainCommand(current, { type: "triage_inbox", inboxItemId: id, target, targetId: crypto.randomUUID(), title, detail, projectId, decidedAt: new Date().toISOString() }));
    },
    async setInboxStatus(id, status, snoozedUntil) {
      await ensureWorkspaceState();
      const command = { type: "set_inbox_status", inboxItemId: id, status, snoozedUntil, changedAt: new Date().toISOString() } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `inbox:${id}`, command, [{ collection: "inbox", ids: [id] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setInboxStatusRemote(id, status, snoozedUntil), `inbox:${id}`);
      });
    },
    async releaseDueInbox(now = new Date()) {
      const previous = stateRef.current;
      const released = releaseDueInboxItems(previous, now);
      if (released === previous) return;
      const affected = previous.inbox.filter((item) => item.status === "snoozed" && item.snoozedUntil && new Date(item.snoozedUntil).getTime() <= now.getTime()).map((item) => item.id);
      await mutationCoordinator.run({
        key: "inbox:release-due",
        apply: () => {
          const base = stateRef.current;
          const next = releaseDueInboxItems(base, now);
          return {
            nextState: next,
            rollback: (current: AppState) => restoreMutationScopes(current, base, [{ collection: "inbox", ids: affected }]),
            reapply: (fresh: AppState) => releaseDueInboxItems(fresh, now)
          };
        },
        persist: async () => {
          if (mode !== "demo" && stateRef.current.workspaceId) await runRemote(async () => { await (await loadRepository()).releaseDueInboxItemsRemote(stateRef.current.workspaceId!); }, "inbox:release-due");
        }
      });
    },
    async createKnowledge(input: CreateKnowledgeInput) {
      const id = crypto.randomUUID();
      const relations = (input.relations ?? []).map((relation) => ({ ...relation, id: relation.id ?? crypto.randomUUID() }));
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const scopes: MutationScope[] = [{ collection: "knowledge", ids: [id] }, { collection: "knowledgeLinks", ids: relations.map((relation) => relation.id!) }];
      const applyCreate = (base: AppState) => {
        const createdAt = new Date().toISOString();
        const created = executeDomainCommand(base, { type: "create_knowledge", id, kind: input.kind, title: input.title, detail: input.detail, sourceUrl: input.sourceUrl, projectId: input.projectId, sourceInboxItemId: input.sourceInboxItemId, createdAt });
        return relations.reduce((next, relation) => executeDomainCommand(next, { type: "link_knowledge", id: relation.id!, knowledgeItemId: id, ...relation.target, meaning: relation.meaning, createdAt }), created);
      };
      await mutationCoordinator.run({
        key: `knowledge:${id}`,
        apply: () => {
          const base = stateRef.current;
          return {
            nextState: applyCreate(base),
            rollback: (currentState: AppState) => restoreMutationScopes(currentState, base, scopes),
            reapply: (fresh: AppState) => applyCreate(fresh)
          };
        },
        persist: async () => {
          if (mode !== "demo") await runRemote(async () => await (await loadRepository()).createKnowledgeRemote(stateRef.current.workspaceId!, id, input, relations), `knowledge:${id}`);
        }
      });
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
      const current = await ensureWorkspaceState();
      if (mode !== "demo" && !current.workspaceId) throw new Error("Brak aktywnego Workspace.");
      const scopes: MutationScope[] = [{ collection: "knowledge", ids: result.kind === "new" ? [knowledgeId] : [] }, { collection: "knowledgeLinks", ids: [linkId] }, { collection: "progressEntries", ids: progressId ? [progressId] : [] }];
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `action:${actionId}:result`, { type: "record_action_result", actionId, result, knowledgeId, linkId, progressId, createdAt }, scopes, async () => {
        if (mode !== "demo") await runRemote(async () => await (await loadRepository()).recordActionResultRemote(stateRef.current.workspaceId!, actionId, result, knowledgeId, linkId, progressId), `action:${actionId}:result`);
      });
      return knowledgeId;
    },
    async updateKnowledge(knowledgeId, changes) {
      const previous = stateRef.current;
      const changedAt = new Date().toISOString();
      const goalLinks = changes.goalIds === undefined ? undefined : [...new Set(changes.goalIds)].map((goalId) => ({
        id: previous.knowledgeLinks.find((link) => link.knowledgeItemId === knowledgeId && link.goalId === goalId)?.id ?? crypto.randomUUID(),
        goalId
      }));
      const { goalIds: _goalIds, ...knowledgeChanges } = changes;
      void _goalIds;
      const linkIds = [...previous.knowledgeLinks.filter((link) => link.knowledgeItemId === knowledgeId && link.goalId).map((link) => link.id), ...(goalLinks ?? []).map((link) => link.id)];
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `knowledge:${knowledgeId}`, { type: "update_knowledge", knowledgeId, ...knowledgeChanges, goalLinks, changedAt }, [
        { collection: "knowledge", ids: [knowledgeId] },
        { collection: "knowledgeLinks", ids: linkIds }
      ], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).updateKnowledgeRemote(knowledgeId, knowledgeChanges, goalLinks), `knowledge:${knowledgeId}`);
      });
    },
    async setVisibility(entityType, entityId, visibility) {
      await ensureWorkspaceState();
      const command = { type: "set_visibility", entityType, entityId, visibility, changedAt: new Date().toISOString() } as const;
      await runScopedCommand(mutationCoordinator, () => stateRef.current, `${entityType}:${entityId}:visibility`, command, [{ collection: entityType === "project" ? "projects" : "knowledge", ids: [entityId] }], async () => {
        if (mode !== "demo") await runRemote(async () => (await loadRepository()).setEntityVisibilityRemote(entityId, visibility), `${entityType}:${entityId}:visibility`);
      });
    },
    async setAIProposal(aiProposal) {
      await ensureWorkspaceState();
      const pendingProposal = stateRef.current.aiProposals.find((proposal) => proposal.status === "pending");
      const proposalId = stateRef.current.aiProposalId;
      const executionId = aiProposal === "approved" ? crypto.randomUUID() : undefined;
      const command = pendingProposal ? {
        type: "decide_ai_proposal",
        proposalId: pendingProposal.id,
        decision: aiProposal === "approved" ? "approved" : "rejected",
        executionId,
        decidedAt: new Date().toISOString()
      } as const : undefined;
      const proposal = pendingProposal;
      if (!command || !proposal || mode === "demo" || !proposalId) {
        setState((current) => command ? executeDomainCommand(current, command) : { ...current, aiProposal });
        return;
      }
      try {
        await mutationCoordinator.run({
          key: `ai-proposal:${proposalId}`,
          apply: () => {
            const previous = stateRef.current;
            return {
              nextState: executeDomainCommand(previous, command),
              rollback: (current: AppState) => ({
                ...restoreMutationScopes(current, previous, [
                  { collection: "aiProposals", ids: [proposal.id] },
                  { collection: "aiExecutions", ids: executionId ? [executionId] : [] }
                ]),
                aiProposal: previous.aiProposal
              }),
              reapply: (fresh: AppState) => executeDomainCommand(fresh, command)
            };
          },
          persist: async () => {
            await runRemote(async () => await (await loadRepository()).decideAIProposalRemote(proposalId, aiProposal), `ai-proposal:${proposalId}`);
          }
        });
      } catch {
        // The coordinator keeps the keyed error visible without leaking a rejected click promise.
      }
    },
    async completeReview(summary = "", type = "weekly", answers = {}) {
      const completedAt = new Date().toISOString();
      const reviewId = crypto.randomUUID();
      const command = { type: "complete_review", reviewId, reviewType: type, templateVersion: 1, answers, summary, completedAt } as const;
      const current = await ensureWorkspaceState();
      try {
        await mutationCoordinator.run({
          key: `review:${reviewId}`,
          apply: () => {
            const previous = stateRef.current;
            return {
              nextState: executeDomainCommand(previous, command),
              rollback: (currentState: AppState) => ({
                ...restoreMutationScopes(currentState, previous, [{ collection: "reviews", ids: [reviewId] }]),
                reviewCompletedAt: previous.reviewCompletedAt
              }),
              reapply: (fresh: AppState) => executeDomainCommand(fresh, command)
            };
          },
          persist: async () => {
            if (mode !== "demo" && current.workspaceId && user) await runRemote(async () => await (await loadRepository()).completeReviewRemote(stateRef.current.workspaceId!, summary), `review:${reviewId}`);
          }
        });
        return true;
      } catch {
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
  }), [aiGoalReview, aiGoalReviewError, aiGoalReviewStatus, ensureWorkspaceState, localHydrated, localRepository, mode, mutationCoordinator, remoteQuery, runRemote, state, syncState, user]);

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
