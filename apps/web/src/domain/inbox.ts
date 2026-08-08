import type { AppState } from "./types";

function zonedParts(date: Date, timeZone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
}

/** Returns the next local calendar day at the requested wall-clock time. */
export function tomorrowAtLocalTime(now: Date, timeZone: string, hour = 9) {
  const current = zonedParts(now, timeZone);
  const localNoon = new Date(Date.UTC(Number(current.year), Number(current.month) - 1, Number(current.day) + 1, 12));
  const next = zonedParts(localNoon, timeZone);
  const wallClockAsUtc = Date.UTC(Number(next.year), Number(next.month) - 1, Number(next.day), hour);
  let instant = wallClockAsUtc;
  // Two passes handle offset changes at DST boundaries without a timezone library.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(instant), timeZone);
    const actualAsUtc = Date.UTC(Number(actual.year), Number(actual.month) - 1, Number(actual.day), Number(actual.hour), Number(actual.minute), Number(actual.second));
    instant -= actualAsUtc - wallClockAsUtc;
  }
  return new Date(instant).toISOString();
}

/** Idempotent projection: an item is updated in place and can be released only once. */
export function releaseDueInboxItems(state: AppState, now: Date): AppState {
  let changed = false;
  const inbox = state.inbox.map((item) => {
    if (item.status !== "snoozed" || !item.snoozedUntil || new Date(item.snoozedUntil).getTime() > now.getTime()) return item;
    changed = true;
    return { ...item, status: "unprocessed" as const, snoozedUntil: undefined };
  });
  return changed ? { ...state, inbox } : state;
}
