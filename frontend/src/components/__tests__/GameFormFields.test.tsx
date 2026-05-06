import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameFormFields } from '../GameFormFields';
import type { GameFormData } from '../GameFormFields';

const baseFormData: GameFormData = {
  title: '',
  description: '',
  genre: '',
  max_players: '',
  recruitment_deadline: '',
  start_date: '',
  end_date: '',
  is_anonymous: false,
  auto_accept_audience: false,
  allow_group_conversations: true,
  portrait_avatars: true,
};

describe('GameFormFields', () => {
  describe('Checkbox labels', () => {
    it('shows clean label text without parenthetical clarifications', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      expect(screen.getAllByText('Anonymous Mode').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Auto-Accept Audience Members').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Allow Group Conversations').length).toBeGreaterThan(0);
    });
  });

  describe('Help tooltips on settings', () => {
    it('renders help tooltip for Anonymous Mode with descriptive text', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      const tooltips = screen.getAllByRole('tooltip');
      const tooltipTexts = tooltips.map((t) => t.textContent ?? '');

      expect(tooltipTexts.some((t) => /character ownership/i.test(t))).toBe(true);
    });

    it('renders help tooltip for Auto-Accept Audience Members', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      const tooltips = screen.getAllByRole('tooltip');
      const tooltipTexts = tooltips.map((t) => t.textContent ?? '');

      expect(tooltipTexts.some((t) => /automatically approved/i.test(t))).toBe(true);
    });

    it('renders help tooltip for Allow Group Conversations', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      const tooltips = screen.getAllByRole('tooltip');
      const tooltipTexts = tooltips.map((t) => t.textContent ?? '');

      expect(tooltipTexts.some((t) => /3 or more participants/i.test(t))).toBe(true);
    });

    it('renders help tooltip for Avatar Style explaining both options', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      const tooltips = screen.getAllByRole('tooltip');
      const tooltipTexts = tooltips.map((t) => t.textContent ?? '');

      expect(tooltipTexts.some((t) => /circular/i.test(t) && /portrait/i.test(t))).toBe(true);
    });

    it('renders exactly four setting tooltips', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      expect(screen.getAllByRole('tooltip')).toHaveLength(4);
    });
  });

  describe('Avatar Style radio buttons', () => {
    it('renders Circular and Portrait radio options', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Circular' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Portrait' })).toBeInTheDocument();
    });

    it('selects Portrait when portrait_avatars is true', () => {
      render(<GameFormFields formData={{ ...baseFormData, portrait_avatars: true }} onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Portrait' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Circular' })).not.toBeChecked();
    });

    it('selects Circular when portrait_avatars is false', () => {
      render(<GameFormFields formData={{ ...baseFormData, portrait_avatars: false }} onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Circular' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Portrait' })).not.toBeChecked();
    });

    it('calls onChange with true when Portrait is selected', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<GameFormFields formData={{ ...baseFormData, portrait_avatars: false }} onChange={onChange} />);

      await user.click(screen.getByRole('radio', { name: 'Portrait' }));

      expect(onChange).toHaveBeenCalledWith('portrait_avatars', true);
    });

    it('calls onChange with false when Circular is selected', async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<GameFormFields formData={{ ...baseFormData, portrait_avatars: true }} onChange={onChange} />);

      await user.click(screen.getByRole('radio', { name: 'Circular' }));

      expect(onChange).toHaveBeenCalledWith('portrait_avatars', false);
    });

    it('defaults to Portrait when portrait_avatars is undefined', () => {
      const formDataNoAvatarPref = { ...baseFormData, portrait_avatars: undefined };
      render(<GameFormFields formData={formDataNoAvatarPref} onChange={vi.fn()} />);

      expect(screen.getByRole('radio', { name: 'Portrait' })).toBeChecked();
    });
  });
});
