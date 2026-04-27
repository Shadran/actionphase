import { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './ui';
import { logger } from '@/services/LoggingService';

interface DeleteGameConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  gameTitle: string;
}

/**
 * DeleteGameConfirmationDialog - Confirmation dialog for deleting a cancelled game
 *
 * Deleting a game:
 * - Permanently removes the game from the system
 * - Cannot be undone
 * - Only available for games in cancelled state
 * - Only available to the Game Master
 */
export function DeleteGameConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  gameTitle,
}: DeleteGameConfirmationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const handleConfirm = async () => {
    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      await onConfirm();
      submittingRef.current = false;
      onClose();
    } catch (error) {
      submittingRef.current = false;
      logger.error('Failed to delete game', { error, gameTitle });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!submittingRef.current) onClose(); }} title="Delete Game">
      <div className="space-y-4">
        {/* Warning message */}
        <div className="bg-semantic-error/10 border border-semantic-error rounded-lg p-4">
          <h3 className="font-semibold text-content-primary mb-2">
            ⚠️ Permanent Deletion
          </h3>
          <p className="text-content-secondary text-sm">
            Deleting this game will:
          </p>
          <ul className="list-disc list-inside text-content-secondary text-sm mt-2 space-y-1">
            <li>Permanently remove all game data</li>
            <li>Delete all associated characters and content</li>
            <li>Cannot be recovered or undone</li>
          </ul>
        </div>

        {/* Game info */}
        <div>
          <p className="text-content-secondary text-sm mb-2">
            You are about to permanently delete:
          </p>
          <p className="font-semibold text-content-primary">
            {gameTitle}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 justify-end pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="delete-game-cancel-button"
          >
            Keep Game
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isSubmitting}
            loading={isSubmitting}
            data-testid="delete-game-confirm-button"
          >
            {isSubmitting ? 'Deleting...' : 'Delete Game'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
