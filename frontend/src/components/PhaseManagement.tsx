import { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { PhaseCard } from './PhaseCard';
import { CreatePhaseModal } from './CreatePhaseModal';
import type { DraftPostData } from './CreatePhaseModal';
import { EditPhaseModal } from './EditPhaseModal';
import { usePhaseManagement } from '../hooks/usePhaseManagement';
import { apiClient } from '../lib/api';
import { Button } from './ui';
import { PHASE_TYPE_LABELS } from '../types/phases';
import type { GamePhase, CreatePhaseRequest } from '../types/phases';
import { localDateTimeToUTC } from '../utils/timezone';

interface PhaseManagementProps {
  gameId: number;
  className?: string;
}

export function PhaseManagement({ gameId, className = '' }: PhaseManagementProps) {
  const [isCreatingPhase, setIsCreatingPhase] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [isEditingDeadline, setIsEditingDeadline] = useState<number | null>(null);
  const [editingPhase, setEditingPhase] = useState<GamePhase | null>(null);

  const {
    phases,
    currentPhase,
    isLoading,
    createPhaseMutation,
    activatePhaseMutation,
    updateDeadlineMutation,
    updatePhaseMutation,
    deletePhaseMutation,
  } = usePhaseManagement(gameId);

  if (isLoading) {
    return (
      <div className={`surface-base rounded-lg border border-theme-default p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 surface-sunken rounded mb-4 w-1/3"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 surface-sunken rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`surface-base rounded-lg border border-theme-default ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-content-primary">Phase Management</h2>
            <p className="text-sm text-content-secondary mt-1">
              Create and control game phases to structure your session
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setIsCreatingPhase(true)}
          >
            New Phase
          </Button>
        </div>

        {/* Current Phase Summary */}
        {currentPhase && (
          <div className="mb-6 p-4 bg-interactive-primary-subtle border border-interactive-primary rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-content-primary">Currently Active</h3>
                <p className="text-sm text-content-primary">
                  {currentPhase.title || PHASE_TYPE_LABELS[currentPhase.phase_type]} (Phase {currentPhase.phase_number})
                </p>
              </div>
              {currentPhase.deadline && (
                <CountdownTimer deadline={currentPhase.deadline} />
              )}
            </div>
          </div>
        )}

        {/* Phase List */}
        <div className="space-y-3">
          {phases.length === 0 ? (
            <div className="text-center py-8 text-content-secondary">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No phases created yet</p>
              <p className="text-sm">Create your first phase to begin the game session</p>
            </div>
          ) : (
            phases.map((phase) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                gameId={gameId}
                allPhases={phases}
                currentPhaseId={currentPhase?.id}
                isActive={phase.is_active}
                isSelected={selectedPhaseId === phase.id}
                isEditingDeadline={isEditingDeadline === phase.id}
                onSelect={() => setSelectedPhaseId(phase.id)}
                onActivate={() => activatePhaseMutation.mutate(phase.id)}
                onEdit={() => setEditingPhase(phase)}
                onDelete={async () => {
                  await deletePhaseMutation.mutateAsync(phase.id);
                }}
                onEditDeadline={() => setIsEditingDeadline(phase.id)}
                onUpdateDeadline={(deadline) =>
                  updateDeadlineMutation.mutate({
                    phaseId: phase.id,
                    data: { deadline: localDateTimeToUTC(deadline) }
                  })
                }
                onCancelEditDeadline={() => setIsEditingDeadline(null)}
                isActivating={activatePhaseMutation.isPending}
                isUpdatingDeadline={updateDeadlineMutation.isPending}
              />
            ))
          )}
        </div>
      </div>

      {/* Create Phase Modal */}
      {isCreatingPhase && (
        <CreatePhaseModal
          onClose={() => setIsCreatingPhase(false)}
          onSubmit={async (data: CreatePhaseRequest, draftPost?: DraftPostData) => {
            const response = await createPhaseMutation.mutateAsync(data);
            if (draftPost && response?.data?.id) {
              try {
                await apiClient.messages.createDraftPost(
                  response.data.id,
                  draftPost.characterId,
                  draftPost.content
                );
              } catch {
                // Draft creation failure is non-fatal — phase was created successfully
              }
            }
            setIsCreatingPhase(false);
          }}
          isSubmitting={createPhaseMutation.isPending}
        />
      )}

      {/* Edit Phase Modal */}
      {editingPhase && (
        <EditPhaseModal
          phase={editingPhase}
          onClose={() => setEditingPhase(null)}
          onSubmit={(data) => {
            updatePhaseMutation.mutate({
              phaseId: editingPhase.id,
              data
            });
            setEditingPhase(null);
          }}
          isSubmitting={updatePhaseMutation.isPending}
        />
      )}
    </div>
  );
}
