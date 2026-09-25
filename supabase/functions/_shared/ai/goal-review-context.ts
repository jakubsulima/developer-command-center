export interface GoalReviewContext {
  workspaceId: string;
  windowDays: 7 | 14 | 28;
  sourceSnapshotAt: string;
  periodStart: string;
  periodEnd: string;
  goals: Array<Record<string, unknown> & { id: string; openActions: Array<{ id: string; goalId?: string }>; signals: Array<{ signalKey: string }> }>;
  omittedGoalIds: string[];
}

export interface LimitedGoalReviewContext {
  context: GoalReviewContext;
  serialized: string;
}

function serializeContext(context: GoalReviewContext) {
  return JSON.stringify(context);
}

function incrementCount(goal: Record<string, unknown>, key: string, amount = 1) {
  goal[key] = (typeof goal[key] === "number" ? goal[key] as number : 0) + amount;
}

function shortenTextFields(goal: Record<string, unknown>, maxLengths: { title: number; outcome: number; area: number; criteria: number; action: number; blocker: number; progress: number }) {
  let removed = 0;
  const shorten = (owner: Record<string, unknown>, key: string, max: number) => {
    const value = owner[key];
    if (typeof value !== "string" || value.length <= max) return;
    removed += value.length - max;
    owner[key] = `${value.slice(0, Math.max(0, max - 1))}…`;
  };
  shorten(goal, "title", maxLengths.title);
  shorten(goal, "outcome", maxLengths.outcome);
  const area = goal.area;
  if (area && typeof area === "object" && !Array.isArray(area)) shorten(area as Record<string, unknown>, "name", maxLengths.area);
  if (Array.isArray(goal.criteria)) for (const item of goal.criteria) {
    if (item && typeof item === "object" && !Array.isArray(item)) shorten(item as Record<string, unknown>, "title", maxLengths.criteria);
  }
  if (Array.isArray(goal.openActions)) for (const item of goal.openActions) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const action = item as Record<string, unknown>;
      shorten(action, "title", maxLengths.action);
      shorten(action, "blocker", maxLengths.blocker);
    }
  }
  if (Array.isArray(goal.recentProgress)) for (const item of goal.recentProgress) {
    if (item && typeof item === "object" && !Array.isArray(item)) shorten(item as Record<string, unknown>, "content", maxLengths.progress);
  }
  if (removed) incrementCount(goal, "truncatedDescriptionChars", removed);
}

function fitFirstGoal(context: GoalReviewContext, goal: GoalReviewContext["goals"][number], maxChars: number) {
  const candidate = JSON.parse(JSON.stringify(goal)) as Record<string, unknown> & GoalReviewContext["goals"][number];
  const fits = () => serializeContext({ ...context, goals: [candidate] }).length <= maxChars;
  if (fits()) return candidate;

  const progress = Array.isArray(candidate.recentProgress) ? candidate.recentProgress as unknown[] : [];
  while (progress.length && !fits()) {
    progress.pop();
    incrementCount(candidate, "omittedRecentProgressCount");
  }
  candidate.recentProgress = progress;

  const actions = candidate.openActions;
  while (actions.length && !fits()) {
    actions.pop();
    incrementCount(candidate, "omittedOpenActionsCount");
  }
  candidate.openActions = actions;

  const limits = [
    { title: 180, outcome: 500, area: 120, criteria: 180, action: 180, blocker: 220, progress: 240 },
    { title: 120, outcome: 300, area: 80, criteria: 120, action: 120, blocker: 150, progress: 160 },
    { title: 80, outcome: 160, area: 60, criteria: 80, action: 80, blocker: 100, progress: 100 },
    { title: 48, outcome: 80, area: 40, criteria: 48, action: 48, blocker: 60, progress: 60 },
  ];
  for (const maxLengths of limits) {
    shortenTextFields(candidate, maxLengths);
    if (fits()) return candidate;
  }
  return undefined;
}

