import { AppErrorReporter, type SafePerformanceMetric } from "./appErrorReporter";

export type PerformanceMetricName = "app-start" | "lazy-route-transition" | "quick-add-open" | "workspace-first-interaction";
export type PerformanceViewport = "desktop" | "mobile";

type PerformanceDimensions = {
  route?: string;
  viewport?: PerformanceViewport;
};

const aggregates = new Map<string, SafePerformanceMetric>();
const activeStarts = new Map<string, number>();
let flushTimer: number | undefined;
let lifecycleInstalled = false;
let debugSnapshotEnabled = false;

function clock() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export function performanceNow() {
  return clock();
}

export function viewportBucket(width = typeof window === "undefined" ? 1024 : window.innerWidth): PerformanceViewport {
  return width <= 480 ? "mobile" : "desktop";
}

function dimensionValue(value: string | undefined) {
  return value?.trim().replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "unknown";
}

function metricKey(name: PerformanceMetricName, dimensions: PerformanceDimensions) {
  return `${name}|route=${dimensionValue(dimensions.route)}|viewport=${dimensions.viewport ?? viewportBucket()}`;
}

function scheduleFlush() {
  if (typeof window === "undefined" || flushTimer !== undefined) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = undefined;
    flushPerformanceMetrics();
  }, 60_000);
}

export function recordPerformanceTiming(name: PerformanceMetricName, durationMs: number, dimensions: PerformanceDimensions = {}) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  const key = metricKey(name, dimensions);
  const rounded = Math.round(durationMs);
  const previous = aggregates.get(key);
  aggregates.set(key, {
    count: (previous?.count ?? 0) + 1,
    minMs: Math.min(previous?.minMs ?? rounded, rounded),
    maxMs: Math.max(previous?.maxMs ?? rounded, rounded),
    totalMs: (previous?.totalMs ?? 0) + rounded
  });
  if (import.meta.env.DEV) console.info("[command.performance]", { name, durationMs: rounded, ...dimensions, viewport: dimensions.viewport ?? viewportBucket() });
  exposeDebugSnapshot();
  scheduleFlush();
}

export function beginPerformanceTiming(name: string) {
  activeStarts.set(name, clock());
}

export function finishPerformanceTiming(name: string, metric: PerformanceMetricName, dimensions: PerformanceDimensions = {}) {
  const startedAt = activeStarts.get(name);
  activeStarts.delete(name);
  if (startedAt === undefined) return;
  recordPerformanceTiming(metric, clock() - startedAt, dimensions);
}

export function flushPerformanceMetrics() {
  if (flushTimer !== undefined && typeof window !== "undefined") {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (!aggregates.size) return;
  const metrics = Object.fromEntries(aggregates);
  aggregates.clear();
  AppErrorReporter.reportPerformance(metrics);
}

export function getPerformanceSnapshot() {
  return Object.fromEntries(aggregates);
}

export function installPerformanceMetrics() {
  if (typeof window === "undefined" || lifecycleInstalled) return;
  lifecycleInstalled = true;
  const flush = () => flushPerformanceMetrics();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  debugSnapshotEnabled = new URLSearchParams(window.location.search).has("perf");
  if (debugSnapshotEnabled) {
    (window as Window & { __commandPerformance?: () => Record<string, SafePerformanceMetric> }).__commandPerformance = getPerformanceSnapshot;
    exposeDebugSnapshot();
  }
}

function exposeDebugSnapshot() {
  if (!debugSnapshotEnabled || typeof document === "undefined") return;
  const snapshot = document.getElementById("command-performance-debug") ?? document.head.appendChild(Object.assign(document.createElement("script"), { id: "command-performance-debug", type: "application/json" }));
  snapshot.textContent = JSON.stringify(getPerformanceSnapshot());
}
