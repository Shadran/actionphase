import type { GameWithDetails } from '../types/games';
import { formatScheduleDay } from '../lib/scheduleFormat';

interface GameInfoGridProps {
  game: GameWithDetails;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not set';
  return new Date(dateString).toLocaleString();
};

export function GameInfoGrid({ game }: GameInfoGridProps) {
  const hasSchedule =
    game.common_room_open_day != null &&
    game.common_room_open_time != null &&
    game.common_room_close_day != null &&
    game.common_room_close_time != null &&
    game.schedule_timezone != null;

  const openLabel = hasSchedule
    ? formatScheduleDay(
        game.common_room_open_day!,
        game.common_room_open_time!,
        game.schedule_timezone!
      )
    : null;

  const closeLabel = hasSchedule
    ? formatScheduleDay(
        game.common_room_close_day!,
        game.common_room_close_time!,
        game.schedule_timezone!
      )
    : null;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <h3 className="font-semibold text-content-primary mb-2">Players</h3>
          <p className="text-content-secondary">
            {game.current_players} / {game.max_players || 'Unlimited'}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-content-primary mb-2">Recruitment Deadline</h3>
          <p className="text-content-secondary">{formatDate(game.recruitment_deadline)}</p>
        </div>

        <div>
          <h3 className="font-semibold text-content-primary mb-2">Start Date</h3>
          <p className="text-content-secondary">{formatDate(game.start_date)}</p>
        </div>

        <div>
          <h3 className="font-semibold text-content-primary mb-2">End Date</h3>
          <p className="text-content-secondary">{formatDate(game.end_date)}</p>
        </div>
      </div>

      {hasSchedule && (
        <div className="mt-6">
          <h3 className="font-semibold text-content-primary mb-2">Common Room Schedule</h3>
          <p className="text-content-secondary text-sm">
            <span className="font-medium text-content-primary">Opens:</span> {openLabel}
          </p>
          <p className="text-content-secondary text-sm mt-1">
            <span className="font-medium text-content-primary">Closes:</span> {closeLabel}
          </p>
          <p className="text-content-tertiary text-xs mt-1">Times shown in your local timezone</p>
        </div>
      )}
    </div>
  );
}
