import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test-utils'
import { GamesPage } from '../GamesPage'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the API client
vi.mock('../../lib/api', () => ({
  apiClient: {
    getAuthToken: vi.fn(),
    removeAuthToken: vi.fn(),
    games: {
      applyToGame: vi.fn(),
    },
  },
}))

// Mock the auth hook
vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

// Mock components
vi.mock('../../components/GamesList', () => ({
  GamesList: ({
    games,
    loading,
    error,
    onApplyToGame,
  }: unknown) => (
    <div data-testid="games-list">
      <div>Games Count: {games?.length || 0}</div>
      <div>Loading: {String(loading)}</div>
      <div>Error: {error || 'none'}</div>
      {onApplyToGame && (
        <button onClick={() => onApplyToGame({ id: 456, title: 'Test Game' })}>Apply to Game</button>
      )}
    </div>
  ),
}))

vi.mock('../../components/CreateGameForm', () => ({
  CreateGameForm: ({ onSuccess, onCancel }: unknown) => (
    <div data-testid="create-game-form">
      <button onClick={() => onSuccess(789)}>Create Success</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('../../components/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: unknown) => (
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        <button onClick={onClose}>Close Modal</button>
        {children}
      </div>
    ) : null
  ),
}))

vi.mock('../../components/ApplyToGameModal', () => ({
  ApplyToGameModal: ({ gameId, gameTitle, isOpen, onClose, onApplicationSubmitted }: unknown) => (
    isOpen ? (
      <div data-testid="apply-modal">
        <h2>Apply to {gameTitle}</h2>
        <div>Game ID: {gameId}</div>
        <button onClick={onClose}>Close Apply Modal</button>
        <button onClick={onApplicationSubmitted}>Submit Application</button>
      </div>
    ) : null
  ),
}))

import { apiClient } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

// Type for mocked useAuth return value
type MockedAuthReturn = Partial<ReturnType<typeof useAuth>> & {
  isAuthenticated: boolean;
  user: { id: number; username: string } | null;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  isLoading: boolean;
};

describe('GamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { id: 1, username: 'testuser' },
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
    } as MockedAuthReturn)

    vi.mocked(apiClient.getAuthToken).mockReturnValue('valid-token')

    // Mock window methods
    Object.defineProperty(window, 'location', {
      value: { href: '', reload: vi.fn() },
      writable: true,
    })

    global.confirm = vi.fn().mockReturnValue(true)
    global.alert = vi.fn()
  })

  it('renders games page with header and create button', () => {
    renderWithProviders(<GamesPage />)

    expect(screen.getByRole('heading', { name: 'Browse Games' })).toBeInTheDocument()
    expect(screen.getByText('Discover and join role-playing games in the ActionPhase community')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Create Game' })).toBeInTheDocument()
  })

  it('opens create game modal', () => {
    renderWithProviders(<GamesPage />)

    const createButton = screen.getByText('Create Game')
    fireEvent.click(createButton)

    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('Create New Game')).toBeInTheDocument()
    expect(screen.getByTestId('create-game-form')).toBeInTheDocument()
  })

  it('closes create game modal', () => {
    renderWithProviders(<GamesPage />)

    // Open modal
    fireEvent.click(screen.getByText('Create Game'))
    expect(screen.getByTestId('modal')).toBeInTheDocument()

    // Close modal
    fireEvent.click(screen.getByText('Close Modal'))
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('handles successful game creation', () => {
    renderWithProviders(<GamesPage />)

    // Open modal and create game
    fireEvent.click(screen.getByText('Create Game'))
    fireEvent.click(screen.getByText('Create Success'))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    expect(mockNavigate).toHaveBeenCalledWith('/games/789')
  })

  it('handles game creation cancellation', () => {
    renderWithProviders(<GamesPage />)

    // Open modal and cancel
    fireEvent.click(screen.getByText('Create Game'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('opens apply modal when clicking apply to game', () => {
    renderWithProviders(<GamesPage />)

    expect(screen.queryByTestId('apply-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Apply to Game'))

    expect(screen.getByTestId('apply-modal')).toBeInTheDocument()
    expect(screen.getByText('Apply to Test Game')).toBeInTheDocument()
    expect(screen.getByText('Game ID: 456')).toBeInTheDocument()
  })

  it('closes apply modal', () => {
    renderWithProviders(<GamesPage />)

    // Open modal
    fireEvent.click(screen.getByText('Apply to Game'))
    expect(screen.getByTestId('apply-modal')).toBeInTheDocument()

    // Close modal
    fireEvent.click(screen.getByText('Close Apply Modal'))
    expect(screen.queryByTestId('apply-modal')).not.toBeInTheDocument()
  })

  it('handles successful application submission', () => {
    renderWithProviders(<GamesPage />)

    // Open modal and submit application
    fireEvent.click(screen.getByText('Apply to Game'))
    expect(screen.getByTestId('apply-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Submit Application'))

    // Modal should close after successful submission
    expect(screen.queryByTestId('apply-modal')).not.toBeInTheDocument()
  })
})
