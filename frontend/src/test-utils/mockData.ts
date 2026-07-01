import type { User } from '../types/auth'
import type { Game } from '../types/games'

/**
 * Creates a mock user for testing
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates a mock game for testing
 */
export function createMockGame(overrides?: Partial<Game>): Game {
  return {
    id: 1,
    title: 'Test Game',
    description: 'A test game for unit testing',
    gm_user_id: 1,
    state: 'setup',
    max_players: 4,
    is_public: true,
    is_anonymous: false,
    game_config: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Mock JWT token for testing
 */
export const MOCK_JWT_TOKEN = 'mock-jwt-token'

/**
 * Mock user credentials for login tests
 */
export const MOCK_CREDENTIALS = {
  email: 'test@example.com',
  password: 'testpassword123',
}

/**
 * Mock registration data
 */
export const MOCK_REGISTRATION = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123',
}
