import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useUserActionResults(gameId: number) {
  return useQuery({
    queryKey: ['actionResults', 'user', gameId],
    queryFn: async () => {
      const response = await apiClient.phases.getUserResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
  });
}

export function useGameActionResults(gameId: number) {
  return useQuery({
    queryKey: ['actionResults', 'game', gameId],
    queryFn: async () => {
      const response = await apiClient.phases.getGameResults(gameId);
      return response.data;
    },
    enabled: !!gameId,
  });
}

export function useCreateActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { user_id: number; character_id?: number; action_submission_id?: number; content: string; is_published?: boolean }) => {
      const response = await apiClient.phases.createActionResult(gameId, data);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate action results queries to refetch
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
    },
  });
}

export function useUpdateActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resultId, content }: { resultId: number; content: string }) => {
      const response = await apiClient.phases.updateActionResult(gameId, resultId, { content });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate action results queries to refetch
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
    },
  });
}

export function useDeleteActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultId: number) => {
      await apiClient.phases.deleteActionResult(gameId, resultId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['unpublishedResultsCount'] });
    },
  });
}

export function usePublishActionResult(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resultId: number) => {
      const response = await apiClient.phases.publishActionResult(gameId, resultId);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['actionResults', 'user', gameId] });
      queryClient.invalidateQueries({ queryKey: ['draftCharacterUpdates'] });
      queryClient.invalidateQueries({ queryKey: ['draftUpdateCount'] });
      // Invalidate character data to show published character updates
      queryClient.invalidateQueries({ queryKey: ['characterData'] });
    },
  });
}
