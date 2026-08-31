import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { ensureGoalModel, migrateLegacyWorkspaceState } from "./goals";

describe("current Project migration", () => {
  it("removes compatibility projections from active hydration while preserving legacy records", () => {
    const hydrated = ensureGoalModel({
      ...structuredClone(emptyState),
      projects: [{ id: "legacy", name: "Historia", initials: "H", color: "violet", technology: "Legacy", outcome: "Historia", status: "W trakcie", nextStep: "Historia", primary: false, usedMinutes: 0, requirements: [], workItems: [] }]
    });
    const migrated = migrateLegacyWorkspaceState(hydrated);

    expect(migrated.projects).toHaveLength(1);
    expect(migrated.areas).toEqual([]);
    expect(migrated.goals).toEqual([]);
    expect(migrated.actions).toEqual([]);
  });

  it("keeps an independently persisted current Project when its id collides with history", () => {
    const state = {
      ...structuredClone(emptyState),
      areas: [{ id: "same-id", name: "Bieżący", visibility: "active" as const, createdAt: "2026-08-01", updatedAt: "2026-08-01" }],
      projects: [{ id: "same-id", name: "Historia", initials: "H", color: "violet" as const, technology: "Legacy", outcome: "Historia", status: "W trakcie" as const, nextStep: "Historia", primary: false, usedMinutes: 0, requirements: [], workItems: [] }]
    };
    expect(migrateLegacyWorkspaceState(state).areas).toEqual(state.areas);
  });
});
