import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

const draftPostKey = (phaseId: number) => ['draftPost', phaseId];

/**
 * Fetch the draft post for a pending phase.
 * Returns null (404 → undefined) if no draft exists.
 */
export function useDraftPost(phaseId: number | undefined) {
  return useQuery({
    queryKey: draftPostKey(phaseId!),
    queryFn: async () => {
      try {
        const response = await apiClient.messages.getDraftPost(phaseId!);
        return response.data;
      } catch (err: unknown) {
        // 404 means no draft exists — treat as null
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: !!phaseId,
  });
}

/**
 * Create a draft post for a pending phase.
 */
export function useCreateDraftPost(phaseId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterId, content }: { characterId: number; content: string }) => {
      const response = await apiClient.messages.createDraftPost(phaseId, characterId, content);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftPostKey(phaseId) });
    },
  });
}

/**
 * Update the content of an existing draft post.
 */
export function useUpdateDraftPost(phaseId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const response = await apiClient.messages.updateDraftPost(phaseId, content);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: draftPostKey(phaseId) });
    },
  });
}

/**
 * Delete a draft post for a phase.
 */
export function useDeleteDraftPost(phaseId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.messages.deleteDraftPost(phaseId);
    },
    onSuccess: () => {
      queryClient.setQueryData(draftPostKey(phaseId), null);
    },
  });
}
