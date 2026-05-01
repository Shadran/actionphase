import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { GameApplicationsList } from '../GameApplicationsList';
import type { GameApplication } from '../../types/games';

vi.mock('../../lib/api', () => ({
  apiClient: {
    auth: {
      getCurrentUser: vi.fn().mockResolvedValue(null),
    },
    games: {
      getGameApplications: vi.fn(),
      reviewGameApplication: vi.fn(),
    },
  },
}));

vi.mock('../GameApplicationCard', () => ({
  GameApplicationCard: ({ application, onApprove, onReject }: {
    application: GameApplication;
    onApprove?: (id: number) => void;
    onReject?: (id: number) => void;
  }) => (
    <div data-testid={`app-card-${application.id}`}>
      <span>{application.username}</span>
      <span>{application.status}</span>
      {onApprove && (
        <button onClick={() => onApprove(application.id)} data-testid={`approve-${application.id}`}>
          Approve
        </button>
      )}
      {onReject && (
        <button onClick={() => onReject(application.id)} data-testid={`reject-${application.id}`}>
          Reject
        </button>
      )}
    </div>
  ),
}));

import { apiClient } from '../../lib/api';

const makeApp = (overrides: Partial<GameApplication> = {}): GameApplication => ({
  id: 1,
  game_id: 10,
  user_id: 42,
  username: 'alice',
  role: 'player',
  status: 'pending',
  applied_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('GameApplicationsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when isGM is false', () => {
    const { container } = renderWithProviders(
      <GameApplicationsList gameId={10} isGM={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows loading spinner while fetching', async () => {
    vi.mocked(apiClient.games.getGameApplications).mockImplementation(
      () => new Promise(() => {})
    );
    renderWithProviders(<GameApplicationsList gameId={10} isGM />);
    expect(screen.getAllByText(/loading applications/i).length).toBeGreaterThan(0);
  });

  it('shows empty state when no applications', async () => {
    vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({ data: [] } as never);
    renderWithProviders(<GameApplicationsList gameId={10} isGM />);
    await waitFor(() => {
      expect(screen.getByText('No Applications Yet')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('applications-pending-section')).not.toBeInTheDocument();
  });

  it('shows application count and pending section', async () => {
    vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({
      data: [makeApp(), makeApp({ id: 2, username: 'bob' })],
    } as never);
    renderWithProviders(<GameApplicationsList gameId={10} isGM />);
    await waitFor(() => {
      expect(screen.getByText('2 total applications')).toBeInTheDocument();
      expect(screen.getByTestId('applications-pending-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('app-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('app-card-2')).toBeInTheDocument();
  });

  it('separates pending and reviewed applications into sections', async () => {
    vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({
      data: [
        makeApp({ id: 1, status: 'pending' }),
        makeApp({ id: 2, username: 'bob', status: 'approved' }),
      ],
    } as never);
    renderWithProviders(<GameApplicationsList gameId={10} isGM />);
    await waitFor(() => {
      expect(screen.getByTestId('applications-pending-section')).toBeInTheDocument();
      expect(screen.getByTestId('applications-reviewed-section')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(apiClient.games.getGameApplications).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<GameApplicationsList gameId={10} isGM />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load applications.*network error/i)).toBeInTheDocument();
    });
  });

  it('calls reviewGameApplication with approve and refreshes list', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({
      data: [makeApp()],
    } as never);
    vi.mocked(apiClient.games.reviewGameApplication).mockResolvedValue(undefined as never);

    renderWithProviders(<GameApplicationsList gameId={10} isGM gameState="recruitment" />);

    await waitFor(() => {
      expect(screen.getByTestId('approve-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('approve-1'));

    await waitFor(() => {
      expect(apiClient.games.reviewGameApplication).toHaveBeenCalledWith(10, 1, { action: 'approve' });
      expect(apiClient.games.getGameApplications).toHaveBeenCalledTimes(2);
    });
  });

  it('calls reviewGameApplication with reject and refreshes list', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({
      data: [makeApp()],
    } as never);
    vi.mocked(apiClient.games.reviewGameApplication).mockResolvedValue(undefined as never);

    renderWithProviders(<GameApplicationsList gameId={10} isGM gameState="recruitment" />);

    await waitFor(() => {
      expect(screen.getByTestId('reject-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('reject-1'));

    await waitFor(() => {
      expect(apiClient.games.reviewGameApplication).toHaveBeenCalledWith(10, 1, { action: 'reject' });
      expect(apiClient.games.getGameApplications).toHaveBeenCalledTimes(2);
    });
  });
});
