import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { ApplyToGameModal } from '../ApplyToGameModal';

vi.mock('../../lib/api', () => ({
  apiClient: {
    auth: { getCurrentUser: vi.fn().mockResolvedValue(null) },
    games: {
      applyToGame: vi.fn(),
    },
  },
}));

import { apiClient } from '../../lib/api';

const defaultProps = {
  gameId: 10,
  gameTitle: 'Dragon Quest',
  isOpen: true,
  onClose: vi.fn(),
  onApplicationSubmitted: vi.fn(),
};

describe('ApplyToGameModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with game title and submit button', () => {
    renderWithProviders(<ApplyToGameModal {...defaultProps} />);
    expect(screen.getByText(/apply to dragon quest/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-application')).toBeInTheDocument();
  });

  it('shows role select for non-audienceOnly mode', () => {
    renderWithProviders(<ApplyToGameModal {...defaultProps} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('hides role select in audienceOnly mode', () => {
    renderWithProviders(<ApplyToGameModal {...defaultProps} audienceOnly />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-application')).toHaveTextContent(/join as audience/i);
  });

  it('shows auto-accept notice when autoAcceptAudience and role is audience', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApplyToGameModal {...defaultProps} autoAcceptAudience />);
    // Switch to audience role
    await user.selectOptions(screen.getByRole('combobox'), 'audience');
    expect(screen.getByTestId('auto-accept-notice')).toBeInTheDocument();
  });

  it('does not show auto-accept notice for player role', () => {
    renderWithProviders(<ApplyToGameModal {...defaultProps} autoAcceptAudience />);
    expect(screen.queryByTestId('auto-accept-notice')).not.toBeInTheDocument();
  });

  it('calls applyToGame and fires callbacks on successful submit', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.games.applyToGame).mockResolvedValue(undefined as never);
    const onApplicationSubmitted = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ApplyToGameModal
        {...defaultProps}
        onApplicationSubmitted={onApplicationSubmitted}
        onClose={onClose}
      />
    );
    await user.type(screen.getByRole('textbox', { name: /application message/i }), 'I love this genre!');
    await user.click(screen.getByTestId('submit-application'));
    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalledWith(10, {
        role: 'player',
        message: 'I love this genre!',
      });
      expect(onApplicationSubmitted).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('omits empty message from submission', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.games.applyToGame).mockResolvedValue(undefined as never);
    renderWithProviders(<ApplyToGameModal {...defaultProps} />);
    await user.click(screen.getByTestId('submit-application'));
    await waitFor(() => {
      expect(apiClient.games.applyToGame).toHaveBeenCalledWith(10, {
        role: 'player',
        message: undefined,
      });
    });
  });

  it('shows error alert on API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.games.applyToGame).mockRejectedValue(new Error('Already applied'));
    renderWithProviders(<ApplyToGameModal {...defaultProps} />);
    await user.click(screen.getByTestId('submit-application'));
    await waitFor(() => {
      expect(screen.getByText('Already applied')).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked (not submitting)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ApplyToGameModal {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
