import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { CreateCharacterRequest } from '../types/characters';
import type { GameParticipant } from '../types/games';
import { Modal } from './Modal';
import { Input, Button, Alert, Select } from './ui';
import { logger } from '@/services/LoggingService';

interface CreateCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: number;
  userRole?: string; // 'gm', 'player', 'audience'
  participants?: GameParticipant[]; // Game participants for user selection
}

export function CreateCharacterModal({
  isOpen,
  onClose,
  gameId,
  userRole = 'player',
  participants = []
}: CreateCharacterModalProps) {
  const [formData, setFormData] = useState<CreateCharacterRequest>({
    name: '',
    character_type: 'player_character'
  });

  // Get players (participants with role="player")
  const players = participants.filter(p => p.role === 'player');

  const queryClient = useQueryClient();

  const createCharacterMutation = useMutation({
    mutationFn: (data: CreateCharacterRequest) =>
      apiClient.characters.createCharacter(gameId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gameCharacters', gameId] });
      queryClient.invalidateQueries({ queryKey: ['userControllableCharacters', gameId] });
      onClose();
      setFormData({ name: '', character_type: 'player_character' });
    },
    onError: (error) => {
      logger.error('Failed to create character', { error, gameId, characterName: formData.name, characterType: formData.character_type });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    createCharacterMutation.mutate(formData);
  };

  const handleClose = () => {
    onClose();
    setFormData({ name: '', character_type: 'player_character' });
  };

  // Clear user_id when switching away from player_character
  useEffect(() => {
    if (formData.character_type !== 'player_character') {
      setFormData(prev => {
        const { user_id: _user_id, ...rest } = prev;
        return rest;
      });
    }
  }, [formData.character_type]);

  // Determine if we should show user selector
  const showUserSelector = userRole === 'gm' && formData.character_type === 'player_character';

  // Determine available character types based on user role
  const getAvailableCharacterTypes = () => {
    if (userRole === 'gm') {
      return [
        { value: 'player_character', label: 'Player Character' },
        { value: 'npc', label: 'NPC' }
      ];
    } else {
      return [
        { value: 'player_character', label: 'Player Character' }
      ];
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Character">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="character-form">
        {/* Character Name */}
        <Input
          label="Character Name"
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Enter character name..."
          data-testid="character-name-input"
        />

        {/* Character Type */}
        <Select
          label="Character Type"
          id="character_type"
          value={formData.character_type}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            character_type: e.target.value as CreateCharacterRequest['character_type']
          }))}
          helperText={
            formData.character_type === 'player_character'
              ? "A character you'll control during the game"
              : "A non-player character (can be assigned to audience members)"
          }
        >
          {getAvailableCharacterTypes().map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>

        {/* User Selector (for GMs creating player characters) */}
        {showUserSelector && (
          <Select
            label="Assign to Player"
            id="user_id"
            value={formData.user_id || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              user_id: e.target.value ? Number(e.target.value) : undefined
            }))}
            required
            helperText="Select which player will control this character"
          >
            <option value="">Select a player...</option>
            {players.map((player) => (
              <option key={player.user_id} value={player.user_id}>
                {player.username}
              </option>
            ))}
          </Select>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createCharacterMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={createCharacterMutation.isPending}
            disabled={!formData.name.trim() || (showUserSelector && !formData.user_id)}
            data-testid="character-submit-button"
            data-faro-user-action-name="create-character"
          >
            Create Character
          </Button>
        </div>

        {/* Error Display */}
        {createCharacterMutation.error && (
          <Alert variant="danger" className="mt-3">
            Failed to create character: {
              createCharacterMutation.error instanceof Error
                ? createCharacterMutation.error.message
                : 'Unknown error'
            }
          </Alert>
        )}
      </form>
    </Modal>
  );
}
