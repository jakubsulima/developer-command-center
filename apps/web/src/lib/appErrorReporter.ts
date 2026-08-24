export type AppErrorContext = "runtime" | "chunk" | "unhandled-rejection" | "export";

function errorName(value: unknown) {
  return value instanceof Error ? value.name : typeof value;
}

export const AppErrorReporter = {
  report(error: unknown, context: AppErrorContext) {
    // Deliberately omit message, stack, route params and state: those may contain
    // Knowledge, Actions or other user-provided Workspace data.
    console.error("[app-error]", { context, errorName: errorName(error), online: navigator.onLine });
  },
  install() {
    const onError = (event: ErrorEvent) => { AppErrorReporter.report(event.error, "runtime"); };
    const onRejection = (event: PromiseRejectionEvent) => { AppErrorReporter.report(event.reason, "unhandled-rejection"); };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }
};
