import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { executeDomainCommand } from "./commands";

describe("project categories", () => {
  it("supports multiple memberships, rename, and deletion without losing the project", () => {
    let state = structuredClone(emptyState);
    for (const id of ["work", "ai"]) state = executeDomainCommand(state, { type: "save_project_category", id, name: id, color: "#60a5fa" });
    state = executeDomainCommand(state, { type: "create_area", id: "project", name: "Existing project", categoryIds: ["work", "ai"], createdAt: "now" });
    state = executeDomainCommand(state, { type: "save_project_category", id: "work", name: "Praca", color: "#34d399" });
    expect(state.areas[0].categoryIds).toEqual(["work", "ai"]);
    state = executeDomainCommand(state, { type: "delete_project_category", id: "ai" });
    expect(state.areas).toHaveLength(1);
    expect(state.areas[0]).toMatchObject({ name: "Existing project", categoryIds: ["work"] });
    expect(state.projectCategories).toEqual([{ id: "work", name: "Praca", color: "#34d399" }]);
  });
  it("rejects missing categories and duplicate category names", () => {
    const state = executeDomainCommand(emptyState, { type: "save_project_category", id: "work", name: "Praca", color: "#60a5fa" });
    expect(() => executeDomainCommand(state, { type: "save_project_category", id: "duplicate", name: " praca ", color: "#60a5fa" })).toThrow();
    expect(() => executeDomainCommand(state, { type: "create_area", id: "project", name: "Project", categoryIds: ["missing"], createdAt: "now" })).toThrow();
  });
});
