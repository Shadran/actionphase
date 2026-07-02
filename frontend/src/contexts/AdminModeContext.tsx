import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { logger } from '@/services/LoggingService';

interface UseAdminModeReturn {
  isAdmin: boolean;
  adminModeEnabled: boolean;
  toggleAdminMode: () => void;
}

type AdminModeContextValue = UseAdminModeReturn;

const AdminModeContext = createContext<AdminModeContextValue | undefined>(undefined);

const ADMIN_MODE_STORAGE_KEY = 'admin_mode_enabled';

interface AdminModeProviderProps {
  children: ReactNode;
}

export function AdminModeProvider({ children }: AdminModeProviderProps) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.is_admin ?? false;

  // Initialize state from localStorage, but only if user is admin
  const [adminModeEnabled, setAdminModeEnabled] = useState<boolean>(() => {
    if (!isAdmin) return false;
    const stored = localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
    return stored === 'true';
  });

  // Restore admin mode from localStorage when user becomes admin (after login)
  useEffect(() => {
    if (isAdmin) {
      const stored = localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
      if (stored === 'true' && !adminModeEnabled) {
        setAdminModeEnabled(true);
        logger.debug('Restored admin mode from localStorage');
      }
    }
  }, [isAdmin, adminModeEnabled]);

  // Clear admin mode when user logs out or is no longer admin
  useEffect(() => {
    if (!isAdmin && adminModeEnabled) {
      setAdminModeEnabled(false);
      localStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
    }
  }, [isAdmin, adminModeEnabled]);

  // Toggle admin mode and persist to localStorage
  const toggleAdminMode = useCallback(() => {
    if (!isAdmin) {
      logger.warn('Cannot toggle admin mode: user is not an admin');
      return;
    }

    setAdminModeEnabled((prev) => {
      const newValue = !prev;
      if (newValue) {
        localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
      }
      logger.info('Admin mode toggled', { enabled: newValue });
      return newValue;
    });
  }, [isAdmin]);

  return (
    <AdminModeContext.Provider value={{ isAdmin, adminModeEnabled, toggleAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminMode(): AdminModeContextValue {
  const context = useContext(AdminModeContext);
  if (!context) {
    throw new Error('useAdminMode must be used within AdminModeProvider');
  }
  return context;
}
