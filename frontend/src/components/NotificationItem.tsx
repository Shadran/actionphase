import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Badge, Button } from './ui';
import { ConfirmModal } from './ConfirmModal';
import type { Notification } from '../types/notifications';
import { useMarkNotificationAsRead, useDeleteNotification } from '../hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: () => void;
}

export default function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const markAsRead = useMarkNotificationAsRead();
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
