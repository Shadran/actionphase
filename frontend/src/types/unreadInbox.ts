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
}

export type UnreadInboxItem = UnreadCommentItem | UnreadPrivateMessageItem;
