import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUnreadInboxItems } from '@/utils/unreadInboxApi';

/**
 * Fetches the list of unread notifications that can be replied to inline
 * from the Dashboard's Unread inbox (comment replies/mentions and PMs).
 */
export function useUnreadInbox() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['unread-inbox'],
    queryFn: fetchUnreadInboxItems,
    enabled: isAuthenticated,
    refetchInterval: isAuthenticated ? 30000 : false,
    placeholderData: (previousData) => previousData,
  });
}
