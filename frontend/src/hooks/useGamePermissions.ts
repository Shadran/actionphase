import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { UserGameRole } from '../contexts/GameContext';
import type { GameWithDetails, GameParticipant } from '../types/games';

export interface GamePermissions {
  // Game data
  game: GameWithDetails | null;
  participants: GameParticipant[];

  // Loading states
  isLoading: boolean;

  // User's role and permissions
  userRole: UserGameRole;
  isGM: boolean;
  isCoGM: boolean;
  isPlayer: boolean;
  isAudience: boolean;
  isParticipant: boolean;
  canEditGame: boolean;
  canManagePhases: boolean;
  canViewAllActions: boolean;

  // User identification
  currentUserId: number | null;
}

/**
 * Hook to get game permissions for the current user.
 * This hook provides comprehensive permission checks and role information
 * for a specific game without requiring a GameContext.
 *
 * @param gameId - The ID of the game to check permissions for
 * @returns GamePermissions object with role and permission information
 */
export function useGamePermissions(gameId: number): GamePermissions {
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id || null;

  // Fetch game details
  const {
    data: game,
    isLoading: isLoadingGame,
  } = useQuery({
    queryKey: ['gameDetails', gameId],
    queryFn: async () => {
      const response = await apiClient.games.getGameWithDetails(gameId);
      return response.data;
    },
    enabled: !!gameId,
    staleTime: 30000,
  });

  // Fetch participants
  const {
    data: participants,
    isLoading: isLoadingParticipants,
  } = useQuery({
    queryKey: ['gameParticipants', gameId],
    queryFn: async () => {
      const response = await apiClient.games.getGameParticipants(gameId);
      return response.data || [];
    },
    enabled: !!gameId,
    staleTime: 30000,
  });

  // Determine user's role
  let userRole: UserGameRole = 'none';
  if (currentUserId && game) {
    if (game.gm_user_id === currentUserId) {
      userRole = 'gm';
    } else {
      const participant = participants?.find(p => p.user_id === currentUserId);
      if (participant) {
        userRole = participant.role as UserGameRole;
      }
    }
  }

  // Calculate permission flags
  const isGM = userRole === 'gm';
  const isCoGM = userRole === 'co_gm';
  const isPlayer = userRole === 'player';
  const isAudience = userRole === 'audience';
  const isParticipant = isPlayer || isCoGM;
  const canEditGame = isGM;
  const canManagePhases = isGM || isCoGM;
  const canViewAllActions = isGM || isCoGM;

  return {
    game: game || null,
    participants: participants || [],
    isLoading: isLoadingGame || isLoadingParticipants,
    userRole,
    isGM,
    isCoGM,
    isPlayer,
    isAudience,
    isParticipant,
    canEditGame,
    canManagePhases,
    canViewAllActions,
    currentUserId,
  };
}
