export const GLOBAL_SEARCH_STORAGE_KEY = "command-global-search";
export const PERSISTENT_DRAFT_STORAGE_PREFIXES = ["command-center-draft-v1:", "command-center-draft-v2:"] as const;

export function clearPersistentDrafts() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && PERSISTENT_DRAFT_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
  }
}

export function clearUnscopedPrivateBrowserState() {
  localStorage.removeItem("command-center-state-v1");
  sessionStorage.removeItem(GLOBAL_SEARCH_STORAGE_KEY);
}
