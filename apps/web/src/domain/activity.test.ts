import { describe, expect, it } from "vitest";
import { workspaceWeekBounds } from "./activity";

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
});
