import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { AddPlayerModal } from '../AddPlayerModal';

vi.mock('../../lib/api', () => ({
  apiClient: {
    auth: {
      getCurrentUser: vi.fn().mockResolvedValue(null),
      searchUsers: vi.fn(),
    },
    games: {},
  },
}));

vi.mock('../../hooks/usePlayerManagement', () => ({
  useAddPlayer: vi.fn(),
}));

import { apiClient } from '../../lib/api';
import { useAddPlayer } from '../../hooks/usePlayerManagement';

const makeMutation = (overrides = {}) => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  reset: vi.fn(),
  ...overrides,
});

describe('AddPlayerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAddPlayer).mockReturnValue(makeMutation() as never);
  });

  it('renders modal with search input', () => {
    renderWithProviders(
      <AddPlayerModal gameId={10} isOpen onClose={vi.fn()} />
    );
    expect(screen.getByPlaceholderText(/type username to search/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add player/i })).toBeDisabled();
  });

  it('shows search results dropdown after debounce', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [{ id: 5, username: 'alice', created_at: '2024-01-01T00:00:00Z' }] },
    } as never);

    renderWithProviders(<AddPlayerModal gameId={10} isOpen onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/type username to search/i), 'ali');

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('selects a user from dropdown and enables Add Player button', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [{ id: 5, username: 'alice', created_at: '2024-01-01T00:00:00Z' }] },
    } as never);

    renderWithProviders(<AddPlayerModal gameId={10} isOpen onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/type username to search/i), 'ali');
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument(), { timeout: 500 });
    await user.click(screen.getByText('alice'));

    expect(screen.getByRole('button', { name: /add player/i })).not.toBeDisabled();
    expect(screen.getByText(/selected: alice/i)).toBeInTheDocument();
  });

  it('calls addPlayer.mutateAsync on submit and closes modal', async () => {
    const user = userEvent.setup();
    const addMutation = makeMutation();
    vi.mocked(useAddPlayer).mockReturnValue(addMutation as never);
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [{ id: 5, username: 'alice', created_at: '2024-01-01T00:00:00Z' }] },
    } as never);
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderWithProviders(
      <AddPlayerModal gameId={10} isOpen onClose={onClose} onSuccess={onSuccess} />
    );

    await user.type(screen.getByPlaceholderText(/type username to search/i), 'ali');
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument(), { timeout: 500 });
    await user.click(screen.getByText('alice'));
    await user.click(screen.getByRole('button', { name: /add player/i }));

    await waitFor(() => {
      expect(addMutation.mutateAsync).toHaveBeenCalledWith(5);
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows no results message when search returns empty', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [] },
    } as never);

    renderWithProviders(<AddPlayerModal gameId={10} isOpen onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/type username to search/i), 'xyz');

    await waitFor(() => {
      expect(screen.getByText(/no users found matching "xyz"/i)).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddPlayerModal gameId={10} isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
