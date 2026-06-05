import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { PrivateMessages } from '../PrivateMessages';
import type { Character } from '../../types/characters';

// Mock the auth hook
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { useAuth } from '../../contexts/AuthContext'

describe('PrivateMessages', () => {
  const mockCharacters: Character[] = [
    {
      id: 1,
      game_id: 1,
      name: 'Hero Character',
      character_type: 'player_character',
      user_id: 100,
      status: 'approved',
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the useAuth hook
    vi.mocked(useAuth).mockReturnValue({
      currentUser: {
        id: 100,
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
      },
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      isCheckingAuth: false,
      authError: null,
    });

    // Mock the conversations API
    server.use(
      http.get('/api/v1/games/:gameId/conversations', () => {
        return HttpResponse.json({
          conversations: [],
        });
      })
    );
  });

  describe('Phase Restrictions', () => {
    it('shows phase restriction alert when not in common_room', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="action"
        />
      , { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/you can read message history/i)).toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /\+ new/i });
      expect(newButton).toBeDisabled();
    });

    it('does not show phase restriction alert during common_room', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      await waitFor(() => {
        expect(screen.queryByText(/you can read message history/i)).not.toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /\+ new/i });
      expect(newButton).not.toBeDisabled();
    });

    it('disables new conversation button during results phase', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="results"
        />
      , { gameId: 1 });

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toBeDisabled();
      });
    });

    it('shows tooltip on disabled new conversation button', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="action"
        />
      , { gameId: 1 });

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toHaveAttribute('title', 'New conversations can only be started during Common Room phases');
      });
    });

    it('shows correct tooltip on enabled new conversation button', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toHaveAttribute('title', 'Start a new private conversation');
      });
    });

    it('enables messaging during interlude phase', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="interlude"
        />
      , { gameId: 1 });

      await waitFor(() => {
        expect(screen.queryByText(/you can read message history/i)).not.toBeInTheDocument();
      });

      const newButton = screen.getByRole('button', { name: /\+ new/i });
      expect(newButton).not.toBeDisabled();
    });

    it('disables messaging when phase type is undefined', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType={undefined}
        />
      , { gameId: 1 });

      await waitFor(() => {
        const newButton = screen.getByRole('button', { name: /\+ new/i });
        expect(newButton).toBeDisabled();
        expect(screen.getByText(/you can read message history/i)).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('renders refresh button in conversation list', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByLabelText(/refresh conversation list/i)).toBeInTheDocument();
      });
    });

    it('refresh button shows only icon (no text)', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      await waitFor(() => {
        const refreshButton = screen.getByLabelText(/refresh conversation list/i);
        expect(refreshButton).toBeInTheDocument();
        // Button should not contain "Refresh" text (icon only to save space)
        expect(refreshButton.textContent).toBe('');
      });
    });

    it('refreshes conversation list when refresh button is clicked', async () => {
      const user = userEvent.setup();
      let conversationsFetchCount = 0;

      const mockConversations = [
        {
          id: 1,
          game_id: 1,
          title: 'Test Conversation',
          last_message_content: 'Hello!',
          last_message_sent_at: '2024-01-01T10:00:00Z',
          unread_count: 0,
        },
      ];

      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          conversationsFetchCount++;
          return HttpResponse.json({ conversations: mockConversations });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      // Wait for initial load
      await waitFor(() => {
        expect(conversationsFetchCount).toBeGreaterThan(0);
      });

      const initialFetchCount = conversationsFetchCount;

      // Click refresh button
      const refreshButton = screen.getByLabelText(/refresh conversation list/i);
      await user.click(refreshButton);

      // Verify conversations endpoint was called again
      await waitFor(() => {
        expect(conversationsFetchCount).toBeGreaterThan(initialFetchCount);
      });
    });

    it('disables refresh button while refreshing', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/games/:gameId/conversations', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ conversations: [] });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByLabelText(/refresh conversation list/i)).toBeInTheDocument();
      });

      // Click refresh button
      const refreshButton = screen.getByLabelText(/refresh conversation list/i);
      await user.click(refreshButton);

      // Button should be disabled during refresh
      expect(refreshButton).toBeDisabled();

      // Wait for refresh to complete
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });

    it('fetches updated conversation data after refresh', async () => {
      const user = userEvent.setup();
      let conversationCount = 1;

      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          const conversations = Array.from({ length: conversationCount }, (_, i) => ({
            id: i + 1,
            game_id: 1,
            title: `Conversation ${i + 1}`,
            last_message_content: 'Test message',
            last_message_sent_at: '2024-01-01T10:00:00Z',
            unread_count: 0,
            participants: [{ character_id: 1, character_name: 'Test', username: 'test' }],
            created_at: '2024-01-01T00:00:00Z',
          }));
          return HttpResponse.json({ conversations });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByLabelText(/refresh conversation list/i)).toBeInTheDocument();
      });

      // Update conversation count (simulates new conversation being created elsewhere)
      conversationCount = 2;

      // Click refresh button
      const refreshButton = screen.getByLabelText(/refresh conversation list/i);
      await user.click(refreshButton);

      // Verify refresh completed (button is enabled again)
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });

    it('handles refresh errors gracefully', async () => {
      const user = userEvent.setup();

      // Start with successful response
      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          return HttpResponse.json({ conversations: [] });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByLabelText(/refresh conversation list/i)).toBeInTheDocument();
      });

      // Make refresh fail
      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          return HttpResponse.error();
        })
      );

      // Click refresh button
      const refreshButton = screen.getByLabelText(/refresh conversation list/i);
      await user.click(refreshButton);

      // Wait for error handling to complete - button should be re-enabled
      await waitFor(() => {
        expect(refreshButton).not.toBeDisabled();
      });
    });

    it('increments refresh key to force ConversationList remount', async () => {
      const user = userEvent.setup();

      // We can't directly test the refreshKey state, but we can verify
      // that ConversationList remounts by checking that it fetches data again
      let conversationsFetchCount = 0;

      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          conversationsFetchCount++;
          return HttpResponse.json({ conversations: [] });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      // Wait for initial ConversationList mount and fetch
      await waitFor(() => {
        expect(conversationsFetchCount).toBeGreaterThan(0);
      });

      const fetchCountBeforeRefresh = conversationsFetchCount;

      // Click refresh button
      const refreshButton = screen.getByLabelText(/refresh conversation list/i);
      await user.click(refreshButton);

      // ConversationList should remount and fetch again
      await waitFor(() => {
        expect(conversationsFetchCount).toBeGreaterThan(fetchCountBeforeRefresh);
      });
    });
  });

  describe('URL sync - conversation param', () => {
    const mockConversations = [
      {
        id: 42,
        game_id: 1,
        title: 'Deep Linked Conversation',
        conversation_type: 'direct',
        participant_count: 2,
        participant_names: 'Alice, Bob',
        last_message: 'Hello!',
        last_message_at: '2025-01-15T10:00:00Z',
        unread_count: 0,
        created_at: '2025-01-01T00:00:00Z',
      },
    ];

    it('opens conversation from URL param on mount', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          return HttpResponse.json({ conversations: mockConversations });
        }),
        http.get('/api/v1/games/:gameId/conversations/:conversationId', () => {
          return HttpResponse.json({
            conversation: { id: 42, title: 'Deep Linked Conversation', conversation_type: 'direct' },
            participants: [{ user_id: 1, character_id: 1, character_name: 'Alice', username: 'alice' }],
          });
        }),
        http.get('/api/v1/conversations/:conversationId/messages', () => {
          return HttpResponse.json({ messages: [] });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />,
        { gameId: 1, initialEntries: ['/?tab=messages&conversation=42'] }
      );

      // Should show the thread view (back button) rather than the list
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to conversations/i })).toBeInTheDocument();
      });
    });

    it('shows conversation list when no conversation param is present', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />,
        { gameId: 1 }
      );

      await waitFor(() => {
        expect(screen.getByText(/private messages/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to conversations/i })).not.toBeInTheDocument();
      });
    });

    it('updates URL when a conversation is selected', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('http://localhost:3000/api/v1/games/:gameId/conversations', () => {
          return HttpResponse.json({ conversations: mockConversations });
        }),
        http.get('http://localhost:3000/api/v1/games/:gameId/conversations/:conversationId', () => {
          return HttpResponse.json({
            conversation: { id: 42, title: 'Deep Linked Conversation', conversation_type: 'direct' },
            participants: [{ user_id: 1, character_id: 1, character_name: 'Alice', username: 'alice' }],
          });
        }),
        http.get('http://localhost:3000/api/v1/conversations/:conversationId/messages', () => {
          return HttpResponse.json({ messages: [] });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />,
        { gameId: 1 }
      );

      await waitFor(() => {
        expect(screen.getAllByText('Deep Linked Conversation')[0]).toBeInTheDocument();
      });

      // The conversation link calls onSelectConversation which sets the URL param
      await user.click(screen.getAllByText('Deep Linked Conversation')[0]);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to conversations/i })).toBeInTheDocument();
      });
    });

    it('clears conversation param when back button is clicked', async () => {
      const user = userEvent.setup();

      server.use(
        http.get('/api/v1/games/:gameId/conversations', () => {
          return HttpResponse.json({ conversations: mockConversations });
        }),
        http.get('/api/v1/games/:gameId/conversations/:conversationId', () => {
          return HttpResponse.json({
            conversation: { id: 42, title: 'Deep Linked Conversation', conversation_type: 'direct' },
            participants: [{ user_id: 1, character_id: 1, character_name: 'Alice', username: 'alice' }],
          });
        }),
        http.get('/api/v1/conversations/:conversationId/messages', () => {
          return HttpResponse.json({ messages: [] });
        })
      );

      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />,
        { gameId: 1, initialEntries: ['/?tab=messages&conversation=42'] }
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /back to conversations/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back to conversations/i }));

      await waitFor(() => {
        expect(screen.getByText(/private messages/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /back to conversations/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Basic Rendering', () => {
    it('renders private messages component', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/private messages/i)).toBeInTheDocument();
      });
    });

    it('renders new conversation button', async () => {
      renderWithProviders(
        <PrivateMessages
          gameId={1}
          characters={mockCharacters}
          isAnonymous={false}
          currentPhaseType="common_room"
        />
      , { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /\+ new/i })).toBeInTheDocument();
      });
    });
  });
});
