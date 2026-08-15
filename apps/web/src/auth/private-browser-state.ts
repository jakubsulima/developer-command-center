export const GLOBAL_SEARCH_STORAGE_KEY = "command-global-search";

export function clearUnscopedPrivateBrowserState() {
  localStorage.removeItem("command-center-state-v1");
  sessionStorage.removeItem(GLOBAL_SEARCH_STORAGE_KEY);
}
