import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import { releaseDueInboxItems, tomorrowAtLocalTime } from "./inbox";

describe("Inbox lifecycle", () => {
  it("uses the Workspace day and offset across DST changes", () => {
    expect(tomorrowAtLocalTime(new Date("2026-03-28T22:00:00Z"), "Europe/Warsaw")).toBe("2026-03-29T07:00:00.000Z");
    expect(tomorrowAtLocalTime(new Date("2026-10-23T22:00:00Z"), "Europe/Warsaw")).toBe("2026-10-25T08:00:00.000Z");
    expect(tomorrowAtLocalTime(new Date("2026-08-05T22:00:00Z"), "America/Los_Angeles")).toBe("2026-08-06T16:00:00.000Z");
  });

  it("releases a due item in place exactly once", () => {
    const state = { ...emptyState, inbox: [{ id: "one", kind: "text" as const, content: "x", status: "snoozed" as const, createdAt: "2026-08-01T00:00:00Z", snoozedUntil: "2026-08-05T07:00:00Z" }] };
    const released = releaseDueInboxItems(state, new Date("2026-08-05T07:00:00Z"));
    expect(released.inbox).toEqual([{ id: "one", kind: "text", content: "x", status: "unprocessed", createdAt: "2026-08-01T00:00:00Z", snoozedUntil: undefined }]);
    expect(releaseDueInboxItems(released, new Date("2026-08-05T08:00:00Z"))).toBe(released);
  });
});
