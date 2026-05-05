import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { CommentWithParent } from '../types/messages';
import { ParentCommentPreview } from './ParentCommentPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { Card, CardBody, Badge, Button } from './ui';
import CharacterAvatar from './CharacterAvatar';
import { useGameContext } from '../contexts/GameContext';
import type { CommentReadMode } from '../lib/api/auth';

interface CommentWithParentCardProps {
  comment: CommentWithParent;
  gameId: number;
  onNavigateToParent?: () => void;
  onNavigateToComment?: () => void;
  commentReadMode?: CommentReadMode;
  isRead?: boolean;
  onToggleRead?: (currentlyRead: boolean) => void;
}

/**
 * Displays a comment with its parent context in a card.
 * Used in the "New Comments" view to show recent activity.
 */
export function CommentWithParentCard({
  comment,
  gameId,
  onNavigateToParent,
  onNavigateToComment,
  commentReadMode,
  isRead = false,
  onToggleRead,
}: CommentWithParentCardProps) {
  const { allGameCharacters, game } = useGameContext();
  const portraitAvatars = game?.portrait_avatars ?? false;

  const parentCharacterId = comment.parent_character_name
    ? allGameCharacters.find(c => c.name === comment.parent_character_name)?.id ?? null
    : null;

  // Backend returns UTC timestamps without 'Z' suffix
  // Append 'Z' to ensure proper UTC parsing
  const utcDateString = comment.created_at.endsWith('Z') ? comment.created_at : `${comment.created_at}Z`;
  const timeAgo = formatDistanceToNow(new Date(utcDateString), {
    addSuffix: true,
  });

  const isEdited = comment.edit_count > 0;
  const showReadButton = commentReadMode === 'manual' && !comment.is_deleted && onToggleRead;

  return (
    <Card className={`hover:shadow-md transition-shadow${isRead ? ' opacity-50' : ''}`}>
      <CardBody>
        {/* Parent context preview */}
        <ParentCommentPreview
          content={comment.parent_content}
          createdAt={comment.parent_created_at}
          isDeleted={comment.parent_is_deleted}
          messageType={comment.parent_message_type}
          authorUsername={comment.parent_author_username}
          characterId={parentCharacterId}
          characterName={comment.parent_character_name}
          characterAvatarUrl={comment.parent_character_avatar_url}
          onNavigateToParent={onNavigateToParent}
          hideViewInThread
        />

        {/* Comment header + body */}
        <div className="bg-bg-secondary rounded-lg p-3">
          <div className="flex items-start gap-3 mb-2">
            <CharacterAvatar
              avatarUrl={comment.character_avatar_url}
              characterName={comment.character_name || comment.author_username}
              size="sm"
              shape={portraitAvatars ? 'portrait' : 'circle'}
            />
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Link to={`/characters/${comment.character_id}`} className="font-medium text-text-heading hover:underline">
                  {comment.character_name || 'Unknown'}
                </Link>
                <span className="text-sm text-content-tertiary">
                  @{comment.author_username}
                </span>
                <span className="text-sm text-content-tertiary">{timeAgo}</span>
                {isEdited && (
                  <Badge variant="secondary" size="sm">
                    Edited
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {comment.is_deleted ? (
            <p className="text-content-tertiary italic">[deleted]</p>
          ) : (
            <MarkdownPreview content={comment.content} fullWidth />
          )}
        </div>

        {/* Footer actions */}
        {(onNavigateToComment && !comment.is_deleted) || showReadButton ? (
          <div className="mt-3 pt-3 border-t border-border-primary flex items-center justify-between">
            {onNavigateToComment && !comment.is_deleted ? (
              <a
                href={`/games/${gameId}?tab=common-room&comment=${comment.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateToComment();
                }}
                className="text-sm text-interactive-primary hover:text-accent-secondary font-medium"
              >
                View in thread →
              </a>
            ) : <span />}
            {showReadButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleRead(isRead)}
                aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
                data-testid="toggle-read-button"
              >
                {isRead ? 'Unread' : 'Read'}
              </Button>
            )}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
