import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useParams, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicArchiveRoute } from './components/PublicArchiveRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminModeProvider } from './contexts/AdminModeContext';
import { GameProvider } from './contexts/GameContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { logger } from '@/services/LoggingService';

// Lazy load all page components for better code splitting
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const GamesPage = lazy(() => import('./pages/GamesPage').then(m => ({ default: m.GamesPage })));
const GameDetailsPage = lazy(() => import('./pages/GameDetailsPage').then(m => ({ default: m.GameDetailsPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const CharacterPage = lazy(() => import('./pages/CharacterPage').then(m => ({ default: m.CharacterPage })));
const ThemeTestPage = lazy(() => import('./pages/ThemeTestPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false, // Prevent automatic refetch on tab switch to preserve user input and scroll position
    },
  },
});

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen surface-page flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-interactive-primary"></div>
    </div>
  );
}

// Root layout: wraps every route with the shared Layout + Suspense
function RootLayout() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function AuthGatedLogin() {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  if (isCheckingAuth) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />;
}

function AuthGatedForgotPassword() {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  if (isCheckingAuth) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />;
}

function AuthGatedResetPassword() {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  if (isCheckingAuth) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />;
}

function CatchAll() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

function GameDetailsPageWrapper() {
  const { gameId } = useParams<{ gameId: string }>();

  if (!gameId) {
    return <Navigate to="/games" replace />;
  }

  const gameIdNum = parseInt(gameId, 10);

  return (
    <GameProvider gameId={gameIdNum}>
      <GameDetailsPage gameId={gameIdNum} />
    </GameProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <AuthGatedLogin /> },
      { path: '/forgot-password', element: <AuthGatedForgotPassword /> },
      { path: '/reset-password', element: <AuthGatedResetPassword /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      {
        path: '/dashboard',
        element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
      },
      {
        path: '/notifications',
        element: <ProtectedRoute><NotificationsPage /></ProtectedRoute>,
      },
      {
        path: '/settings',
        element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
      },
      {
        path: '/admin',
        element: <ProtectedRoute><AdminPage /></ProtectedRoute>,
      },
      {
        path: '/admin/:tab',
        element: <ProtectedRoute><AdminPage /></ProtectedRoute>,
      },
      {
        path: '/theme-test',
        element: <ProtectedRoute><ThemeTestPage /></ProtectedRoute>,
      },
      {
        path: '/games',
        element: <ProtectedRoute><GamesPage /></ProtectedRoute>,
      },
      {
        path: '/games/recruiting',
        element: <Navigate to="/games?states=recruitment" replace />,
      },
      {
        path: '/games/:gameId',
        element: <PublicArchiveRoute><GameDetailsPageWrapper /></PublicArchiveRoute>,
      },
      {
        path: '/users/:username',
        element: <ProtectedRoute><UserProfilePage /></ProtectedRoute>,
      },
      {
        path: '/characters/:characterId',
        element: <ProtectedRoute><CharacterPage /></ProtectedRoute>,
      },
      { path: '/', element: <HomePage /> },
      { path: '*', element: <CatchAll /> },
    ],
  },
]);

function App() {
  useEffect(() => {
    // Log application initialization
    logger.info('ActionPhase application initialized', {
      environment: import.meta.env.MODE,
      baseUrl: import.meta.env.VITE_API_BASE_URL || 'proxy',
      version: import.meta.env.VITE_APP_VERSION || 'development',
    });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <AdminModeProvider>
              <ThemeProvider>
                <RouterProvider router={router} />
              </ThemeProvider>
            </AdminModeProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
