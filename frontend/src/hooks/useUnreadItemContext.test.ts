import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useUnreadItemContext } from './useUnreadItemContext';
import * as unreadInboxApi from '@/utils/unreadInboxApi';
import type { UnreadPrivateMessageItem } from '@/types/unreadInbox';
import type { Notification } from '@/types/notifications';
import type { PrivateMessage } from '@/types/conversations';

vi.mock('@/utils/unreadInboxApi', () => ({
  fetchCommentContext: vi.fn(),
  fetchPmContext: vi.fn(),
  fetchConversationParticipantCharacterIds: vi.fn(),
  fetchAllGameCharacters: vi.fn(),
  resolveReplyCharacters: vi.fn(),
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    user_id: 1,
    game_id: 12,
    type: 'private_message',
    title: 'New message',
    is_read: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<PrivateMessage> = {}): PrivateMessage {
  return {
    id: 1,
    conversation_id: 34,
    sender_user_id: 5,
    sender_character_id: 20,
    content: 'default content',
    created_at: '2026-01-01T00:00:00Z',
    sender_username: 'gm',
    sender_character_name: 'GM Character',
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useUnreadItemContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(unreadInboxApi.resolveReplyCharacters).mockResolvedValue([]);
    vi.mocked(unreadInboxApi.fetchAllGameCharacters).mockResolvedValue([]);
    vi.mocked(unreadInboxApi.fetchConversationParticipantCharacterIds).mockResolvedValue([]);
  });

  it('previews the specific message the notification was for, not just the last message in the conversation', async () => {
    // Same sender sent two messages in the same conversation; each produced its
    // own notification. The conversation, fetched in full, contains both.
    const firstMessage = makeMessage({ id: 101, content: 'First message' });
    const secondMessage = makeMessage({ id: 102, content: 'Second message' });
    vi.mocked(unreadInboxApi.fetchPmContext).mockResolvedValue([firstMessage, secondMessage]);

    const itemForFirstMessage: UnreadPrivateMessageItem = {
      kind: 'private_message',
      notification: makeNotification({ id: 1 }),
      gameId: 12,
      conversationId: 34,
      messageId: 101,
    };

    const { result } = renderHook(() => useUnreadItemContext(itemForFirstMessage, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.previewMessage.content).toBe('First message');
  });

  it('previews the second message when its notification is expanded, from the same fetched conversation', async () => {
    const firstMessage = makeMessage({ id: 101, content: 'First message' });
    const secondMessage = makeMessage({ id: 102, content: 'Second message' });
    vi.mocked(unreadInboxApi.fetchPmContext).mockResolvedValue([firstMessage, secondMessage]);

    const itemForSecondMessage: UnreadPrivateMessageItem = {
      kind: 'private_message',
      notification: makeNotification({ id: 2 }),
      gameId: 12,
      conversationId: 34,
      messageId: 102,
    };

    const { result } = renderHook(() => useUnreadItemContext(itemForSecondMessage, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.previewMessage.content).toBe('Second message');
  });

  it('falls back to the most recent message if the notification message id is missing from the conversation', async () => {
    const firstMessage = makeMessage({ id: 101, content: 'First message' });
    const secondMessage = makeMessage({ id: 102, content: 'Second message' });
    vi.mocked(unreadInboxApi.fetchPmContext).mockResolvedValue([firstMessage, secondMessage]);

    const itemForDeletedMessage: UnreadPrivateMessageItem = {
      kind: 'private_message',
      notification: makeNotification({ id: 3 }),
      gameId: 12,
      conversationId: 34,
      messageId: 999, // e.g. the message was deleted and no longer appears
    };

    const { result } = renderHook(() => useUnreadItemContext(itemForDeletedMessage, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.previewMessage.content).toBe('Second message');
  });
});
