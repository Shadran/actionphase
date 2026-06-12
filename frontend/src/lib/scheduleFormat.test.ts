import { describe, it, expect } from 'vitest';
import { formatScheduleDay } from './scheduleFormat';

// Mirrors the anchor logic in formatScheduleDay: Sunday of the current UTC week.
function currentSundayUtcMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay());
}

// Computes the expected UTC instant for (day, HH:MM) in a given IANA timezone,
// using the same current-week anchor as formatScheduleDay.
function expectedUtcMs(day: number, time: string, tz: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  const sundayMs = currentSundayUtcMs();
  const estimateUtcMs = sundayMs + day * 86400_000 + hours * 3600_000 + minutes * 60_000;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(estimateUtcMs));
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;

  const storedLocalMs = Date.UTC(
    parseInt(p.year, 10), parseInt(p.month, 10) - 1, parseInt(p.day, 10),
    parseInt(p.hour, 10) % 24, parseInt(p.minute, 10), parseInt(p.second, 10)
  );
  const offsetMs = estimateUtcMs - storedLocalMs;
  const targetLocalMs = sundayMs + day * 86400_000 + hours * 3600_000 + minutes * 60_000;
  return targetLocalMs + offsetMs;
}

function expectedDisplay(utcMs: number): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;
  return `${p.weekday} at ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

describe('formatScheduleDay', () => {
  it('displays UTC timezone schedule without any shift', () => {
    expect(formatScheduleDay(6, '10:00', 'UTC')).toBe(expectedDisplay(expectedUtcMs(6, '10:00', 'UTC')));
  });

  it('converts America/New_York correctly', () => {
    expect(formatScheduleDay(6, '10:00', 'America/New_York')).toBe(
      expectedDisplay(expectedUtcMs(6, '10:00', 'America/New_York'))
    );
  });

  it('converts America/Los_Angeles correctly', () => {
    expect(formatScheduleDay(6, '10:00', 'America/Los_Angeles')).toBe(
      expectedDisplay(expectedUtcMs(6, '10:00', 'America/Los_Angeles'))
    );
  });

  it('handles midnight (00:00) correctly', () => {
    expect(formatScheduleDay(0, '00:00', 'UTC')).toBe(expectedDisplay(expectedUtcMs(0, '00:00', 'UTC')));
  });

  it('handles non-zero minutes correctly', () => {
    expect(formatScheduleDay(3, '09:05', 'UTC')).toBe(expectedDisplay(expectedUtcMs(3, '09:05', 'UTC')));
  });

  it('shifts the day when timezone offset crosses midnight', () => {
    // Saturday 22:00 in America/New_York crosses into Sunday UTC
    expect(formatScheduleDay(6, '22:00', 'America/New_York')).toBe(
      expectedDisplay(expectedUtcMs(6, '22:00', 'America/New_York'))
    );
  });
});
