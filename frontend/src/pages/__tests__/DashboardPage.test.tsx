import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { DashboardPage } from '../DashboardPage';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DashboardData } from '../../hooks/useDashboard';

// Mock the useDashboard hook
vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

// Mock dashboard child components
vi.mock('../../components/DashboardGameCard', () => ({
  DashboardGameCard: ({ game }: unknown) => (
    <div data-testid="dashboard-game-card">{game.title}</div>
  ),
}));

vi.mock('../../components/UrgentActionsCard', () => ({
  UrgentActionsCard: ({ games }: unknown) => (
    <div data-testid="urgent-actions-card">
      Urgent games: {games.filter((g: unknown) => g.is_urgent).length}
    </div>
  ),
}));

vi.mock('../../components/RecentActivityCard', () => ({
  RecentActivityCard: ({ messages }: unknown) => (
    <div data-testid="recent-activity-card">
      Messages: {messages.length}
    </div>
  ),
}));

vi.mock('../../components/UpcomingDeadlinesCard', () => ({
  UpcomingDeadlinesCard: ({ deadlines }: unknown) => (
    <div data-testid="upcoming-deadlines-card">
      Deadlines: {deadlines.length}
    </div>
  ),
}));

vi.mock('../../components/Dashboard/ActivityTabs', () => ({
  ActivityTabs: ({ deadlines, messages }: unknown) => (
    <div data-testid="activity-tabs">
      Deadlines: {deadlines.length}, Messages: {messages.length}
    </div>
  ),
}));

import { useDashboard } from '../../hooks/useDashboard';

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching dashboard data', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/loading your dashboard/i)).toBeInTheDocument();
  });

  it('shows error state when dashboard fetch fails', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load'),
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/failed to load dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/please try refreshing the page/i)).toBeInTheDocument();
  });

  it('shows empty state when user has no games', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: false,
        player_games: [],
        gm_games: [],
        audience_games: [], mixed_role_games: [],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/welcome to actionphase!/i)).toBeInTheDocument();
    expect(screen.getByText(/you're not currently in any games/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /browse games/i })).toBeInTheDocument();
  });

  it('displays dashboard when user has games', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [
          {
            game_id: 1,
            title: 'Test Player Game',
            state: 'in_progress',
            user_role: 'player',
            has_pending_action: false,
            pending_applications: 0,
            unread_comments: 0,
            is_urgent: false,
            deadline_status: 'normal',
          },
        ],
        gm_games: [
          {
            game_id: 2,
            title: 'Test GM Game',
            state: 'recruitment',
            user_role: 'gm',
            has_pending_action: false,
            pending_applications: 3,
            unread_comments: 0,
            is_urgent: false,
            deadline_status: 'normal',
          },
        ],
        audience_games: [], mixed_role_games: [],
        recent_messages: [
          {
            message_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            author_name: 'Test Author',
            content: 'Test message',
            created_at: new Date().toISOString(),
            message_type: 'post',
          },
        ],
        upcoming_deadlines: [
          {
            phase_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            phase_type: 'action',
            phase_title: 'Test Phase',
            phase_number: 1,
            end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            has_pending_submission: false,
            hours_remaining: 24,
          },
        ],
        unread_notifications: 5,
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/my dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/my games as player/i)).toBeInTheDocument();
    expect(screen.getByText(/games i'm running/i)).toBeInTheDocument();
    expect(screen.getByText('Test Player Game')).toBeInTheDocument();
    expect(screen.getByText('Test GM Game')).toBeInTheDocument();
  });

  it('shows urgent actions card when user has urgent games', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [
          {
            game_id: 1,
            title: 'Urgent Game',
            state: 'in_progress',
            user_role: 'player',
            has_pending_action: true,
            pending_applications: 0,
            unread_comments: 0,
            is_urgent: true,
            deadline_status: 'critical',
            current_phase_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          },
        ],
        gm_games: [],
        audience_games: [], mixed_role_games: [],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByTestId('urgent-actions-card')).toBeInTheDocument();
    expect(screen.getByText(/urgent games: 1/i)).toBeInTheDocument();
  });

  it('displays recent activity and upcoming deadlines sidebars', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [],
        gm_games: [],
        audience_games: [], mixed_role_games: [],
        recent_messages: [
          {
            message_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            author_name: 'Test Author',
            content: 'Test message',
            created_at: new Date().toISOString(),
            message_type: 'post',
          },
          {
            message_id: 2,
            game_id: 1,
            game_title: 'Test Game',
            author_name: 'Another Author',
            content: 'Another message',
            created_at: new Date().toISOString(),
            message_type: 'comment',
          },
        ],
        upcoming_deadlines: [
          {
            phase_id: 1,
            game_id: 1,
            game_title: 'Test Game',
            phase_type: 'action',
            phase_title: 'Test Phase',
            phase_number: 1,
            end_time: new Date().toISOString(),
            has_pending_submission: true,
            hours_remaining: 12,
          },
          {
            phase_id: 2,
            game_id: 2,
            game_title: 'Another Game',
            phase_type: 'action',
            phase_title: 'Another Phase',
            phase_number: 2,
            end_time: new Date().toISOString(),
            has_pending_submission: false,
            hours_remaining: 48,
          },
        ],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    // Mobile: ActivityTabs should be present
    expect(screen.getByTestId('activity-tabs')).toBeInTheDocument();

    // Desktop: individual cards should be present
    expect(screen.getByTestId('recent-activity-card')).toBeInTheDocument();
    expect(screen.getByTestId('upcoming-deadlines-card')).toBeInTheDocument();
  });

  it('shows mixed role games section when user has games with both roles', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        user_id: 1,
        has_games: true,
        player_games: [],
        gm_games: [],
        audience_games: [],
        mixed_role_games: [
          {
            game_id: 1,
            title: 'Mixed Role Game',
            state: 'in_progress',
            user_role: 'both',
            has_pending_action: false,
            pending_applications: 0,
            unread_comments: 0,
            is_urgent: false,
            deadline_status: 'normal',
          },
        ],
        recent_messages: [],
        upcoming_deadlines: [],
        unread_notifications: 0, notifications_by_type: {},
      },
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/other games/i)).toBeInTheDocument();
    expect(screen.getByText('Mixed Role Game')).toBeInTheDocument();
  });

  it('returns null when data is undefined and not loading', () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as Partial<UseQueryResult<DashboardData>>);

    const { container } = renderWithProviders(<DashboardPage />);

    expect(container.firstChild).toBeNull();
  });
});
