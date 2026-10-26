import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint, reminderIsDue } from "../../../../supabase/functions/send-return-reminders/policy";
describe("return reminder delivery policy", () => {
  it("only permits HTTPS push provider endpoints", () => {
    expect(isAllowedPushEndpoint("https://web.push.apple.com/Qtoken")).toBe(true);
    for (const url of ["http://web.push.apple.com/token", "https://127.0.0.1/token", "https://web.push.apple.com.evil.test/token", "https://user:pass@web.push.apple.com/token", "https://web.push.apple.com:444/token"]) expect(isAllowedPushEndpoint(url)).toBe(false);
  });
  it("expires missed windows and uses the user's local date across DST", () => {
    const reminder = { local_date:"2026-10-25", timezone:"Europe/Warsaw", weekdays:[0], local_time:"02:30:00" };
    expect(reminderIsDue(reminder,new Date("2026-10-25T00:30:00Z"))).toBe(true);
    expect(reminderIsDue(reminder,new Date("2026-10-25T01:30:00Z"))).toBe(true); // DB daily key deduplicates repeated hour.
    expect(reminderIsDue(reminder,new Date("2026-10-25T01:40:00Z"))).toBe(false);
    expect(reminderIsDue(reminder,new Date("2026-10-26T01:30:00Z"))).toBe(false);
  });
});
