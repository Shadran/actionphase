import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button, Input } from '../../components/ui';
import type { IPBan } from '../../lib/api/admin';

export function IPBansTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [ip, setIP] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const { data: bans, isLoading } = useQuery({
    queryKey: ['ipBans'],
    queryFn: async () => {
      const res = await apiClient.admin.listIPBans();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.admin.createIPBan(ip.trim(), reason, expiresAt || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipBans'] });
      setIP('');
      setReason('');
      setExpiresAt('');
      showSuccess('IP banned');
    },
    onError: () => showError('Failed to ban IP'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.deleteIPBan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipBans'] });
      showSuccess('IP ban removed');
    },
    onError: () => showError('Failed to remove IP ban'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="bg-surface-base rounded-lg shadow">
      <div className="px-6 py-4 border-b border-theme-default">
        <h2 className="text-xl font-semibold text-content-primary">IP Bans</h2>
        <p className="text-sm text-content-tertiary mt-1">Block access from specific IP addresses</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="px-6 py-4 border-b border-theme-default space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              label="IP Address"
              placeholder="192.168.1.1"
              value={ip}
              onChange={e => setIP(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-48">
            <Input
              label="Reason (optional)"
              placeholder="Reason for ban"
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-48">
            <Input
              label="Expires (optional)"
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <Button variant="danger" type="submit" disabled={!ip.trim() || createMutation.isPending}>
          Add IP Ban
        </Button>
      </form>

      {/* Ban list */}
      {isLoading ? (
        <div className="px-6 py-8 text-center text-content-tertiary">Loading...</div>
      ) : !bans?.length ? (
        <div className="px-6 py-8 text-center text-content-tertiary">No IP bans</div>
      ) : (
        <div className="divide-y divide-theme-default">
          {bans.map((ban: IPBan) => (
            <div key={ban.id} className="px-6 py-4 hover:bg-surface-raised flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-content-primary">{ban.ip_address}</div>
                {ban.reason && <div className="text-sm text-content-secondary">{ban.reason}</div>}
                <div className="text-xs text-content-tertiary">
                  Banned {new Date(ban.created_at).toLocaleDateString()}
                  {ban.expires_at && ` · Expires ${new Date(ban.expires_at).toLocaleDateString()}`}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  if (confirm(`Remove ban for ${ban.ip_address}?`)) deleteMutation.mutate(ban.id);
                }}
                disabled={deleteMutation.isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
