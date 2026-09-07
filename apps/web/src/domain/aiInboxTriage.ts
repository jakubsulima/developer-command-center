export const AI_INBOX_TRIAGE_SCHEMA_VERSION = 1 as const;

export type AIInboxTriageDecision = "goal" | "action" | "knowledge" | "keep_inbox";
export type AIInboxTriageConfidence = "low" | "medium" | "high";
export type AIInboxTriageLinkedType = "goal" | "project" | "none";
export type AIInboxTriageKnowledgeKind = "note" | "resource" | "decision";

export interface AIInboxTriageProposalContent {
  schemaVersion: typeof AI_INBOX_TRIAGE_SCHEMA_VERSION;
  decision: AIInboxTriageDecision;
  confidence: AIInboxTriageConfidence;
  reason: string;
  title: string | null;
  detail: string | null;
  knowledgeKind: AIInboxTriageKnowledgeKind | null;
  linkedType: AIInboxTriageLinkedType;
  linkedId: string | null;
  targetDate: string | null;
}

export interface AIInboxTriageProposal {
  proposalId: string;
  inboxItemId: string;
  status: "ready";
  cached: boolean;
  generatedAt: string;
  provider: string;
  model: string;
  proposal: AIInboxTriageProposalContent;
}

export type AIInboxTriageFeedbackRating = "helpful" | "not_helpful";

export class AIInboxTriageError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AIInboxTriageError";
  }
}

const decisions = ["goal", "action", "knowledge", "keep_inbox"] as const;
const confidences = ["low", "medium", "high"] as const;
const linkedTypes = ["goal", "project", "none"] as const;
const knowledgeKinds = ["note", "resource", "decision"] as const;

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", `${label}: oczekiwano obiektu.`);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", `${label}: niedozwolone pola: ${extras.join(", ")}.`);
}

function nullableText(value: unknown, label: string, max: number) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", `${label}: nieprawidłowy tekst.`);
  return value.trim() || null;
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", `${label}: nieznana wartość.`);
  return value as T;
}

function targetDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "proposal.targetDate: nieprawidłowa data.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "proposal.targetDate: nieprawidłowa data.");
  return value;
}

export function decodeAIInboxTriageProposalContent(payload: unknown): AIInboxTriageProposalContent {
  const root = object(payload, "AIInboxTriageProposal");
  exactKeys(root, ["schemaVersion", "decision", "confidence", "reason", "title", "detail", "knowledgeKind", "linkedType", "linkedId", "targetDate"], "AIInboxTriageProposal");
  if (root.schemaVersion !== AI_INBOX_TRIAGE_SCHEMA_VERSION) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "Nieobsługiwana wersja schematu.");
  const decision = enumeration(root.decision, decisions, "proposal.decision");
  const confidence = enumeration(root.confidence, confidences, "proposal.confidence");
  const linkedType = enumeration(root.linkedType, linkedTypes, "proposal.linkedType");
  const linkedId = nullableText(root.linkedId, "proposal.linkedId", 80);
  if (linkedType === "none" && linkedId !== null) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "proposal.linkedId musi być puste.");
  if (linkedType !== "none" && !linkedId) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "proposal.linkedId jest wymagane.");
  const knowledgeKind = root.knowledgeKind === null ? null : enumeration(root.knowledgeKind, knowledgeKinds, "proposal.knowledgeKind");
  if (decision === "knowledge" && !knowledgeKind) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "proposal.knowledgeKind jest wymagane dla Wiedzy.");
  if (decision !== "knowledge" && knowledgeKind !== null) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "proposal.knowledgeKind jest dozwolone tylko dla Wiedzy.");
  if (confidence === "low" && decision !== "keep_inbox") throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "Niska pewność musi oznaczać pozostawienie w Skrzynce.");
  if (decision === "keep_inbox" && (root.title !== null || root.detail !== null || root.targetDate !== null)) throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "Niepewna propozycja nie może zawierać zmian.");
  return {
    schemaVersion: AI_INBOX_TRIAGE_SCHEMA_VERSION,
    decision,
    confidence,
    reason: nullableText(root.reason, "proposal.reason", 800) ?? "Brak wystarczających danych.",
    title: nullableText(root.title, "proposal.title", 300),
    detail: nullableText(root.detail, "proposal.detail", 1200),
    knowledgeKind,
    linkedType,
    linkedId,
    targetDate: targetDate(root.targetDate)
  };
}

export function decodeAIInboxTriageProposal(payload: unknown): AIInboxTriageProposal {
  const root = object(payload, "AIInboxTriageResponse");
  exactKeys(root, ["proposalId", "inboxItemId", "status", "cached", "generatedAt", "provider", "model", "proposal"], "AIInboxTriageResponse");
  if (root.status !== "ready" || typeof root.cached !== "boolean") throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "Nieprawidłowy status propozycji.");
  if (typeof root.proposalId !== "string" || typeof root.inboxItemId !== "string" || typeof root.generatedAt !== "string" || typeof root.provider !== "string" || typeof root.model !== "string") throw new AIInboxTriageError("INVALID_MODEL_OUTPUT", "Nieprawidłowe metadane propozycji.");
  return { proposalId: root.proposalId, inboxItemId: root.inboxItemId, status: "ready", cached: root.cached, generatedAt: root.generatedAt, provider: root.provider, model: root.model, proposal: decodeAIInboxTriageProposalContent(root.proposal) };
}
