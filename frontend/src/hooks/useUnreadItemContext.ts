import { useQuery } from '@tanstack/react-query';
import {
  fetchCommentContext,
  fetchPmContext,
  fetchConversationParticipantCharacterIds,
  fetchAllGameCharacters,
  resolveReplyCharacters,
} from '@/utils/unreadInboxApi';
import type { UnreadInboxItem } from '@/types/unreadInbox';
import type { Character } from '@/types/characters';

/** Maps directly onto ParentCommentPreview's props for the quoted-content block. */
export interface PreviewMessage {
  content: string;
  createdAt: string | null;
  authorUsername: string | null;
  characterId: number | null;
  characterName: string | null;
  characterAvatarUrl: string | null;
}

export interface CommentItemContext {
  kind: 'comment';
  previewMessage: PreviewMessage;
  rootPostId: number;
  controllableCharacters: Character[];
  /** Every character in the game, for the @-mention list (matches Common Room scope). */
  mentionableCharacters: Character[];
  defaultCharacterId: number | null;
}

export interface PmItemContext {
  kind: 'private_message';
  previewMessage: PreviewMessage;
  controllableCharacters: Character[];
  /** Characters participating in this conversation, for the @-mention list (matches MessageThread scope). */
  mentionableCharacters: Character[];
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
 * display, the user's controllable characters (for the reply-as picker), the
 * full mentionable character list (for @-mention autocomplete), and which
 * character to default the reply-as picker to.
 *
 * Comment default: the parent-of-the-replied-comment's character (if
 * controlled), matching ThreadedComment.tsx's nested-reply behavior so
 * conversations continue as the same NPC/character. Mention scope is every
 * character in the game, matching the Common Room.
 * PM default: a character already participating in the conversation. Mention
 * scope is limited to conversation participants, matching MessageThread.
 */
export function useUnreadItemContext(item: UnreadInboxItem, enabled: boolean) {
  return useQuery<UnreadItemContext>({
    queryKey: ['unread-inbox', 'item-context', item.kind, item.gameId, item.kind === 'comment' ? item.commentId : item.conversationId],
    enabled,
    queryFn: async () => {
      const controllableCharacters = await resolveReplyCharacters(item.gameId);

      if (item.kind === 'comment') {
        const [{ comment, parent, rootPostId }, mentionableCharacters] = await Promise.all([
          fetchCommentContext(item.gameId, item.commentId),
          fetchAllGameCharacters(item.gameId),
        ]);
        const preferredCharacterId = parent?.character_id ?? comment.character_id;
        return {
          kind: 'comment',
          previewMessage: {
            content: comment.content,
            createdAt: comment.created_at,
            authorUsername: comment.author_username,
            characterId: comment.character_id,
            characterName: comment.character_name,
            characterAvatarUrl: comment.character_avatar_url ?? null,
          },
          rootPostId,
          controllableCharacters,
          mentionableCharacters,
          defaultCharacterId: pickDefaultCharacterId(controllableCharacters, preferredCharacterId),
        };
      }

      const [messages, mentionableCharacters, participantCharacterIds] = await Promise.all([
        fetchPmContext(item.gameId, item.conversationId),
        fetchAllGameCharacters(item.gameId),
        fetchConversationParticipantCharacterIds(item.gameId, item.conversationId),
      ]);
      const lastMessage = messages[messages.length - 1];
      const preferredCharacterId = participantCharacterIds.find((id) =>
        controllableCharacters.some((c) => c.id === id)
      );
      const participantSet = new Set(participantCharacterIds);

      return {
        kind: 'private_message',
        previewMessage: {
          content: lastMessage?.content ?? '',
          createdAt: lastMessage?.created_at ?? null,
          authorUsername: lastMessage?.sender_username ?? null,
          characterId: lastMessage?.sender_character_id ?? null,
          characterName: lastMessage?.sender_character_name ?? null,
          characterAvatarUrl: lastMessage?.sender_avatar_url ?? null,
        },
        controllableCharacters,
        mentionableCharacters: mentionableCharacters.filter((c) => participantSet.has(c.id)),
        defaultCharacterId: pickDefaultCharacterId(controllableCharacters, preferredCharacterId),
      };
    },
  });
}
