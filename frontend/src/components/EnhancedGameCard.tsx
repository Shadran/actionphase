import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import type { EnrichedGameListItem } from '../types/games';
import { GAME_STATE_LABELS, GAME_STATE_COLORS, USER_RELATIONSHIP_LABELS } from '../types/games';
import { Button } from './ui';

interface EnhancedGameCardProps {
  game: EnrichedGameListItem;
  onClick?: () => void;
  onApplyClick?: () => void;
  showApplyButton?: boolean;
  'data-testid'?: string;
}

export function EnhancedGameCard({
  game,
  onClick,
  onApplyClick,
  showApplyButton = false,
  'data-testid': dataTestId
}: EnhancedGameCardProps) {
  const isUserGame = game.user_relationship === 'gm' || game.user_relationship === 'participant';
  const hasApplied = game.user_relationship === 'applied';
  const hasOpenSpots = !game.max_players || game.current_players < game.max_players;

  // Determine deadline to display
  const deadline = game.current_phase_deadline || game.recruitment_deadline;

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Link
      to={`/games/${game.id}`}
      className={`surface-base rounded-lg shadow-md border-2 transition-all hover:shadow-lg block ${
        isUserGame
          ? 'border-interactive-primary bg-interactive-primary-subtle'
          : hasApplied
          ? 'border-semantic-warning bg-semantic-warning-subtle'
          : 'border-theme-default hover:border-theme-strong'
      }`}
      onClick={onClick}
      data-testid={dataTestId}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-theme-default">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-content-primary flex-1 pr-2">
            {game.title}
          </h3>

          {/* User Relationship Badge */}
          {game.user_relationship && game.user_relationship !== 'none' && (
            <span
              className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                game.user_relationship === 'gm'
                  ? 'bg-semantic-info-subtle text-content-primary'
                  : game.user_relationship === 'participant'
                  ? 'bg-interactive-primary-subtle text-content-primary'
                  : 'bg-semantic-warning-subtle text-content-primary'
              }`}
            >
              {USER_RELATIONSHIP_LABELS[game.user_relationship]}
            </span>
          )}
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* State Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${GAME_STATE_COLORS[game.state]}`} data-testid={`game-status-${game.state}`}>
            {GAME_STATE_LABELS[game.state]}
          </span>

          {/* Archive Badge for completed games */}
          {game.state === 'completed' && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-interactive-primary-subtle text-interactive-primary">
              📚 Public Archive
            </span>
          )}

          {/* Genre Badge */}
          {game.genre && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold surface-raised text-content-primary">
              {game.genre}
            </span>
          )}

          {/* Recent Activity Indicator */}
          {game.has_recent_activity && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-semantic-success-subtle text-content-primary flex items-center gap-1">
              <span className="w-2 h-2 bg-semantic-success rounded-full animate-pulse"></span>
              New Activity
            </span>
          )}

          {/* Deadline Urgency Badge */}
          {deadline && game.deadline_urgency !== 'normal' && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                game.deadline_urgency === 'critical'
                  ? 'bg-semantic-danger-subtle text-content-primary'
                  : 'bg-semantic-warning-subtle text-content-primary'
              }`}
            >
              {game.deadline_urgency === 'critical' ? '⚠️ Urgent' : '⏰ Soon'}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        <p className="text-sm text-content-secondary mb-3 line-clamp-2">{game.description}</p>

        {/* Game Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm text-content-primary">
          <div>
            <span className="font-medium">GM:</span> {game.gm_username}
          </div>
          <div>
            <span className="font-medium">Players:</span>{' '}
            {game.current_players}
            {game.max_players && ` / ${game.max_players}`}
            {hasOpenSpots && game.state === 'recruitment' && (
              <span className="text-semantic-success ml-1">✓ Open</span>
            )}
          </div>

          {game.start_date && (
            <div className="col-span-2">
              <span className="font-medium">Starts:</span>{' '}
              {formatDate(game.start_date)}
            </div>
          )}

          {deadline && game.state !== 'completed' && game.state !== 'cancelled' && (
            <div className="col-span-2">
              <span className="font-medium">
                {game.current_phase_type ? 'Phase Deadline' : 'Application Deadline'}:
              </span>{' '}
              <span
                className={
                  game.deadline_urgency === 'critical'
                    ? 'text-semantic-danger font-semibold'
                    : game.deadline_urgency === 'warning'
                    ? 'text-semantic-warning font-semibold'
                    : ''
                }
              >
                {formatDistanceToNow(new Date(deadline), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      {showApplyButton && !isUserGame && !hasApplied && game.state === 'recruitment' && hasOpenSpots && onApplyClick && (
        <div className="p-4 border-t border-theme-default">
          <Button
            variant="primary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onApplyClick();
            }}
            className="w-full"
            data-testid={`apply-button-${game.id}`}
          >
            Apply to Join
          </Button>
        </div>
      )}
    </Link>
  );
}
