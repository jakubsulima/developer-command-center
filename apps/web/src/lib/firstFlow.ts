export type FirstFlowStage =
  | "unknown"
  | "empty-workspace"
  | "capture-started"
  | "capture-saved"
  | "triage-started"
  | "action-created"
  | "first-action-completed";

interface FirstFlowSnapshot {
  stage: FirstFlowStage;
  startedAt: number;
}

const STORAGE_KEY = "command-center-first-flow-v1";
const stageOrder: Record<FirstFlowStage, number> = {
  unknown: 0,
  "empty-workspace": 1,
  "capture-started": 2,
  "capture-saved": 3,
  "triage-started": 4,
  "action-created": 5,
  "first-action-completed": 6
};

let snapshot: FirstFlowSnapshot = { stage: "unknown", startedAt: Date.now() };

function readSnapshot(): FirstFlowSnapshot {
  if (typeof sessionStorage === "undefined") return snapshot;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<FirstFlowSnapshot> | null;
    if (parsed?.stage && parsed.stage in stageOrder && typeof parsed.startedAt === "number") {
      snapshot = { stage: parsed.stage as FirstFlowStage, startedAt: parsed.startedAt };
    }
  } catch {
    // Diagnostics must never block the product flow.
  }
  return snapshot;
}

export function recordFirstFlowStage(stage: FirstFlowStage) {
  const current = readSnapshot();
  if (stageOrder[stage] < stageOrder[current.stage]) return;
  const next = { stage, startedAt: current.stage === "unknown" ? Date.now() : current.startedAt };
  snapshot = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing and restricted storage are supported.
  }
}

export function getFirstFlowSnapshot() {
  const current = readSnapshot();
  return {
    stage: current.stage,
    elapsedMs: Math.max(0, Date.now() - current.startedAt)
  };
}

export function clearFirstFlowSnapshot() {
  snapshot = { stage: "unknown", startedAt: Date.now() };
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}
