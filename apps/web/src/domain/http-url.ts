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
