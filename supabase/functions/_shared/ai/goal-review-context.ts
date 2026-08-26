export interface GoalReviewContext {
  workspaceId: string;
  sourceSnapshotAt: string;
  periodStart: string;
  periodEnd: string;
  goals: Array<Record<string, unknown> & { id: string; openActions: Array<{ id: string; goalId?: string }>; signals: Array<{ signalKey: string }> }>;
  omittedGoalIds: string[];
}

export function decodeGoalReviewContext(value: unknown): GoalReviewContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("WORKSPACE_NOT_AVAILABLE");
  const root = value as Record<string, unknown>;
  if (typeof root.workspaceId !== "string" || typeof root.sourceSnapshotAt !== "string" || typeof root.periodStart !== "string" || typeof root.periodEnd !== "string" || !Array.isArray(root.goals) || !Array.isArray(root.omittedGoalIds)) throw new Error("WORKSPACE_NOT_AVAILABLE");
  const goals = root.goals.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("WORKSPACE_NOT_AVAILABLE");
    const goal = item as Record<string, unknown>;
    if (typeof goal.id !== "string" || !Array.isArray(goal.openActions) || !Array.isArray(goal.signals)) throw new Error("WORKSPACE_NOT_AVAILABLE");
    return goal as GoalReviewContext["goals"][number];
  });
  if (root.omittedGoalIds.some((id) => typeof id !== "string")) throw new Error("WORKSPACE_NOT_AVAILABLE");
  return { workspaceId: root.workspaceId, sourceSnapshotAt: root.sourceSnapshotAt, periodStart: root.periodStart, periodEnd: root.periodEnd, goals, omittedGoalIds: root.omittedGoalIds as string[] };
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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return { serialized, hash: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("") };
}
