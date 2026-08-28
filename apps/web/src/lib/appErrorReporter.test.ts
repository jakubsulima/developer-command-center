import { describe, expect, it, beforeEach } from "vitest";
import { createSafeErrorPayload } from "./appErrorReporter";
import { clearFirstFlowSnapshot, recordFirstFlowStage } from "./firstFlow";

describe("app error reporter", () => {
  beforeEach(() => {
    clearFirstFlowSnapshot();
    recordFirstFlowStage("triage-started");
  });

  it("creates a payload without message, stack, route or workspace data", () => {
    const payload = createSafeErrorPayload(new Error("Cel: nie wysyłaj tej treści"), "mutation", { operationType: "inbox:123" });

    expect(payload).toMatchObject({ context: "mutation", errorName: "Error", operationType: "inbox", firstFlowStage: "triage-started" });
    expect(payload).not.toHaveProperty("message");
    expect(payload).not.toHaveProperty("stack");
    expect(JSON.stringify(payload)).not.toContain("Cel:");
  });
});
