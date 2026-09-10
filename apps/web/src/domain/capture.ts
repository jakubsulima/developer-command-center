import type { InboxKind } from "./types";

export interface NormalizedCapture {
  content: string;
  kind: "text" | "link";
  previewDomain?: string;
}

export function captureErrorMessage(code: string) {
  if (code === "invalid_capture_url" || code === "invalid_capture_protocol") return "Podaj pełny adres HTTP lub HTTPS, np. https://example.com.";
  if (code === "capture_content_required") return "Wpisz treść przechwycenia.";
  return "Nie udało się zapisać. Spróbuj ponownie.";
}

export function normalizeCapture(raw: string, requestedKind?: InboxKind): NormalizedCapture {
  const content = raw;
  const candidate = raw.trim();
  if (!candidate) throw new Error("capture_content_required");
  if (requestedKind === "voice" || requestedKind === "file") throw new Error("capture_asset_required");
  let parsed: URL | undefined;
  try { parsed = new URL(candidate); } catch { /* A regular text capture is valid. */ }
  const isWebUrl = parsed?.protocol === "http:" || parsed?.protocol === "https:";
  if (requestedKind === "link" && !isWebUrl) throw new Error("invalid_capture_url");
  return isWebUrl
    ? { content, kind: "link", previewDomain: parsed!.hostname.replace(/^www\./, "") }
    : { content, kind: "text" };
}
