import { useState } from 'react';
import { useNotifications, useMarkAllAsRead } from '../hooks/useNotifications';
import NotificationItem from '../components/NotificationItem';
import { useNavigate } from 'react-router-dom';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [limit] = useState(50); // Show 50 notifications per page (can add pagination later)
  const { data: notificationsData, isLoading, error } = useNotifications({ limit });
  const markAllAsRead = useMarkAllAsRead();

  const notifications = notificationsData?.data || [];
  const hasUnread = notifications.some(n => !n.is_read);


  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <div className="min-h-screen bg-surface-sunken py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-content-primary">Notifications</h1>
            {hasUnread && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-4 py-2 text-sm font-medium text-interactive-primary bg-semantic-info-subtle hover:bg-semantic-info-subtle rounded-lg transition-colors"
                disabled={markAllAsRead.isPending}
              >
                {markAllAsRead.isPending ? 'Marking...' : 'Mark all as read'}
              </button>
            )}
          </div>
          <p className="text-content-secondary">
            Stay updated with all your game activities and messages
          </p>
        </div>

        {/* Notifications List */}
        <div className="bg-surface-base rounded-lg shadow border border-theme-default">
          {isLoading ? (
            <div className="p-12 text-center text-content-secondary">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary mx-auto mb-4"></div>
              <p>Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-semantic-danger">
              <p className="font-medium mb-2">Failed to load notifications</p>
              <p className="text-sm text-content-secondary">Please try again later</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-content-secondary">
              <svg
                className="w-20 h-20 mx-auto mb-4 text-content-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p className="text-lg font-medium mb-1">No notifications</p>
              <p className="text-sm text-content-tertiary">You're all caught up!</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={index === notifications.length - 1 ? '' : 'border-b border-theme-default'}
                >
                  <NotificationItem
                    notification={notification}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back to Dashboard Link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-sm text-content-secondary hover:text-content-primary transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
