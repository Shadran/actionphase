/**
 * Converts a stored weekday (0=Sun–6=Sat) + "HH:MM" time in the GM's IANA timezone
 * into a display string ("Saturday at 10:00 AM") in the viewer's local timezone.
 *
 * Algorithm:
 * 1. Find a reference date in the current week matching the stored day-of-week.
 *    Using a current-week anchor means DST offsets reflect the actual time of year,
 *    so the displayed time stays correct as DST transitions occur.
 * 2. Compute the UTC instant for (day, time) in the stored timezone by measuring
 *    the offset at that moment.
 * 3. Format that UTC instant using the browser's default timezone via Intl.
 */
export function formatScheduleDay(
  day: number,
  time: string,
  scheduleTimezone: string
): string {
  const [hours, minutes] = time.split(':').map(Number);

  // Anchor to the current week: find the most recent Sunday, then add `day` days.
  // This ensures the DST offset used is representative of the current time of year.
  const now = new Date();
  const currentSundayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - now.getUTCDay()
  );
  const estimateUtcMs = currentSundayUtcMs + day * 86400_000 + hours * 3600_000 + minutes * 60_000;

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

  // storedLocalMs: what the stored timezone "thinks" this UTC moment is (as fake-UTC ms)
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

  // The target local time in the stored timezone (anchored to current week)
  const targetLocalMs = currentSundayUtcMs + day * 86400_000 + hours * 3600_000 + minutes * 60_000;

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
