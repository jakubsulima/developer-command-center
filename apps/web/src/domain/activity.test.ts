import { describe, expect, it } from "vitest";
import { selectWorkspaceActivity, workspaceWeekBounds } from "./activity";
import { emptyState } from "../data/empty";

describe("tydzień Workspace", () => {
  it("zaczyna się w poniedziałek w Europe/Warsaw", () => {
    const bounds = workspaceWeekBounds(new Date("2026-08-23T21:30:00.000Z"), "Europe/Warsaw");
    expect(bounds.startDate).toBe("2026-08-17");
    expect(bounds.endDate).toBe("2026-08-24");
    expect(bounds.start.toISOString()).toBe("2026-08-16T22:00:00.000Z");
  });

  it("uwzględnia zmianę czasu w America/New_York", () => {
    const bounds = workspaceWeekBounds(new Date("2026-03-08T20:00:00.000Z"), "America/New_York");
    expect(bounds.startDate).toBe("2026-03-02");
    expect(bounds.endDate).toBe("2026-03-09");
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000);
  });

  it("liczy koniec tygodnia wyłącznie i pomija aktywność archiwalnego Celu", () => {
    const state = {
      ...structuredClone(emptyState),
      goals: [{ id: "archived", title: "Stary Cel", outcome: "", kind: "custom" as const, status: "active" as const, visibility: "archived" as const, priority: "normal" as const }],
      actions: [
        { id: "inside", version: 1, title: "W środku", detail: "", status: "completed" as const, goalId: "archived", position: 0, isNext: false, pinnedToToday: false, checklist: [], completedAt: "2026-08-23T21:59:59.999Z" },
        { id: "boundary", version: 1, title: "Na końcu", detail: "", status: "completed" as const, position: 1, isNext: false, pinnedToToday: false, checklist: [], completedAt: "2026-08-24T22:00:00.000Z" }
      ]
    };
    expect(selectWorkspaceActivity(state, new Date("2026-08-23T21:30:00.000Z"))).toMatchObject({ completedActions: 0, periodStart: "2026-08-17", periodEnd: "2026-08-24" });
  });
});
