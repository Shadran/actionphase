import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useConversation } from '../contexts/ConversationContext';
import { logger } from '@/services/LoggingService';

interface ConversationListProps {
  gameId: number;
  onSelectConversation: (conversationId: number) => void;
  selectedConversationId?: number;
}

export function ConversationList({ gameId, onSelectConversation, selectedConversationId }: ConversationListProps) {
  const { conversations, loadingConversations, loadConversations } = useConversation();
  const [searchParams] = useSearchParams();

  const getConversationHref = (conversationId: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('conversation', String(conversationId));
    return `?${params.toString()}`;
  };

  useEffect(() => {
    loadConversations(gameId);
  }, [gameId, loadConversations]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loadingConversations) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-content-secondary">Loading conversations...</div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto text-content-tertiary mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-content-secondary text-lg mb-2">No conversations yet</p>
          <p className="text-content-tertiary text-sm">Start a conversation with other characters in the game</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {conversations.map((conversation) => (
        <Link
          key={conversation.id}
          to={getConversationHref(conversation.id)}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) return;
            logger.debug('Conversation clicked', { conversationId: conversation.id, gameId, title: conversation.title });
            onSelectConversation(conversation.id);
          }}
          className={`block w-full text-left hover:bg-surface-raised transition-colors rounded-none border-l-4 px-4 py-3 border-b border-theme-subtle ${
            selectedConversationId === conversation.id
              ? 'bg-interactive-primary-subtle border-l-interactive-primary'
              : 'border-l-transparent hover:border-l-border-primary'
          }`}
          data-testid="conversation-item"
          data-faro-user-action-name="open-conversation"
        >
          {/* Mobile: Vertical Stack Layout */}
          <div className="md:hidden w-full">
            {/* Title + Timestamp row */}
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 className="font-semibold text-base text-content-primary truncate flex-1 min-w-0">
                {conversation.title || 'Untitled Conversation'}
              </h3>
              {conversation.last_message_at && (
                <span className="text-xs text-content-tertiary flex-shrink-0 whitespace-nowrap">
                  {formatDate(conversation.last_message_at)}
                </span>
              )}
            </div>

            {/* Participants + Unread Badge */}
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm text-content-secondary truncate flex-1 min-w-0">
                {conversation.participant_names || `${conversation.participant_count} ${conversation.participant_count === 1 ? 'participant' : 'participants'}`}
              </p>
              {conversation.unread_count > 0 && (
                <span className="bg-semantic-danger text-white text-xs font-bold rounded-full px-2 py-0.5 flex-shrink-0 min-w-[1.5rem] text-center">
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </span>
              )}
            </div>

            {/* Last Message preview if available */}
            {conversation.last_message && (
              <p className="text-sm text-content-tertiary truncate">
                {conversation.last_message}
              </p>
            )}
          </div>

          {/* Desktop: Horizontal Layout */}
          <div className="hidden md:block w-full">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h3 className="font-semibold text-base text-content-primary truncate flex-1 min-w-0">
                {conversation.title || 'Untitled Conversation'}
              </h3>
              {conversation.last_message_at && (
                <span className="text-xs text-content-tertiary flex-shrink-0 whitespace-nowrap">
                  {formatDate(conversation.last_message_at)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm text-content-secondary truncate flex-1 min-w-0">
                {conversation.participant_names || `${conversation.participant_count} ${conversation.participant_count === 1 ? 'participant' : 'participants'}`}
              </p>
              {conversation.unread_count > 0 && (
                <span className="bg-semantic-danger text-white text-xs font-bold rounded-full px-2 py-0.5 flex-shrink-0 min-w-[1.5rem] text-center">
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </span>
              )}
            </div>

            {conversation.last_message && (
              <p className="text-sm text-content-tertiary truncate">
                {conversation.last_message}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
