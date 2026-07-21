import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useReplyToUnread } from './useReplyToUnread';
import * as unreadInboxApi from '@/utils/unreadInboxApi';
import type { UnreadCommentItem, UnreadPrivateMessageItem } from '@/types/unreadInbox';
import type { Notification } from '@/types/notifications';

vi.mock('@/utils/unreadInboxApi', () => ({
  replyToComment: vi.fn(),
  replyToPm: vi.fn(),
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 1,
    user_id: 1,
    game_id: 12,
    type: 'comment_reply',
    title: 'Someone replied',
    is_read: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useReplyToUnread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls replyToComment with rootPostId for a comment item', async () => {
    vi.mocked(unreadInboxApi.replyToComment).mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const item: UnreadCommentItem = {
      kind: 'comment',
      notification: makeNotification({ id: 1 }),
      gameId: 12,
      commentId: 99,
    };

    const { result } = renderHook(() => useReplyToUnread(), { wrapper: createWrapper(queryClient) });

    result.current.mutate({ item, characterId: 7, content: 'Sounds good!', rootPostId: 50 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(unreadInboxApi.replyToComment).toHaveBeenCalledWith({
      gameId: 12,
      notificationId: 1,
      parentCommentId: 99,
      rootPostId: 50,
      characterId: 7,
      content: 'Sounds good!',
    });
    expect(unreadInboxApi.replyToPm).not.toHaveBeenCalled();
  });

  it('rejects without calling replyToComment when rootPostId is missing for a comment item', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const item: UnreadCommentItem = {
      kind: 'comment',
      notification: makeNotification({ id: 1 }),
      gameId: 12,
      commentId: 99,
    };

    const { result } = renderHook(() => useReplyToUnread(), { wrapper: createWrapper(queryClient) });

    result.current.mutate({ item, characterId: 7, content: 'Sounds good!' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(unreadInboxApi.replyToComment).not.toHaveBeenCalled();
  });

  it('calls replyToPm (not replyToComment) for a private_message item', async () => {
    vi.mocked(unreadInboxApi.replyToPm).mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const item: UnreadPrivateMessageItem = {
      kind: 'private_message',
      notification: makeNotification({ id: 2, type: 'private_message' }),
      gameId: 12,
      conversationId: 34,
      messageId: 55,
    };

    const { result } = renderHook(() => useReplyToUnread(), { wrapper: createWrapper(queryClient) });

    result.current.mutate({ item, characterId: 8, content: 'Are you coming?' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(unreadInboxApi.replyToPm).toHaveBeenCalledWith({
      gameId: 12,
      notificationId: 2,
      conversationId: 34,
      characterId: 8,
      content: 'Are you coming?',
    });
    expect(unreadInboxApi.replyToComment).not.toHaveBeenCalled();
  });

  it('invalidates unread-inbox, notifications, and dashboard queries on success', async () => {
    vi.mocked(unreadInboxApi.replyToPm).mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const item: UnreadPrivateMessageItem = {
      kind: 'private_message',
      notification: makeNotification({ id: 2, type: 'private_message' }),
      gameId: 12,
      conversationId: 34,
      messageId: 55,
    };

    const { result } = renderHook(() => useReplyToUnread(), { wrapper: createWrapper(queryClient) });

    result.current.mutate({ item, characterId: 8, content: 'Are you coming?' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unread-inbox'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard'] });
  });

  it('surfaces a rejected mutation as isError when the underlying API call throws', async () => {
    vi.mocked(unreadInboxApi.replyToPm).mockRejectedValue(new Error('network error'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const item: UnreadPrivateMessageItem = {
      kind: 'private_message',
      notification: makeNotification({ id: 2, type: 'private_message' }),
      gameId: 12,
      conversationId: 34,
      messageId: 55,
    };

    const { result } = renderHook(() => useReplyToUnread(), { wrapper: createWrapper(queryClient) });

    result.current.mutate({ item, characterId: 8, content: 'Are you coming?' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isSuccess).toBe(false);
  });
});
