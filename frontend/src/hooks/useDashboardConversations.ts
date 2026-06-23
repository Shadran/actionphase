import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { ConversationListItem } from '../types/conversations';

/**
 * Fetches the conversation list for a game, used by the dashboard PM preview.
 * Only loads conversations with unread messages to avoid unnecessary data.
 */
export function useDashboardConversations(gameId: number | undefined) {
  return useQuery<ConversationListItem[]>({
    queryKey: ['dashboard-conversations', gameId],
    queryFn: async () => {
      if (!gameId) return [];
      const response = await apiClient.conversations.getUserConversations(gameId, { unreadOnly: true, limit: 3 });
      return response.data.conversations ?? [];
    },
    enabled: !!gameId,
    refetchInterval: 15000,
    placeholderData: (previousData) => previousData,
  });
}
