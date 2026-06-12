import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils/render';
import { GameInfoGrid } from '../GameInfoGrid';
import type { GameWithDetails } from '../../types/games';

const baseGame: GameWithDetails = {
  id: 1,
  title: 'Test Game',
  description: 'A test game',
  gm_user_id: 1,
  state: 'in_progress',
  current_players: 3,
  max_players: 6,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('GameInfoGrid', () => {
  it('renders players, dates, and no schedule section when schedule is not set', () => {
    renderWithProviders(<GameInfoGrid game={baseGame} />);

    expect(screen.getByText('Players')).toBeTruthy();
    expect(screen.getByText('3 / 6')).toBeTruthy();
    expect(screen.queryByText('Common Room Schedule')).toBeNull();
  });

  it('renders the schedule section when all schedule fields are present', () => {
    const gameWithSchedule: GameWithDetails = {
      ...baseGame,
      common_room_open_day: 6,
      common_room_open_time: '10:00:00',
      common_room_close_day: 0,
      common_room_close_time: '22:00:00',
      schedule_timezone: 'UTC',
    };

    renderWithProviders(<GameInfoGrid game={gameWithSchedule} />);

    expect(screen.getByText('Common Room Schedule')).toBeTruthy();
    expect(screen.getByText('Opens:')).toBeTruthy();
    expect(screen.getByText('Closes:')).toBeTruthy();
    expect(screen.getByText('Times shown in your local timezone')).toBeTruthy();
  });

  it('does not render schedule section when only some schedule fields are set', () => {
    const partialSchedule: GameWithDetails = {
      ...baseGame,
      common_room_open_day: 6,
      // missing open_time, close_day, close_time, timezone
    };

    renderWithProviders(<GameInfoGrid game={partialSchedule} />);

    expect(screen.queryByText('Common Room Schedule')).toBeNull();
  });
});
