export type AppQuickAddRequest = import("./QuickAdd").QuickAddRequest;

export function requestAppQuickAdd(request?: AppQuickAddRequest) {
  window.dispatchEvent(new CustomEvent("app-shell:quick-add", { detail: request }));
}
