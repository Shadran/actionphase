import { type ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

interface PublicArchiveRouteProps {
  children: ReactNode;
}

/**
 * PublicArchiveRoute - Conditional route protection for game pages
 *
 * Allows access to:
 * - Completed games: Public archive mode (any user, including unauthenticated)
 * - Non-completed games: Requires authentication
 *
 * This implements the public archive feature where completed games become
 * publicly viewable read-only archives.
 */
export const PublicArchiveRoute = ({ children }: PublicArchiveRouteProps) => {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const location = useLocation();
  const { gameId } = useParams<{ gameId: string }>();

  // Fetch game to check if it's completed (public archive)
  const { data: game, isLoading: isLoadingGame, error } = useQuery({
    queryKey: ['gameForAccessCheck', gameId],
    queryFn: async () => {
      if (!gameId) return null;
      const response = await apiClient.games.getGame(parseInt(gameId, 10));
      return response.data;
    },
    enabled: !!gameId,
    retry: false, // Don't retry on 403/404
    staleTime: 60000, // Cache for 1 minute
  });

  // While auth is still resolving, render children optimistically so the page skeleton
  // paints immediately. If the user turns out to be unauthenticated and the game is not
  // a public archive, we redirect below once both checks complete.
  if (isCheckingAuth || isLoadingGame) {
    return <>{children}</>;
  }

  // Both checks complete — enforce access control.

  // If game fetch failed, unauthenticated user gets redirected to login
  if (error && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Public Archive Mode: completed games are viewable by anyone
  if (game?.state === 'completed') {
    return <>{children}</>;
  }

  // Non-completed game, unauthenticated user → redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
