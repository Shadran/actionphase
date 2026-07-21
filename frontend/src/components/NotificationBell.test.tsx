import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithProviders, createTestQueryClient as _createTestQueryClient } from '../test-utils/render';
import NotificationBell from './NotificationBell';

// Setup MSW server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotificationBell', () => {
  beforeEach(() => {
    // Mock auth endpoints that renderWithProviders triggers
    server.use(
      http.get('http://localhost:3000/api/v1/auth/me', () => {
        return HttpResponse.json({
          id: 1,
          username: 'testuser',
          email: 'test@example.com'
        });
      }),
      // Mock notifications list endpoint (used by dropdown)
      http.get('http://localhost:3000/api/v1/notifications', () => {
        return HttpResponse.json([]);
      })
    );
    localStorage.setItem('auth_token', 'test-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('displays unread count badge when there are unread notifications', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.json({ unread_count: 7 });
      })
    );

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toBeInTheDocument();
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('7');
    });
  });

  it('does not display badge when unread count is 0', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.json({ unread_count: 0 });
      })
    );

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });
  });

  it('displays "99+" when unread count exceeds 99', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.json({ unread_count: 150 });
      })
    );

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('99+');
    });
  });

  it('opens dropdown when bell is clicked', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.json({ unread_count: 3 });
      }),
      http.get('http://localhost:3000/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    // Click bell
    await user.click(screen.getByTestId('notification-bell'));

    // Dropdown should be visible
    await waitFor(() => {
      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });
  });

  it('closes dropdown when bell is clicked again', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.json({ unread_count: 3 });
      }),
      http.get('http://localhost:3000/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    // Open dropdown
    await user.click(screen.getByTestId('notification-bell'));

    await waitFor(() => {
      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });

    // Close dropdown
    await user.click(screen.getByTestId('notification-bell'));

    await waitFor(() => {
      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
    });
  });

  it('carries the Faro user-action name so INP attributes to a human name, not svg.h-6.w-6', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.json({ unread_count: 0 });
      })
    );

    renderWithProviders(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    expect(screen.getByTestId('notification-bell')).toHaveAttribute(
      'data-faro-user-action-name',
      'open-notifications'
    );
  });

  it('handles API errors gracefully', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications/unread-count', () => {
        return HttpResponse.error();
      })
    );

    renderWithProviders(<NotificationBell />);

    // Should still render bell even if API fails
    await waitFor(() => {
      expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
    });

    // Badge should not be visible
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });
});
