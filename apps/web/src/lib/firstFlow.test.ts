import { describe, expect, it, beforeEach } from "vitest";
import { clearFirstFlowSnapshot, getFirstFlowSnapshot, recordFirstFlowStage } from "./firstFlow";

describe("first flow diagnostics", () => {
  beforeEach(() => clearFirstFlowSnapshot());

  it("advances monotonically without storing user content", () => {
    recordFirstFlowStage("empty-workspace");
    recordFirstFlowStage("capture-saved");
    recordFirstFlowStage("capture-started");

    expect(getFirstFlowSnapshot().stage).toBe("capture-saved");
    expect(sessionStorage.getItem("command-center-first-flow-v1")).not.toContain("user");
  });
});
