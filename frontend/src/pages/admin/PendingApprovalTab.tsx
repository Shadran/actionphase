import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui';
import type { User } from '../../lib/api/admin';

export function PendingApprovalTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { data: users, isLoading } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: async () => {
      const res = await apiClient.admin.listPendingUsers();
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (userId: number) => apiClient.admin.approveUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
      showSuccess('User approved');
    },
    onError: () => showError('Failed to approve user'),
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
              <Button
                variant="primary"
                onClick={() => approveMutation.mutate(user.id)}
                disabled={approveMutation.isPending}
              >
                Approve
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
