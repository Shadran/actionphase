import { describe, it, expect } from 'vitest';
import { formatScheduleDay } from './scheduleFormat';

// Helper: build the expected display string for a given UTC ms in the viewer's local timezone.
// This mirrors what formatScheduleDay does for its output step.
function expectedDisplay(utcMs: number): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const parts = formatter.formatToParts(new Date(utcMs));
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;
  return `${p.weekday} at ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

describe('formatScheduleDay', () => {
  it('displays UTC timezone schedule without any shift', () => {
    // Saturday (6) at 10:00 UTC — UTC instant = 2024-01-13T10:00:00Z
    const utcMs = Date.UTC(2024, 0, 13, 10, 0, 0);
    expect(formatScheduleDay(6, '10:00', 'UTC')).toBe(expectedDisplay(utcMs));
  });

  it('converts America/New_York (UTC-5 in January) correctly', () => {
    // Saturday (6) at 10:00 Eastern = Saturday at 15:00 UTC in January (EST = UTC-5)
    const utcMs = Date.UTC(2024, 0, 13, 15, 0, 0);
    expect(formatScheduleDay(6, '10:00', 'America/New_York')).toBe(expectedDisplay(utcMs));
  });

  it('converts America/Los_Angeles (UTC-8 in January) correctly', () => {
    // Saturday (6) at 10:00 Pacific = Saturday at 18:00 UTC
    const utcMs = Date.UTC(2024, 0, 13, 18, 0, 0);
    expect(formatScheduleDay(6, '10:00', 'America/Los_Angeles')).toBe(expectedDisplay(utcMs));
  });

  it('handles midnight (00:00) correctly', () => {
    // Sunday (0) at 00:00 UTC = 2024-01-07T00:00:00Z
    const utcMs = Date.UTC(2024, 0, 7, 0, 0, 0);
    expect(formatScheduleDay(0, '00:00', 'UTC')).toBe(expectedDisplay(utcMs));
  });

  it('handles non-zero minutes correctly', () => {
    // Wednesday (3) at 09:05 UTC = 2024-01-10T09:05:00Z
    const utcMs = Date.UTC(2024, 0, 10, 9, 5, 0);
    expect(formatScheduleDay(3, '09:05', 'UTC')).toBe(expectedDisplay(utcMs));
  });

  it('shifts the day when timezone offset crosses midnight', () => {
    // Saturday (6) at 22:00 America/New_York = Sunday at 03:00 UTC (EST UTC-5)
    const utcMs = Date.UTC(2024, 0, 14, 3, 0, 0);
    expect(formatScheduleDay(6, '22:00', 'America/New_York')).toBe(expectedDisplay(utcMs));
  });
});
