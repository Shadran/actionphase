import { useMemo } from 'react';
import { useCharacterOwnership } from './useCharacterOwnership';
import type { Character } from '../types/characters';

export interface CharacterSheetPermissions {
  /**
   * Whether the current user controls this character. Covers player characters
   * and assigned NPCs (via ownership), plus the GM's implicit ownership of
   * unassigned NPCs.
   */
  isUserCharacter: (character: Character) => boolean;
  /** Whether the user can open the sheet (see at least public info). */
  canView: (character: Character) => boolean;
  /** Whether the user can edit sheet bio/notes fields. */
  canEdit: (character: Character) => boolean;
  /** Whether the user can edit stats (abilities, skills, items, currency) — GM only. */
  canEditStats: () => boolean;
}

/**
 * Character-sheet view/edit permission logic, shared by any surface that opens
 * the character sheet (the Characters tab, the common-room Utility Drawer, …).
 *
 * Note: "GM" here means the primary GM (`userRole === 'gm'`), matching the
 * original Characters-tab semantics — co-GMs do not implicitly own NPCs or edit
 * stats through this hook.
 *
 * @param gameId - the game whose characters these are
 * @param userRole - the user's role string ('gm' | 'player' | 'audience' | …)
 * @param gameState - current game state (editing disabled when completed/cancelled)
 */
export function useCharacterSheetPermissions(
  gameId: number,
  userRole: string | undefined,
  gameState: string | undefined
): CharacterSheetPermissions {
  const { isUserCharacter: isUserCharacterById } = useCharacterOwnership(gameId);

  return useMemo(() => {
    const isEditableState =
      gameState !== 'completed' && gameState !== 'cancelled';

    const isUserCharacter = (character: Character): boolean => {
      // Controllable characters (player characters and assigned NPCs).
      if (isUserCharacterById(character.id)) return true;
      // GMs implicitly own unassigned NPCs.
      if (
        character.character_type === 'npc' &&
        !character.assigned_user_id &&
        userRole === 'gm'
      ) {
        return true;
      }
      return false;
    };

    const canView = (character: Character): boolean => {
      if (userRole === 'gm' || userRole === 'audience') return true;
      if (isUserCharacter(character)) return true;
      // Anyone can view approved characters (public information only).
      if (character.status === 'approved') return true;
      return false;
    };

    const canEdit = (character: Character): boolean => {
      if (!isEditableState) return false;
      if (userRole === 'gm') return true;
      // Users can edit their own characters (regardless of approval status).
      return isUserCharacter(character);
    };

    const canEditStats = (): boolean => isEditableState && userRole === 'gm';

    return { isUserCharacter, canView, canEdit, canEditStats };
  }, [isUserCharacterById, userRole, gameState]);
}
