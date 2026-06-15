import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameActions } from '../GameActions';
import type { Game } from '../../types/games';

const baseGame: Game = {
  id: 1,
  title: 'Test Game',
  description: '',
  gm_user_id: 99,
  state: 'in_progress',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const defaultProps = {
  game: baseGame,
  isGM: false,
  canEditGame: false,
  isCheckingAuth: false,
  isParticipant: false,
  isInGame: false,
  userRole: 'none' as const,
  userApplication: null,
  actionLoading: false,
  stateActions: [],
  onEditGame: vi.fn(),
  onStateChange: vi.fn(),
  onApplyToGame: vi.fn(),
  onWithdrawApplication: vi.fn(),
  onLeaveGame: vi.fn(),
};

describe('GameActions - Join as Audience button visibility', () => {
  it('shows Join as Audience button during character_creation', () => {
    render(<GameActions {...defaultProps} game={{ ...baseGame, state: 'character_creation' }} />);
    expect(screen.getByTestId('join-as-audience-button')).toBeInTheDocument();
  });

  it('shows Join as Audience button during in_progress', () => {
    render(<GameActions {...defaultProps} game={{ ...baseGame, state: 'in_progress' }} />);
    expect(screen.getByTestId('join-as-audience-button')).toBeInTheDocument();
  });

  it('does not show Join as Audience button on completed games', () => {
    render(<GameActions {...defaultProps} game={{ ...baseGame, state: 'completed' }} />);
    expect(screen.queryByTestId('join-as-audience-button')).not.toBeInTheDocument();
  });

  it('does not show Join as Audience button if user is already in game', () => {
    render(<GameActions {...defaultProps} isInGame game={{ ...baseGame, state: 'in_progress' }} />);
    expect(screen.queryByTestId('join-as-audience-button')).not.toBeInTheDocument();
  });

  it('does not show Join as Audience button for the GM', () => {
    render(<GameActions {...defaultProps} isGM game={{ ...baseGame, state: 'in_progress' }} />);
    expect(screen.queryByTestId('join-as-audience-button')).not.toBeInTheDocument();
  });
});
