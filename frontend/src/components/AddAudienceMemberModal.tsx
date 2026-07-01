import { AddParticipantModal } from './AddParticipantModal';

interface AddAudienceMemberModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddAudienceMemberModal({ gameId, isOpen, onClose, onSuccess }: AddAudienceMemberModalProps) {
  return (
    <AddParticipantModal
      gameId={gameId}
      role="audience"
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
