import { Link } from 'react-router-dom';
import type { DashboardGameCard as GameCardType } from '../types/dashboard';
import { Clock, AlertCircle, Users, MessageSquare } from 'lucide-react';
import { GAME_STATE_LABELS } from '../types/games';
import { PHASE_TYPE_LABELS } from '../types/phases';

interface DashboardGameCardProps {
  game: GameCardType;
}

/**
 * DashboardGameCard - Display individual game information on dashboard
 */
export function DashboardGameCard({ game }: DashboardGameCardProps) {
  const deadlineColor = {
    critical: 'text-content-primary bg-semantic-danger-subtle',
    warning: 'text-content-primary bg-semantic-warning-subtle',
    normal: 'text-content-primary bg-semantic-success-subtle',
  }[game.deadline_status];

  const getRoleDisplay = (role: string): string => {
    if (role === 'gm' || role === 'co_gm') return 'GM';
    if (role === 'audience') return 'Audience';
    return 'Player';
  };

  const roleDisplay = getRoleDisplay(game.user_role);

  return (
    <Link
      to={`/games/${game.game_id}`}
      data-testid="game-card"
      className={`block surface-base rounded-lg shadow-md border ${
        game.is_urgent ? 'border-semantic-danger ring-2 ring-semantic-danger/20' : 'border-theme-default'
      } hover:shadow-lg transition-shadow duration-200`}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-content-primary">{game.title}</h3>
            {game.description && (
              <p className="text-sm text-content-secondary mt-1 line-clamp-2">{game.description}</p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex gap-2">
            {game.state === 'completed' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-interactive-primary-subtle text-interactive-primary">
                Archive
              </span>
            )}
            {game.is_urgent && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-semantic-danger-subtle text-content-primary">
                <AlertCircle className="w-3 h-3 mr-1" />
                Urgent
              </span>
            )}
          </div>
        </div>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-content-secondary mb-4">
          <span className="font-medium">{roleDisplay}</span>
          <span className="text-content-tertiary">•</span>
          <span>{GAME_STATE_LABELS[game.state as keyof typeof GAME_STATE_LABELS]}</span>
          {game.genre && (
            <>
              <span className="text-content-tertiary">•</span>
              <span>{game.genre}</span>
            </>
          )}
        </div>

        {/* Current Phase Info */}
        {game.current_phase_title && (
          <div className="mb-4 p-3 surface-raised rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-content-primary">
                  {game.current_phase_title}
                </p>
                <p className="text-xs text-content-secondary mt-0.5">
                  {game.current_phase_type ? PHASE_TYPE_LABELS[game.current_phase_type as keyof typeof PHASE_TYPE_LABELS] : ''}
                </p>
              </div>
              {game.current_phase_deadline && (
                <div className={`ml-4 px-2 py-1 rounded text-xs font-medium ${deadlineColor}`}>
                  <Clock className="w-3 h-3 inline mr-1" />
                  Deadline: {new Date(game.current_phase_deadline).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Items */}
        <div className="flex items-center gap-4 text-sm">
          {game.has_pending_action && (
            <span className="inline-flex items-center text-content-primary bg-semantic-warning-subtle px-2 py-1 rounded">
              <AlertCircle className="w-4 h-4 mr-1" />
              Action needed
            </span>
          )}
          {game.pending_applications > 0 && (
            <span className="inline-flex items-center text-content-primary bg-interactive-primary-subtle px-2 py-1 rounded">
              <Users className="w-4 h-4 mr-1" />
              {game.pending_applications} application{game.pending_applications > 1 ? 's' : ''}
            </span>
          )}
          {game.unread_messages > 0 && (
            <span className="inline-flex items-center text-content-primary surface-raised px-2 py-1 rounded">
              <MessageSquare className="w-4 h-4 mr-1" />
              {game.unread_messages} unread
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
