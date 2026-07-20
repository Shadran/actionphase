import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Character } from '../../types/characters';
import type { GamePhase } from '../../types/phases';
import type { UserGameRole } from '../../contexts/GameContext';
import type { CommentReadMode } from '../../lib/api/auth';

/**
 * Shared context passed to every Utility Drawer panel and to each utility's
 * `isAvailable` gate. Assembled by CommonRoom from GameContext + its own props,
 * so panels stay decoupled from how that data is sourced.
 */
export interface UtilityContext {
  gameId: number;
  currentPhase?: GamePhase | null;
  isGM: boolean;
  isAudience: boolean;
  isGameCompleted: boolean;
  /** User's role in the game — used to compute sheet view/edit permissions. */
  userRole: UserGameRole;
  /** Current game state, e.g. 'in_progress' | 'completed'. */
  gameState: string;
  /** Whether the game is in anonymous mode. */
  isAnonymous: boolean;
  /** Characters the current user controls in this game (may be empty for GM/audience). */
  userCharacters: Character[];
  /** All characters in the game (for reference/lookup within panels). */
  allGameCharacters: Character[];
  /**
   * Open the standard character-sheet modal for a character, as if the user
   * clicked "View/Edit Sheet" on the Characters tab. Closes the drawer first,
   * so the modal stacks cleanly over the common room.
   */
  openCharacterSheet: (characterId: number) => void;
  /** Close the Utility Drawer, e.g. after a panel action completes. */
  closeDrawer: () => void;
  /** The current user's comment read tracking mode ('auto' or 'manual'). */
  commentReadMode: CommentReadMode;
}

/** Props every utility panel receives when rendered inside the drawer. */
export interface UtilityPanelProps {
  ctx: UtilityContext;
}

/**
 * Describes a single utility available in the common-room Utility Drawer.
 *
 * Adding a new utility is a matter of appending one descriptor to the registry
 * (registry.ts) and supplying a Panel component — no changes to the drawer
 * container or CommonRoom are required.
 */
export interface CommonRoomUtility {
  /** Stable identifier, e.g. 'character-sheet'. */
  id: string;
  /** Short label shown in the utility list and as the panel title. */
  label: string;
  /** One-line description shown under the label in the list view. */
  description: string;
  icon: LucideIcon;
  /**
   * Whether this utility should be offered in the current context.
   * e.g. the character sheet is only useful when the user controls a character.
   */
  isAvailable: (ctx: UtilityContext) => boolean;
  /** The panel body rendered inside the drawer when this utility is selected. */
  Panel: ComponentType<UtilityPanelProps>;
}
