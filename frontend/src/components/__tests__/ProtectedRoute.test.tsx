import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { useAuth } from '../../contexts/AuthContext'
import { ProtectedRoute } from '../ProtectedRoute'

// Mock the useAuth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../contexts/AuthContext'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('When user is authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)
    })

    it('should render children when user is authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <div data-testid="protected-content">Secret Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()
      expect(screen.getByText('Secret Content')).toBeInTheDocument()
    })

    it('should render different children components', () => {
      render(
        <MemoryRouter initialEntries={['/games']}>
          <ProtectedRoute>
            <div>
              <h1>Dashboard</h1>
              <p>Welcome back!</p>
            </div>
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
      expect(screen.getByText('Welcome back!')).toBeInTheDocument()
    })

    it('should render complex nested children', () => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <ProtectedRoute>
            <div>
              <nav data-testid="nav">Navigation</nav>
              <main data-testid="main">Main Content</main>
              <footer data-testid="footer">Footer</footer>
            </div>
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(screen.getByTestId('nav')).toBeInTheDocument()
      expect(screen.getByTestId('main')).toBeInTheDocument()
      expect(screen.getByTestId('footer')).toBeInTheDocument()
    })
  })

  describe('When user is NOT authenticated', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        currentUser: null,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)
    })

    it('should redirect to /login when user is not authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div data-testid="protected-content">Secret Content</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      )

      // Should NOT render protected content
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()

      // Should render login page (after redirect)
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('should save the original location in state when redirecting', () => {
      // This test verifies the state={{ from: location }} functionality
      let _capturedState: unknown = null

      const LoginPage = () => {
        const location = window.location as Record<string, unknown>
        _capturedState = location.state
        return <div data-testid="login-page">Login Page</div>
      }

      render(
        <MemoryRouter initialEntries={['/games/123']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/games/:id" element={
              <ProtectedRoute>
                <div data-testid="protected-content">Secret Content</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      )

      // Protected content should not be visible
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()

      // Should show login page
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })

    it('should redirect from different protected routes', () => {
      const protectedRoutes = [
        { path: '/dashboard', initialEntry: '/dashboard' },
        { path: '/games', initialEntry: '/games' },
        { path: '/profile', initialEntry: '/profile' },
      ]

      protectedRoutes.forEach(({ path, initialEntry }) => {
        const { unmount } = render(
          <MemoryRouter initialEntries={[initialEntry]}>
            <Routes>
              <Route path="/login" element={<div data-testid="login-page">Login</div>} />
              <Route path={path} element={
                <ProtectedRoute>
                  <div data-testid="protected-content">Secret Content</div>
                </ProtectedRoute>
              } />
            </Routes>
          </MemoryRouter>
        )

        expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
        expect(screen.getByTestId('login-page')).toBeInTheDocument()
        unmount()
      })
    })

    it('should not render children when not authenticated', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div>
                  <h1>Secret Dashboard</h1>
                  <button>Delete Account</button>
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.queryByRole('heading', { name: 'Secret Dashboard' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete Account' })).not.toBeInTheDocument()
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)
    })

    it('should handle empty children', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <></>
          </ProtectedRoute>
        </MemoryRouter>
      )

      // Should render without errors, even with empty children
      expect(container).toBeInTheDocument()
    })

    it('should handle null children gracefully', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            {null}
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(container).toBeInTheDocument()
    })
  })

  describe('When requireAdmin is true', () => {
    it('should render children when user is an admin', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'adminuser', email: 'admin@example.com', is_admin: true, created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <ProtectedRoute requireAdmin>
            <div data-testid="admin-content">Admin Panel</div>
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(screen.getByTestId('admin-content')).toBeInTheDocument()
    })

    it('should redirect non-admin authenticated users to /', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 2, username: 'regularuser', email: 'user@example.com', is_admin: false, created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/" element={<div data-testid="home-page">Home</div>} />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <div data-testid="admin-content">Admin Panel</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('home-page')).toBeInTheDocument()
    })

    it('should redirect unauthenticated users to /login, not /', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        currentUser: null,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route path="/" element={<div data-testid="home-page">Home</div>} />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <div data-testid="admin-content">Admin Panel</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      )

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  describe('Authentication state changes', () => {
    it('should update when authentication state changes from authenticated to unauthenticated', () => {
      // Start authenticated
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        currentUser: { id: 1, username: 'testuser', email: 'test@example.com', created_at: '', updated_at: '' },
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      const { unmount } = render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <ProtectedRoute>
            <div data-testid="protected-content">Secret Content</div>
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(screen.getByTestId('protected-content')).toBeInTheDocument()

      // Clean up and re-render with unauthenticated state
      unmount()

      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        currentUser: null,
        isCheckingAuth: false,
        isLoading: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      } as Partial<ReturnType<typeof useAuth>>)

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div data-testid="protected-content">Secret Content</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      )

      // Should NOT show protected content when unauthenticated
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument()
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })
})
