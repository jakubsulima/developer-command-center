import { Button } from "./ui";

function preview(value: unknown) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "Szkic bez treści";
  const fields = value as Record<string, unknown>;
  return [...new Set(["title", "content", "detail", "note", "name", "description", "outcome", "sourceUrl", "scheduledFor", "routineStartsOn", "routineChecklist"].map((key) => fields[key]).filter((text): text is string => typeof text === "string" && Boolean(text.trim())))].join("\n") || "Szkic bez treści";
}

export function DraftRecovery<T>({ alternatives, recover, disabled }: { alternatives: Array<{ key: string; value: T }>; recover: (key: string) => boolean; disabled?: boolean }) {
  if (!alternatives.length) return null;
  return <details className="draft-recovery"><summary>Inne szkice do odzyskania ({alternatives.length})</summary><p>Zachowano różne wersje na tym urządzeniu. Wybór zachowa również bieżącą wersję.</p>{alternatives.map((item, index) => <div key={item.key}><pre>{preview(item.value)}</pre><Button type="button" disabled={disabled} onClick={() => recover(item.key)}>Wznów szkic {index + 1}</Button></div>)}</details>;
}
