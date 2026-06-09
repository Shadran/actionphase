import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AxiosResponse } from 'axios';
import { AdminPage } from './AdminPage';
import { apiClient } from '../lib/api';
import { ToastProvider } from '../contexts/ToastContext';
import { AdminModeProvider } from '../contexts/AdminModeContext';

// Mock the API client
vi.mock('../lib/api', () => ({
  apiClient: {
    admin: {
      listAdmins: vi.fn(),
      listBannedUsers: vi.fn(),
      listUsers: vi.fn(),
      banUser: vi.fn(),
      unbanUser: vi.fn(),
      revokeAdminStatus: vi.fn(),
      grantAdminStatus: vi.fn(),
      getUserByUsername: vi.fn(),
      getUserSessions: vi.fn(),
      createIPBan: vi.fn(),
      createFingerprintBan: vi.fn(),
    },
  },
}));

// Mock the AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 1, username: 'testadmin', email: 'test@example.com' },
    isAuthenticated: true,
    isLoading: false,
    isCheckingAuth: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    error: null,
  }),
}));

describe('AdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderAdminPage = () => {
    return render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin/:tab?" element={
            <QueryClientProvider client={queryClient}>
              <AdminModeProvider>
                <ToastProvider>
                  <AdminPage />
                </ToastProvider>
              </AdminModeProvider>
            </QueryClientProvider>
          } />
        </Routes>
      </MemoryRouter>
    );
  };

  const selectTab = async (user: ReturnType<typeof userEvent.setup>, tabLabel: string) => {
    await user.selectOptions(screen.getByRole('combobox'), tabLabel);
  };

  describe('Banned Users Tab', () => {
    it('shows loading state initially', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.admin.listBannedUsers).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderAdminPage();

      await selectTab(user, 'Banned Users');

      expect(screen.getByText(/loading banned users/i)).toBeInTheDocument();
    });

    it('displays empty state when no banned users exist', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await selectTab(user, 'Banned Users');

      await waitFor(() => {
        expect(screen.getByText(/no banned users/i)).toBeInTheDocument();
      });
    });

    it('displays list of banned users', async () => {
      const user = userEvent.setup();
      const bannedUsers = [
        {
          id: 1,
          username: 'banneduser1',
          email: 'banned1@example.com',
          banned_at: '2025-10-21T12:00:00Z',
          banned_by_user_id: 2,
          banned_by_username: 'admin',
          created_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'banneduser2',
          email: 'banned2@example.com',
          banned_at: '2025-10-21T13:00:00Z',
          banned_by_user_id: 2,
          banned_by_username: 'admin',
          created_at: '2025-01-01T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: bannedUsers,
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await selectTab(user, 'Banned Users');

      await waitFor(() => {
        expect(screen.getByText('banneduser1')).toBeInTheDocument();
        expect(screen.getByText('banneduser2')).toBeInTheDocument();
        expect(screen.getByText('banned1@example.com')).toBeInTheDocument();
        expect(screen.getByText('banned2@example.com')).toBeInTheDocument();
      });

      const badges = screen.getAllByText('BANNED');
      expect(badges).toHaveLength(2);

      const bannedByTexts = screen.getAllByText(/^Banned by:/i);
      expect(bannedByTexts).toHaveLength(2);
    });

    it('displays error state when API fails', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.admin.listBannedUsers).mockRejectedValue(
        new Error('API Error')
      );

      renderAdminPage();

      await selectTab(user, 'Banned Users');

      await waitFor(() => {
        expect(screen.getByText(/error loading banned users/i)).toBeInTheDocument();
      });
    });

    it('unbans a user when unban button is clicked and confirmed via modal', async () => {
      const userActions = userEvent.setup();
      const bannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [bannedUser],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.unbanUser).mockResolvedValue({} as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      await selectTab(userActions, 'Banned Users');

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      // Click Unban User to open the confirmation modal
      await userActions.click(screen.getByRole('button', { name: /unban user/i }));

      // Confirm via the modal's confirm button
      await userActions.click(screen.getByRole('button', { name: /^unban$/i }));

      await waitFor(() => {
        expect(apiClient.admin.unbanUser).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(screen.getByText('User unbanned successfully')).toBeInTheDocument();
      });
    });

    it('does not unban user when confirmation modal is cancelled', async () => {
      const userActions = userEvent.setup();
      const bannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [bannedUser],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await selectTab(userActions, 'Banned Users');

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      await userActions.click(screen.getByRole('button', { name: /unban user/i }));

      // Cancel via the modal's cancel button
      await userActions.click(screen.getByRole('button', { name: /^cancel$/i }));

      expect(apiClient.admin.unbanUser).not.toHaveBeenCalled();
    });

    it('shows error toast when unban fails', async () => {
      const userActions = userEvent.setup();
      const bannedUser = {
        id: 1,
        username: 'banneduser',
        email: 'banned@example.com',
        banned_at: '2025-10-21T12:00:00Z',
        banned_by_user_id: 2,
        banned_by_username: 'admin',
        created_at: '2025-01-01T00:00:00Z',
      };

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [bannedUser],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.unbanUser).mockRejectedValue(new Error('API Error'));

      renderAdminPage();

      await selectTab(userActions, 'Banned Users');

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
      });

      await userActions.click(screen.getByRole('button', { name: /unban user/i }));
      await userActions.click(screen.getByRole('button', { name: /^unban$/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to unban user/i)).toBeInTheDocument();
      });
    });
  });

  describe('Admins Tab', () => {
    it('switches to admins tab when clicked', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByText(/administrator users/i)).toBeInTheDocument();
      });
    });

    it('displays list of admin users', async () => {
      const admins = [
        {
          id: 1,
          username: 'admin1',
          email: 'admin1@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'admin2',
          email: 'admin2@example.com',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByText('admin1')).toBeInTheDocument();
        expect(screen.getByText('admin2')).toBeInTheDocument();
        expect(screen.getByText('admin1@example.com')).toBeInTheDocument();
        expect(screen.getByText('admin2@example.com')).toBeInTheDocument();
      });

      const badges = screen.getAllByText('ADMIN');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('displays empty state when no admins exist', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByText(/no administrators found/i)).toBeInTheDocument();
      });
    });

    it('displays error state when API fails', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockRejectedValue(new Error('API Error'));

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByText(/error loading administrators/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('shows Admin Mode tab by default', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^admin mode$/i })).toBeInTheDocument();
      });
    });

    it('switches between tabs correctly', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^admin mode$/i })).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /administrator users/i })).toBeInTheDocument();
      });

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Banned Users');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /^banned users$/i })).toBeInTheDocument();
      });
    });
  });

  describe('Revoke Admin with Self-Protection', () => {
    it('does not show revoke button for current user', async () => {
      const admins = [
        {
          id: 1, // Same as mocked currentUser.id
          username: 'testadmin',
          email: 'test@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'anotheradmin',
          email: 'another@example.com',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByText('testadmin')).toBeInTheDocument();
        expect(screen.getByText('anotheradmin')).toBeInTheDocument();
      });

      expect(screen.getByText('YOU')).toBeInTheDocument();

      // Should only see 1 Revoke Admin button (for anotheradmin, not testadmin)
      const revokeButtons = screen.getAllByRole('button', { name: /revoke admin/i });
      expect(revokeButtons).toHaveLength(1);
    });

    it('revokes admin status for other users via confirmation modal', async () => {
      const admins = [
        {
          id: 1,
          username: 'testadmin',
          email: 'test@example.com',
          createdAt: '2025-01-01T00:00:00Z',
        },
        {
          id: 2,
          username: 'anotheradmin',
          email: 'another@example.com',
          createdAt: '2025-01-02T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.listAdmins).mockResolvedValue({
        data: admins,
      } as Partial<AxiosResponse<unknown[]>>);
      vi.mocked(apiClient.admin.revokeAdminStatus).mockResolvedValue({} as Partial<AxiosResponse<unknown>>);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'Admins');

      await waitFor(() => {
        expect(screen.getByText('anotheradmin')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /revoke admin/i }));

      // Confirm via the modal
      await userEvent.click(screen.getByRole('button', { name: /^revoke$/i }));

      await waitFor(() => {
        expect(apiClient.admin.revokeAdminStatus).toHaveBeenCalledWith(2);
      });

      await waitFor(() => {
        expect(screen.getByText('Admin status revoked successfully')).toBeInTheDocument();
      });
    });
  });

  describe('All Users Tab', () => {
    const mockUsersResponse = (users: unknown[]) =>
      vi.mocked(apiClient.admin.listUsers).mockResolvedValue({
        data: { users, total: users.length, page: 1, page_size: 25 },
      } as Partial<AxiosResponse<unknown>>);

    it('shows All Users tab when clicked', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      mockUsersResponse([]);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'All Users');

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /all users/i })).toBeInTheDocument();
      });
    });

    it('displays list of users', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      mockUsersResponse([
        {
          id: 2,
          username: 'regularuser',
          email: 'regular@example.com',
          is_admin: false,
          is_banned: false,
          createdAt: '2025-01-02T00:00:00Z',
        },
      ]);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'All Users');

      await waitFor(() => {
        expect(screen.getByText('regularuser')).toBeInTheDocument();
        expect(screen.getByText('regular@example.com')).toBeInTheDocument();
      });
    });

    it('shows ADMIN badge for admin users', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      mockUsersResponse([
        {
          id: 2,
          username: 'adminuser',
          email: 'admin@example.com',
          is_admin: true,
          is_banned: false,
          createdAt: '2025-01-02T00:00:00Z',
        },
      ]);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'All Users');

      await waitFor(() => {
        expect(screen.getByText('adminuser')).toBeInTheDocument();
        expect(screen.getByText('ADMIN')).toBeInTheDocument();
      });
    });

    it('shows BANNED badge for banned users', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      mockUsersResponse([
        {
          id: 2,
          username: 'banneduser',
          email: 'banned@example.com',
          is_admin: false,
          is_banned: true,
          createdAt: '2025-01-02T00:00:00Z',
        },
      ]);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'All Users');

      await waitFor(() => {
        expect(screen.getByText('banneduser')).toBeInTheDocument();
        expect(screen.getByText('BANNED')).toBeInTheDocument();
      });
    });

    it('shows empty state when no users found', async () => {
      vi.mocked(apiClient.admin.listBannedUsers).mockResolvedValue({
        data: [],
      } as Partial<AxiosResponse<unknown[]>>);
      mockUsersResponse([]);

      renderAdminPage();

      await userEvent.selectOptions(screen.getByRole('combobox'), 'All Users');

      await waitFor(() => {
        expect(screen.getByText(/no users found/i)).toBeInTheDocument();
      });
    });
  });
});
