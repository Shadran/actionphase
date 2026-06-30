import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { GetNotificationsParams } from '../types/notifications';

export function useNotifications(params?: GetNotificationsParams) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', params],
    queryFn: async () => {
      const response = await apiClient.notifications.getNotifications(params);
      return response.data;
    },
    // Only run query when user is authenticated
    enabled: isAuthenticated,
    // Poll every 30 seconds for new notifications, but only when authenticated
    refetchInterval: isAuthenticated ? 30000 : false,
    // Always refetch when component mounts to ensure fresh data when dropdown opens
    refetchOnMount: 'always',
  });
}

export function useUnreadCount() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', 'unreadCount'],
    queryFn: async () => {
      const response = await apiClient.notifications.getUnreadCount();
      return response.data.unread_count;
    },
    // Only run query when user is authenticated
    enabled: isAuthenticated,
    // Poll every 15 seconds for unread count, but only when authenticated
    refetchInterval: isAuthenticated ? 15000 : false,
    // Always refetch when component mounts to ensure fresh badge count
    refetchOnMount: 'always',
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiClient.notifications.markNotificationAsRead(notificationId);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Invalidate dashboard to update unread counts (fixes stale count issue)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkNotificationAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiClient.notifications.markNotificationAsUnread(notificationId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.notifications.markAllNotificationsAsRead();
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Invalidate dashboard to update unread counts (fixes stale count issue)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useAutoMarkNotificationRead() {
  const [searchParams, setSearchParams] = useSearchParams();
  const markAsRead = useMarkNotificationAsRead();

  useEffect(() => {
    const notifId = searchParams.get('notif');
    if (!notifId) return;

    const id = parseInt(notifId, 10);
    if (!isNaN(id)) {
      markAsRead.mutate(id);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('notif');
    setSearchParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      await apiClient.notifications.deleteNotification(notificationId);
    },
    onSuccess: () => {
      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      // Invalidate dashboard to update unread counts (fixes stale count issue)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
