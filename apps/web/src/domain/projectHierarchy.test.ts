import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { executeDomainCommand } from "./commands";
import { projectParentOptions } from "./projectHierarchy";

function hierarchy() {
  let state = structuredClone(emptyState);
  for (const [id, parentProjectId] of [["root", undefined], ["child", "root"], ["leaf", "child"]]) {
    state = executeDomainCommand(state, { type: "create_area", id: id!, name: id!, parentProjectId, createdAt: "now" });
  }
  return state;
}
describe("project hierarchy", () => {
  it("creates nested projects and excludes self and descendants from parent options", () => {
    const state = hierarchy();
    expect(state.areas[2].parentProjectId).toBe("child");
    expect(projectParentOptions(state.areas, "root")).toEqual([]);
    expect(projectParentOptions(state.areas, "child").map((p) => p.id)).toEqual(["root"]);
  });
  it("rejects cycles and missing parents", () => {
    for (const parentProjectId of ["root", "leaf", "missing"]) {
      expect(() => executeDomainCommand(hierarchy(), { type: "update_area", areaId: "root", parentProjectId, changedAt: "later" })).toThrow();
    }
  });
  it("preserves the parent on rename and allows detaching or moving", () => {
    const state = executeDomainCommand(hierarchy(), { type: "update_area", areaId: "child", name: "Renamed", changedAt: "later" });
    expect(state.areas[1].parentProjectId).toBe("root");
    const detached = executeDomainCommand(state, { type: "update_area", areaId: "child", parentProjectId: null, changedAt: "later" });
    expect(detached.areas[1].parentProjectId).toBeUndefined();
    const moved = executeDomainCommand(detached, { type: "update_area", areaId: "root", parentProjectId: "leaf", changedAt: "later" });
    expect(moved.areas[0].parentProjectId).toBe("leaf");
  });
});
