/**
 * Converts a stored weekday (0=Sun–6=Sat) + "HH:MM" time in the GM's IANA timezone
 * into a display string ("Saturday at 10:00 AM") in the viewer's local timezone.
 *
 * Algorithm:
 * 1. Find the UTC instant corresponding to (day, time) in the stored timezone
 *    by computing the timezone offset at that moment.
 * 2. Format that UTC instant using the browser's default timezone via Intl.
 */
export function formatScheduleDay(
  day: number,
  time: string,
  scheduleTimezone: string
): string {
  const [hours, minutes] = time.split(':').map(Number);

  // Reference week anchored to 2024-01-07 (a Sunday). day=0→Sun, day=6→Sat.
  // First estimate: treat (day, time) as UTC.
  const estimateUtcMs = Date.UTC(2024, 0, 7 + day, hours, minutes, 0);

  // Find out what local clock the stored timezone shows at that UTC estimate.
  const storedTzFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: scheduleTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = storedTzFormatter.formatToParts(new Date(estimateUtcMs));
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;

  // What UTC time corresponds to the stored timezone's local representation?
  // storedLocalMs is what the stored timezone "thinks" this UTC moment is.
  const storedLocalMs = Date.UTC(
    parseInt(p.year, 10),
    parseInt(p.month, 10) - 1,
    parseInt(p.day, 10),
    parseInt(p.hour, 10) % 24,
    parseInt(p.minute, 10),
    parseInt(p.second, 10)
  );

  // Offset: how far UTC is from the stored timezone's local time
  const offsetMs = estimateUtcMs - storedLocalMs;

  // The target local time in the stored timezone (as a fake-UTC ms value)
  const targetLocalMs = Date.UTC(2024, 0, 7 + day, hours, minutes, 0);

  // The actual UTC instant for (day, time) in the stored timezone
  const actualUtcMs = targetLocalMs + offsetMs;

  // Format in the viewer's local timezone via Intl (uses browser default)
  const viewerFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const viewerParts = viewerFormatter.formatToParts(new Date(actualUtcMs));
  const vp: Record<string, string> = {};
  for (const { type, value } of viewerParts) vp[type] = value;

  return `${vp.weekday} at ${vp.hour}:${vp.minute} ${vp.dayPeriod}`;
}
