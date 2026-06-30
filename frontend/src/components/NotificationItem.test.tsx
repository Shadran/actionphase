import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import NotificationItem from './NotificationItem';
import type { Notification } from '../types/notifications';

// Setup MSW server
const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('NotificationItem', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          {component}
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  const createMockNotification = (overrides?: Partial<Notification>): Notification => ({
    id: 1,
    user_id: 1,
    game_id: 10,
    type: 'private_message',
    title: 'Test Notification',
    content: 'Test content',
    is_read: false,
    created_at: new Date().toISOString(),
    link_url: '/games/10',
    ...overrides,
  });

  it('displays notification title and content', () => {
    const notification = createMockNotification({
      title: 'New private message',
      content: 'John sent you a message',
    });

    renderWithProviders(<NotificationItem notification={notification} />);

    expect(screen.getByText('New private message')).toBeInTheDocument();
    expect(screen.getByText('John sent you a message')).toBeInTheDocument();
  });

  it('displays correct icon for notification type', () => {
    const notificationTypes = [
      { type: 'private_message', icon: '✉️' },
      { type: 'comment_reply', icon: '💬' },
      { type: 'character_mention', icon: '👤' },
      { type: 'action_submitted', icon: '⚡' },
      { type: 'action_result', icon: '📜' },
      { type: 'phase_created', icon: '🎯' },
    ];

    notificationTypes.forEach(({ type, icon }) => {
      const notification = createMockNotification({ type });
      const { unmount } = renderWithProviders(<NotificationItem notification={notification} />);

      expect(screen.getByText(icon)).toBeInTheDocument();

      unmount();
    });
  });

  it('shows unread indicator for unread notifications', () => {
    const notification = createMockNotification({ is_read: false });

    renderWithProviders(<NotificationItem notification={notification} />);

    // Look for the "New" badge
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('does not show unread indicator for read notifications', () => {
    const notification = createMockNotification({ is_read: true });

    renderWithProviders(<NotificationItem notification={notification} />);

    // Should not have "New" badge
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });

  it('displays title with bold text when unread', () => {
    const notification = createMockNotification({ is_read: false, title: 'Unread message' });

    renderWithProviders(<NotificationItem notification={notification} />);

    const titleElement = screen.getByText('Unread message');
    expect(titleElement.className).toContain('font-semibold');
  });

  it('displays title with normal weight when read', () => {
    const notification = createMockNotification({ is_read: true, title: 'Read message' });

    renderWithProviders(<NotificationItem notification={notification} />);

    const titleElement = screen.getByText('Read message');
    expect(titleElement.className).toContain('font-normal');
  });

  it('marks notification as read when clicked', async () => {
    const notification = createMockNotification({ is_read: false });
    const mockOnNavigate = vi.fn();

    let markReadCalled = false;
    server.use(
      http.put('/api/v1/notifications/:id/mark-read', () => {
        markReadCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockOnNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    await waitFor(() => {
      expect(markReadCalled).toBe(true);
    });
  });

  it('does not mark already read notifications when clicked', async () => {
    const notification = createMockNotification({ is_read: true });

    let markReadCalled = false;
    server.use(
      http.put('/api/v1/notifications/:id/mark-read', () => {
        markReadCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    await user.click(screen.getByText('Test Notification'));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(markReadCalled).toBe(false);
  });

  it('calls onNavigate callback when clicked', async () => {
    const notification = createMockNotification({ link_url: '/games/123#results' });
    const mockOnNavigate = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockOnNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    expect(mockOnNavigate).toHaveBeenCalled();
  });

  it('does not call onNavigate when link_url is not provided', async () => {
    const notification = createMockNotification({ link_url: undefined });
    const mockOnNavigate = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockOnNavigate} />
    );

    await user.click(screen.getByText('Test Notification'));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('shows confirm modal when delete button is clicked', async () => {
    const notification = createMockNotification();

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    await user.click(screen.getByTitle('Delete notification'));

    expect(screen.getByText('Delete Notification')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this notification?')).toBeInTheDocument();
  });

  it('deletes notification when confirm modal is confirmed', async () => {
    const notification = createMockNotification();
    let deleteApiCalled = false;

    server.use(
      http.delete('http://localhost:3000/api/v1/notifications/:id', () => {
        deleteApiCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    await user.click(screen.getByTitle('Delete notification'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteApiCalled).toBe(true);
    });
  });

  it('does not delete notification when confirm modal is cancelled', async () => {
    const notification = createMockNotification();
    let deleteCalled = false;

    server.use(
      http.delete('/api/v1/notifications/:id', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    await user.click(screen.getByTitle('Delete notification'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(deleteCalled).toBe(false);
  });

  it('renders as an anchor element when link_url is provided', () => {
    const notification = createMockNotification({ link_url: '/games/10' });

    renderWithProviders(<NotificationItem notification={notification} />);

    // The notification item must be an <a> tag so the browser handles middle-click,
    // right-click → open in new tab, etc.
    const link = document.querySelector('a.notification-item');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/games/10');
  });

  it('renders as a div when no link_url is provided', () => {
    const notification = createMockNotification({ link_url: undefined });

    renderWithProviders(<NotificationItem notification={notification} />);

    expect(document.querySelector('a.notification-item')).not.toBeInTheDocument();
    expect(document.querySelector('div.notification-item')).toBeInTheDocument();
  });

  it('displays relative timestamp', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const notification = createMockNotification({
      created_at: fiveMinutesAgo,
    });

    renderWithProviders(<NotificationItem notification={notification} />);

    // date-fns formatDistanceToNow should produce something like "5 minutes ago"
    expect(screen.getByText(/minutes ago/i)).toBeInTheDocument();
  });

  it('does not trigger navigation when delete button is clicked', async () => {
    const notification = createMockNotification();
    const mockOnNavigate = vi.fn();

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockOnNavigate} />
    );

    await user.click(screen.getByTitle('Delete notification'));

    // Modal should open, but navigation should not fire
    expect(screen.getByText('Delete Notification')).toBeInTheDocument();
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });

  it('shows open-eye button with "Mark as read" label when notification is unread', () => {
    const notification = createMockNotification({ is_read: false });

    renderWithProviders(<NotificationItem notification={notification} />);

    const toggleBtn = screen.getByTestId('toggle-read-button');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Mark as read');
    expect(toggleBtn).toHaveAttribute('title', 'Mark as read');
  });

  it('shows slash-eye button with "Mark as unread" label when notification is read', () => {
    const notification = createMockNotification({ is_read: true });

    renderWithProviders(<NotificationItem notification={notification} />);

    const toggleBtn = screen.getByTestId('toggle-read-button');
    expect(toggleBtn).toHaveAttribute('aria-label', 'Mark as unread');
    expect(toggleBtn).toHaveAttribute('title', 'Mark as unread');
  });

  it('calls markAsRead when toggle button is clicked on an unread notification', async () => {
    const notification = createMockNotification({ is_read: false });

    let markReadCalled = false;
    server.use(
      http.put('/api/v1/notifications/:id/mark-read', () => {
        markReadCalled = true;
        return HttpResponse.json({ id: notification.id, is_read: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    await user.click(screen.getByTestId('toggle-read-button'));

    await waitFor(() => {
      expect(markReadCalled).toBe(true);
    });
  });

  it('calls markAsUnread when toggle button is clicked on a read notification', async () => {
    const notification = createMockNotification({ is_read: true });

    let markUnreadCalled = false;
    server.use(
      http.put('/api/v1/notifications/:id/mark-unread', () => {
        markUnreadCalled = true;
        return HttpResponse.json({ id: notification.id, is_read: false });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<NotificationItem notification={notification} />);

    await user.click(screen.getByTestId('toggle-read-button'));

    await waitFor(() => {
      expect(markUnreadCalled).toBe(true);
    });
  });

  it('toggle button click does not trigger navigation', async () => {
    const notification = createMockNotification({ is_read: false });
    const mockOnNavigate = vi.fn();

    server.use(
      http.put('/api/v1/notifications/:id/mark-read', () => {
        return HttpResponse.json({ id: notification.id, is_read: true });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(
      <NotificationItem notification={notification} onNavigate={mockOnNavigate} />
    );

    await user.click(screen.getByTestId('toggle-read-button'));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockOnNavigate).not.toHaveBeenCalled();
  });
});
