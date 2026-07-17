import { UserRound, Dices } from 'lucide-react';
import type { CommonRoomUtility } from './types';
import { CharacterSheetPanel } from './panels/CharacterSheetPanel';
import { DiceRollerPanel } from './panels/DiceRollerPanel';

/**
 * The set of utilities offered by the common-room Utility Drawer.
 *
 * To add a utility: append a descriptor here and supply its Panel component.
 * No changes to UtilityDrawer or CommonRoom are needed.
 */
export const COMMON_ROOM_UTILITIES: CommonRoomUtility[] = [
  {
    id: 'character-sheet',
    label: 'Character Sheet',
    description: 'View your abilities, skills, and inventory.',
    icon: UserRound,
    // Only useful when the user controls at least one character.
    isAvailable: (ctx) => ctx.userCharacters.length > 0,
    Panel: CharacterSheetPanel,
  },
  {
    id: 'dice-roller',
    label: 'Dice Roller',
    description: 'Roll dice and copy the result into a reply.',
    icon: Dices,
    // Available to everyone in the room.
    isAvailable: () => true,
    Panel: DiceRollerPanel,
  },
];
