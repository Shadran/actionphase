import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

/**
 * Hook to fetch draft character updates for an action result
 */
export function useDraftCharacterUpdates(gameId: number, resultId: number) {
  return useQuery({
    queryKey: ['draftCharacterUpdates', gameId, resultId],
    queryFn: async () => {
      const response = await apiClient.phases.getDraftCharacterUpdates(gameId, resultId);
      return response.data;
    },
    enabled: !!gameId && !!resultId,
  });
}

/**
 * Hook to fetch the count of draft updates for an action result
 */
export function useDraftUpdateCount(gameId: number, resultId: number) {
  return useQuery({
    queryKey: ['draftUpdateCount', gameId, resultId],
    queryFn: async () => {
      const response = await apiClient.phases.getDraftUpdateCount(gameId, resultId);
      return response.data.count;
    },
    enabled: !!gameId && !!resultId,
  });
}

