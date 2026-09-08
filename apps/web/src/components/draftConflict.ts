export function isDraftVersionConflict(error: unknown) {
  return /(?:version_conflict|wersj|stale)/i.test(error instanceof Error ? error.message : String(error));
}
