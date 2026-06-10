import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test-utils'
import type { useAuth } from '../../contexts/AuthContext'
import { GamesList } from '../GamesList'
import type { EnrichedGameListItem } from '../../types/games'

// Mock the EnhancedGameCard component
vi.mock('../EnhancedGameCard')

// Mock the auth hook
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

import { useAuth } from '../../contexts/AuthContext'

describe('GamesList', () => {
  const mockOnGameClick = vi.fn()
  const _mockOnCreateClick = vi.fn()
  const mockOnApplyToGame = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GM Cannot Apply Bug - Regression Test', () => {
    const gmUser = { id: 1, username: 'gm_user', email: 'gm@example.com', created_at: '', updated_at: '' }
    const regularUser = { id: 2, username: 'player_user', email: 'player@example.com', created_at: '', updated_at: '' }

    const gmOwnedGame: EnrichedGameListItem = {
      id: 1,
      title: 'GMs Game',
      description: 'A game owned by the GM',
      gm_user_id: 1,
      gm_username: 'gm_user',
      state: 'recruitment',
      max_players: 4,
      current_players: 0,
      is_public: true,
      is_anonymous: false,
      user_relationship: 'gm',
      deadline_urgency: 'normal',
      has_recent_activity: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    const otherGame: EnrichedGameListItem = {
      id: 2,
      title: 'Other GMs Game',
      description: 'A game owned by another GM',
      gm_user_id: 99,
      gm_username: 'other_gm',
      state: 'recruitment',
      max_players: 5,
      current_players: 1,
      is_public: true,
      is_anonymous: false,
      user_relationship: 'none',
      deadline_urgency: 'normal',
      has_recent_activity: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    }

    it('GM should NOT see apply button on their own game', () => {
      // Setup: GM is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: gmUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      renderWithProviders(
        <GamesList
          games={[gmOwnedGame]}
          loading={false}
          error={null}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      expect(screen.getByText('GMs Game')).toBeInTheDocument()

      // CRITICAL: GM should NOT see "Apply to Join" button on their own game
      expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument()
      expect(screen.queryByText('Applying...')).not.toBeInTheDocument()
    })

    it('GM should see apply button on other GMs games', () => {
      // Setup: GM is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: gmUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      renderWithProviders(
        <GamesList
          games={[otherGame]}
          loading={false}
          error={null}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      expect(screen.getByText('Other GMs Game')).toBeInTheDocument()

      // GM SHOULD see "Apply to Join" button on other games
      expect(screen.getByText('Apply to Join')).toBeInTheDocument()
    })

    it('Regular user should see apply button on all recruiting games', () => {
      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      renderWithProviders(
        <GamesList
          games={[gmOwnedGame, otherGame]}
          loading={false}
          error={null}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      expect(screen.getByText('GMs Game')).toBeInTheDocument()
      expect(screen.getByText('Other GMs Game')).toBeInTheDocument()

      // Regular user should see "Apply to Join" on BOTH games
      const applyButtons = screen.getAllByText('Apply to Join')
      expect(applyButtons).toHaveLength(2)
    })

    it('Apply button should call onApplyToGame with correct game ID', () => {
      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      renderWithProviders(
        <GamesList
          games={[otherGame]}
          loading={false}
          error={null}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      expect(screen.getByText('Other GMs Game')).toBeInTheDocument()

      // Click the apply button
      const applyButton = screen.getByText('Apply to Join')
      fireEvent.click(applyButton)

      // Should call onApplyToGame with the game object
      expect(mockOnApplyToGame).toHaveBeenCalledWith(otherGame)
    })

    it('Apply button should not appear when onApplyToGame is not provided', () => {
      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      renderWithProviders(
        <GamesList
          games={[otherGame]}
          loading={false}
          error={null}
          // Note: onApplyToGame NOT provided
        />
      )

      expect(screen.getByText('Other GMs Game')).toBeInTheDocument()

      // Should NOT see apply button when callback not provided
      expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument()
    })

    it('Apply button should not appear on non-recruiting games', () => {
      const inProgressGame: EnrichedGameListItem = {
        ...otherGame,
        state: 'in_progress',
      }

      // Setup: Regular player is logged in
      vi.mocked(useAuth).mockReturnValue({
        currentUser: regularUser,
        isAuthenticated: true,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      renderWithProviders(
        <GamesList
          games={[inProgressGame]}
          loading={false}
          error={null}
          onApplyToGame={mockOnApplyToGame}
        />
      )

      expect(screen.getByText('Other GMs Game')).toBeInTheDocument()

      // Should NOT see apply button on non-recruiting games
      expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument()
    })
  })

  describe('Basic functionality', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        currentUser: null,
        isAuthenticated: false,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)
    })

    it('renders loading state initially', () => {
      renderWithProviders(<GamesList games={[]} loading={true} error={null} />)

      // Loading renders skeleton cards, not text
      expect(screen.getByTestId('games-list')).toBeInTheDocument()
      expect(screen.queryByRole('article')).not.toBeInTheDocument()
    })

    it('renders games list after loading', () => {
      const mockGames: EnrichedGameListItem[] = [
        {
          id: 1,
          title: 'Test Game',
          description: 'Test description',
          gm_user_id: 1,
          gm_username: 'testgm',
          state: 'recruitment',
          max_players: 4,
          current_players: 2,
          is_public: true,
          is_anonymous: false,
          user_relationship: 'none',
          deadline_urgency: 'normal',
          has_recent_activity: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ]

      renderWithProviders(<GamesList games={mockGames} loading={false} error={null} />)

      expect(screen.getByText('Test Game')).toBeInTheDocument()
      expect(screen.getByText('Test description')).toBeInTheDocument()
    })

    it('renders empty state when no games', () => {
      renderWithProviders(<GamesList games={[]} loading={false} error={null} />)

      expect(screen.getByText(/No games match your current filters/i)).toBeInTheDocument()
    })

    it('handles game click', () => {
      const mockGames: EnrichedGameListItem[] = [
        {
          id: 1,
          title: 'Clickable Game',
          description: 'Click me',
          gm_user_id: 1,
          gm_username: 'testgm',
          state: 'recruitment',
          max_players: 4,
          current_players: 0,
          is_public: true,
          is_anonymous: false,
          user_relationship: 'none',
          deadline_urgency: 'normal',
          has_recent_activity: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ]

      renderWithProviders(
        <GamesList
          games={mockGames}
          loading={false}
          error={null}
          onGameClick={mockOnGameClick}
        />
      )

      // Click the game card
      const gameCard = screen.getByTestId('game-card-1')
      fireEvent.click(gameCard)

      expect(mockOnGameClick).toHaveBeenCalledWith(mockGames[0])
    })

    it('renders error state when error provided', () => {
      renderWithProviders(
        <GamesList
          games={[]}
          loading={false}
          error="Failed to load games"
        />
      )

      expect(screen.getByText(/Error Loading Games/i)).toBeInTheDocument()
      expect(screen.getByText('Failed to load games')).toBeInTheDocument()
    })
  })
})
