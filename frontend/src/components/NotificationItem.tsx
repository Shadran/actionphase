import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Badge, Button } from './ui';
import { ConfirmModal } from './ConfirmModal';
import type { Notification } from '../types/notifications';
import { useMarkNotificationAsRead, useMarkNotificationAsUnread, useDeleteNotification } from '../hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: () => void;
}

export default function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const markAsRead = useMarkNotificationAsRead();
  const markAsUnread = useMarkNotificationAsUnread();
  const deleteNotification = useDeleteNotification();

  const handleClick = () => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }
    onNavigate?.();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    deleteNotification.mutate(notification.id);
  };

  const handleToggleRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (notification.is_read) {
      markAsUnread.mutate(notification.id);
    } else {
      markAsRead.mutate(notification.id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'private_message':
        return '✉️';
      case 'comment_reply':
        return '💬';
      case 'character_mention':
        return '👤';
      case 'action_submitted':
        return '⚡';
      case 'action_result':
        return '📜';
      case 'common_room_post':
        return '📣';
      case 'phase_created':
        return '🎯';
      case 'poll_created':
        return '📊';
      case 'application_approved':
        return '✅';
      case 'character_approved':
        return '✅';
      case 'game_state_changed':
        return '🎮';
      default:
        return '🔔';
    }
  };

  const itemClassName = `
    notification-item
    flex items-start gap-3 p-4 border-b border-theme-default
    ${notification.is_read ? 'surface-base' : 'surface-raised'}
    ${notification.link_url ? 'cursor-pointer hover:surface-sunken' : ''}
    transition-colors
  `;

  const itemContent = (
    <>
      {/* Icon */}
      <div className="text-2xl flex-shrink-0">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className={`text-sm text-content-primary ${!notification.is_read ? 'font-semibold' : 'font-normal'}`}>
              {notification.title}
            </h4>
            {notification.content && (
              <p className="text-sm text-content-primary mt-1">{notification.content}</p>
            )}
          </div>

          {/* Unread indicator */}
          {!notification.is_read && (
            <Badge variant="primary" size="sm" dot className="flex-shrink-0">
              New
            </Badge>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-content-secondary mt-2">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Toggle read/unread button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleRead}
        className="text-content-secondary hover:text-content-primary flex-shrink-0 p-1 h-auto"
        title={notification.is_read ? 'Mark as unread' : 'Mark as read'}
        aria-label={notification.is_read ? 'Mark as unread' : 'Mark as read'}
        data-testid="toggle-read-button"
      >
        {notification.is_read ? (
          /* Slash eye — click to mark unread */
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          /* Open eye — click to mark read */
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </Button>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteClick}
        className="text-content-secondary hover:text-semantic-danger flex-shrink-0 p-1 h-auto"
        title="Delete notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Button>
    </>
  );

  return (
    <>
      {notification.link_url ? (
        <Link
          to={notification.link_url}
          onClick={handleClick}
          className={itemClassName}
        >
          {itemContent}
        </Link>
      ) : (
        <div className={itemClassName}>
          {itemContent}
        </div>
      )}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
