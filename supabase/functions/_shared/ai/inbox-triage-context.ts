export interface InboxTriageContext {
  workspaceId: string;
  sourceSnapshotAt: string;
  inbox: { id: string; kind: string; content: string; createdAt: string; status: string; contentChars: number; isLink: boolean };
  goals: Array<{ id: string; title: string; outcome: string; priority: string; targetDate: string | null; areaId: string | null }>;
  projects: Array<{ id: string; title: string; outcome: string; status: string }>;
}

export function decodeInboxTriageContext(value: unknown): InboxTriageContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("WORKSPACE_NOT_AVAILABLE");
  const root = value as Record<string, unknown>;
  if (typeof root.workspaceId !== "string" || typeof root.sourceSnapshotAt !== "string" || !root.inbox || !Array.isArray(root.goals) || !Array.isArray(root.projects)) throw new Error("WORKSPACE_NOT_AVAILABLE");
  const inbox = root.inbox as Record<string, unknown>;
  if (typeof inbox.id !== "string" || typeof inbox.kind !== "string" || typeof inbox.content !== "string" || typeof inbox.createdAt !== "string" || typeof inbox.status !== "string") throw new Error("WORKSPACE_NOT_AVAILABLE");
  return {
    workspaceId: root.workspaceId,
    sourceSnapshotAt: root.sourceSnapshotAt,
    inbox: { id: inbox.id, kind: inbox.kind, content: inbox.content, createdAt: inbox.createdAt, status: inbox.status, contentChars: inbox.content.length, isLink: inbox.kind === "link" },
    goals: root.goals.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((goal) => ({ id: String(goal.id), title: String(goal.title ?? ""), outcome: String(goal.outcome ?? ""), priority: String(goal.priority ?? "normal"), targetDate: typeof goal.targetDate === "string" ? goal.targetDate : null, areaId: typeof goal.areaId === "string" ? goal.areaId : null })),
    projects: root.projects.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((project) => ({ id: String(project.id), title: String(project.title ?? ""), outcome: String(project.outcome ?? ""), status: String(project.status ?? "active") }))
  };
}

export function contextAllowlists(context: InboxTriageContext) {
  return { goalIds: new Set(context.goals.map((goal) => goal.id)), projectIds: new Set(context.projects.map((project) => project.id)) };
}

export async function hashInboxTriageContext(context: InboxTriageContext) {
  const serialized = JSON.stringify(context);
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized));
  return { serialized, hash: [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("") };
}
