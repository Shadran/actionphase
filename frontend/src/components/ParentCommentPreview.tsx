import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import CharacterAvatar from './CharacterAvatar';
import { useOptionalGameContext } from '../contexts/GameContext';
import type { Character } from '../types/characters';

interface ParentCommentPreviewProps {
  content?: string | null;
  createdAt?: string | null;
  isDeleted?: boolean | null;
  messageType?: string | null;
  authorUsername?: string | null;
  characterId?: number | null;
  characterName?: string | null;
  characterAvatarUrl?: string | null;
  onNavigateToParent?: () => void;
  mentionedCharacters?: Character[];
  defaultExpanded?: boolean;
  hideViewInThread?: boolean;
  portraitAvatars?: boolean;
}

/**
 * Shows a preview of the parent message (post or comment) that was replied to.
 * Can be expanded to show the full content, or collapsed to show just a preview.
 */
export function ParentCommentPreview({
  content,
  createdAt,
  isDeleted,
  messageType,
  authorUsername,
  characterId,
  characterName,
  characterAvatarUrl,
  onNavigateToParent,
  mentionedCharacters = [],
  defaultExpanded = false,
  hideViewInThread = false,
  portraitAvatars: portraitAvatarsProp,
}: ParentCommentPreviewProps) {
  const gameContext = useOptionalGameContext();
  const portraitAvatars = portraitAvatarsProp ?? gameContext?.game?.portrait_avatars ?? false;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // If there's no parent content, don't render anything
  if (!content && !isDeleted) {
    return null;
  }

  const timeAgo = createdAt
    ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
    : null;

  return (
    <div className="border-l-2 border-border-secondary pl-3 mb-3 opacity-70">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 text-sm min-w-0">
          {messageType && (
            <Badge variant="secondary" size="sm">
              {messageType === 'post' ? 'Post' : 'Comment'}
            </Badge>
          )}
          {characterName && (
            <CharacterAvatar
              avatarUrl={characterAvatarUrl}
              characterName={characterName}
              size="xs"
              shape={portraitAvatars ? 'portrait' : 'circle'}
            />
          )}
          {characterName ? (
            characterId ? (
              <Link to={`/characters/${characterId}`} className="font-medium text-text-heading truncate hover:underline">{characterName}</Link>
            ) : (
              <span className="font-medium text-text-heading truncate">{characterName}</span>
            )
          ) : authorUsername ? (
            <span className="text-content-secondary truncate">@{authorUsername}</span>
          ) : null}
          {timeAgo && (
            <span className="text-content-tertiary shrink-0">{timeAgo}</span>
          )}
        </div>

        {!isDeleted && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-interactive-primary hover:text-interactive-secondary flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {isDeleted ? (
        <div className="text-sm text-content-tertiary italic">[deleted]</div>
      ) : isExpanded ? (
        <div className="text-sm">
          <MarkdownPreview
            content={content || ''}
            mentionedCharacters={mentionedCharacters?.map(char => ({
              id: char.id,
              name: char.name,
              username: char.username,
              character_type: char.character_type,
              avatar_url: char.avatar_url ?? undefined
            }))}
          />
        </div>
      ) : (
        <div className="text-sm text-content-secondary line-clamp-2">
          <MarkdownPreview
            content={content || ''}
            mentionedCharacters={mentionedCharacters?.map(char => ({
              id: char.id,
              name: char.name,
              username: char.username,
              character_type: char.character_type,
              avatar_url: char.avatar_url ?? undefined
            }))}
          />
        </div>
      )}

      {onNavigateToParent && !isDeleted && !hideViewInThread && (
        <button
          onClick={onNavigateToParent}
          className="text-xs text-interactive-primary hover:text-accent-secondary mt-2 flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View in thread
        </button>
      )}
    </div>
  );
}
