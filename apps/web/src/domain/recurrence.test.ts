import { describe, expect, it } from "vitest";
import { emptyState } from "../data/empty";
import type { RecurringActionTemplate } from "./types";
import { describeRecurringSchedule, materializeRecurringActions, nextOccurrenceDates } from "./recurrence";

function template(overrides: Partial<RecurringActionTemplate> = {}): RecurringActionTemplate {
  return {
    id: "series-1",
    title: "Przegląd budżetu",
    detail: "",
    timezone: "Europe/Warsaw",
    startsOn: "2024-01-31",
    rule: { unit: "month", interval: 1, dayOfMonth: 31 },
    missedPolicy: "skip_missed",
    status: "active",
    checklist: [],
    skippedOccurrenceCount: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("nextOccurrenceDates", () => {
  it("opisuje regułę serii językiem widocznym na liście", () => {
    expect(describeRecurringSchedule(template({ startsOn: "2026-08-03", rule: { unit: "week", interval: 1, weekdays: [1, 3] } }))).toBe("Co tydzień · Pn, Śr");
    expect(describeRecurringSchedule(template({ rule: { unit: "day", interval: 3 } }))).toBe("Co 3 dni");
    expect(describeRecurringSchedule(template({ startsOn: "2026-08-17", rule: { unit: "month", interval: 2 } }))).toBe("Co 2 miesiące · 17. dzień miesiąca");
  });

  it("uses the final valid day for monthly dates and handles a leap year", () => {
    expect(nextOccurrenceDates(template(), "2024-01-01", 3)).toEqual([
      "2024-01-31", "2024-02-29", "2024-03-31"
    ]);
  });

  it("supports an interval and selected weekdays across the DST boundary", () => {
    expect(nextOccurrenceDates(template({
      startsOn: "2026-03-23",
      rule: { unit: "week", interval: 1, weekdays: [1, 5] }
    }), "2026-03-27", 4)).toEqual([
      "2026-03-27", "2026-03-30", "2026-04-03", "2026-04-06"
    ]);
  });
});

describe("materializeRecurringActions", () => {
  it("is idempotent and skip_missed does not create a backlog", () => {
    const state = { ...emptyState, recurringActionTemplates: [template()] };
    const once = materializeRecurringActions(state, "2024-03-31");
    const twice = materializeRecurringActions(once, "2024-03-31");

    expect(twice.actions).toHaveLength(1);
    expect(twice.actions[0]).toEqual(expect.objectContaining({ occurrenceDate: "2024-03-31", scheduledFor: "2024-03-31" }));
    expect(twice.recurringActionTemplates[0]?.skippedOccurrenceCount).toBe(2);
  });

  it("carry_one creates at most the latest missed occurrence after a long absence", () => {
    const state = { ...emptyState, recurringActionTemplates: [template({
      startsOn: "2026-01-01",
      rule: { unit: "day", interval: 1 },
      missedPolicy: "carry_one"
    })] };

    const result = materializeRecurringActions(state, "2026-04-01");

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.occurrenceDate).toBe("2026-04-01");
    expect(result.recurringActionTemplates[0]?.skippedOccurrenceCount).toBe(90);
  });
});
