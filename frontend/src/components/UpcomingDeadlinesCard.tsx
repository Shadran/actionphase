import { Link } from 'react-router-dom';
import type { DashboardDeadline } from '../types/dashboard';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { Badge } from './ui';

interface UpcomingDeadlinesCardProps {
  deadlines: DashboardDeadline[];
}

/**
 * UpcomingDeadlinesCard - Display upcoming phase deadlines
 */
export function UpcomingDeadlinesCard({ deadlines }: UpcomingDeadlinesCardProps) {
  if (deadlines.length === 0) {
    return null;
  }

  return (
    <div className="surface-base rounded-lg shadow-lg p-8 h-full">
      <div className="flex items-center mb-4">
        <Calendar className="w-5 h-5 text-content-tertiary mr-2" />
        <h2 className="text-lg font-bold text-content-primary">Upcoming Deadlines</h2>
      </div>
      <div className="space-y-3">
        {deadlines.map((deadline) => {
          const urgencyColor = getUrgencyColor(deadline.hours_remaining);
          const subtitle = deadline.deadline_type === 'phase'
            ? `Phase ${deadline.phase_number}`
            : deadline.deadline_type === 'poll'
            ? 'Poll deadline'
            : null;
          return (
            <Link
              key={`${deadline.deadline_type}-${deadline.source_id}`}
              to={`/games/${deadline.game_id}`}
              className="block border border-theme-default rounded-md p-3 hover:border-theme-subtle hover:shadow transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="font-medium text-content-primary text-sm">
                    {deadline.game_title}
                  </p>
                  <p className="text-xs text-content-tertiary mt-0.5">
                    {deadline.title}{subtitle ? ` — ${subtitle}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center text-xs text-content-tertiary">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDeadlineDate(deadline.end_time)}
                </div>
                <div className={`flex items-center text-xs font-medium ${urgencyColor}`}>
                  {deadline.hours_remaining < 24 && (
                    <AlertCircle className="w-3 h-3 mr-1" />
                  )}
                  {formatTimeRemaining(deadline.hours_remaining)}
                </div>
              </div>
              {deadline.has_pending_submission && (
                <Badge variant="warning" className="mt-2">
                  Action pending
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Get urgency color based on hours remaining
 */
function getUrgencyColor(hours: number): string {
  if (hours < 6) {
    return 'text-semantic-danger';
  } else if (hours < 24) {
    return 'text-semantic-warning';
  } else {
    return 'text-semantic-success';
  }
}

/**
 * Format deadline date in readable format
 */
function formatDeadlineDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // If today, show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // If this week, show day and time
  const weekFromNow = new Date(now);
  weekFromNow.setDate(now.getDate() + 7);

  if (date < weekFromNow) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  // Otherwise show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format hours remaining in friendly format
 */
function formatTimeRemaining(hours: number): string {
  if (hours < 1) {
    return 'Less than 1 hour';
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
}
