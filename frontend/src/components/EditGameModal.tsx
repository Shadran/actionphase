import { useState, useEffect } from 'react';
import type { GameWithDetails, UpdateGameRequest } from '../types/games';
import { apiClient } from '../lib/api';
import { Button, Alert } from './ui';
import { Modal } from './Modal';
import { GameFormFields, type GameFormData } from './GameFormFields';
import { convertToISO8601, formatDateTimeLocal } from '../lib/utils/dates';

interface EditGameModalProps {
  game: GameWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onGameUpdated: () => void;
}

export function EditGameModal({ game, isOpen, onClose, onGameUpdated }: EditGameModalProps) {
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    description: '',
    genre: '',
    max_players: '',
    recruitment_deadline: '',
    start_date: '',
    end_date: '',
    is_anonymous: false,
    auto_accept_audience: false,
    allow_group_conversations: true,
    portrait_avatars: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with game data
  useEffect(() => {
    if (isOpen && game) {
      setFormData({
        title: game.title || '',
        description: game.description || '',
        genre: game.genre || '',
        max_players: game.max_players || '',
        recruitment_deadline: game.recruitment_deadline ? formatDateTimeLocal(game.recruitment_deadline) : '',
        start_date: game.start_date ? formatDateTimeLocal(game.start_date) : '',
        end_date: game.end_date ? formatDateTimeLocal(game.end_date) : '',
        is_anonymous: game.is_anonymous || false,
        auto_accept_audience: game.auto_accept_audience || false,
        allow_group_conversations: game.allow_group_conversations ?? true,
        portrait_avatars: game.portrait_avatars ?? false,
      });
      setError(null);
    }
  }, [isOpen, game]);

  const handleChange = (field: keyof GameFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }

    try {
      setLoading(true);

      const updateData: UpdateGameRequest = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        genre: formData.genre.trim() || undefined,
        max_players: formData.max_players === '' ? undefined : Number(formData.max_players),
        recruitment_deadline: convertToISO8601(formData.recruitment_deadline) || undefined,
        start_date: convertToISO8601(formData.start_date) || undefined,
        end_date: convertToISO8601(formData.end_date) || undefined,
        is_public: true, // Default to true for now
        is_anonymous: formData.is_anonymous,
        auto_accept_audience: formData.auto_accept_audience,
        allow_group_conversations: formData.allow_group_conversations ?? true,
        portrait_avatars: formData.portrait_avatars ?? false,
      };

      await apiClient.games.updateGame(game.id, updateData);
      onGameUpdated();
      onClose();
    } catch (_err) {
      setError(_err instanceof Error ? _err.message : 'Failed to update game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Game">
      {error && (
        <Alert variant="danger" className="mb-4" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <GameFormFields
          formData={formData}
          onChange={handleChange}
        />

        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="flex-1"
          >
            Save Changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
