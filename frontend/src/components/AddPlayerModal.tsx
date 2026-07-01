import { AddParticipantModal } from './AddParticipantModal';

interface AddPlayerModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPlayerModal({ gameId, isOpen, onClose, onSuccess }: AddPlayerModalProps) {
  return (
    <AddParticipantModal
      gameId={gameId}
      role="player"
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
