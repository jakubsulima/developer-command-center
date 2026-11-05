export type AppQuickAddRequest = import("./QuickAdd").QuickAddRequest;

export function requestAppQuickAdd(request?: AppQuickAddRequest) {
  // Children can request creation on mount (e.g. /capture redirects). Dispatch
  // after the current effects so the shell has installed its listener.
  queueMicrotask(() => window.dispatchEvent(new CustomEvent("app-shell:quick-add", { detail: request })));
}
