import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpTooltip } from './HelpTooltip';
import { Checkbox } from './Checkbox';

describe('HelpTooltip', () => {
  describe('Rendering', () => {
    it('renders a tooltip role element with the help text', () => {
      render(<HelpTooltip text="Detailed explanation here" />);

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('tooltip element contains the provided text', () => {
      render(<HelpTooltip text="Detailed explanation here" />);

      // The tooltip span contains the text content
      expect(screen.getByText('Detailed explanation here')).toBeInTheDocument();
    });

    it('icon has aria-label set to the help text', () => {
      const { container } = render(<HelpTooltip text="Some help text" />);

      const icon = container.querySelector('svg[aria-label]');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-label')).toBe('Some help text');
    });
  });

  describe('Checkbox integration', () => {
    it('renders tooltip alongside the checkbox label when helpText is provided', () => {
      render(
        <Checkbox
          label="My Setting"
          helpText="This is what the setting does"
          checked={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('My Setting')).toBeInTheDocument();
      expect(screen.getByRole('tooltip')).toHaveTextContent('This is what the setting does');
    });

    it('does not render tooltip when helpText is omitted', () => {
      render(
        <Checkbox
          label="My Setting"
          checked={false}
          onChange={() => {}}
        />
      );

      expect(screen.getByText('My Setting')).toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
