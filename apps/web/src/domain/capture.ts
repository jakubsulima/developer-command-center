import type { InboxKind } from "./types";

export interface NormalizedCapture {
  content: string;
  kind: "text" | "link";
  previewDomain?: string;
}

export function normalizeCapture(raw: string, requestedKind?: InboxKind): NormalizedCapture {
  const content = raw.trim();
  if (!content) throw new Error("capture_content_required");
  if (requestedKind === "voice" || requestedKind === "file") throw new Error("capture_asset_required");
  let parsed: URL | undefined;
  try { parsed = new URL(content); } catch { /* A regular text capture is valid. */ }
  const isWebUrl = parsed?.protocol === "http:" || parsed?.protocol === "https:";
  if (requestedKind === "link" && !isWebUrl) throw new Error("invalid_capture_url");
  if (parsed && !isWebUrl && requestedKind === "link") throw new Error("invalid_capture_protocol");
  return isWebUrl ? { content, kind: "link", previewDomain: parsed!.hostname.replace(/^www\./, "") } : { content, kind: "text" };
}
