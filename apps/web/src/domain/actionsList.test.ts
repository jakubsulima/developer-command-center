import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { executeDomainCommand } from "./commands";
import { actionListSortDirection, actionListSortValue, matchesActionListFilter } from "./actionsList";
import type { GoalAction } from "./types";

const action = (id: string, changes: Partial<GoalAction> = {}): GoalAction => ({
  id, version: 1, title: id, detail: "", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [], ...changes
});

describe("lista Działań", () => {
  it("współdzieli regułę Startu dla Na dziś i nie traktuje przypiętego terminu jako zaległego", () => {
    const state = structuredClone(emptyState);
    state.areas = [{ id: "project", name: "Projekt", visibility: "active", createdAt: "", updatedAt: "" }];
    state.goals = [{ id: "goal", title: "Cel", outcome: "", kind: "custom", status: "paused", visibility: "active", priority: "normal", areaId: "project" }];
    state.actions = [
      action("pinned", { goalId: "goal", areaId: "project", pinnedToToday: true }),
      action("overdue", { goalId: "goal", areaId: "project", scheduledFor: "2026-09-07" }),
      action("completed", { goalId: "goal", areaId: "project", status: "completed", completedAt: "2026-09-08T10:00:00Z" })
    ];
    expect(state.actions.filter((item) => matchesActionListFilter(state, item, { view: "today", today: "2026-09-08" })).map((item) => item.id)).toEqual(["pinned"]);
    expect(matchesActionListFilter(state, state.actions[0]!, { view: "open", projectId: "project", goalId: "goal", today: "2026-09-08" })).toBe(true);
    expect(matchesActionListFilter(state, state.actions[0]!, { view: "open", projectId: "other", today: "2026-09-08" })).toBe(false);
  });

  it("ukrywa Działania z archiwalnego rodzica, ale pozwala na wstrzymany Cel", () => {
    const state = structuredClone(emptyState);
    state.goals = [{ id: "goal", title: "Cel", outcome: "", kind: "custom", status: "paused", visibility: "archived", priority: "normal" }];
    const archived = action("archived-parent", { goalId: "goal" });
    expect(matchesActionListFilter(state, archived, { view: "open", today: "2026-09-08" })).toBe(false);
    state.goals[0]!.visibility = "active";
    expect(matchesActionListFilter(state, archived, { view: "open", today: "2026-09-08" })).toBe(true);
  });

  it("sortuje otwarte od najbliższego terminu, a Ukończone od najnowszego", () => {
    expect(actionListSortValue(action("none"), "open")).toBe("9999-12-31");
    expect(actionListSortDirection("open")).toBe("asc");
    expect(actionListSortDirection("completed")).toBe("desc");
    expect(actionListSortValue(action("done", { completedAt: "2026-09-08T12:00:00Z" }), "completed")).toContain("2026-09-08");
  });

  it("rozróżnia każdy widok po statusie i terminie", () => {
    const state = structuredClone(emptyState);
    state.actions = [
      action("today", { scheduledFor: "2026-09-08" }),
      action("overdue", { scheduledFor: "2026-09-07" }),
      action("unscheduled"),
      action("blocked", { status: "blocked" }),
      action("completed", { status: "completed", completedAt: "2026-09-08T12:00:00Z" }),
      action("cancelled", { status: "cancelled" })
    ];
    const ids = (view: "open" | "today" | "overdue" | "unscheduled" | "blocked" | "completed") => state.actions.filter((item) => matchesActionListFilter(state, item, { view, today: "2026-09-08" })).map((item) => item.id);
    expect(ids("open")).toEqual(["today", "overdue", "unscheduled", "blocked"]);
    expect(ids("today")).toEqual(["today"]);
    expect(ids("overdue")).toEqual(["overdue"]);
    expect(ids("unscheduled")).toEqual(["unscheduled", "blocked"]);
    expect(ids("blocked")).toEqual(["blocked"]);
    expect(ids("completed")).toEqual(["completed"]);
  });

  it("odrzuca cofnięcie statusu na nieaktualnej wersji", () => {
    const state = structuredClone(emptyState);
    state.actions = [action("versioned")];
    expect(() => executeDomainCommand(state, { type: "set_action_status", actionId: "versioned", status: "completed", expectedVersion: 2, changedAt: "2026-09-08T10:00:00.000Z" })).toThrow("action_version_conflict");
  });
});
