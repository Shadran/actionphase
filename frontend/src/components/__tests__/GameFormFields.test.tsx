import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  portrait_avatars: false,
};

describe('GameFormFields', () => {
  describe('Checkbox labels', () => {
    it('shows clean label text without parenthetical clarifications', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      // Use text matcher to find the label text nodes directly
      expect(screen.getAllByText('Anonymous Mode').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Auto-Accept Audience Members').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Allow Group Conversations').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Portrait Avatars').length).toBeGreaterThan(0);
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

    it('renders help tooltip for Portrait Avatars', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      const tooltips = screen.getAllByRole('tooltip');
      const tooltipTexts = tooltips.map((t) => t.textContent ?? '');

      expect(tooltipTexts.some((t) => /float to the left/i.test(t))).toBe(true);
    });

    it('renders exactly four setting tooltips', () => {
      render(<GameFormFields formData={baseFormData} onChange={vi.fn()} />);

      expect(screen.getAllByRole('tooltip')).toHaveLength(4);
    });
  });
});
