import { useEffect, useRef } from 'react';
import type { SheetItem } from '../hooks/useCharacterSheetItems';

const TYPE_LABELS: Record<SheetItem['type'], string> = {
  ability: 'ability',
  skill: 'skill',
  item: 'item',
};

const TYPE_COLOR: Record<SheetItem['type'], string> = {
  ability: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  skill: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  item: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
};

interface SheetItemAutocompleteProps {
  items: SheetItem[];
  query: string;
  position: { top: number; left: number };
  onSelect: (item: SheetItem) => void;
  selectedIndex: number;
  onClose: () => void;
}

/**
 * SheetItemAutocomplete - dropdown for the %% trigger in CommentEditor.
 *
 * Shows all sheet items when query is empty; filters by name when the user
 * types after %%. Follows the same pattern as CharacterAutocomplete.
 */
export function SheetItemAutocomplete({
  items,
  query,
  position,
  onSelect,
  selectedIndex,
  onClose: _onClose,
}: SheetItemAutocompleteProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = query
    ? items.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      const el = listRef.current.children[selectedIndex] as HTMLElement;
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    minWidth: '220px',
    maxWidth: '320px',
  };

  if (filtered.length === 0) {
    return (
      <div
        className="z-50 surface-base border border-theme-default rounded-md shadow-lg py-2 px-3 text-sm text-content-tertiary"
        style={style}
      >
        No items found
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      role="listbox"
      className="z-50 surface-base border border-theme-default rounded-md shadow-lg py-1 max-h-56 overflow-y-auto"
      style={style}
    >
      {filtered.map((item, index) => (
        <li
          key={item.id}
          role="option"
          aria-selected={index === selectedIndex}
          onClick={() => onSelect(item)}
          className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-interactive-primary-subtle text-interactive-primary'
              : 'hover:surface-raised text-content-primary'
          }`}
        >
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLOR[item.type]}`}>
            {TYPE_LABELS[item.type]}
          </span>
          <span className="font-medium truncate">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}
