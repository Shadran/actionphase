import type { Notification } from '@/types/notifications';

export interface UnreadCommentItem {
  kind: 'comment';
  notification: Notification;
  gameId: number;
  commentId: number;
}

export interface UnreadPrivateMessageItem {
  kind: 'private_message';
  notification: Notification;
  gameId: number;
  conversationId: number;
  /** The specific message this notification was for — used to preview the
   * right message when a conversation has multiple unread notifications. */
  messageId: number;
}

export type UnreadInboxItem = UnreadCommentItem | UnreadPrivateMessageItem;
