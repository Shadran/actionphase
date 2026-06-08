import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders children when open', () => {
    render(
      <Drawer open={true} onClose={vi.fn()} title="My Sheet">
        <p>Drawer content</p>
      </Drawer>
    );
    expect(screen.getByText('Drawer content')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="My Sheet">
        <p>Hidden content</p>
      </Drawer>
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
  });

  it('renders title', () => {
    render(
      <Drawer open={true} onClose={vi.fn()} title="Character Sheet">
        <p>Content</p>
      </Drawer>
    );
    expect(screen.getByText('Character Sheet')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Sheet">
        <p>Content</p>
      </Drawer>
    );
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { baseElement } = render(
      <Drawer open={true} onClose={onClose}>
        <p>Content</p>
      </Drawer>
    );
    // Click the backdrop (the fixed overlay div behind the panel)
    const backdrop = baseElement.querySelector('[aria-hidden="true"]');
    if (backdrop) await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
