/** Restrict server requests to supported push providers; redirects are forbidden by the caller. */
export function isAllowedPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && (
      url.hostname === "web.push.apple.com" || url.hostname === "fcm.googleapis.com" ||
      url.hostname === "updates.push.services.mozilla.com" || url.hostname.endsWith(".push.services.mozilla.com")
    );
  } catch { return false; }
}
export function reminderIsDue(reminder: { local_date: string; timezone: string; local_time: string; weekdays: number[] }, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: reminder.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const [hours, minutes] = reminder.local_time.split(":").map(Number);
  const delta = Number(parts.hour) * 60 + Number(parts.minute) - hours * 60 - minutes;
  return date === reminder.local_date && reminder.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay()) && delta >= 0 && delta < 10;
}
