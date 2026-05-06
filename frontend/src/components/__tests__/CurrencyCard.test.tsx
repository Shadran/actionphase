import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencyCard } from '../CurrencyCard';
import type { CurrencyEntry } from '../../types/characters';

const mockCurrency: CurrencyEntry = {
  id: '1',
  type: 'Gold',
  amount: 1000,
  description: 'Standard currency',
};

describe('CurrencyCard', () => {
  describe('Display - View Mode', () => {
    it('displays currency type and amount', () => {
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Gold')).toBeInTheDocument();
      expect(screen.getByText('1,000')).toBeInTheDocument();
    });

    it('displays description when provided', () => {
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('Standard currency')).toBeInTheDocument();
    });

    it('hides description when not provided', () => {
      const currencyWithoutDesc = { ...mockCurrency, description: undefined };
      render(
        <CurrencyCard
          currency={currencyWithoutDesc}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('Standard currency')).not.toBeInTheDocument();
    });
  });

  describe('Edit Controls', () => {
    it('hides edit buttons when canEdit is false', () => {
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.queryByText('✎')).not.toBeInTheDocument();
      expect(screen.queryByText('🗑')).not.toBeInTheDocument();
    });

    it('shows edit buttons when canEdit is true', () => {
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('✎')).toBeInTheDocument();
      expect(screen.getByText('🗑')).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode when edit button clicked', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByDisplayValue('Gold')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Standard currency')).toBeInTheDocument();
    });

    it('shows save and cancel buttons in edit mode', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      expect(screen.getByText('✓')).toBeInTheDocument();
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('allows editing currency type', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const typeInput = screen.getByDisplayValue('Gold');
      await user.clear(typeInput);
      await user.type(typeInput, 'Silver');

      expect(screen.getByDisplayValue('Silver')).toBeInTheDocument();
    });

    it('allows editing amount', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const amountInput = screen.getByDisplayValue('1000');
      await user.clear(amountInput);
      await user.type(amountInput, '2000');

      expect(screen.getByDisplayValue('2000')).toBeInTheDocument();
    });

    it('allows editing description', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const descInput = screen.getByDisplayValue('Standard currency');
      await user.clear(descInput);
      await user.type(descInput, 'Updated notes');

      expect(screen.getByDisplayValue('Updated notes')).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('calls onUpdate with modified values when saved', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const typeInput = screen.getByDisplayValue('Gold');
      await user.clear(typeInput);
      await user.type(typeInput, 'Platinum');

      const amountInput = screen.getByDisplayValue('1000');
      await user.clear(amountInput);
      await user.type(amountInput, '5000');

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'Platinum',
        amount: 5000,
        description: 'Standard currency',
      });
    });

    it('exits edit mode after save', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      await user.click(screen.getByText('✓'));

      expect(screen.queryByText('✓')).not.toBeInTheDocument();
      expect(screen.getByText('✎')).toBeInTheDocument();
    });

    it('sets description to undefined when empty', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const descInput = screen.getByDisplayValue('Standard currency');
      await user.clear(descInput);

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'Gold',
        amount: 1000,
        description: undefined,
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('reverts changes when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const typeInput = screen.getByDisplayValue('Gold');
      await user.clear(typeInput);
      await user.type(typeInput, 'Changed');

      await user.click(screen.getByText('✕'));

      // Should show original value
      expect(screen.getByText('Gold')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Changed')).not.toBeInTheDocument();
    });

    it('does not call onUpdate when cancelled', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      const typeInput = screen.getByDisplayValue('Gold');
      await user.clear(typeInput);
      await user.type(typeInput, 'Changed');

      await user.click(screen.getByText('✕'));

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('exits edit mode when cancelled', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      await user.click(screen.getByText('✕'));

      expect(screen.queryByText('✕')).not.toBeInTheDocument();
      expect(screen.getByText('✎')).toBeInTheDocument();
    });
  });

  describe('Remove Functionality', () => {
    it('calls onRemove when delete button clicked', async () => {
      const onRemove = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={onRemove}
        />
      );

      await user.click(screen.getByText('🗑'));

      expect(onRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe('Decimal Amount Support', () => {
    it('accepts decimal amount input', async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={onUpdate}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));
      const amountInput = screen.getByDisplayValue('1000');
      await user.clear(amountInput);
      await user.type(amountInput, '1.5');

      await user.click(screen.getByText('✓'));

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1.5 })
      );
    });
  });

  describe('Number Formatting', () => {
    it('formats large amounts with thousands separators', () => {
      const largeCurrency = { ...mockCurrency, amount: 1234567 };
      render(
        <CurrencyCard
          currency={largeCurrency}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    it('handles zero amount correctly', () => {
      const zeroCurrency = { ...mockCurrency, amount: 0 };
      render(
        <CurrencyCard
          currency={zeroCurrency}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('Description uses markdown', () => {
    it('renders markdown bold syntax in description as HTML, not raw text', () => {
      const currency = { ...mockCurrency, description: '**Bold note**' };
      render(
        <CurrencyCard
          currency={currency}
          canEdit={false}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      // MarkdownPreview renders **text** as <strong>, not as literal asterisks
      expect(screen.queryByText('**Bold note**')).not.toBeInTheDocument();
      expect(screen.getByText('Bold note')).toBeInTheDocument();
    });

    it('renders Write/Preview tabs in edit mode for description field', async () => {
      const user = userEvent.setup();
      render(
        <CurrencyCard
          currency={mockCurrency}
          canEdit={true}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
        />
      );

      await user.click(screen.getByText('✎'));

      // CommentEditor renders Write/Preview tabs — plain Input does not
      expect(screen.getByRole('button', { name: /^write$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^preview$/i })).toBeInTheDocument();
    });
  });
});
