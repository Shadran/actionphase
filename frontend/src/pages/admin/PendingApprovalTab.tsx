import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { User } from '../../lib/api/admin';

export function PendingApprovalTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [userToReject, setUserToReject] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: async () => {
      const res = await apiClient.admin.listPendingUsers();
      return res.data;
    },
    staleTime: 0,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
      showSuccess('User approved');
    },
    onError: () => showError('Failed to approve user'),
  });

  const rejectMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.rejectUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
      setUserToReject(null);
      showSuccess('User rejected');
    },
    onError: () => showError('Failed to reject user'),
  });

  return (
    <div className="bg-surface-base rounded-lg shadow">
      <div className="px-6 py-4 border-b border-theme-default">
        <h2 className="text-xl font-semibold text-content-primary">Pending Approval</h2>
        <p className="text-sm text-content-tertiary mt-1">
          New accounts awaiting admin approval
        </p>
      </div>

      {isLoading ? (
        <div className="px-6 py-8 text-center text-content-tertiary">Loading...</div>
      ) : !users?.length ? (
        <div className="px-6 py-8 text-center text-content-tertiary">No pending accounts</div>
      ) : (
        <div className="divide-y divide-theme-default">
          {users.map((user: User) => (
            <div key={user.id} className="px-6 py-4 hover:bg-surface-raised flex items-center justify-between">
              <div>
                <div className="font-medium text-content-primary">{user.username}</div>
                <div className="text-sm text-content-tertiary">{user.email}</div>
                {user.pending_approval_since && (
                  <div className="text-xs text-content-tertiary">
                    Pending since {new Date(user.pending_approval_since).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => approveMutation.mutate(user.id)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setUserToReject(user)}
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={userToReject !== null}
        onClose={() => setUserToReject(null)}
        onConfirm={() => rejectMutation.mutate(userToReject!.id)}
        title="Reject Registration"
        message={`Reject ${userToReject?.username}? Their account will be deleted.`}
        confirmText="Reject"
        variant="danger"
        isLoading={rejectMutation.isPending}
      />
    </div>
  );
}
