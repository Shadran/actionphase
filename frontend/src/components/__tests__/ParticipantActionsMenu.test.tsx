import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { ParticipantActionsMenu } from '../ParticipantActionsMenu';
import type { GameParticipant, GameApplication } from '../../types/games';

vi.mock('../../hooks/usePlayerManagement', () => ({
  usePromoteToCoGM: vi.fn(),
  useDemoteFromCoGM: vi.fn(),
  useTransitionPlayerToAudience: vi.fn(),
  useRemovePlayer: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  apiClient: {
    auth: {
      getCurrentUser: vi.fn().mockResolvedValue(null),
    },
    games: {
      reviewGameApplication: vi.fn(),
    },
  },
}));

import { usePromoteToCoGM, useDemoteFromCoGM, useTransitionPlayerToAudience, useRemovePlayer } from '../../hooks/usePlayerManagement';
import { apiClient } from '../../lib/api';

const makeMutation = (overrides = {}) => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
  ...overrides,
});

const baseParticipant: GameParticipant = {
  id: 1,
  game_id: 10,
  user_id: 42,
  username: 'alice',
  role: 'audience',
  status: 'active',
  joined_at: '2024-01-01T00:00:00Z',
};

const baseApplication: GameApplication = {
  id: 5,
  game_id: 10,
  user_id: 99,
  username: 'bob',
  role: 'player',
  status: 'pending',
  applied_at: '2024-01-01T00:00:00Z',
};

