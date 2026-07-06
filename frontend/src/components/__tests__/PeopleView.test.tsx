import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { PeopleView } from '../PeopleView';
import { apiClient } from '../../lib/api';
import type { GameParticipant } from '../../types/games';

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    games: {
      getGameApplications: vi.fn(),
    },
  },
}));

// Mock the child components that have complex dependencies
vi.mock('../CharactersList', () => ({
  CharactersList: () => <div data-testid="characters-list">Characters List</div>,
}));

vi.mock('../RemovePlayerButton', () => ({
  RemovePlayerButton: () => <div>Remove Player</div>,
}));

vi.mock('../AddPlayerModal', () => ({
  AddPlayerModal: () => <div>Add Player Modal</div>,
}));

vi.mock('../AddAudienceMemberModal', () => ({
  AddAudienceMemberModal: () => <div>Add Audience Member Modal</div>,
}));

vi.mock('../InactiveCharactersList', () => ({
  InactiveCharactersList: () => <div>Inactive Characters</div>,
}));

vi.mock('../AudienceMemberBadge', () => ({
  AudienceMemberBadge: () => <span>Audience</span>,
}));

vi.mock('../ParticipantActionsMenu', () => ({
  ParticipantActionsMenu: () => <div>Actions Menu</div>,
}));

beforeEach(() => {
  vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({ data: [] } as never);
});

describe('PeopleView - Leave Game Button', () => {
  const mockPlayerParticipant: GameParticipant = {
    id: 1,
    game_id: 1,
    user_id: 1,
    username: 'player1',
    email: 'player1@example.com',
    role: 'player',
    status: 'active',
    joined_at: '2024-01-01',
  };

  const mockAudienceParticipant: GameParticipant = {
    id: 2,
    game_id: 1,
    user_id: 2,
    username: 'audience1',
    email: 'audience1@example.com',
    role: 'audience',
    status: 'active',
    joined_at: '2024-01-02',
  };

  const mockGMParticipant: GameParticipant = {
    id: 3,
    game_id: 1,
    user_id: 3,
    username: 'gm1',
    email: 'gm1@example.com',
    role: 'gm',
    status: 'active',
    joined_at: '2024-01-03',
  };

  describe('Bug #9: Audience members cannot leave games', () => {
    it('should show Leave Game button for audience members', async () => {
      // Arrange: User is an audience member
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Leave Game button should be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeInTheDocument();
    });

    it('should not show Leave Game button for non-participants', async () => {
      // Arrange: User has no role in the game
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={999} // User is not in the participants list
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Leave Game button should NOT be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should call onLeaveGame when audience member clicks Leave Game', async () => {
      // Arrange
      const user = userEvent.setup();
      const onLeaveGame = vi.fn();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="in_progress"
          onLeaveGame={onLeaveGame}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Act
      const leaveButton = screen.getByRole('button', { name: /leave game/i });
      await user.click(leaveButton);

      // Assert
      expect(onLeaveGame).toHaveBeenCalledTimes(1);
    });

    it('should show Leave Game button for regular participants', async () => {
      // Arrange: User is a regular player participant
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={1} // User is player1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Leave Game button should be visible
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeInTheDocument();
    });

    it('should not show Leave Game button in completed games', async () => {
      // Arrange
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="completed"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button in cancelled games', async () => {
      // Arrange
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockAudienceParticipant]}
          isGM={false}
          currentUserId={2} // User is audience1
          gameState="cancelled"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button when onLeaveGame is not provided', async () => {
      // Arrange: onLeaveGame callback is undefined
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={1} // User is player1
          gameState="in_progress"
          // onLeaveGame is undefined
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should not show Leave Game button for GM', async () => {
      // Arrange: Current user is the GM
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockGMParticipant]}
          isGM={true}
          currentUserId={3} // User is gm1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: GM should not see Leave Game button
      const leaveButton = screen.queryByRole('button', { name: /leave game/i });
      expect(leaveButton).not.toBeInTheDocument();
    });

    it('should disable Leave Game button when actionLoading is true', async () => {
      // Arrange
      const user = userEvent.setup();

      renderInRouter(
        <PeopleView
          gameId={1}
          participants={[mockPlayerParticipant]}
          isGM={false}
          currentUserId={1} // User is player1
          gameState="in_progress"
          onLeaveGame={vi.fn()}
          actionLoading={true}
        />
      );

      // Switch to Participants tab
      const participantsTab = screen.getByRole('button', { name: /participants/i });
      await user.click(participantsTab);

      // Assert: Button should be disabled
      const leaveButton = screen.getByRole('button', { name: /leave game/i });
      expect(leaveButton).toBeDisabled();
    });
  });
});

