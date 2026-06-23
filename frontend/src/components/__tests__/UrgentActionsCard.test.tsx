import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { UrgentActionsCard } from '../UrgentActionsCard';
import type { DashboardGameCard } from '../../types/dashboard';

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

describe('UrgentActionsCard', () => {
  const baseGame: DashboardGameCard = {
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

  it('returns null when no urgent games', () => {
    const nonUrgentGames: DashboardGameCard[] = [
      { ...baseGame, is_urgent: false },
      { ...baseGame, game_id: 2, is_urgent: false },
    ];

    const { container } = renderWithProviders(<UrgentActionsCard games={nonUrgentGames} />);

    expect(container.firstChild).toBeNull();
  });

  it('returns null when games array is empty', () => {
    const { container } = renderWithProviders(<UrgentActionsCard games={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it('displays urgent actions header when urgent games exist', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        current_phase_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('Urgent Actions Required')).toBeInTheDocument();
    expect(screen.getByText(/following games have pending actions/i)).toBeInTheDocument();
  });

  it('displays urgent game title', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        title: 'Critical Adventure',
        is_urgent: true,
        deadline_status: 'critical',
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('Critical Adventure')).toBeInTheDocument();
  });

  it('displays phase title when available', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        current_phase_title: 'Action Phase 5',
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('Action Phase 5')).toBeInTheDocument();
  });

  it('shows action submission needed badge when has_pending_action is true', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        has_pending_action: true,
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('Action submission needed')).toBeInTheDocument();
  });

  it('does not show action badge when has_pending_action is false', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        has_pending_action: false,
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.queryByText('Action submission needed')).not.toBeInTheDocument();
  });

  it('displays multiple urgent games', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        game_id: 1,
        title: 'Game One',
        is_urgent: true,
        deadline_status: 'critical',
      },
      {
        ...baseGame,
        game_id: 2,
        title: 'Game Two',
        is_urgent: true,
        deadline_status: 'warning',
      },
      {
        ...baseGame,
        game_id: 3,
        title: 'Game Three',
        is_urgent: true,
        deadline_status: 'critical',
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('Game One')).toBeInTheDocument();
    expect(screen.getByText('Game Two')).toBeInTheDocument();
    expect(screen.getByText('Game Three')).toBeInTheDocument();
  });

  it('filters out non-urgent games', () => {
    const mixedGames: DashboardGameCard[] = [
      {
        ...baseGame,
        game_id: 1,
        title: 'Urgent Game',
        is_urgent: true,
        deadline_status: 'critical',
      },
      {
        ...baseGame,
        game_id: 2,
        title: 'Normal Game',
        is_urgent: false,
        deadline_status: 'normal',
      },
    ];

    renderWithProviders(<UrgentActionsCard games={mixedGames} />);

    expect(screen.getByText('Urgent Game')).toBeInTheDocument();
    expect(screen.queryByText('Normal Game')).not.toBeInTheDocument();
  });

  it('links to game detail page', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        game_id: 42,
        is_urgent: true,
        deadline_status: 'critical',
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/games/42');
  });

  it('formats deadline as overdue when deadline has passed', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        current_phase_deadline: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('formats deadline in minutes when less than 1 hour', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        current_phase_deadline: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    // Should show minutes (between 44-45 depending on test execution time)
    expect(screen.getByText(/\d+ minutes/)).toBeInTheDocument();
  });

  it('formats deadline in hours when less than 24 hours', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        current_phase_deadline: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    // Should show "5 hours" (or 4 hours depending on timing)
    expect(screen.getByText(/\d+ hours/)).toBeInTheDocument();
  });

  it('formats deadline in days when 24+ hours', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'warning',
        current_phase_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    // Should show "2 days"
    expect(screen.getByText(/\d+ days?/)).toBeInTheDocument();
  });

  it('uses singular "day" for exactly 1 day', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'warning',
        current_phase_deadline: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      },
    ];

    renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('does not show deadline when current_phase_deadline is not set', () => {
    const urgentGames: DashboardGameCard[] = [
      {
        ...baseGame,
        is_urgent: true,
        deadline_status: 'critical',
        current_phase_deadline: undefined,
      },
    ];

    const { container } = renderWithProviders(<UrgentActionsCard games={urgentGames} />);

    // Clock icon should not be present
    expect(container.innerHTML).not.toContain('Clock');
  });
});
