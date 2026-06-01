import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { AdminModeToggle } from '../components/AdminModeToggle';
import { UserListTab } from './admin/UserListTab';
import { PendingApprovalTab } from './admin/PendingApprovalTab';
import { IPBansTab } from './admin/IPBansTab';
import { FingerprintBansTab } from './admin/FingerprintBansTab';
import type { AdminUser, BannedUser } from '../lib/api/admin';

export function AdminPage() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const currentUserId = currentUser?.id;
  const [activeTab, setActiveTab] = useState<'mode' | 'admins' | 'banned' | 'users' | 'pending' | 'ip-bans' | 'fingerprint-bans'>('mode');

  // Fetch admins
  const {
    data: admins,
    isLoading: isLoadingAdmins,
    error: adminsError,
  } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await apiClient.admin.listAdmins();
      return response.data;
    },
  });

  // Fetch banned users
  const {
    data: bannedUsers,
    isLoading: isLoadingBanned,
    error: bannedError,
  } = useQuery({
    queryKey: ['bannedUsers'],
    queryFn: async () => {
      const response = await apiClient.admin.listBannedUsers();
      return response.data;
    },
  });

  // Unban user mutation
  const unbanMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bannedUsers'] });
      showSuccess('User unbanned successfully');
    },
    onError: (error) => {
      showError(`Failed to unban user: ${error}`);
    },
  });

  // Revoke admin status mutation
  const revokeAdminMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.revokeAdminStatus(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      showSuccess('Admin status revoked successfully');
    },
    onError: (error) => {
      showError(`Failed to revoke admin status: ${error}`);
    },
  });

  const handleUnbanUser = (userId: number, username: string) => {
    // eslint-disable-next-line no-alert
    if (confirm(`Are you sure you want to unban user ${username}?`)) {
      unbanMutation.mutate(userId);
    }
  };

  const handleRevokeAdmin = (userId: number, username: string) => {
    // eslint-disable-next-line no-alert
    if (confirm(`Are you sure you want to revoke admin status from ${username}?`)) {
      revokeAdminMutation.mutate(userId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-content-primary mb-8">Admin Panel</h1>

      {/* Tab Navigation */}
      <div className="border-b border-theme-default mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('mode')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'mode'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Admin Mode
          </button>
          <button
            onClick={() => setActiveTab('banned')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'banned'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Banned Users
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admins'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Admins
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pending'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab('ip-bans')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'ip-bans'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            IP Bans
          </button>
          <button
            onClick={() => setActiveTab('fingerprint-bans')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'fingerprint-bans'
                ? 'border-interactive-primary text-interactive-primary'
                : 'border-transparent text-content-tertiary hover:text-content-secondary hover:border-content-tertiary'
            }`}
          >
            Device Bans
          </button>
        </nav>
      </div>

      {/* Admin Mode Tab */}
      {activeTab === 'mode' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">Admin Mode</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Control your administrator privileges and visibility
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="max-w-2xl">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-content-primary mb-2">What is Admin Mode?</h3>
                <p className="text-sm text-content-secondary mb-4">
                  When Admin Mode is enabled, you'll see additional moderation controls throughout the site,
                  such as delete buttons on posts and comments. This allows you to quickly moderate content
                  without switching to the admin panel.
                </p>
                <p className="text-sm text-content-secondary mb-4">
                  When disabled, the site appears as it does to regular users, hiding all administrative controls.
                </p>
              </div>

              <div className="border-t border-theme-default pt-4">
                <AdminModeToggle />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banned Users Tab */}
      {activeTab === 'banned' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">Banned Users</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Manage users who have been banned from the platform
            </p>
          </div>

          {isLoadingBanned ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              Loading banned users...
            </div>
          ) : bannedError ? (
            <div className="px-6 py-8 text-center text-red-500">
              Error loading banned users. You may not have admin permissions.
            </div>
          ) : !bannedUsers || bannedUsers.length === 0 ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              No banned users
            </div>
          ) : (
            <div className="divide-y divide-theme-default">
              {bannedUsers.map((user: BannedUser) => (
                <div key={user.id} className="px-6 py-4 hover:bg-surface-raised">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-content-primary">
                          {user.username}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                          BANNED
                        </span>
                      </div>
                      <p className="text-sm text-content-secondary mt-1">{user.email}</p>
                      <div className="text-xs text-content-tertiary mt-2">
                        <p>
                          Banned by: <span className="font-medium">{user.banned_by_username}</span>
                        </p>
                        <p>
                          Banned at:{' '}
                          {new Date(user.banned_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnbanUser(user.id, user.username)}
                      disabled={unbanMutation.isPending}
                      className="ml-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {unbanMutation.isPending ? 'Unbanning...' : 'Unban User'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <div className="bg-surface-base rounded-lg shadow">
          <div className="px-6 py-4 border-b border-theme-default">
            <h2 className="text-xl font-semibold text-content-primary">Administrator Users</h2>
            <p className="text-sm text-content-tertiary mt-1">
              Users with administrative privileges
            </p>
          </div>

          {isLoadingAdmins ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              Loading administrators...
            </div>
          ) : adminsError ? (
            <div className="px-6 py-8 text-center text-red-500">
              Error loading administrators. You may not have admin permissions.
            </div>
          ) : !admins || admins.length === 0 ? (
            <div className="px-6 py-8 text-center text-content-tertiary">
              No administrators found
            </div>
          ) : (
            <div className="divide-y divide-theme-default">
              {admins.map((user: AdminUser) => (
                <div key={user.id} className="px-6 py-4 hover:bg-surface-raised">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-lg font-medium text-content-primary">
                          {user.username}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          ADMIN
                        </span>
                        {user.id === currentUserId && (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-content-secondary mt-1">{user.email}</p>
                      <p className="text-xs text-content-tertiary mt-1">
                        Created: {new Date(user.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {user.id !== currentUserId && (
                      <button
                        onClick={() => handleRevokeAdmin(user.id, user.username)}
                        disabled={revokeAdminMutation.isPending}
                        className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {revokeAdminMutation.isPending ? 'Revoking...' : 'Revoke Admin'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Users Tab */}
      {activeTab === 'users' && <UserListTab />}

      {/* Pending Approval Tab */}
      {activeTab === 'pending' && <PendingApprovalTab />}

      {/* IP Bans Tab */}
      {activeTab === 'ip-bans' && <IPBansTab />}

      {/* Device Fingerprint Bans Tab */}
      {activeTab === 'fingerprint-bans' && <FingerprintBansTab />}

    </div>
  );
}
