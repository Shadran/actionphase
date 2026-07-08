import { describe, it, expect } from 'vitest';
import { classifyNotification, parseConversationIdFromLinkUrl } from './parseUnreadNotification';
import type { Notification } from '@/types/notifications';

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

describe('parseConversationIdFromLinkUrl', () => {
  it('extracts the conversation id from a well-formed link_url', () => {
    expect(parseConversationIdFromLinkUrl('/games/12?tab=messages&conversation=34')).toBe(34);
  });

  it('returns null when link_url is missing', () => {
    expect(parseConversationIdFromLinkUrl(undefined)).toBeNull();
  });

  it('returns null when the conversation param is missing', () => {
    expect(parseConversationIdFromLinkUrl('/games/12?tab=messages')).toBeNull();
  });

  it('returns null when the conversation param is not a number', () => {
    expect(parseConversationIdFromLinkUrl('/games/12?tab=messages&conversation=abc')).toBeNull();
  });

  it('returns null for a malformed url', () => {
    expect(parseConversationIdFromLinkUrl('::not a url::')).toBeNull();
  });
});

describe('classifyNotification', () => {
  it('classifies a comment_reply notification as a comment item', () => {
    const notification = makeNotification({
      type: 'comment_reply',
      related_type: 'comment',
      related_id: 99,
    });

    expect(classifyNotification(notification)).toEqual({
      kind: 'comment',
      notification,
      gameId: 12,
      commentId: 99,
    });
  });

  it('classifies a comment_reply notification even when related_type is "message"', () => {
    // classifyNotification doesn't need related_type at all — `type` alone is
    // sufficient to know this points at a comment/reply message. Regression
    // coverage for a real bug in a test fixture that mis-set related_type to
    // "message" on a comment_reply row (backend/pkg/db/test_fixtures/e2e/25_notification_flow.sql).
    const notification = makeNotification({
      type: 'comment_reply',
      related_type: 'message',
      related_id: 35815,
    });

    expect(classifyNotification(notification)).toEqual({
      kind: 'comment',
      notification,
      gameId: 12,
      commentId: 35815,
    });
  });

  it('classifies a character_mention notification as a comment item', () => {
    const notification = makeNotification({
      type: 'character_mention',
      related_type: 'comment',
      related_id: 55,
    });

    expect(classifyNotification(notification)).toEqual({
      kind: 'comment',
      notification,
      gameId: 12,
      commentId: 55,
    });
  });

  it('classifies a private_message notification with a valid link_url as a PM item', () => {
    const notification = makeNotification({
      type: 'private_message',
      related_type: 'message',
      related_id: 77,
      link_url: '/games/12?tab=messages&conversation=34',
    });

    expect(classifyNotification(notification)).toEqual({
      kind: 'private_message',
      notification,
      gameId: 12,
      conversationId: 34,
      messageId: 77,
    });
  });

  it('returns null for a private_message notification with no parseable conversation id', () => {
    const notification = makeNotification({
      type: 'private_message',
      related_type: 'message',
      related_id: 77,
      link_url: undefined,
    });

    expect(classifyNotification(notification)).toBeNull();
  });

  it('returns null for a private_message notification missing related_id', () => {
    const notification = makeNotification({
      type: 'private_message',
      related_type: 'message',
      related_id: undefined,
      link_url: '/games/12?tab=messages&conversation=34',
    });

    expect(classifyNotification(notification)).toBeNull();
  });

  it('returns null for a comment notification missing related_id', () => {
    const notification = makeNotification({
      type: 'comment_reply',
      related_type: 'comment',
      related_id: undefined,
    });

    expect(classifyNotification(notification)).toBeNull();
  });

  it('returns null for non-repliable notification types', () => {
    const types = ['common_room_post', 'action_result', 'phase_created', 'handout_published', 'character_approved'];
    for (const type of types) {
      expect(classifyNotification(makeNotification({ type }))).toBeNull();
    }
  });

  it('returns null when game_id is missing', () => {
    const notification = makeNotification({
      type: 'comment_reply',
      related_type: 'comment',
      related_id: 99,
      game_id: undefined,
    });

    expect(classifyNotification(notification)).toBeNull();
  });
});
