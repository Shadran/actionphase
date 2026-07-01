import { AddParticipantModal } from './AddParticipantModal';

interface AddAudienceMemberModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  excludeUserIds?: number[];
}

export function AddAudienceMemberModal({ gameId, isOpen, onClose, onSuccess, excludeUserIds }: AddAudienceMemberModalProps) {
  return (
    <AddParticipantModal
      gameId={gameId}
      role="audience"
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      excludeUserIds={excludeUserIds}
    />
  );
}
