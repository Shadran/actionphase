import { BaseApiClient } from './client';
import type {
  Notification,
  NotificationListResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
  GetNotificationsParams
} from '../../types/notifications';

/**
 * Notifications API client
 * Handles user notifications and unread counts
 */
export class NotificationsApi extends BaseApiClient {
  async getNotifications(params?: GetNotificationsParams) {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.offset) queryParams.set('offset', params.offset.toString());
    if (params?.unread) queryParams.set('unread', 'true');

    const queryString = queryParams.toString();
    const url = `/api/v1/notifications${queryString ? `?${queryString}` : ''}`;
    return this.client.get<NotificationListResponse>(url);
  }

  async getUnreadCount() {
    return this.client.get<UnreadCountResponse>('/api/v1/notifications/unread-count');
  }

  async getNotification(id: number) {
    return this.client.get<Notification>(`/api/v1/notifications/${id}`);
  }

  async markNotificationAsRead(id: number) {
    return this.client.put<Notification>(`/api/v1/notifications/${id}/mark-read`);
  }

  async markNotificationAsUnread(id: number) {
    return this.client.put<Notification>(`/api/v1/notifications/${id}/mark-unread`);
  }

  async markAllNotificationsAsRead() {
    return this.client.put<MarkAllReadResponse>('/api/v1/notifications/mark-all-read');
  }

  async deleteNotification(id: number) {
    return this.client.delete(`/api/v1/notifications/${id}`);
  }
}
