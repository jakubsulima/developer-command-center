export function normalizeHttpUrl(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("invalid_knowledge_source_url");
  }
  return normalized;
}

export function safeHttpUrl(value: string | undefined) {
  try {
    return normalizeHttpUrl(value);
  } catch {
    return undefined;
  }
}

/** Conservative comparison: preserves meaningful path, query order, fragments and credentials. */
export function knowledgeUrlKey(value: string | undefined) {
  const url = safeHttpUrl(value);
  if (!url) return undefined;
  const parts = /^(https?):\/\/([^/?#]+)(.*)$/i.exec(url);
  if (!parts) return undefined;
  if (parts[2].includes("@")) return url;
  const scheme = parts[1].toLowerCase();
  const authority = parts[2].toLowerCase().replace(scheme === "http" ? /:80$/ : /:443$/, "");
  const tail = parts[3];
  return `${scheme}://${authority}${!tail || /^[?#]/.test(tail) ? "/" : ""}${tail}`;
}
