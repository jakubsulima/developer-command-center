/** Preserve the server code; a response can also report an uncertain outcome. */
export class OperationResponseError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "OperationResponseError";
  }
}

// Failed statements, not lost responses. Connection errors, timeouts and
// completion_unknown (40003) must not authorize changing submitted payloads.
export function isRejectionCode(code?: string): boolean {
  return Boolean(code && /^(22|23|28|42|44|P0)[0-9A-Z]{3}$/.test(code));
}

const localRejections = new Set([
  "goal_not_found", "area_not_found", "action_not_found", "source_book_not_found",
  "knowledge_not_found", "knowledge_item_not_found", "knowledge_link_target_required",
  "knowledge_result_requires_artifact", "knowledge_decision_requires_decision",
  "knowledge_source_requires_note_and_material"
]);

export function isOperationRejected(error: unknown): boolean {
  if (error instanceof OperationResponseError) return isRejectionCode(error.code);
  // Domain validation runs locally before the remote command. Older adapters
  // prefixed these exact codes with an operation label.
  return error instanceof Error && error.name === "Error"
    && localRejections.has(error.message.split(": ").at(-1) ?? "");
}
