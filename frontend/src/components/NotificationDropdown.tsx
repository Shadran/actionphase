import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications, useMarkAllAsRead } from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import { Button } from './ui';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  bellButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function NotificationDropdown({ isOpen, onClose, bellButtonRef }: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notificationsData, isLoading, error } = useNotifications({ limit: 20 });
  const markAllAsRead = useMarkAllAsRead();

  // Close dropdown when clicking outside (but not on the bell button)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      const clickedBell = bellButtonRef?.current && bellButtonRef.current.contains(target);

      if (!clickedDropdown && !clickedBell) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, bellButtonRef]);

  const handleNavigate = () => {
    onClose();
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  const notifications = notificationsData?.data || [];
  const hasUnread = notifications.some(n => !n.is_read);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="fixed md:absolute right-2 md:right-0 top-[60px] md:top-full mt-0 md:mt-2 w-[calc(100vw-1rem)] md:w-96 surface-base border border-theme-default rounded-lg shadow-xl z-50"
      data-testid="notification-dropdown"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-theme-default">
        <h3 className="text-lg font-semibold text-content-primary">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsRead.isPending}
            className="text-interactive-primary hover:opacity-80"
          >
            {markAllAsRead.isPending ? 'Marking...' : 'Mark all read'}
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-content-secondary">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-interactive-primary mx-auto"></div>
            <p className="mt-2">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-semantic-danger">
            <p className="font-medium">Failed to load notifications</p>
            <p className="text-sm text-content-secondary mt-1">Please try again later</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-content-secondary">
            <svg className="w-16 h-16 mx-auto mb-4 text-content-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="font-medium">No notifications</p>
            <p className="text-sm text-content-secondary mt-1">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>

      {/* Footer - Always show "View all" link */}
      <div className="p-3 border-t border-theme-default text-center">
        <Link
          to="/notifications"
          onClick={onClose}
          className="text-sm text-interactive-primary hover:opacity-80"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
