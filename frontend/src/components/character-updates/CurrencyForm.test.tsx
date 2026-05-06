import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencyForm } from './CurrencyForm';

describe('CurrencyForm', () => {
  describe('Submit guard', () => {
    it('does not call onSubmit when currency type is empty', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          submitLabel="Add Currency"
        />
      );

      // Leave type empty, only fill amount
      const amountInput = screen.getByLabelText(/^amount$/i);
      await user.clear(amountInput);
      await user.type(amountInput, '10');

      await user.click(screen.getByRole('button', { name: /add currency/i }));

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Decimal support', () => {
    it('accepts decimal amount', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <CurrencyForm
          onSubmit={onSubmit}
          onCancel={vi.fn()}
          submitLabel="Add Currency"
        />
      );

      await user.type(screen.getByLabelText(/currency type/i), 'Gold');

      const amountInput = screen.getByLabelText(/^amount$/i);
      await user.clear(amountInput);
      await user.type(amountInput, '1.5');

      await user.click(screen.getByRole('button', { name: /add currency/i }));

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1.5 })
      );
    });
  });

  describe('Description field uses markdown editor', () => {
    it('renders Write/Preview tabs for description field', () => {
      render(
        <CurrencyForm
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          submitLabel="Add Currency"
        />
      );

      // CommentEditor renders Write/Preview tabs — plain Input/Textarea does not
      expect(screen.getByRole('button', { name: /^write$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^preview$/i })).toBeInTheDocument();
    });

    it('pre-populates description editor with initial value', () => {
      render(
        <CurrencyForm
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          submitLabel="Add Currency"
          initialValues={{ description: 'Earned from quests' }}
        />
      );

      expect(screen.getByDisplayValue('Earned from quests')).toBeInTheDocument();
    });
  });
});
