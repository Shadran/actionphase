import { useState } from 'react';
import { MessageSquare, Reply, AtSign } from 'lucide-react';
import { Spinner, Alert } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { UnreadReplyBox } from './UnreadReplyBox';
import { useUnreadItemContext } from '../hooks/useUnreadItemContext';
import { useReplyToUnread } from '../hooks/useReplyToUnread';
import type { UnreadInboxItem } from '../types/unreadInbox';

interface UnreadInboxItemCardProps {
  item: UnreadInboxItem;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  private_message: <MessageSquare className="w-4 h-4" />,
  comment_reply: <Reply className="w-4 h-4" />,
  character_mention: <AtSign className="w-4 h-4" />,
};

export function UnreadInboxItemCard({ item }: UnreadInboxItemCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: context, isLoading, isError } = useUnreadItemContext(item, isExpanded);
  const replyMutation = useReplyToUnread();

  const handleSubmit = (characterId: number, content: string) => {
    replyMutation.mutate({
      item,
      characterId,
      content,
      rootPostId: context?.kind === 'comment' ? context.rootPostId : undefined,
    });
  };

  return (
    <div className="border border-theme-default rounded-md p-3">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 text-left"
        aria-expanded={isExpanded}
      >
        <span className="text-interactive-primary flex-shrink-0">
          {TYPE_ICON[item.notification.type] ?? <MessageSquare className="w-4 h-4" />}
        </span>
        <span className="flex-1 text-sm text-content-primary">{item.notification.title}</span>
      </button>

      {isExpanded && (
        <div className="mt-3 pl-7 space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-content-secondary text-sm">
              <Spinner size="sm" /> Loading...
            </div>
          )}

          {isError && <Alert variant="danger">Couldn't load this item. Try refreshing.</Alert>}

          {context && (
            <>
              <div className="text-sm border-l-2 border-theme-default pl-3">
                <span className="font-medium text-content-primary">{context.authorName}: </span>
                <MarkdownPreview content={context.contentPreview} />
              </div>

              <UnreadReplyBox
                controllableCharacters={context.controllableCharacters}
                defaultCharacterId={context.defaultCharacterId}
                onSubmit={handleSubmit}
                isSubmitting={replyMutation.isPending}
                error={replyMutation.isError ? 'Failed to send reply. Please try again.' : null}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
