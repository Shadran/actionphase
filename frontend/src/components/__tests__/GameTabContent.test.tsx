import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameTabContent } from '../GameTabContent';
import type { GameWithDetails, GameParticipant } from '../../types/games';
import type { GamePhase } from '../../types/phases';

// Mock all child components
vi.mock('../GameResultsManager', () => ({
  GameResultsManager: ({ gameId }: { gameId: number }) => (
    <div data-testid="game-results-manager">GameResultsManager for game {gameId}</div>
  ),
}));

vi.mock('../ActionsList', () => ({
  ActionsList: () => <div data-testid="actions-list">ActionsList</div>,
}));

vi.mock('../ActionSubmission', () => ({
  ActionSubmission: () => <div data-testid="action-submission">ActionSubmission</div>,
}));

vi.mock('../ActionResultsList', () => ({
  ActionResultsList: () => <div data-testid="action-results-list">ActionResultsList</div>,
}));

vi.mock('../GameApplicationsList', () => ({
  GameApplicationsList: () => <div>GameApplicationsList</div>,
}));

vi.mock('../CharactersList', () => ({
  CharactersList: () => <div>CharactersList</div>,
}));

vi.mock('../PhaseManagement', () => ({
  PhaseManagement: () => <div>PhaseManagement</div>,
}));

vi.mock('../CommonRoom', () => ({
  CommonRoom: () => <div>CommonRoom</div>,
}));

vi.mock('../PrivateMessages', () => ({
  PrivateMessages: () => <div>PrivateMessages</div>,
}));

vi.mock('../HistoryView', () => ({
  HistoryView: () => <div>HistoryView</div>,
}));

vi.mock('../PeopleView', () => ({
  PeopleView: () => <div>PeopleView</div>,
}));

vi.mock('../HandoutsList', () => ({
  HandoutsList: () => <div>HandoutsList</div>,
}));

vi.mock('../AudienceView', () => ({
  AudienceView: () => <div>AudienceView</div>,
}));

describe('GameTabContent - Actions Tab with GameResultsManager', () => {
  const mockGame: GameWithDetails = {
    id: 326,
    title: 'E2E Test: Action Results',
    description: 'Test game',
    state: 'in_progress',
    gm_user_id: 1,
    gm_username: 'TestGM',
    genre: 'Horror',
    max_players: 5,
    current_players: 3,
    is_anonymous: false,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  const mockParticipants: GameParticipant[] = [];

  const mockPhase: GamePhase = {
    id: 1,
    game_id: 326,
    phase_type: 'action',
    phase_number: 1,
    title: 'Phase 1',
    is_active: true,
    is_published: true,
    created_at: '2025-01-01T00:00:00Z',
  };

  it('renders GameResultsManager for GM on actions tab', () => {
    render(
      <GameTabContent
        activeTab="actions"
        gameId={326}
        game={mockGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={true}
        isParticipant={true}
        currentUserId={1}
        userCharacters={[]}
      />
    );

    // GM should see both ActionsList and GameResultsManager
    expect(screen.getByTestId('game-results-manager')).toBeInTheDocument();
    expect(screen.getByText('GameResultsManager for game 326')).toBeInTheDocument();
  });

  it('does NOT render actions tab for players (shows ActionSubmission instead)', () => {
    render(
      <GameTabContent
        activeTab="actions"
        gameId={326}
        game={mockGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={false}
        isParticipant={true}
        currentUserId={2}
        userCharacters={[]}
      />
    );

    // Players should NOT see GameResultsManager (actions tab shows ActionSubmission for players)
    expect(screen.queryByTestId('game-results-manager')).not.toBeInTheDocument();
  });

  it('passes correct gameId to GameResultsManager on actions tab', () => {
    const testGameId = 999;
    const testGame = { ...mockGame, id: testGameId };

    render(
      <GameTabContent
        activeTab="actions"
        gameId={testGameId}
        game={testGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={true}
        isParticipant={true}
        currentUserId={1}
        userCharacters={[]}
      />
    );

    expect(screen.getByText(`GameResultsManager for game ${testGameId}`)).toBeInTheDocument();
  });

  it('only shows GameResultsManager on actions tab when game state is in_progress', () => {
    const recruitmentGame = { ...mockGame, state: 'recruitment' as const };

    const { rerender } = render(
      <GameTabContent
        activeTab="actions"
        gameId={326}
        game={recruitmentGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={true}
        isParticipant={true}
        currentUserId={1}
        userCharacters={[]}
      />
    );

    // Should not render GameResultsManager during recruitment
    expect(screen.queryByTestId('game-results-manager')).not.toBeInTheDocument();

    // Update to in_progress state
    rerender(
      <GameTabContent
        activeTab="actions"
        gameId={326}
        game={mockGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={true}
        isParticipant={true}
        currentUserId={1}
        userCharacters={[]}
      />
    );

    // Now should render GameResultsManager
    expect(screen.getByTestId('game-results-manager')).toBeInTheDocument();
  });

  it('only shows GameResultsManager when actions tab is active', () => {

    const { rerender } = render(
      <GameTabContent
        activeTab="people"
        gameId={326}
        game={mockGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={true}
        isParticipant={true}
        currentUserId={1}
        userCharacters={[]}
      />
    );

    // Should not render on people tab
    expect(screen.queryByTestId('game-results-manager')).not.toBeInTheDocument();

    // Switch to actions tab
    rerender(
      <GameTabContent
        activeTab="actions"
        gameId={326}
        game={mockGame}
        participants={mockParticipants}
        currentPhaseData={{ phase: mockPhase }}
        isLoadingPhase={false}
        isGM={true}
        isParticipant={true}
        currentUserId={1}
        userCharacters={[]}
      />
    );

    // Now should render GameResultsManager
    expect(screen.getByTestId('game-results-manager')).toBeInTheDocument();
  });
});
