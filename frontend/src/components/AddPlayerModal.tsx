import { AddParticipantModal } from './AddParticipantModal';

interface AddPlayerModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  excludeUserIds?: number[];
}

export function AddPlayerModal({ gameId, isOpen, onClose, onSuccess, excludeUserIds }: AddPlayerModalProps) {
  return (
    <AddParticipantModal
      gameId={gameId}
      role="player"
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      excludeUserIds={excludeUserIds}
    />
  );
}
