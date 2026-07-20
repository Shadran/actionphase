import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import type { UtilityPanelProps } from '../types';

/**
 * Launches the standard character-sheet modal from the Utility Drawer, exactly
 * as clicking "View/Edit Sheet" on the Characters tab does.
 *
 * - Exactly one controlled character: opens that sheet immediately (no UI here).
 * - More than one: shows a picker; selecting a character opens its sheet.
 *
 * Opening a sheet closes the drawer (handled by ctx.openCharacterSheet) so the
 * modal stacks cleanly over the common room.
 */
export function CharacterSheetPanel({ ctx }: UtilityPanelProps) {
  const { userCharacters, openCharacterSheet } = ctx;

  // With a single character there is nothing to choose — open it directly.
  const soleCharacterId =
    userCharacters.length === 1 ? userCharacters[0].id : null;

  useEffect(() => {
    if (soleCharacterId !== null) {
      openCharacterSheet(soleCharacterId);
    }
    // Only fire on mount / when the sole character changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soleCharacterId]);

  if (userCharacters.length === 0) {
    return (
      <p className="text-sm text-content-secondary text-center py-6 px-4">
        You don't control a character in this game.
      </p>
    );
  }

  if (soleCharacterId !== null) {
    // The effect above opens the sheet; render nothing meaningful meanwhile.
    return null;
  }

  return (
    <ul className="p-2" data-testid="character-sheet-picker">
      {userCharacters.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => openCharacterSheet(c.id)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:surface-raised transition-colors text-left group"
            data-testid={`character-sheet-open-${c.id}`}
            data-faro-user-action-name="open-character-sheet-from-drawer"
          >
            <span className="flex-1 min-w-0 text-sm font-medium text-content-primary truncate group-hover:text-interactive-primary">
              {c.name}
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-content-tertiary" />
          </button>
        </li>
      ))}
    </ul>
  );
}
