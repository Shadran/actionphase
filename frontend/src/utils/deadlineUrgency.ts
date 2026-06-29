export type DeadlineUrgencyLevel = 'critical' | 'warning' | 'normal' | 'expired';

const CRITICAL_HOURS = 1;
const WARNING_HOURS = 3;

export function getDeadlineUrgency(deadlineStr?: string): DeadlineUrgencyLevel {
  if (!deadlineStr) return 'normal';

  try {
    const hoursRemaining = (new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining < 0) return 'expired';
    if (hoursRemaining < CRITICAL_HOURS) return 'critical';
    if (hoursRemaining < WARNING_HOURS) return 'warning';
    return 'normal';
  } catch {
    return 'normal';
  }
}

export function getDeadlineUrgencyFromHours(hours: number): DeadlineUrgencyLevel {
  if (hours < 0) return 'expired';
  if (hours < CRITICAL_HOURS) return 'critical';
  if (hours < WARNING_HOURS) return 'warning';
  return 'normal';
}