describe('PeopleView - Pending audience applications with no participants', () => {
  it('should show pending audience applications even when there are no participants', async () => {
    const user = userEvent.setup();

    vi.mocked(apiClient.games.getGameApplications).mockResolvedValue({
      data: [
        {
          id: 10,
          game_id: 1,
          user_id: 5,
          username: 'audienceApplicant',
          role: 'audience',
          status: 'pending',
          applied_at: '2024-01-01T00:00:00Z',
          message: 'I want to watch!',
        },
      ],
    } as never);

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[]} // No participants at all
        isGM={true}
        currentUserId={3}
        gmUserId={3}
        gameState="recruitment"
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    // The pending audience application section must be visible
    await waitFor(() => {
      expect(screen.getByText(/pending audience applications/i)).toBeInTheDocument();
    });
    expect(screen.getByText('audienceApplicant')).toBeInTheDocument();
  });
});

describe('PeopleView - anonymous game former player display', () => {
  const formerPlayer: GameParticipant = {
    id: 10,
    game_id: 1,
    user_id: 10,
    username: 'deadPlayer',
    role: 'audience',
    status: 'active',
    joined_at: '2024-01-01T00:00:00Z',
    is_former_player: true,
  };

  it('shows former players in a "Former Players" section in non-anonymous games', async () => {
    const user = userEvent.setup();

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[formerPlayer]}
        isGM={false}
        currentUserId={99}
        gameState="in_progress"
        isAnonymous={false}
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    expect(screen.getByText(/former players/i)).toBeInTheDocument();
    expect(screen.queryByText(/^players$/i)).not.toBeInTheDocument();
  });

  it('hides "Former Players" section from a regular player in an anonymous game', async () => {
    const user = userEvent.setup();
    const regularPlayer: GameParticipant = {
      id: 11, game_id: 1, user_id: 11, username: 'activePlayer',
      role: 'player', status: 'active', joined_at: '2024-01-01T00:00:00Z',
    };

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[regularPlayer, formerPlayer]}
        isGM={false}
        currentUserId={11} // viewing as the active player
        gameState="in_progress"
        isAnonymous={true}
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    expect(screen.queryByText(/former players/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^players \(2\)$/i)).toBeInTheDocument();
    expect(screen.getByText('deadPlayer')).toBeInTheDocument();
  });

  it('hides "Former Players" section from a non-participant in an anonymous game', async () => {
    const user = userEvent.setup();

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[formerPlayer]}
        isGM={false}
        currentUserId={99} // not in participants list
        gameState="in_progress"
        isAnonymous={true}
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    expect(screen.queryByText(/former players/i)).not.toBeInTheDocument();
  });

  it('shows "Former Players" section to the GM in an anonymous game', async () => {
    const user = userEvent.setup();

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[formerPlayer]}
        isGM={true}
        currentUserId={1}
        gameState="in_progress"
        isAnonymous={true}
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    expect(screen.getByText(/former players/i)).toBeInTheDocument();
    expect(screen.getByText('deadPlayer')).toBeInTheDocument();
  });

  it('shows "Former Players" section to an audience member in an anonymous game', async () => {
    const user = userEvent.setup();
    const audienceMember: GameParticipant = {
      id: 20, game_id: 1, user_id: 20, username: 'watcher',
      role: 'audience', status: 'active', joined_at: '2024-01-01T00:00:00Z',
      is_former_player: false,
    };

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[audienceMember, formerPlayer]}
        isGM={false}
        currentUserId={20} // viewing as audience member
        gameState="in_progress"
        isAnonymous={true}
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    expect(screen.getByText(/former players/i)).toBeInTheDocument();
    expect(screen.getByText('deadPlayer')).toBeInTheDocument();
  });
});

describe('PeopleView - participant profile links', () => {
  const mockPlayer: GameParticipant = {
    id: 1,
    game_id: 1,
    user_id: 1,
    username: 'playerOne',
    role: 'player',
    status: 'active',
    joined_at: '2024-01-01T00:00:00Z',
  };

  it('links participant username to their user profile', async () => {
    const user = userEvent.setup();

    renderInRouter(
      <PeopleView
        gameId={1}
        participants={[mockPlayer]}
        isGM={false}
        currentUserId={99}
        gameState="in_progress"
      />
    );

    const participantsTab = screen.getByRole('button', { name: /participants/i });
    await user.click(participantsTab);

    const link = screen.getByRole('link', { name: /playerOne/i });
    expect(link).toHaveAttribute('href', '/users/playerOne');
  });
});
