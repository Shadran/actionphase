import type { Notification } from '@/types/notifications';
import type { UnreadInboxItem } from '@/types/unreadInbox';

const COMMENT_NOTIFICATION_TYPES = new Set(['comment_reply', 'character_mention']);

/**
 * Extracts the `conversation` query param from a notification's link_url,
 * e.g. "/games/12?tab=messages&conversation=34" -> 34.
 * The conversation ID isn't stored on the notification itself, only in this URL.
 */
export function parseConversationIdFromLinkUrl(linkUrl?: string): number | null {
  if (!linkUrl) return null;

  try {
    const url = new URL(linkUrl, 'http://placeholder');
    const raw = url.searchParams.get('conversation');
    if (!raw) return null;

    const conversationId = parseInt(raw, 10);
    return Number.isNaN(conversationId) ? null : conversationId;
  } catch {
    return null;
  }
}

/**
 * Classifies a notification into a reply-capable inbox item, or null if it's
 * not one of the types the Unread inbox can show a reply box for.
 */
export function classifyNotification(notification: Notification): UnreadInboxItem | null {
  if (!notification.game_id) return null;

  if (COMMENT_NOTIFICATION_TYPES.has(notification.type)) {
    // related_id is always the comment/reply message id for these types; the
    // backend's related_type value for it has been observed to vary ("comment"
    // vs "message") in seeded data, so we key off `type` instead of trusting it.
    if (!notification.related_id) return null;
    return {
      kind: 'comment',
      notification,
      gameId: notification.game_id,
      commentId: notification.related_id,
    };
  }

  if (notification.type === 'private_message') {
    const conversationId = parseConversationIdFromLinkUrl(notification.link_url);
    if (!conversationId) return null;
    return {
      kind: 'private_message',
      notification,
      gameId: notification.game_id,
      conversationId,
    };
  }

  return null;
}
