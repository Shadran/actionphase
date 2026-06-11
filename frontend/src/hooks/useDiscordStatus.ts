import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { DiscordStatus } from '../lib/api/auth';

/**
 * Hook to fetch the current user's Discord account link status.
 * Returns whether a Discord account is linked and, if so, the Discord username.
 */
export function useDiscordStatus() {
  return useQuery<DiscordStatus>({
    queryKey: ['discordStatus'],
    queryFn: async () => {
      const response = await apiClient.auth.getDiscordStatus();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
