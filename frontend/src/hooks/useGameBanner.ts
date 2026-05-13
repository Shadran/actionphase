import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function useUploadGameBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gameId, file }: { gameId: number; file: File }) =>
      apiClient.games.uploadGameBanner(gameId, file),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gameDetails', variables.gameId] });
    },
  });
}

export function useDeleteGameBanner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameId: number) =>
      apiClient.games.deleteGameBanner(gameId),
    onSuccess: (_, gameId) => {
      queryClient.invalidateQueries({ queryKey: ['gameDetails', gameId] });
    },
  });
}
