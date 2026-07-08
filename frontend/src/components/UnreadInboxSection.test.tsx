import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../test-utils/render';
import { UnreadInboxSection } from './UnreadInboxSection';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    currentUser: { id: 1, username: 'player1', email: 'player1@example.com', created_at: '', updated_at: '' },
    isAuthenticated: true,
    isCheckingAuth: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    error: null,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const commentNotification = {
  id: 1,
  user_id: 1,
  game_id: 12,
  type: 'comment_reply',
  title: 'Jane replied to your comment',
  is_read: false,
  created_at: '2026-01-01T00:00:00Z',
  related_type: 'comment',
  related_id: 99,
  link_url: '/games/12?tab=common-room&comment=99',
};

const pmNotification = {
  id: 2,
  user_id: 1,
  game_id: 12,
  type: 'private_message',
  title: 'New message from Alex',
  is_read: false,
  created_at: '2026-01-01T00:00:00Z',
  related_type: 'message',
  related_id: 55,
  link_url: '/games/12?tab=messages&conversation=34',
};

const mockComment = {
  id: 99,
  game_id: 12,
  author_id: 2,
  character_id: 3,
  content: 'Great idea, let\'s do that.',
  message_type: 'comment',
  thread_depth: 1,
  author_username: 'jane',
  character_name: 'Jane the Bard',
  is_edited: false,
  is_deleted: false,
  is_draft: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  parent_id: 50,
};

const mockParent = {
  ...mockComment,
  id: 50,
  character_id: 7,
  character_name: 'My Character',
  content: 'Original comment',
  parent_id: undefined,
  message_type: 'post',
};

const mockControllableCharacters = [
  { id: 7, game_id: 12, name: 'My Character', status: 'approved', is_active: true, created_at: '', updated_at: '' },
];

function setupHandlers() {
  const readIds = new Set<number>();

  server.use(
    http.get('/api/v1/notifications', () => {
      const data = [commentNotification, pmNotification].filter((n) => !readIds.has(n.id));
      return HttpResponse.json({
        data,
        pagination: { total: data.length, limit: 100, offset: 0 },
      });
    }),
    http.put('/api/v1/notifications/:id/mark-read', ({ params }) => {
      readIds.add(Number(params.id));
      return HttpResponse.json({ id: Number(params.id), is_read: true });
    }),
    http.get('/api/v1/games/:gameId/characters/controllable', () => {
      return HttpResponse.json(mockControllableCharacters);
    }),
    http.get('/api/v1/games/:gameId/messages/:messageId', ({ params }) => {
      if (params.messageId === '99') return HttpResponse.json(mockComment);
      if (params.messageId === '50') return HttpResponse.json(mockParent);
      return HttpResponse.json(mockComment);
    }),
    http.post('/api/v1/games/:gameId/posts/:postId/comments', () => {
      return HttpResponse.json({ id: 200 });
    }),
    http.get('/api/v1/games/:gameId/conversations/:conversationId', () => {
      return HttpResponse.json({
        conversation: { id: 34, game_id: 12, conversation_type: 'direct', created_by_user_id: 1, created_at: '', updated_at: '' },
        participants: [{ id: 1, conversation_id: 34, user_id: 1, character_id: 7, joined_at: '', username: 'player1' }],
      });
    }),
    http.get('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
      return HttpResponse.json({
        messages: [
          {
            id: 55,
            conversation_id: 34,
            sender_character_id: 8,
            sender_character_name: 'Alex the Rogue',
            sender_username: 'alex',
            content: 'Are you coming tonight?',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });
    }),
    http.post('/api/v1/games/:gameId/conversations/:conversationId/messages', () => {
      return HttpResponse.json({ id: 999 });
    })
  );
}

describe('UnreadInboxSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHandlers();
  });

  it('renders nothing when there are no unread repliable notifications', async () => {
    server.use(
      http.get('/api/v1/notifications', () => {
        return HttpResponse.json({ data: [], pagination: { total: 0, limit: 100, offset: 0 } });
      })
    );

    const { container } = renderWithProviders(<UnreadInboxSection />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows the unread count and item titles', async () => {
    renderWithProviders(<UnreadInboxSection />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
    expect(screen.getByText('Jane replied to your comment')).toBeInTheDocument();
    expect(screen.getByText('New message from Alex')).toBeInTheDocument();
  });

  it('collapses and expands the section on header click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<UnreadInboxSection />);

    await waitFor(() => {
      expect(screen.getByText('Jane replied to your comment')).toBeInTheDocument();
    });

    const header = screen.getByRole('button', { name: /unread/i });
    await user.click(header);

    expect(screen.queryByText('Jane replied to your comment')).not.toBeInTheDocument();

    await user.click(header);
    expect(screen.getByText('Jane replied to your comment')).toBeInTheDocument();
  });

  it('sends a comment reply with the entered content and character', async () => {
    const user = userEvent.setup();
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post('/api/v1/games/:gameId/posts/:postId/comments', async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ id: 200 });
      })
    );

    renderWithProviders(<UnreadInboxSection />);

    await waitFor(() => {
      expect(screen.getByText('Jane replied to your comment')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Jane replied to your comment'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Write a reply...')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Write a reply...'), 'Sounds good!');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(capturedBody).toMatchObject({
        content: 'Sounds good!',
        character_id: 7,
        root_post_id: 50,
      });
    });

    // The replied item disappears once the notification list refetches as read.
    await waitFor(() => {
      expect(screen.queryByText('Jane replied to your comment')).not.toBeInTheDocument();
    });
  });
});
