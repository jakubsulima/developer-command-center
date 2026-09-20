import { describe, expect, it } from "vitest";
import { describeActionSchedule, formatActionDate, resolveRoutineTitle } from "./actionPresentation";

describe("prezentacja Działania", () => {
  it.each(["Europe/Warsaw", "America/Los_Angeles"])("traktuje ISO jako datę kalendarzową w %s", (timeZone) => {
    expect(formatActionDate("2026-09-18", timeZone, { today: "2026-09-20" })).toBe("18 wrz");
    expect(formatActionDate("2026-09-18", timeZone, { style: "detail", today: "2026-09-20" })).toBe("18 września 2026");
  });

  it("opisuje termin względem jawnego dzisiaj", () => {
    expect(describeActionSchedule({ scheduledFor: "2026-09-20", pinnedToToday: false }, "2026-09-20", "Europe/Warsaw")).toBe("Dzisiaj");
    expect(describeActionSchedule({ scheduledFor: "2026-09-21", pinnedToToday: false }, "2026-09-20", "Europe/Warsaw")).toBe("Jutro");
    expect(describeActionSchedule({ scheduledFor: "2026-09-18", pinnedToToday: false }, "2026-09-20", "Europe/Warsaw")).toBe("Zaległe · 18 wrz");
    expect(describeActionSchedule({ pinnedToToday: false }, "2026-09-20", "Europe/Warsaw")).toBe("Bez terminu");
  });

  it("rozwiązuje nazwę Rutyny i bezpieczny fallback", () => {
    expect(resolveRoutineTitle({ recurringTemplateId: "routine" }, [{ id: "routine", title: "Poranny przegląd" }])).toBe("Rutyna: Poranny przegląd");
    expect(resolveRoutineTitle({ recurringTemplateId: "missing" }, [])).toBe("Z Rutyny");
    expect(resolveRoutineTitle({}, [])).toBeUndefined();
  });
});
