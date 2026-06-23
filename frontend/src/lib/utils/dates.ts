/**
 * Date utility functions for consistent date formatting across the application
 */

/**
 * Formats a timestamp as a human-readable relative time string (e.g. "3m ago", "2h ago").
 */
export function formatRelativeTime(timestamp: string): string {
  const minutesAgo = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60));
  if (minutesAgo < 1) return 'Just now';
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  if (minutesAgo < 1440) return `${Math.floor(minutesAgo / 60)}h ago`;
  return `${Math.floor(minutesAgo / 1440)}d ago`;
}

import { localDateTimeToUTC, utcToLocalDateTime } from '../../utils/timezone';

/**
 * Converts a datetime-local string to ISO 8601 format (RFC3339) with proper timezone handling
 *
 * The DateTimeInput component returns dates in YYYY-MM-DDTHH:mm format in the user's local time.
 * This function converts that local time to UTC for storage in the backend.
 *
 * @param dateTimeLocal - Date string in YYYY-MM-DDTHH:mm format (e.g., "2025-11-10T14:30")
 * @returns ISO 8601 formatted string in UTC (e.g., "2025-11-10T22:30:00.000Z") or empty string if input is falsy
 *
 * @example
 * ```typescript
 * // User in PST (UTC-8) enters 2:30 PM
 * convertToISO8601("2025-11-10T14:30") // "2025-11-10T22:30:00.000Z" (stored in UTC)
 * convertToISO8601("") // ""
 * convertToISO8601(undefined) // ""
 * ```
 */
export function convertToISO8601(dateTimeLocal: string | undefined): string {
  if (!dateTimeLocal) return '';
  // Convert from user's local time to UTC using timezone utilities
  return localDateTimeToUTC(dateTimeLocal);
}

/**
 * Formats a UTC date string or Date object for datetime-local input in the user's timezone
 *
 * @param date - ISO 8601 UTC date string or Date object
 * @returns String in YYYY-MM-DDTHH:mm format for datetime-local inputs, converted to user's local timezone
 *
 * @example
 * ```typescript
 * // User in PST (UTC-8) viewing a UTC time
 * formatDateTimeLocal("2025-11-10T22:30:00Z") // "2025-11-10T14:30" (displayed in PST)
 * formatDateTimeLocal(new Date("2025-11-10T22:30:00Z")) // "2025-11-10T14:30"
 * ```
 */
export function formatDateTimeLocal(date: string | Date): string {
  // Convert to ISO string if it's a Date object
  const isoString = typeof date === 'string' ? date : date.toISOString();

  // Convert UTC to local datetime-local format using timezone utilities
  return utcToLocalDateTime(isoString);
}
