export function describeMutationError(error: unknown, fallback = "Nie udało się zapisać zmiany.") {
  const message = error instanceof Error ? error.message : String(error);
  if (/action_version_conflict/i.test(message)) return "Działanie zmieniło się w międzyczasie. Odśwież widok i spróbuj ponownie.";
  if (/version_conflict/i.test(message)) return "Rekord zmienił się w międzyczasie. Odśwież widok i spróbuj ponownie.";
  return message || fallback;
}