describe('ParticipantActionsMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePromoteToCoGM).mockReturnValue(makeMutation());
    vi.mocked(useDemoteFromCoGM).mockReturnValue(makeMutation());
    vi.mocked(useTransitionPlayerToAudience).mockReturnValue(makeMutation());
    vi.mocked(useRemovePlayer).mockReturnValue(makeMutation());
  });

  it('returns null when no actions are available', () => {
    const { container } = renderWithProviders(
      <ParticipantActionsMenu gameId={10} isPrimaryGM={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders menu button when participant is present', () => {
    renderWithProviders(
      <ParticipantActionsMenu gameId={10} participant={baseParticipant} isPrimaryGM={false} />
    );
    expect(screen.getByRole('button', { name: /participant actions/i })).toBeInTheDocument();
  });

  it('opens dropdown on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ParticipantActionsMenu gameId={10} participant={baseParticipant} isPrimaryGM={true} />
    );
    await user.click(screen.getByRole('button', { name: /participant actions/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  describe('Promote to Co-GM', () => {
    it('shows Promote to Co-GM for primary GM with audience participant', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.getByRole('menuitem', { name: /promote to co-gm/i })).toBeInTheDocument();
    });

    it('does not show Promote to Co-GM for non-primary GM', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={false}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.queryByRole('menuitem', { name: /promote to co-gm/i })).not.toBeInTheDocument();
    });

    it('does not show Promote to Co-GM for co_gm participant', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={{ ...baseParticipant, role: 'co_gm' }}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.queryByRole('menuitem', { name: /promote to co-gm/i })).not.toBeInTheDocument();
    });

    it('shows confirm modal when Promote to Co-GM is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /promote to co-gm/i }));
      expect(screen.getByText('Promote to Co-GM?')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    it('calls promoteToCoGM.mutateAsync and fires onSuccess', async () => {
      const user = userEvent.setup();
      const promoteMutation = makeMutation();
      vi.mocked(usePromoteToCoGM).mockReturnValue(promoteMutation);
      const onSuccess = vi.fn();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={true}
          onSuccess={onSuccess}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /promote to co-gm/i }));
      await user.click(screen.getByRole('button', { name: /^promote to co-gm$/i }));
      await waitFor(() => {
        expect(promoteMutation.mutateAsync).toHaveBeenCalledWith(42);
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Demote from Co-GM', () => {
    const coGMParticipant = { ...baseParticipant, role: 'co_gm' as const };

    it('shows Demote from Co-GM for primary GM with co_gm participant', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={coGMParticipant}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.getByRole('menuitem', { name: /demote from co-gm/i })).toBeInTheDocument();
    });

    it('does not show Demote from Co-GM for non-primary GM', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={coGMParticipant}
          isPrimaryGM={false}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.queryByRole('menuitem', { name: /demote from co-gm/i })).not.toBeInTheDocument();
    });

    it('calls demoteFromCoGM.mutateAsync after confirming', async () => {
      const user = userEvent.setup();
      const demoteMutation = makeMutation();
      vi.mocked(useDemoteFromCoGM).mockReturnValue(demoteMutation);
      const onSuccess = vi.fn();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={coGMParticipant}
          isPrimaryGM={true}
          onSuccess={onSuccess}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /demote from co-gm/i }));
      await user.click(screen.getByRole('button', { name: /demote to audience/i }));
      await waitFor(() => {
        expect(demoteMutation.mutateAsync).toHaveBeenCalledWith(42);
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Remove Player', () => {
    it('shows Remove Player for any participant (non-primary GM)', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={false}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.getByRole('menuitem', { name: /remove player/i })).toBeInTheDocument();
    });

    it('calls removePlayer.mutateAsync after confirming', async () => {
      const user = userEvent.setup();
      const removeMutation = makeMutation();
      vi.mocked(useRemovePlayer).mockReturnValue(removeMutation);
      const onSuccess = vi.fn();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={false}
          onSuccess={onSuccess}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /remove player/i }));
      await user.click(screen.getByRole('button', { name: /^remove player$/i }));
      await waitFor(() => {
        expect(removeMutation.mutateAsync).toHaveBeenCalledWith(42);
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Move to Audience', () => {
    const playerParticipant: GameParticipant = { ...baseParticipant, role: 'player' };

    it('shows Move to Audience for primary GM with player participant', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={playerParticipant}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.getByRole('menuitem', { name: /move to audience/i })).toBeInTheDocument();
    });

    it('does not show Move to Audience for non-primary GM', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={playerParticipant}
          isPrimaryGM={false}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.queryByRole('menuitem', { name: /move to audience/i })).not.toBeInTheDocument();
    });

    it('does not show Move to Audience for audience participant', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={baseParticipant}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.queryByRole('menuitem', { name: /move to audience/i })).not.toBeInTheDocument();
    });

    it('submit button is disabled until "confirm" is typed', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={playerParticipant}
          isPrimaryGM={true}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /move to audience/i }));
      const submitButton = screen.getByRole('button', { name: /^move to audience$/i });
      expect(submitButton).toBeDisabled();
      await user.type(screen.getByPlaceholderText('confirm'), 'confirm');
      expect(submitButton).not.toBeDisabled();
    });

    it('calls transitionToAudience.mutateAsync and fires onSuccess after typing confirm', async () => {
      const user = userEvent.setup();
      const transitionMutation = makeMutation();
      vi.mocked(useTransitionPlayerToAudience).mockReturnValue(transitionMutation);
      const onSuccess = vi.fn();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          participant={playerParticipant}
          isPrimaryGM={true}
          onSuccess={onSuccess}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /move to audience/i }));
      await user.type(screen.getByPlaceholderText('confirm'), 'confirm');
      await user.click(screen.getByRole('button', { name: /^move to audience$/i }));
      await waitFor(() => {
        expect(transitionMutation.mutateAsync).toHaveBeenCalledWith(42);
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe('Approve / Reject Application', () => {
    it('shows Approve and Reject Application when application provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          application={baseApplication}
          isPrimaryGM={false}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      expect(screen.getByRole('menuitem', { name: /approve application/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /reject application/i })).toBeInTheDocument();
    });

    it('calls reviewGameApplication with approve after confirming', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.games.reviewGameApplication).mockResolvedValue(undefined as never);
      const onSuccess = vi.fn();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          application={baseApplication}
          isPrimaryGM={false}
          onSuccess={onSuccess}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /approve application/i }));
      await user.click(screen.getByRole('button', { name: /^approve application$/i }));
      await waitFor(() => {
        expect(apiClient.games.reviewGameApplication).toHaveBeenCalledWith(10, 5, { action: 'approve' });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('calls reviewGameApplication with reject after confirming', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.games.reviewGameApplication).mockResolvedValue(undefined as never);
      const onSuccess = vi.fn();
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          application={baseApplication}
          isPrimaryGM={false}
          onSuccess={onSuccess}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /reject application/i }));
      await user.click(screen.getByRole('button', { name: /^reject application$/i }));
      await waitFor(() => {
        expect(apiClient.games.reviewGameApplication).toHaveBeenCalledWith(10, 5, { action: 'reject' });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('shows application message in approve modal', async () => {
      const user = userEvent.setup();
      const appWithMessage = { ...baseApplication, message: 'Please let me in' };
      renderWithProviders(
        <ParticipantActionsMenu
          gameId={10}
          application={appWithMessage}
          isPrimaryGM={false}
        />
      );
      await user.click(screen.getByRole('button', { name: /participant actions/i }));
      await user.click(screen.getByRole('menuitem', { name: /approve application/i }));
      expect(screen.getByText(/"Please let me in"/)).toBeInTheDocument();
    });
  });
});
