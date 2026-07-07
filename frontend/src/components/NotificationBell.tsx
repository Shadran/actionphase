import { useState, useRef } from 'react';
import { useUnreadCount } from '../hooks/useNotifications';
import { Badge, Button } from './ui';
import NotificationDropdown from './NotificationDropdown';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount } = useUnreadCount();
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const displayCount = unreadCount && unreadCount > 99 ? '99+' : unreadCount;
  const hasUnread = unreadCount && unreadCount > 0;

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        ref={bellButtonRef}
        variant="ghost"
        onClick={toggleDropdown}
        className="relative p-2 text-white/90 hover:text-white h-auto"
        aria-label="Notifications"
        data-testid="notification-bell"
        data-faro-user-action-name="open-notifications"
      >
        {/* Bell Icon */}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {hasUnread && (
          <Badge
            variant="danger"
            size="sm"
            className="absolute -top-1 -right-1"
            data-testid="notification-badge"
          >
            {displayCount}
          </Badge>
        )}
      </Button>

      {/* Dropdown - only render when open to ensure fresh data on mount */}
      {isOpen && (
        <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} bellButtonRef={bellButtonRef} />
      )}
    </div>
  );
}
