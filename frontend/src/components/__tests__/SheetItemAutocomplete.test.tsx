import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SheetItemAutocomplete } from '../SheetItemAutocomplete';
import type { SheetItem } from '../../hooks/useCharacterSheetItems';

const items: SheetItem[] = [
  { id: 'a1', name: 'Fire Bolt', type: 'ability', description: 'Deals fire damage' },
  { id: 's1', name: 'Stealth', type: 'skill' },
  { id: 'i1', name: 'Longbow', type: 'item' },
];

const pos = { top: 100, left: 200 };

describe('SheetItemAutocomplete', () => {
  it('renders all items when query is empty', () => {
    render(
      <SheetItemAutocomplete items={items} query="" position={pos} onSelect={vi.fn()} selectedIndex={0} />
    );
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.getByText('Stealth')).toBeInTheDocument();
    expect(screen.getByText('Longbow')).toBeInTheDocument();
  });

  it('filters items by query', () => {
    render(
      <SheetItemAutocomplete items={items} query="bolt" position={pos} onSelect={vi.fn()} selectedIndex={0} />
    );
    expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
    expect(screen.queryByText('Stealth')).not.toBeInTheDocument();
  });

  it('shows no items message when filter matches nothing', () => {
    render(
      <SheetItemAutocomplete items={items} query="xyzzy" position={pos} onSelect={vi.fn()} selectedIndex={0} />
    );
    expect(screen.getByText('No items found')).toBeInTheDocument();
  });

  it('calls onSelect with the clicked item', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SheetItemAutocomplete items={items} query="" position={pos} onSelect={onSelect} selectedIndex={0} />
    );
    await user.click(screen.getByText('Stealth'));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it('applies selected highlight to the correct index', () => {
    render(
      <SheetItemAutocomplete items={items} query="" position={pos} onSelect={vi.fn()} selectedIndex={1} />
    );
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('shows type badges', () => {
    render(
      <SheetItemAutocomplete items={items} query="" position={pos} onSelect={vi.fn()} selectedIndex={0} />
    );
    expect(screen.getByText('ability')).toBeInTheDocument();
    expect(screen.getByText('skill')).toBeInTheDocument();
    expect(screen.getByText('item')).toBeInTheDocument();
  });
});
