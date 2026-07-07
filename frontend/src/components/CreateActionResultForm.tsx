import React, { useState } from 'react';
import { useCreateActionResult } from '../hooks/useActionResults';
import { useToast } from '../contexts/ToastContext';
import { Button, Alert } from './ui';
import { CommentEditor } from './CommentEditor';
import { logger } from '@/services/LoggingService';

interface CreateActionResultFormProps {
  gameId: number;
  userId: number;
  userName: string;
  characterId?: number;
  characterName?: string;
  actionSubmissionId?: number;
  onSuccess?: () => void;
}

export const CreateActionResultForm: React.FC<CreateActionResultFormProps> = ({
  gameId,
  userId,
  userName,
  characterId,
  characterName,
  actionSubmissionId,
  onSuccess,
}) => {
  const { showWarning } = useToast();
  const [content, setContent] = useState('');
  const createResult = useCreateActionResult(gameId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      showWarning('Please enter result content');
      return;
    }

    try {
      await createResult.mutateAsync({
        user_id: userId,
        character_id: characterId,
        action_submission_id: actionSubmissionId,
        content: content.trim(),
        is_published: false, // Always create as draft
      });

      setContent('');
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to create action result', { error, gameId, userId, userName, characterId, characterName, actionSubmissionId });
    }
  };

  const recipientLabel = characterName ? `${characterName} (${userName})` : userName;

  return (
    <form onSubmit={handleSubmit} className="p-4 surface-base border border-theme-default rounded shadow-sm">
      <h4 className="font-semibold text-content-primary mb-2">Send Result to {recipientLabel}</h4>

      <div className="mb-4">
        <label className="block text-sm font-medium text-content-primary mb-1">Result Content</label>
        <CommentEditor
          id="content"
          value={content}
          onChange={setContent}
          rows={4}
          placeholder="Enter the result of the player's action..."
          maxLength={100000}
          warnOnUnsavedChanges
          showCharacterCount={true}
        />
        <p className="mt-1 text-xs text-content-tertiary">Maximum 100,000 characters. Result will be created as a draft.</p>
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={createResult.isPending}
        className="w-full"
        data-faro-user-action-name="create-action-result"
      >
        {createResult.isPending ? 'Creating...' : 'Create Draft Result'}
      </Button>

      {createResult.isError && (
        <Alert variant="danger" className="mt-2">
          Failed to create result. Please try again.
        </Alert>
      )}

      {createResult.isSuccess && (
        <Alert variant="success" className="mt-2">
          Draft result created! Add character updates and publish when ready.
        </Alert>
      )}
    </form>
  );
};
