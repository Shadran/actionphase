import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { DashboardGameCard } from '../DashboardGameCard';
import type { DashboardGameCard as GameCardType } from '../../types/dashboard';

// Mock react-router-dom Link
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children, className }: unknown) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

describe('DashboardGameCard', () => {
  const baseGame: GameCardType = {
    game_id: 1,
    title: 'Test Game',
    state: 'in_progress',
    genre: 'Fantasy',
    gm_user_id: 100,
    gm_username: 'TestGM',
    user_role: 'player',
    has_pending_action: false,
    pending_applications: 0,
    unread_comments: 0,
    unvoted_polls: 0,
    deadline_status: 'normal',
    is_urgent: false,
    updated_at: new Date(),
    created_at: new Date(),
  };

  it('displays game title and basic information', () => {
    renderWithProviders(<DashboardGameCard game={baseGame} />);

    expect(screen.getByText('Test Game')).toBeInTheDocument();
    expect(screen.getByText('Player')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Fantasy')).toBeInTheDocument();
  });

  it('shows urgent indicator for urgent games', () => {
    const urgentGame: GameCardType = {
      ...baseGame,
      is_urgent: true,
      deadline_status: 'critical',
      has_pending_action: true,
      current_phase_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      current_phase_title: 'Action Phase',
      current_phase_type: 'action',
    };

    const { container } = renderWithProviders(<DashboardGameCard game={urgentGame} />);

    expect(screen.getByText('Urgent')).toBeInTheDocument();

    // Check for urgent styling (semantic danger border)
    const link = container.querySelector('a');
    expect(link?.className).toContain('border-semantic-danger');
  });

  it('displays current phase information when available', () => {
    const gameWithPhase: GameCardType = {
      ...baseGame,
      current_phase_title: 'Planning Phase',
      current_phase_type: 'common_room',
      current_phase_deadline: '2025-10-25T18:00:00Z',
    };

    renderWithProviders(<DashboardGameCard game={gameWithPhase} />);

    expect(screen.getByText('Planning Phase')).toBeInTheDocument();
    expect(screen.getByText('Common Room')).toBeInTheDocument();
  });

  it('shows action needed badge when user has pending action', () => {
    const gameWithPendingAction: GameCardType = {
      ...baseGame,
      has_pending_action: true,
      current_phase_type: 'action',
    };

    renderWithProviders(<DashboardGameCard game={gameWithPendingAction} />);

    expect(screen.getByText('Action needed')).toBeInTheDocument();
  });

  it('shows pending applications count for GM', () => {
    const gmGameWithApplications: GameCardType = {
      ...baseGame,
      user_role: 'gm',
      state: 'recruitment',
      pending_applications: 5,
    };

    renderWithProviders(<DashboardGameCard game={gmGameWithApplications} />);

    expect(screen.getByText('5 applications')).toBeInTheDocument();
  });

  it('shows unread comments count', () => {
    const gameWithComments: GameCardType = {
      ...baseGame,
      unread_comments: 12,
    };

    renderWithProviders(<DashboardGameCard game={gameWithComments} />);

    expect(screen.getByText('12 new comments')).toBeInTheDocument();
  });

  it('displays GM role correctly', () => {
    const gmGame: GameCardType = {
      ...baseGame,
      user_role: 'gm',
    };

    renderWithProviders(<DashboardGameCard game={gmGame} />);

    expect(screen.getByText('GM')).toBeInTheDocument();
  });

  it('displays co_gm as GM', () => {
    const coGmGame: GameCardType = {
      ...baseGame,
      user_role: 'co_gm',
    };

    renderWithProviders(<DashboardGameCard game={coGmGame} />);

    expect(screen.getByText('GM')).toBeInTheDocument();
  });

  it('displays audience role correctly', () => {
    const audienceGame: GameCardType = {
      ...baseGame,
      user_role: 'audience',
    };

    renderWithProviders(<DashboardGameCard game={audienceGame} />);

    expect(screen.getByText('Audience')).toBeInTheDocument();
  });

  it('shows description when available', () => {
    const gameWithDescription: GameCardType = {
      ...baseGame,
      description: 'An epic fantasy adventure',
    };

    renderWithProviders(<DashboardGameCard game={gameWithDescription} />);

    expect(screen.getByText('An epic fantasy adventure')).toBeInTheDocument();
  });

  it('applies warning color for warning deadline status', () => {
    const warningGame: GameCardType = {
      ...baseGame,
      deadline_status: 'warning',
      current_phase_title: 'Test Phase',
      current_phase_type: 'action',
      current_phase_deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<DashboardGameCard game={warningGame} />);

    // Check for semantic warning styling in the deadline badge
    expect(container.innerHTML).toContain('bg-semantic-warning-subtle');
    expect(container.innerHTML).toContain('bg-semantic-warning-subtle');
  });

  it('applies critical color for critical deadline status', () => {
    const criticalGame: GameCardType = {
      ...baseGame,
      deadline_status: 'critical',
      current_phase_title: 'Test Phase',
      current_phase_type: 'action',
      current_phase_deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<DashboardGameCard game={criticalGame} />);

    // Check for semantic danger/critical styling in the deadline badge
    expect(container.innerHTML).toContain('bg-semantic-danger-subtle');
    expect(container.innerHTML).toContain('bg-semantic-danger-subtle');
  });

  it('applies normal color for normal deadline status', () => {
    const normalGame: GameCardType = {
      ...baseGame,
      deadline_status: 'normal',
      current_phase_title: 'Test Phase',
      current_phase_type: 'action',
      current_phase_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };

    const { container } = renderWithProviders(<DashboardGameCard game={normalGame} />);

    // Check for semantic success/normal styling in the deadline badge
    expect(container.innerHTML).toContain('bg-semantic-success-subtle');
    expect(container.innerHTML).toContain('bg-semantic-success-subtle');
  });

  it('links to game detail page', () => {
    renderWithProviders(<DashboardGameCard game={baseGame} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/games/1');
  });

  it('shows game state badge', () => {
    const recruitingGame: GameCardType = {
      ...baseGame,
      state: 'recruitment',
    };

    renderWithProviders(<DashboardGameCard game={recruitingGame} />);

    expect(screen.getByText('Recruiting Players')).toBeInTheDocument();
  });

  it('does not show pending applications when count is zero', () => {
    const gmGame: GameCardType = {
      ...baseGame,
      user_role: 'gm',
      pending_applications: 0,
    };

    renderWithProviders(<DashboardGameCard game={gmGame} />);

    expect(screen.queryByText(/applications/i)).not.toBeInTheDocument();
  });

  it('does not show unread comments when count is zero', () => {
    renderWithProviders(<DashboardGameCard game={{ ...baseGame, unread_comments: 0 }} />);

    expect(screen.queryByText(/new comment/i)).not.toBeInTheDocument();
  });

  it('does not show action needed when has_pending_action is false', () => {
    renderWithProviders(<DashboardGameCard game={{ ...baseGame, has_pending_action: false }} />);

    expect(screen.queryByText(/action needed/i)).not.toBeInTheDocument();
  });
});
