import { contextAllowlists, type InboxTriageContext } from "./inbox-triage-context.ts";

export const inboxTriageJsonSchema: Record<string, unknown> = {
  type: "object", additionalProperties: false,
  required: ["schemaVersion", "decision", "confidence", "reason", "title", "detail", "knowledgeKind", "linkedType", "linkedId", "targetDate"],
  properties: {
    schemaVersion: { const: 1 },
    decision: { enum: ["goal", "action", "knowledge", "keep_inbox"] },
    confidence: { enum: ["low", "medium", "high"] },
    reason: { type: "string", minLength: 1, maxLength: 800 },
    title: { type: ["string", "null"], maxLength: 300 },
    detail: { type: ["string", "null"], maxLength: 1200 },
    knowledgeKind: { enum: ["note", "resource", "decision", null] },
    linkedType: { enum: ["goal", "project", "none"] },
    linkedId: { type: ["string", "null"], maxLength: 80 },
    targetDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
  }
};

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}:object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label}:text`);
  return value.trim();
}

function nullableText(value: unknown, label: string, max: number) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) throw new Error(`${label}:text`);
  return value.trim() || null;
}

function oneOf(value: unknown, values: string[], label: string) {
  if (typeof value !== "string" || !values.includes(value)) throw new Error(`${label}:enum`);
  return value;
}

function validDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("targetDate:date");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("targetDate:date");
  return value;
}

export function parseProviderJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
}

export function validateAndFinalizeInboxTriage(payload: unknown, context: InboxTriageContext) {
  const root = object(payload, "proposal");
  const allowed = ["schemaVersion", "decision", "confidence", "reason", "title", "detail", "knowledgeKind", "linkedType", "linkedId", "targetDate"];
  if (Object.keys(root).some((key) => !allowed.includes(key))) throw new Error("extra_fields");
  if (root.schemaVersion !== 1) throw new Error("schema_version");
  const decision = oneOf(root.decision, ["goal", "action", "knowledge", "keep_inbox"], "decision");
  const confidence = oneOf(root.confidence, ["low", "medium", "high"], "confidence");
  const linkedType = oneOf(root.linkedType, ["goal", "project", "none"], "linkedType");
  const linkedId = nullableText(root.linkedId, "linkedId", 80);
  const allowlists = contextAllowlists(context);
  if (linkedType === "none" && linkedId !== null) throw new Error("foreign_reference");
  if (linkedType === "goal" && (!linkedId || !allowlists.goalIds.has(linkedId))) throw new Error("foreign_reference");
  if (linkedType === "project" && (!linkedId || !allowlists.projectIds.has(linkedId))) throw new Error("foreign_reference");
  const knowledgeKind = root.knowledgeKind === null ? null : oneOf(root.knowledgeKind, ["note", "resource", "decision"], "knowledgeKind");
  const title = nullableText(root.title, "title", 300);
  const detail = nullableText(root.detail, "detail", 1200);
  const targetDate = validDate(root.targetDate);
  const reason = text(root.reason, "reason", 800);
  if (confidence === "low" && decision !== "keep_inbox") throw new Error("low_confidence_requires_keep_inbox");
  if (decision === "keep_inbox" && (title !== null || detail !== null || knowledgeKind !== null || targetDate !== null || linkedType !== "none" || linkedId !== null)) throw new Error("keep_inbox_must_not_mutate");
  if (decision === "goal" && (!title || !detail)) throw new Error("goal_fields_required");
  if (decision === "action" && !title) throw new Error("action_title_required");
  if (decision === "knowledge" && (!title || !knowledgeKind)) throw new Error("knowledge_fields_required");
  if (decision !== "knowledge" && knowledgeKind !== null) throw new Error("knowledge_kind_not_allowed");
  if (decision === "knowledge" && targetDate !== null) throw new Error("knowledge_date_not_allowed");
  return { schemaVersion: 1 as const, decision: decision as "goal" | "action" | "knowledge" | "keep_inbox", confidence: confidence as "low" | "medium" | "high", reason, title, detail, knowledgeKind: knowledgeKind as "note" | "resource" | "decision" | null, linkedType: linkedType as "goal" | "project" | "none", linkedId, targetDate };
}
