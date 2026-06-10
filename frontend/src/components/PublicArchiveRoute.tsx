import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PublicArchiveRouteProps {
  children: ReactNode;
}

/**
 * PublicArchiveRoute - Route protection for game pages.
 *
 * All game pages require authentication. For completed games, any logged-in
 * user may view the archive (not just participants). Access control beyond
 * authentication is enforced by the backend and individual page components.
 */
export const PublicArchiveRoute = ({ children }: PublicArchiveRouteProps) => {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const location = useLocation();

  // Render children optimistically while auth resolves to avoid a spinner flash
  if (isCheckingAuth) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
