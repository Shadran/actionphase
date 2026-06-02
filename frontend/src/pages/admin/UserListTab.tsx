import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Badge, Button, Input, Modal, Textarea } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { SessionDetail, User } from '../../lib/api/admin';

type PendingBan = { type: 'ip'; value: string } | { type: 'fingerprint'; value: string };

export function UserListTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [pendingBan, setPendingBan] = useState<PendingBan | null>(null);
  const [banReason, setBanReason] = useState('');
  const [userToBan, setUserToBan] = useState<User | null>(null);

  // Debounce search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    clearTimeout((window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer);
    (window as unknown as { _searchTimer?: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers', page, debouncedSearch],
    queryFn: async () => {
      const res = await apiClient.admin.listUsers(page, 25, debouncedSearch);
      return res.data;
    },
  });

  const banMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.banUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      setUserToBan(null);
      showSuccess('User banned');
    },
    onError: () => showError('Failed to ban user'),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      showSuccess('User unbanned');
    },
    onError: () => showError('Failed to unban user'),
  });

  const createIPBanMutation = useMutation({
    mutationFn: ({ ip, reason }: { ip: string; reason: string }) =>
      apiClient.admin.createIPBan(ip, reason),
    onSuccess: () => { showSuccess('IP banned'); closeBanModal(); },
    onError: () => showError('Failed to ban IP'),
  });

  const createFingerprintBanMutation = useMutation({
    mutationFn: ({ fp, reason }: { fp: string; reason: string }) =>
      apiClient.admin.createFingerprintBan(fp, reason),
    onSuccess: () => { showSuccess('Device fingerprint banned'); closeBanModal(); },
    onError: () => showError('Failed to ban fingerprint'),
  });

  const closeBanModal = () => {
    setPendingBan(null);
    setBanReason('');
    setSessionUser(null);
    setSessions(null);
  };

  const confirmBan = () => {
    if (!pendingBan) return;
    if (pendingBan.type === 'ip') {
      createIPBanMutation.mutate({ ip: pendingBan.value, reason: banReason });
    } else {
      createFingerprintBanMutation.mutate({ fp: pendingBan.value, reason: banReason });
    }
  };

  const handleViewSessions = async (user: User) => {
    setSessionUser(user);
    setSessions(null);
    setSessionsLoading(true);
    try {
      const res = await apiClient.admin.getUserSessions(user.id);
      setSessions(res.data);
    } catch {
      showError('Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 1;

  return (
    <div className="bg-surface-base rounded-lg shadow">
      <div className="px-6 py-4 border-b border-theme-default">
        <h2 className="text-xl font-semibold text-content-primary">All Users</h2>
        <p className="text-sm text-content-tertiary mt-1">
          Browse, search, and manage all user accounts
        </p>
      </div>

      <div className="px-6 py-4 border-b border-theme-default">
        <Input
          placeholder="Search by username or email..."
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {isLoading ? (
        <div className="px-6 py-8 text-center text-content-tertiary">Loading users...</div>
      ) : !data?.users?.length ? (
        <div className="px-6 py-8 text-center text-content-tertiary">No users found</div>
      ) : (
        <>
          <div className="divide-y divide-theme-default">
            {data.users.map((user: User) => (
              <div key={user.id} className="px-6 py-4 hover:bg-surface-raised">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-content-primary">{user.username}</span>
                      <span className="text-sm text-content-tertiary">{user.email}</span>
                      {user.is_admin && <Badge variant="primary">ADMIN</Badge>}
                      {user.is_banned && <Badge variant="danger">BANNED</Badge>}
                      {user.pending_approval && <Badge variant="warning">PENDING</Badge>}
                      {!user.email_verified && <Badge variant="warning">UNVERIFIED</Badge>}
                    </div>
                    <div className="text-xs text-content-tertiary mt-1">
                      Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="ghost" onClick={() => handleViewSessions(user)}>
                      Sessions
                    </Button>
                    {user.is_banned ? (
                      <Button
                        variant="secondary"
                        onClick={() => unbanMutation.mutate(user.id)}
                        disabled={unbanMutation.isPending}
                      >
                        Unban
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        onClick={() => setUserToBan(user)}
                        disabled={banMutation.isPending}
                      >
                        Ban
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-theme-default">
            <span className="text-sm text-content-tertiary">
              {data.total} user{data.total !== 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
                Previous
              </Button>
              <span className="text-sm text-content-secondary self-center">
                {page} / {totalPages}
              </span>
              <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Ban User Confirmation */}
      <ConfirmModal
        isOpen={userToBan !== null}
        onClose={() => setUserToBan(null)}
        onConfirm={() => banMutation.mutate(userToBan!.id)}
        title="Ban User"
        message={`Ban ${userToBan?.username}? They will not be able to log in.`}
        confirmText="Ban"
        variant="danger"
        isLoading={banMutation.isPending}
      />

      {/* Ban IP / Device Confirmation Modal */}
      <Modal
        isOpen={pendingBan !== null}
        onClose={closeBanModal}
        title={pendingBan?.type === 'ip' ? `Ban IP: ${pendingBan.value}` : 'Ban Device'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeBanModal}>Cancel</Button>
            <Button
              variant="danger"
              onClick={confirmBan}
              disabled={createIPBanMutation.isPending || createFingerprintBanMutation.isPending}
            >
              Confirm Ban
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {pendingBan?.type === 'fingerprint' && (
            <p className="text-sm text-content-secondary break-all">
              <span className="font-medium">Fingerprint:</span> {pendingBan.value}
            </p>
          )}
          <Textarea
            label="Reason (optional)"
            placeholder="e.g. Spamming, ban evasion..."
            value={banReason}
            onChange={e => setBanReason(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>

      {/* Sessions Modal */}
      {sessionUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-base rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="px-6 py-4 border-b border-theme-default flex items-center justify-between">
              <h3 className="text-lg font-semibold text-content-primary">
                Sessions — {sessionUser.username}
              </h3>
              <Button variant="ghost" onClick={() => { setSessionUser(null); setSessions(null); }}>
                ✕
              </Button>
            </div>
            <div className="p-6">
              {sessionsLoading ? (
                <p className="text-content-tertiary">Loading...</p>
              ) : !sessions?.length ? (
                <p className="text-content-tertiary">No active sessions</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map(s => (
                    <div key={s.id} className="border border-theme-default rounded p-4 text-sm">
                      <div className="grid grid-cols-2 gap-2 text-content-secondary mb-3">
                        <span><span className="font-medium">IP:</span> {s.ip_address ?? '—'}</span>
                        <span><span className="font-medium">Last seen:</span> {new Date(s.last_seen_at).toLocaleString()}</span>
                        <span className="col-span-2 truncate">
                          <span className="font-medium">Device:</span> {s.user_agent ?? '—'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {s.ip_address && (
                          <Button
                            variant="danger"
                            onClick={() => setPendingBan({ type: 'ip', value: s.ip_address! })}
                          >
                            Ban IP
                          </Button>
                        )}
                        {s.fingerprint && (
                          <Button
                            variant="danger"
                            onClick={() => setPendingBan({ type: 'fingerprint', value: s.fingerprint! })}
                          >
                            Ban Device
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
