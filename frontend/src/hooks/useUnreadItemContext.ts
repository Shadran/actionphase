import { useQuery } from '@tanstack/react-query';
import {
  fetchCommentContext,
  fetchPmContext,
  fetchConversationParticipantCharacterIds,
  resolveReplyCharacters,
} from '@/utils/unreadInboxApi';
import type { UnreadInboxItem } from '@/types/unreadInbox';
import type { Character } from '@/types/characters';

export interface CommentItemContext {
  kind: 'comment';
  contentPreview: string;
  authorName: string;
  rootPostId: number;
  controllableCharacters: Character[];
  defaultCharacterId: number | null;
}

export interface PmItemContext {
  kind: 'private_message';
  contentPreview: string;
  authorName: string;
  controllableCharacters: Character[];
  defaultCharacterId: number | null;
}

export type UnreadItemContext = CommentItemContext | PmItemContext;

function pickDefaultCharacterId(
  controllable: Character[],
  preferredCharacterId: number | undefined | null
): number | null {
  if (controllable.length === 0) return null;
  if (preferredCharacterId) {
    const preferred = controllable.find((c) => c.id === preferredCharacterId);
    if (preferred) return preferred.id;
  }
  return controllable[0].id;
}

/**
 * Loads the reply context for a single Unread inbox item: the content to
 * display, the user's controllable characters in that game, and which one to
 * default the reply-as picker to.
 *
 * Comment default: the parent-of-the-replied-comment's character (if
 * controlled), matching ThreadedComment.tsx's nested-reply behavior so
 * conversations continue as the same NPC/character.
 * PM default: a character already participating in the conversation.
 */
export function useUnreadItemContext(item: UnreadInboxItem, enabled: boolean) {
  return useQuery<UnreadItemContext>({
    queryKey: ['unread-inbox', 'item-context', item.kind, item.gameId, item.kind === 'comment' ? item.commentId : item.conversationId],
    enabled,
    queryFn: async () => {
      const controllableCharacters = await resolveReplyCharacters(item.gameId);

      if (item.kind === 'comment') {
        const { comment, parent, rootPostId } = await fetchCommentContext(item.gameId, item.commentId);
        const preferredCharacterId = parent?.character_id ?? comment.character_id;
        return {
          kind: 'comment',
          contentPreview: comment.content,
          authorName: comment.character_name || comment.author_username,
          rootPostId,
          controllableCharacters,
          defaultCharacterId: pickDefaultCharacterId(controllableCharacters, preferredCharacterId),
        };
      }

      const [messages, participantCharacterIds] = await Promise.all([
        fetchPmContext(item.gameId, item.conversationId),
        fetchConversationParticipantCharacterIds(item.gameId, item.conversationId),
      ]);
      const lastMessage = messages[messages.length - 1];
      const preferredCharacterId = participantCharacterIds.find((id) =>
        controllableCharacters.some((c) => c.id === id)
      );

      return {
        kind: 'private_message',
        contentPreview: lastMessage?.content ?? '',
        authorName: lastMessage?.sender_character_name || lastMessage?.sender_username || '',
        controllableCharacters,
        defaultCharacterId: pickDefaultCharacterId(controllableCharacters, preferredCharacterId),
      };
    },
  });
}
