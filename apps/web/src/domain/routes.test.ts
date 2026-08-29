import { describe, expect, it } from "vitest";
import { routeForEntity } from "./routes";

describe("routeForEntity", () => {
  it("builds exact routes for goals, knowledge and actions", () => {
    expect(routeForEntity({ type: "goal", id: "g 1" })).toBe("/goals/g%201");
    expect(routeForEntity({ type: "knowledge", id: "k/1" })).toBe("/knowledge/k%2F1");
    expect(routeForEntity({ type: "action", id: "a1" })).toBe("/actions/a1");
    expect(routeForEntity({ type: "action", id: "standalone" })).toBe("/actions/standalone");
  });

  it.each(["unprocessed", "snoozed", "resolved", "discarded"] as const)("includes the %s Inbox view", (status) => {
    expect(routeForEntity({ type: "inbox", id: "i1", status })).toBe(`/knowledge?section=inbox&status=${status}&item=i1`);
  });
});
