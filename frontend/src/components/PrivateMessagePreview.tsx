import { Link } from 'react-router-dom';
import { MessageSquare, Clock } from 'lucide-react';
import type { ConversationListItem } from '../types/conversations';
import { formatRelativeTime } from '../lib/utils/dates';

interface PrivateMessagePreviewProps {
  conversations: ConversationListItem[];
  gameId: number;
}

/**
 * PrivateMessagePreview - Shows unread private conversations on the dashboard.
 * Only rendered when there are conversations with unread messages.
 */
export function PrivateMessagePreview({ conversations, gameId }: PrivateMessagePreviewProps) {
  if (conversations.length === 0) {
    return null;
  }

  const messagesUrl = `/games/${gameId}?tab=messages`;

  return (
    <div className="surface-base rounded-lg shadow-md border border-interactive-primary/40 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-interactive-primary" />
          <h2 className="text-lg font-bold text-content-primary">Private Messages</h2>
        </div>
        <Link
          to={messagesUrl}
          className="text-sm text-interactive-primary hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="space-y-3">
        {conversations.map((conv) => (
          <Link
            key={conv.id}
            to={`/games/${gameId}?tab=messages&conversation=${conv.id}`}
            className="flex items-start gap-3 p-3 rounded-md hover:surface-raised transition-colors border-l-2 border-l-interactive-primary"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-content-primary truncate">
                  {conv.title || conv.participant_names || 'Conversation'}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {conv.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-interactive-primary text-white text-xs font-bold">
                      {conv.unread_count}
                    </span>
                  )}
                  {conv.last_message_at && (
                    <span className="text-xs text-content-tertiary flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(conv.last_message_at)}
                    </span>
                  )}
                </div>
              </div>
              {conv.last_message && (
                <p className="text-xs text-content-secondary line-clamp-1">{conv.last_message}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