/** Keeps a stable prefix of complete RPC goals and counts each item omitted while fitting the provider input budget. */
export function limitGoalReviewContext(context: GoalReviewContext, maxChars = 40_000): LimitedGoalReviewContext {
  if (!Number.isFinite(maxChars) || maxChars < 1) throw new Error("CONTEXT_TOO_LARGE");
  const selected: GoalReviewContext["goals"] = [];
  let overflowAt = context.goals.length;
  for (let index = 0; index < context.goals.length; index += 1) {
    const goal = context.goals[index]!;
    const candidate = { ...context, goals: [...selected, goal] };
    if (serializeContext(candidate).length <= maxChars) {
      selected.push(goal);
      continue;
    }
    if (!selected.length) {
      const fitted = fitFirstGoal({ ...context, omittedGoalIds: context.omittedGoalIds }, goal, maxChars);
      if (!fitted) throw new Error("CONTEXT_TOO_LARGE");
      selected.push(fitted);
      overflowAt = index + 1;
    } else {
      overflowAt = index;
    }
    break;
  }

  const omitted = [...context.goals.slice(overflowAt).map((goal) => goal.id), ...context.omittedGoalIds];
  let limited: GoalReviewContext = { ...context, goals: selected, omittedGoalIds: [...new Set(omitted)] };
  while (serializeContext(limited).length > maxChars && limited.goals.length > 1) {
    const removedGoal = limited.goals.at(-1)!;
    limited = { ...limited, goals: limited.goals.slice(0, -1), omittedGoalIds: [removedGoal.id, ...limited.omittedGoalIds] };
  }
  if (serializeContext(limited).length > maxChars && limited.goals.length === 1) {
    const fitted = fitFirstGoal(limited, limited.goals[0]!, maxChars);
    if (!fitted) throw new Error("CONTEXT_TOO_LARGE");
    limited = { ...limited, goals: [fitted] };
  }
  const serialized = serializeContext(limited);
  if (serialized.length > maxChars) throw new Error("CONTEXT_TOO_LARGE");
  return { context: limited, serialized };
}

export function decodeGoalReviewContext(value: unknown, windowDays: 7 | 14 | 28): GoalReviewContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("WORKSPACE_NOT_AVAILABLE");
  const root = value as Record<string, unknown>;
  if (typeof root.workspaceId !== "string" || typeof root.sourceSnapshotAt !== "string" || typeof root.periodStart !== "string" || typeof root.periodEnd !== "string" || !Array.isArray(root.goals) || !Array.isArray(root.omittedGoalIds)) throw new Error("WORKSPACE_NOT_AVAILABLE");
  const goals = root.goals.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("WORKSPACE_NOT_AVAILABLE");
    const goal = item as Record<string, unknown>;
    if (typeof goal.id !== "string" || !Array.isArray(goal.openActions) || !Array.isArray(goal.signals)) throw new Error("WORKSPACE_NOT_AVAILABLE");
    const { completed28Days, ...normalized } = goal;
    return { ...normalized, completedInWindow: completed28Days } as unknown as GoalReviewContext["goals"][number];
  });
  if (root.omittedGoalIds.some((id) => typeof id !== "string")) throw new Error("WORKSPACE_NOT_AVAILABLE");
  return { workspaceId: root.workspaceId, windowDays, sourceSnapshotAt: root.sourceSnapshotAt, periodStart: root.periodStart, periodEnd: root.periodEnd, goals, omittedGoalIds: root.omittedGoalIds as string[] };
}

export function contextAllowlists(context: GoalReviewContext) {
  const goalIds = new Set(context.goals.map((goal) => goal.id));
  const actionGoal = new Map<string, string>();
  const signalKeys = new Set<string>();
  for (const goal of context.goals) {
    for (const action of goal.openActions) actionGoal.set(action.id, goal.id);
    for (const signal of goal.signals) signalKeys.add(signal.signalKey);
  }
  return { goalIds, actionGoal, signalKeys };
}

export async function hashGoalReviewContext(context: GoalReviewContext) {
  const serialized = JSON.stringify(context);
  const { sourceSnapshotAt: _snapshot, periodStart: _start, periodEnd: _end, ...stableContext } = context;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stableContext)));
  return { serialized, hash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("") };
}
