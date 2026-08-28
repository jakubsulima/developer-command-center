import { getFirstFlowSnapshot } from "./firstFlow";

export type AppErrorContext = "runtime" | "chunk" | "unhandled-rejection" | "export" | "mutation";

export interface SafeErrorMetadata {
  operationType?: string;
}

export interface SafeErrorPayload {
  kind: "error";
  context: AppErrorContext;
  errorName: string;
  operationType: string;
  firstFlowStage: ReturnType<typeof getFirstFlowSnapshot>["stage"];
  firstFlowElapsedMs: number;
  online: boolean;
  occurredAt: string;
}

function operationType(context: AppErrorContext, metadata?: SafeErrorMetadata) {
  const candidate = metadata?.operationType?.trim().toLowerCase().split(":", 1)[0]?.replace(/[^a-z0-9_-]/g, "");
  return candidate || context;
}

export function createSafeErrorPayload(error: unknown, context: AppErrorContext, metadata?: SafeErrorMetadata): SafeErrorPayload {
  const flow = getFirstFlowSnapshot();
  return {
    kind: "error",
    context,
    errorName: errorName(error),
    operationType: operationType(context, metadata),
    firstFlowStage: flow.stage,
    firstFlowElapsedMs: flow.elapsedMs,
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    occurredAt: new Date().toISOString()
  };
}

function reportingEndpoint() {
  const environment = import.meta.env as ImportMetaEnv & { VITE_ERROR_REPORTING_ENABLED?: string; VITE_ERROR_REPORTING_URL?: string };
  if (environment.VITE_ERROR_REPORTING_ENABLED?.trim().toLowerCase() !== "true") return undefined;
  const endpoint = environment.VITE_ERROR_REPORTING_URL?.trim();
  if (!endpoint) return undefined;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && !(import.meta.env.DEV && url.protocol === "http:")) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function send(payload: SafeErrorPayload | SafeStartupPayload) {
  const endpoint = reportingEndpoint();
  if (!endpoint || typeof fetch === "undefined") return;
  void fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify(payload)
  }).catch(() => {
    // Monitoring must never become a user-facing failure.
  });
}

export interface SafeStartupPayload {
  kind: "startup";
  phasesMs: Record<string, number>;
  betweenMs: Record<string, number | null>;
  externalMs: Record<string, number>;
  firstFlowStage: ReturnType<typeof getFirstFlowSnapshot>["stage"];
  firstFlowElapsedMs: number;
  occurredAt: string;
}

function errorName(value: unknown) {
  return value instanceof Error ? value.name : typeof value;
}

export const AppErrorReporter = {
  report(error: unknown, context: AppErrorContext, metadata?: SafeErrorMetadata) {
    // Deliberately omit message, stack, route params and state: those may contain
    // Knowledge, Actions or other user-provided Workspace data.
    const payload = createSafeErrorPayload(error, context, metadata);
    if (import.meta.env.DEV) console.error("[app-error]", payload);
    send(payload);
  },
  reportStartup(phasesMs: Record<string, number>, betweenMs: Record<string, number | null>, externalMs: Record<string, number>) {
    const flow = getFirstFlowSnapshot();
    send({ kind: "startup", phasesMs, betweenMs, externalMs, firstFlowStage: flow.stage, firstFlowElapsedMs: flow.elapsedMs, occurredAt: new Date().toISOString() });
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
