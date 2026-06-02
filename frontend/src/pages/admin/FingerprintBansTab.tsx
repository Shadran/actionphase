import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Button, Input } from '../../components/ui';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { FingerprintBan } from '../../lib/api/admin';

export function FingerprintBansTab() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const [fingerprint, setFingerprint] = useState('');
  const [reason, setReason] = useState('');
  const [banToDelete, setBanToDelete] = useState<FingerprintBan | null>(null);

  const { data: bans, isLoading } = useQuery({
    queryKey: ['fingerprintBans'],
    queryFn: async () => {
      const res = await apiClient.admin.listFingerprintBans();
      return res.data;
    },
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.admin.createFingerprintBan(fingerprint.trim(), reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fingerprintBans'] });
      setFingerprint('');
      setReason('');
      showSuccess('Device fingerprint banned');
    },
    onError: () => showError('Failed to ban fingerprint'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.admin.deleteFingerprintBan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fingerprintBans'] });
      setBanToDelete(null);
      showSuccess('Fingerprint ban removed');
    },
    onError: () => showError('Failed to remove fingerprint ban'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fingerprint.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="bg-surface-base rounded-lg shadow">
      <div className="px-6 py-4 border-b border-theme-default">
        <h2 className="text-xl font-semibold text-content-primary">Device Fingerprint Bans</h2>
        <p className="text-sm text-content-tertiary mt-1">Block access from specific device fingerprints</p>
      </div>

      {/* Add form */}
      <form onSubmit={handleSubmit} className="px-6 py-4 border-b border-theme-default space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-64">
            <Input
              label="Fingerprint"
              placeholder="Device fingerprint hash"
              value={fingerprint}
              onChange={e => setFingerprint(e.target.value)}
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
        </div>
        <Button variant="danger" type="submit" disabled={!fingerprint.trim() || createMutation.isPending}>
          Add Fingerprint Ban
        </Button>
      </form>

      {/* Ban list */}
      {isLoading ? (
        <div className="px-6 py-8 text-center text-content-tertiary">Loading...</div>
      ) : !bans?.length ? (
        <div className="px-6 py-8 text-center text-content-tertiary">No fingerprint bans</div>
      ) : (
        <div className="divide-y divide-theme-default">
          {bans.map((ban: FingerprintBan) => (
            <div key={ban.id} className="px-6 py-4 hover:bg-surface-raised flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-content-primary text-sm truncate max-w-md">{ban.fingerprint}</div>
                {ban.reason && <div className="text-sm text-content-secondary">{ban.reason}</div>}
                <div className="text-xs text-content-tertiary">
                  Banned {new Date(ban.created_at).toLocaleDateString()}
                  {ban.banned_username && ` · User: ${ban.banned_username}`}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setBanToDelete(ban)}
                disabled={deleteMutation.isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={banToDelete !== null}
        onClose={() => setBanToDelete(null)}
        onConfirm={() => deleteMutation.mutate(banToDelete!.id)}
        title="Remove Device Ban"
        message={`Remove ban for fingerprint: ${banToDelete?.fingerprint.slice(0, 20)}...?`}
        confirmText="Remove"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
