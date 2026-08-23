export type StartupPhase = "auth-module-ready" | "session-resolved" | "workspace-resolved" | "app-interactive";

const phases = new Map<StartupPhase, number>();
const externalTimings = new Map<string, number>();
let reportEmitted = false;

function clock() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function emitReport() {
  if (reportEmitted || !import.meta.env.DEV) return;
  reportEmitted = true;
  const start = phases.get("auth-module-ready") ?? phases.values().next().value ?? clock();
  const elapsed = Object.fromEntries([...phases].map(([phase, timestamp]) => [phase, Math.round(timestamp - start)]));
  const between = {
    authToSession: phaseDuration("auth-module-ready", "session-resolved"),
    sessionToWorkspace: phaseDuration("session-resolved", "workspace-resolved"),
    workspaceToInteractive: phaseDuration("workspace-resolved", "app-interactive")
  };
  console.info("[command.startup]", { phases: elapsed, between, external: Object.fromEntries(externalTimings) });
}

function phaseDuration(from: StartupPhase, to: StartupPhase) {
  const start = phases.get(from);
  const end = phases.get(to);
  return start === undefined || end === undefined ? null : Math.round(end - start);
}

export function markStartupPhase(phase: StartupPhase) {
  if (phases.has(phase)) return;
  phases.set(phase, clock());
  if (phase === "app-interactive") queueMicrotask(emitReport);
}

export function recordStartupTiming(name: string, durationMs: number) {
  if (!externalTimings.has(name)) externalTimings.set(name, Math.round(durationMs));
}

export function getStartupSnapshot() {
  return {
    phases: Object.fromEntries(phases),
    external: Object.fromEntries(externalTimings)
  };
}
