import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { GameHistoryCard } from './GameHistoryCard';
import type { UserGame } from '../types/user-profiles';

const mockGame: UserGame = {
  game_id: 1,
  title: 'Test Game',
  gm_username: 'testgm',
  state: 'in_progress',
  user_role: 'player',
  is_anonymous: false,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-03-20T00:00:00Z',
  characters: [
    {
      id: 101,
      name: 'Test Character',
      avatar_url: 'http://localhost:3000/avatar.jpg',
      character_type: 'warrior',
    },
  ],
};

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('GameHistoryCard', () => {
  it('renders game title as a link', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    const link = screen.getByRole('link', { name: 'Test Game' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/games/1');
  });

  it('formats and displays game state badge', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    // "in_progress" should be formatted as "In Progress"
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('displays user role badge', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    // "player" should be formatted as "Player"
    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  it('displays GM role badge correctly', () => {
    const gmGame = { ...mockGame, user_role: 'gm' };
    renderWithRouter(<GameHistoryCard game={gmGame} />);

    expect(screen.getByText('GM')).toBeInTheDocument();
  });

  it('displays Co-GM role badge correctly', () => {
    const coGmGame = { ...mockGame, user_role: 'co_gm' };
    renderWithRouter(<GameHistoryCard game={coGmGame} />);

    expect(screen.getByText('Co-GM')).toBeInTheDocument();
  });

  it('displays GM username', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    expect(screen.getByText(/GM:/i)).toBeInTheDocument();
    expect(screen.getByText(/@testgm/i)).toBeInTheDocument();
  });

  it('displays "Anonymous Game" badge for anonymous games', () => {
    const anonGame = { ...mockGame, is_anonymous: true };
    renderWithRouter(<GameHistoryCard game={anonGame} />);

    expect(screen.getByText('Anonymous Game')).toBeInTheDocument();
  });

  it('does not display "Anonymous Game" badge for non-anonymous games', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    expect(screen.queryByText('Anonymous Game')).not.toBeInTheDocument();
  });

  it('displays characters for non-anonymous games', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    expect(screen.getByText('Character:')).toBeInTheDocument();
    expect(screen.getByText('Test Character')).toBeInTheDocument();
  });

  it('displays character avatar when avatar_url is provided', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    const avatar = screen.getByAltText('Test Character');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'http://localhost:3000/avatar.jpg');
  });

  it('displays character initial when no avatar_url', () => {
    const gameWithoutAvatar: UserGame = {
      ...mockGame,
      characters: [
        {
          id: 101,
          name: 'Test Character',
          avatar_url: null,
          character_type: 'warrior',
        },
      ],
    };
    renderWithRouter(<GameHistoryCard game={gameWithoutAvatar} />);

    // Should show "T" for "Test Character"
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('hides characters for anonymous games', () => {
    const anonGame: UserGame = {
      ...mockGame,
      is_anonymous: true,
      characters: [
        {
          id: 101,
          name: 'Secret Character',
          avatar_url: null,
          character_type: 'warrior',
        },
      ],
    };
    renderWithRouter(<GameHistoryCard game={anonGame} />);

    expect(screen.queryByText('Character:')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret Character')).not.toBeInTheDocument();
  });

  it('displays plural "Characters:" for multiple characters', () => {
    const multiCharGame: UserGame = {
      ...mockGame,
      characters: [
        {
          id: 101,
          name: 'Character 1',
          avatar_url: null,
          character_type: 'warrior',
        },
        {
          id: 102,
          name: 'Character 2',
          avatar_url: null,
          character_type: 'mage',
        },
      ],
    };
    renderWithRouter(<GameHistoryCard game={multiCharGame} />);

    expect(screen.getByText('Characters:')).toBeInTheDocument();
    expect(screen.getByText('Character 1')).toBeInTheDocument();
    expect(screen.getByText('Character 2')).toBeInTheDocument();
  });

  it('displays formatted date range', () => {
    renderWithRouter(<GameHistoryCard game={mockGame} />);

    // Dates should be formatted as "Jan 2024 → Mar 2024"
    expect(screen.getByText(/2024/i)).toBeInTheDocument();
  });

  it('formats different game states correctly', () => {
    const states = [
      { state: 'recruiting', expected: 'Recruiting' },
      { state: 'character_creation', expected: 'Character Creation' },
      { state: 'completed', expected: 'Completed' },
      { state: 'cancelled', expected: 'Cancelled' },
    ];

    states.forEach(({ state, expected }) => {
      const { unmount } = renderWithRouter(
        <GameHistoryCard game={{ ...mockGame, state }} />
      );
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    });
  });
});
