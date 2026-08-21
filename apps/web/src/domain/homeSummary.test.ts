import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { deriveHomeSummary } from "./homeSummary";
import type { AppState } from "./types";

const action = (id: string, changes: Partial<typeof emptyState.actions[number]> = {}) => ({
  id, version: 1, title: id, detail: "", status: "ready" as const, position: 0, isNext: false, pinnedToToday: false, checklist: [], ...changes
});

describe("deriveHomeSummary", () => {
  const now = new Date("2026-08-21T09:00:00.000Z");

  it.each([
    ["blocked", { actions: [action("blocked", { status: "blocked", scheduledFor: "2026-08-20" })] }],
    ["overdue", { actions: [action("overdue", { scheduledFor: "2026-08-20" })] }],
    ["today_action", { actions: [action("today", { scheduledFor: "2026-08-21" })] }],
    ["goal_without_next_action", { goals: [{ id: "goal-1", title: "Cel", outcome: "", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const }] }],
    ["knowledge_queue", { inbox: [{ id: "inbox-1", kind: "text" as const, content: "Decyzja", createdAt: "2026-08-20T10:00:00.000Z", status: "unprocessed" as const }] }]
  ] as const)("selects %s by deterministic priority", (kind, changes) => {
    const state = { ...structuredClone(emptyState), ...changes } as unknown as AppState;
    expect(deriveHomeSummary(state, now).recommendation.kind).toBe(kind);
  });

  it("uses the oldest item for ties within a rule", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("newer", { status: "blocked", createdAt: "2026-08-20T10:00:00.000Z" }), action("older", { status: "blocked", createdAt: "2026-08-19T10:00:00.000Z" })];
    expect(deriveHomeSummary(state, now).recommendation.title).toContain("older");
  });

  it("does not duplicate a blocked overdue action in attention", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("blocked-overdue", { status: "blocked", scheduledFor: "2026-08-20" })];
    const summary = deriveHomeSummary(state, now);
    expect(summary.attentionSignals.filter((signal) => signal.kind === "blocked")).toHaveLength(1);
    expect(summary.overdueActions).toHaveLength(0);
  });

  it("uses the workspace timezone for the current day", () => {
    const state = structuredClone(emptyState);
    state.workspaceTimezone = "America/Los_Angeles";
    state.actions = [action("today-pacific", { scheduledFor: "2026-08-21" })];
    expect(deriveHomeSummary(state, new Date("2026-08-21T06:30:00.000Z")).today).toBe("2026-08-20");
    expect(deriveHomeSummary(state, new Date("2026-08-21T08:00:00.000Z")).today).toBe("2026-08-21");
  });

  it("limits upcoming actions to the next seven calendar days", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("day-1", { scheduledFor: "2026-08-22" }), action("day-7", { scheduledFor: "2026-08-28" }), action("day-8", { scheduledFor: "2026-08-29" })];
    expect(deriveHomeSummary(state, now).upcomingActions.map((item) => item.id)).toEqual(["day-1", "day-7"]);
  });

  it("counts activity in the trailing seven-day window", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("completed", { status: "completed", completedAt: "2026-08-20T12:00:00.000Z" }), action("old", { status: "completed", completedAt: "2026-08-13T12:00:00.000Z" })];
    state.progressEntries = [{ id: "progress", goalId: "goal", kind: "note", content: "Postęp", createdAt: "2026-08-18T12:00:00.000Z" }];
    state.knowledge = [{ id: "knowledge", type: "note", title: "Wiedza", detail: "", createdAt: "2026-08-19T12:00:00.000Z" }];
    expect(deriveHomeSummary(state, now).activity).toEqual({ completedActions: 1, progressUpdates: 1, knowledgeAdded: 1 });
  });

  it("returns a calm recommendation for an empty workspace", () => {
    const state = structuredClone(emptyState);
    expect(deriveHomeSummary(state, now)).toMatchObject({ recommendation: { kind: "calm" }, attentionCount: 0, todayActions: [], upcomingActions: [] });
  });
});
