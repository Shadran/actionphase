import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { renderWithProviders, createTestQueryClient } from '../test-utils';
import NotificationDropdown from './NotificationDropdown';
import type { Notification } from '../types/notifications';
import type { QueryClient } from '@tanstack/react-query';

// Setup MSW server with default handlers
const server = setupServer(
  // Mock auth/me endpoint that AuthContext calls
  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotificationDropdown', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  const createMockNotifications = (count: number): Notification[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      user_id: 1,
      game_id: 10,
      type: 'private_message',
      title: `Notification ${i + 1}`,
      content: `Content ${i + 1}`,
      is_read: i % 2 === 0, // Alternating read/unread
      created_at: new Date().toISOString(),
      link_url: `/games/10`,
    }));
  };

  it('does not render when isOpen is false', () => {
    renderWithProviders(<NotificationDropdown isOpen={false} onClose={vi.fn()} />, { queryClient });

    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });
  });

  it('displays loading state while fetching notifications', async () => {
    server.use(
      http.get('/api/v1/notifications', async () => {
        // Delay response
        await new Promise(resolve => setTimeout(resolve, 1000));
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    // Wait for loading state to appear (after auth check completes)
    await waitFor(() => {
      expect(screen.getByText(/loading notifications/i)).toBeInTheDocument();
    });
  });

  it('displays error state when API fails', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.error();
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText(/failed to load notifications/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no notifications', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument();
    });
  });

  it('displays list of notifications', async () => {
    const notifications = createMockNotifications(5);

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 5, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      notifications.forEach(notif => {
        expect(screen.getByText(notif.title)).toBeInTheDocument();
      });
    });
  });

  it('displays "Mark all as read" button when there are unread notifications', async () => {
    const notifications = createMockNotifications(5);
    // Make some unread
    notifications[0].is_read = false;
    notifications[1].is_read = false;

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 5, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });
  });

  it('does not display "Mark all as read" button when all notifications are read', async () => {
    const notifications = createMockNotifications(5);
    // Make all read
    notifications.forEach(n => (n.is_read = true));

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 5, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.queryByText('Mark all read')).not.toBeInTheDocument();
    });
  });

  it('marks all notifications as read when button is clicked', async () => {
    const notifications = createMockNotifications(3);
    notifications.forEach(n => (n.is_read = false));

    let markAllReadCalled = false;

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 3, limit: 20, offset: 0 },
        });
      }),
      http.put('/api/v1/notifications/mark-all-read', () => {
        markAllReadCalled = true;
        return HttpResponse.json({ marked_count: 3 });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mark all read'));

    await waitFor(() => {
      expect(markAllReadCalled).toBe(true);
    });
  });

  it('shows loading state while marking all as read', async () => {
    const notifications = createMockNotifications(3);
    notifications.forEach(n => (n.is_read = false));

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 3, limit: 20, offset: 0 },
        });
      }),
      http.put('/api/v1/notifications/mark-all-read', async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return HttpResponse.json({ marked_count: 3 });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('Mark all read')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mark all read'));

    // Should show "Marking..." text
    expect(screen.getByText('Marking...')).toBeInTheDocument();
  });

  it('navigates and closes dropdown when notification is clicked', async () => {
    const notifications = createMockNotifications(1);
    notifications[0].link_url = '/games/123#results';

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 1, limit: 20, offset: 0 },
        });
      }),
      http.put('/api/v1/notifications/:id/mark-read', () => {
        return HttpResponse.json({ success: true });
      })
    );

    const mockOnClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Notification 1')).toBeInTheDocument();
    });

    // Click notification
    await user.click(screen.getByText('Notification 1'));

    // Should close dropdown
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('closes dropdown when clicking outside', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    const mockOnClose = vi.fn();
    renderWithProviders(
      <div>
        <div data-testid="outside-element">Outside</div>
        <NotificationDropdown isOpen={true} onClose={mockOnClose} />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument();
    });

    // Click outside the dropdown
    const outsideElement = screen.getByTestId('outside-element');
    await userEvent.click(outsideElement);

    // Should call onClose
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('displays "View all notifications" link in footer', async () => {
    const notifications = createMockNotifications(5);

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 5, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('View all notifications')).toBeInTheDocument();
    });
  });

  it('displays footer even when no notifications', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      // Footer is always shown, even with no notifications
      expect(screen.getByText('View all notifications')).toBeInTheDocument();
    });
  });

  it('"View all notifications" renders as an anchor so middle-click works', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('View all notifications')).toBeInTheDocument();
    });

    const link = screen.getByText('View all notifications').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/notifications');
  });

  it('navigates to /notifications when "View all" is clicked', async () => {
    const notifications = createMockNotifications(5);

    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({
          data: notifications,
          pagination: { total: 5, limit: 20, offset: 0 },
        });
      })
    );

    const mockOnClose = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('View all notifications')).toBeInTheDocument();
    });

    await user.click(screen.getByText('View all notifications'));

    // Should close dropdown
    expect(mockOnClose).toHaveBeenCalled();

    // Navigation is handled by react-router, we just verify the click worked
  });

  it('fetches notifications with limit of 20', async () => {
    let requestParams: URLSearchParams | null = null;

    server.use(
      http.get('/api/v1/notifications', ({ request }) => {
        const url = new URL(request.url);
        requestParams = url.searchParams;

        return HttpResponse.json({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });
      })
    );

    renderWithProviders(<NotificationDropdown isOpen={true} onClose={vi.fn()} />, { queryClient });

    await waitFor(() => {
      expect(requestParams?.get('limit')).toBe('20');
    });
  });
});
