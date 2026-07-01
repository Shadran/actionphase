import { useEffect, useRef } from 'react';
import type { Character } from '../types/characters';

interface CharacterAutocompleteProps {
  characters: Character[];
  query: string;
  position: { top: number; left: number };
  onSelect: (character: Character) => void;
  selectedIndex: number;
  onClose: () => void;
}

/**
 * CharacterAutocomplete Component
 *
 * Dropdown showing filterable list of characters for mention autocomplete.
 * Triggered when user types @ in the comment editor.
 *
 * Features:
 * - Filters characters by name matching query
 * - Keyboard navigation (arrow keys, enter, escape)
 * - Click to select
 * - Position relative to cursor in textarea
 */
export function CharacterAutocomplete({
  characters,
  query,
  position,
  onSelect,
  selectedIndex,
  onClose: _onClose,
}: CharacterAutocompleteProps) {
  const listRef = useRef<HTMLUListElement>(null);

  // Filter characters based on query (space-insensitive matching)
  // This allows "@TestPlayer1" to match "Test Player 1 Character"
  const filteredCharacters = characters.filter((char) =>
    char.name.toLowerCase().replace(/\s+/g, '').includes(query.toLowerCase().replace(/\s+/g, ''))
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement && typeof selectedElement.scrollIntoView === 'function') {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // If no matches, show "no results" message
  if (filteredCharacters.length === 0) {
    return (
      <div
        className="z-50 surface-base border border-theme-default rounded-md shadow-lg py-2 px-3 text-sm text-content-tertiary"
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: '200px',
        }}
      >
        No characters found
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      role="listbox"
      className="z-50 surface-base border border-theme-default rounded-md shadow-lg py-1 max-h-48 overflow-y-auto"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '200px',
      }}
    >
      {filteredCharacters.map((character, index) => (
        <li
          key={character.id}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(character)}
          className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-interactive-primary-subtle text-interactive-primary'
              : 'hover:surface-raised text-content-primary'
          }`}
        >
          {character.avatar_url && (
            <img
              src={character.avatar_url}
              alt={character.name}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="font-medium">{character.name}</span>
        </li>
      ))}
    </ul>
  );
}

