import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { deriveHomeSummary } from "./homeSummary";
import { deriveWeeklyReview } from "./weeklyReview";
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
    ["today_action", { actions: [action("pinned", { pinnedToToday: true })] }],
    ["next_action", { goals: [{ id: "goal-next", title: "Cel z następnym krokiem", outcome: "Wynik", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const }], actions: [action("next", { goalId: "goal-next", isNext: true })] }],
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

  it("does not guess an arbitrary open action", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-1", title: "Cel", outcome: "Wynik", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
    state.actions = [action("unmarked", { goalId: "goal-1", title: "Nieoznaczone Działanie" })];
    expect(deriveHomeSummary(state, now).recommendation.kind).toBe("goal_without_next_action");
  });

  it("always points action recommendations to the action detail route", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal-1", title: "Cel", outcome: "Wynik", kind: "custom", status: "active", visibility: "active", priority: "normal" }];
    state.actions = [action("next", { goalId: "goal-1", isNext: true })];
    expect(deriveHomeSummary(state, now).recommendation.to).toBe("/actions/next");
  });

  it("prefers a conscious next action across multiple goals", () => {
    const state = structuredClone(emptyState);
    state.goals = [
      { id: "goal-b", title: "Późniejszy Cel", outcome: "", kind: "custom", status: "active", visibility: "active", priority: "normal", createdAt: "2026-08-20T10:00:00.000Z" },
      { id: "goal-a", title: "Wcześniejszy Cel", outcome: "", kind: "custom", status: "active", visibility: "active", priority: "normal", createdAt: "2026-08-19T10:00:00.000Z" }
    ];
    state.actions = [action("next-b", { goalId: "goal-b", isNext: true, createdAt: "2026-08-20T10:00:00.000Z" }), action("next-a", { goalId: "goal-a", isNext: true, createdAt: "2026-08-19T10:00:00.000Z" })];
    expect(deriveHomeSummary(state, now).recommendation).toMatchObject({ kind: "next_action", title: "next-a", context: "Cel: Wcześniejszy Cel" });
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
    expect(deriveHomeSummary(state, now).activity).toEqual({ completedActions: 1, progressUpdates: 1, knowledgeAdded: 1, periodStart: "2026-08-17", periodEnd: "2026-08-24" });
  });

  it("returns a calm recommendation for an empty workspace", () => {
    const state = structuredClone(emptyState);
    expect(deriveHomeSummary(state, now)).toMatchObject({ isPristineWorkspace: true, recommendation: { kind: "calm" }, attentionCount: 0, todayActions: [], upcomingActions: [] });
  });

  it("does not treat a workspace with only a current Project as pristine", () => {
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project", name: "Projekt", visibility: "active", createdAt: "2026-08-21", updatedAt: "2026-08-21" }];
    expect(deriveHomeSummary(state, now).isPristineWorkspace).toBe(false);
  });

  it("keeps historical data from looking pristine", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("done", { status: "completed", completedAt: "2026-08-01T10:00:00.000Z" })];
    state.knowledge = [{ id: "archived-knowledge", type: "note", title: "Archiwalna notatka", detail: "", archivedAt: "2026-08-02T10:00:00.000Z" }];
    state.inbox = [{ id: "resolved-capture", kind: "text", content: "Historia", createdAt: "2026-08-03T10:00:00.000Z", status: "resolved" }];
    expect(deriveHomeSummary(state, now).isPristineWorkspace).toBe(false);
  });

  it("shares the weekly activity fixture with the review", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("completed", { status: "completed", completedAt: "2026-08-20T12:00:00.000Z" })];
    state.progressEntries = [{ id: "progress", goalId: "goal", kind: "note", content: "Postęp", createdAt: "2026-08-18T12:00:00.000Z" }];
    state.knowledge = [{ id: "knowledge", type: "note", title: "Wiedza", detail: "", createdAt: "2026-08-19T12:00:00.000Z" }];
    const home = deriveHomeSummary(state, now).activity;
    const review = deriveWeeklyReview(state, now);
    expect(home).toEqual({ completedActions: review.completedActions, progressUpdates: review.progressUpdates, knowledgeAdded: review.knowledgeAdded, periodStart: review.startDate, periodEnd: review.endDate });
  });
});
