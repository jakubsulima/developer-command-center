import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { projectProjection, projectProjections, projectSignal } from "./projectModule";
import type { AppState, Goal, GoalAction } from "./types";

const signalNow = new Date("2026-09-24T10:00:00.000Z");

function signalState(): AppState {
  const state = structuredClone(emptyState);
  state.areas = [{ id: "project", name: "Projekt", visibility: "active", createdAt: "2026-08-01", updatedAt: "2026-08-01" }];
  return state;
}

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: "goal", title: "Bieżący Cel", outcome: "Rezultat", kind: "custom", status: "active", visibility: "active", priority: "normal", areaId: "project", ...overrides
  };
}

function action(overrides: Partial<GoalAction> = {}): GoalAction {
  return {
    id: "action", version: 1, title: "Wykonać krok", detail: "", areaId: "project", status: "ready", position: 0, isNext: false, pinnedToToday: false, checklist: [], ...overrides
  };
}

describe("Project Module", () => {
  it("uses current areas as Project truth and excludes historical Project records", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "current", name: "Bieżący Projekt", description: "Kontekst", visibility: "active" as const, createdAt: "2026-08-01", updatedAt: "2026-08-01" }],
      projects: [{ id: "legacy", name: "Historyczny Projekt", initials: "HP", color: "violet" as const, technology: "Legacy", outcome: "Nie używaj aktywnie", status: "W trakcie" as const, nextStep: "Historia", primary: false, usedMinutes: 0, requirements: [], workItems: [] }]
    };

    expect(projectProjections(state)).toEqual([expect.objectContaining({ id: "current", name: "Bieżący Projekt" })]);
    expect(projectProjection(state, "legacy")).toBeUndefined();
  });

  it("collects direct and derived contents with deterministic ordering", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "project", name: "Projekt", visibility: "active" as const, createdAt: "2026-08-01", updatedAt: "2026-08-01" }],
      goals: [{ id: "goal", title: "Cel", outcome: "Rezultat", kind: "custom" as const, status: "active" as const, visibility: "active" as const, priority: "normal" as const, areaId: "project" }],
      actions: [{ id: "action", version: 1, title: "Krok", detail: "", goalId: "goal", status: "ready" as const, position: 0, isNext: true, pinnedToToday: false, checklist: [] }],
      knowledge: [
        { id: "late", type: "note" as const, title: "Późniejsza", detail: "", createdAt: "2026-08-02", updatedAt: "2026-08-03" },
        { id: "early", type: "note" as const, title: "Wcześniejsza", detail: "", createdAt: "2026-08-01", updatedAt: "2026-08-02" }
      ],
      knowledgeLinks: [
        { id: "direct", knowledgeItemId: "late", areaId: "project", meaning: "reference" as const, createdAt: "2026-08-01" },
        { id: "derived", knowledgeItemId: "early", actionId: "action", meaning: "material" as const, createdAt: "2026-08-01" }
      ]
    };

    expect(projectProjection(state, "project")?.goals).toHaveLength(1);
    expect(projectProjection(state, "project")?.actions).toHaveLength(1);
    expect(projectProjection(state, "project")?.knowledge.map((item) => item.id)).toEqual(["late", "early"]);
  });

  it("counts an action linked directly and through its Goal only once", () => {
    const state = signalState();
    state.goals = [goal()];
    state.actions = [action({ id: "shared", goalId: "goal", areaId: "project", isNext: true })];

    expect(projectSignal(state, "project", signalNow)).toMatchObject({
      actionId: "shared",
      counts: { openActions: 1 }
    });
  });

  it("chooses a blocked action first and includes its reason and review date", () => {
    const state = signalState();
    state.goals = [goal()];
    state.actions = [
      action({ id: "overdue", title: "Zaległy krok", scheduledFor: "2026-09-20" }),
      action({ id: "blocked", title: "Czeka na decyzję", status: "blocked", blocker: "Czekam na akceptację", reviewOn: "2026-09-28", scheduledFor: "2026-09-24", isNext: true }),
      action({ id: "today", title: "Na dziś", scheduledFor: "2026-09-24" })
    ];

    expect(projectSignal(state, "project", signalNow)).toMatchObject({
      kind: "blocked", actionId: "blocked", title: "Czeka na decyzję", label: "Do odblokowania",
      description: "Czekam na akceptację Wróć do niego 28 wrz.",
      counts: { openActions: 3, blockedActions: 1, overdueActions: 1, todayActions: 1 }
    });
  });

  it("reports an overdue open action without counting blocked work as overdue again", () => {
    const state = signalState();
    state.actions = [
      action({ id: "blocked", status: "blocked", scheduledFor: "2026-09-20", blocker: "Czekam" }),
      action({ id: "overdue", title: "Zaległy krok", scheduledFor: "2026-09-21" }),
      action({ id: "done", status: "completed", scheduledFor: "2026-09-19" })
    ];

    expect(projectSignal(state, "project", signalNow)).toMatchObject({
      kind: "blocked", actionId: "blocked", counts: { overdueActions: 1, blockedActions: 1 }
    });
    state.actions = state.actions.filter((candidate) => candidate.id !== "blocked");
    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "overdue", actionId: "overdue", label: "Wymaga decyzji", description: "Do zrobienia · termin minął 21 wrz." });
  });

  it("uses the Workspace date for today's scheduled and pinned actions", () => {
    const state = signalState();
    state.workspaceTimezone = "Europe/Warsaw";
    state.actions = [action({ id: "today", scheduledFor: "2026-09-25" })];

    expect(projectSignal(state, "project", new Date("2026-09-24T22:30:00.000Z"))).toMatchObject({ kind: "today", actionId: "today", label: "Na dziś" });
    state.actions = [action({ id: "pinned", scheduledFor: undefined, pinnedToToday: true })];
    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "today", actionId: "pinned", description: "Do zrobienia · przypięte na dziś." });
  });

  it("selects an explicitly chosen next action before other available work", () => {
    const state = signalState();
    state.goals = [goal()];
    state.actions = [
      action({ id: "available", title: "Inny krok", position: 0 }),
      action({ id: "next", title: "Wybrany krok", goalId: "goal", areaId: undefined, isNext: true, status: "in_progress", position: 1 })
    ];

    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "next", actionId: "next", label: "Następny krok", description: "W toku. Cel: Bieżący Cel." });
  });

  it("keeps future work dated and labels testing actions as Do sprawdzenia", () => {
    const state = signalState();
    state.actions = [action({ id: "future", scheduledFor: "2026-09-28" })];
    expect(projectSignal(state, "project", signalNow)).toMatchObject({
      kind: "scheduled", actionId: "future", label: "Najbliższy termin 28 wrz", description: "Do zrobienia · zaplanowane na 28 wrz."
    });

    state.actions = [action({ id: "testing", status: "testing", title: "Sprawdzić wynik" })];
    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "testing", actionId: "testing", label: "Do sprawdzenia", statusLabel: "Do sprawdzenia", description: "Do sprawdzenia." });
  });

  it("chooses same-kind candidates by date, position, and ID instead of array order", () => {
    const state = signalState();
    state.actions = [
      action({ id: "c", title: "Trzeci", scheduledFor: "2026-09-22", position: 0 }),
      action({ id: "b", title: "Drugi", scheduledFor: "2026-09-21", position: 2 }),
      action({ id: "z", title: "Pozycja niżej", scheduledFor: "2026-09-21", position: 1 }),
      action({ id: "a", title: "Pierwszy", scheduledFor: "2026-09-21", position: 1 })
    ];
    expect(projectSignal(state, "project", signalNow)?.actionId).toBe("a");
    state.actions.reverse();
    expect(projectSignal(state, "project", signalNow)?.actionId).toBe("a");
  });

  it("ignores hidden goals, closed actions, and non-active Projects", () => {
    const state = signalState();
    state.goals = [goal({ id: "hidden-goal", visibility: "archived" })];
    state.actions = [
      action({ id: "hidden-action", areaId: undefined, goalId: "hidden-goal", isNext: true }),
      action({ id: "completed", status: "completed" }),
      action({ id: "skipped", status: "skipped" }),
      action({ id: "cancelled", status: "cancelled" })
    ];

    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "empty", counts: { openActions: 0, currentGoals: 0 } });
    state.areas[0]!.visibility = "archived";
    expect(projectSignal(state, "project", signalNow)).toBeUndefined();
  });

  it("shows the empty path based on whether the Project has a current Goal", () => {
    const state = signalState();
    state.goals = [goal({ status: "paused" })];
    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "empty", label: "Brak następnego kroku", counts: { currentGoals: 1 } });
    state.goals = [];
    expect(projectSignal(state, "project", signalNow)).toMatchObject({ kind: "empty", label: "Brak pierwszego Celu", title: "Ustal pierwszy Cel" });
  });
});
