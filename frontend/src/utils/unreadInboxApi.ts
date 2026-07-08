import { apiClient } from '@/lib/api';
import { findRootPostId, fetchCommentWithParents } from '@/utils/threadUtils';
import type { Message } from '@/types/messages';
import type { PrivateMessage } from '@/types/conversations';
import type { Character } from '@/types/characters';
import { classifyNotification } from './parseUnreadNotification';
import type { UnreadInboxItem } from '@/types/unreadInbox';

/**
 * Fetches unread notifications and classifies them into reply-capable inbox
 * items (comment replies/mentions and private messages). Non-repliable
 * notification types are dropped.
 */
export async function fetchUnreadInboxItems(): Promise<UnreadInboxItem[]> {
  const response = await apiClient.notifications.getNotifications({ unread: true, limit: 100 });
  return response.data.data
    .map(classifyNotification)
    .filter((item): item is UnreadInboxItem => item !== null);
}

export interface CommentContext {
  comment: Message;
  parent: Message | null;
  rootPostId: number;
}

/**
 * Fetches the comment being replied to, its immediate parent (for character
 * defaulting), and the root post id (required by createComment).
 */
export async function fetchCommentContext(gameId: number, commentId: number): Promise<CommentContext> {
  const { messages } = await fetchCommentWithParents(gameId, commentId, 1);
  const comment = messages[messages.length - 1];
  const parent = messages.length > 1 ? messages[messages.length - 2] : null;
  const rootPostId = await findRootPostId(gameId, comment);

  return { comment, parent, rootPostId };
}

/**
 * Fetches the most recent messages in a conversation, for showing PM context
 * in the Unread inbox.
 */
export async function fetchPmContext(gameId: number, conversationId: number): Promise<PrivateMessage[]> {
  const response = await apiClient.conversations.getConversationMessages(gameId, conversationId);
  return response.data.messages;
}

export async function resolveReplyCharacters(gameId: number): Promise<Character[]> {
  const response = await apiClient.characters.getUserControllableCharacters(gameId);
  return response.data;
}

/**
 * All characters in the game (permission-filtered by the backend), used as
 * the @-mention list when replying to a comment — matches the Common Room's
 * mention scope, which is every character in the game, not just the ones the
 * replier controls.
 */
export async function fetchAllGameCharacters(gameId: number): Promise<Character[]> {
  const response = await apiClient.characters.getGameCharacters(gameId);
  return response.data;
}

/**
 * Returns the character IDs already participating in a conversation, used to
 * default the reply-as character picker to a character the user already
 * spoke as in this thread, and to scope the @-mention list to conversation
 * participants (matching MessageThread's mention scope for PMs).
 */
export async function fetchConversationParticipantCharacterIds(
  gameId: number,
  conversationId: number
): Promise<number[]> {
  const response = await apiClient.conversations.getConversation(gameId, conversationId);
  return response.data.participants
    .map((p) => p.character_id)
    .filter((id): id is number => id !== undefined);
}

export interface ReplyToCommentParams {
  gameId: number;
  notificationId: number;
  parentCommentId: number;
  rootPostId: number;
  characterId: number;
  content: string;
}

export async function replyToComment({
  gameId,
  notificationId,
  parentCommentId,
  rootPostId,
  characterId,
  content,
}: ReplyToCommentParams): Promise<void> {
  await apiClient.messages.createComment(gameId, parentCommentId, {
    character_id: characterId,
    content,
    root_post_id: rootPostId,
  });
  await apiClient.notifications.markNotificationAsRead(notificationId);
}

export interface ReplyToPmParams {
  gameId: number;
  notificationId: number;
  conversationId: number;
  characterId: number;
  content: string;
}

export async function replyToPm({
  gameId,
  notificationId,
  conversationId,
  characterId,
  content,
}: ReplyToPmParams): Promise<void> {
  await apiClient.conversations.sendMessage(gameId, conversationId, {
    character_id: characterId,
    content,
  });
  await apiClient.notifications.markNotificationAsRead(notificationId);
}
