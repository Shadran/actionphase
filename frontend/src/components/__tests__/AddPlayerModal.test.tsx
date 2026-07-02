import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { AddParticipantModal } from '../AddParticipantModal';
import { AddPlayerModal } from '../AddPlayerModal';
import { AddAudienceMemberModal } from '../AddAudienceMemberModal';

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
  useAddParticipant: vi.fn(),
}));

import { apiClient } from '../../lib/api';
import { useAddParticipant } from '../../hooks/usePlayerManagement';

const makeMutation = (overrides = {}) => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  reset: vi.fn(),
  ...overrides,
});

describe('AddParticipantModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.mocked(useAddParticipant).mockReturnValue(makeMutation() as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders player title and button label for role=player', () => {
    renderWithProviders(<AddParticipantModal gameId={10} role="player" isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Add Player Directly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add player/i })).toBeDisabled();
  });

  it('renders audience title and button label for role=audience', () => {
    renderWithProviders(<AddParticipantModal gameId={10} role="audience" isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Add Audience Member Directly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add audience member/i })).toBeDisabled();
  });

  it('passes correct role to useAddParticipant', () => {
    renderWithProviders(<AddParticipantModal gameId={10} role="audience" isOpen onClose={vi.fn()} />);
    expect(vi.mocked(useAddParticipant)).toHaveBeenCalledWith(10, 'audience');
  });

  it('shows search results dropdown after debounce', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [{ id: 5, username: 'alice', created_at: '2024-01-01T00:00:00Z' }] },
    } as never);

    renderWithProviders(<AddParticipantModal gameId={10} role="player" isOpen onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/type username to search/i), 'ali');
    await act(async () => { vi.runAllTimers(); });

    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('selects a user from dropdown and enables submit button', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [{ id: 5, username: 'alice', created_at: '2024-01-01T00:00:00Z' }] },
    } as never);

    renderWithProviders(<AddParticipantModal gameId={10} role="player" isOpen onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/type username to search/i), 'ali');
    await act(async () => { vi.runAllTimers(); });
    await user.click(screen.getByText('alice'));

    expect(screen.getByRole('button', { name: /add player/i })).not.toBeDisabled();
    expect(screen.getByText(/selected: alice/i)).toBeInTheDocument();
  });

  it('calls mutateAsync with user id on submit and closes modal', async () => {
    const user = userEvent.setup();
    const mutation = makeMutation();
    vi.mocked(useAddParticipant).mockReturnValue(mutation as never);
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [{ id: 5, username: 'alice', created_at: '2024-01-01T00:00:00Z' }] },
    } as never);
    const onClose = vi.fn();
    const onSuccess = vi.fn();

    renderWithProviders(
      <AddParticipantModal gameId={10} role="player" isOpen onClose={onClose} onSuccess={onSuccess} />
    );

    await user.type(screen.getByPlaceholderText(/type username to search/i), 'ali');
    await act(async () => { vi.runAllTimers(); });
    await user.click(screen.getByText('alice'));
    await user.click(screen.getByRole('button', { name: /add player/i }));

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith(5);
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('shows no results message when search returns empty', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.auth.searchUsers).mockResolvedValue({
      data: { users: [] },
    } as never);

    renderWithProviders(<AddParticipantModal gameId={10} role="player" isOpen onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText(/type username to search/i), 'xyz');
    await act(async () => { vi.runAllTimers(); });

    expect(screen.getByText(/no users found matching "xyz"/i)).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AddParticipantModal gameId={10} role="player" isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AddPlayerModal wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAddParticipant).mockReturnValue(makeMutation() as never);
  });

  it('renders with player role', () => {
    renderWithProviders(<AddPlayerModal gameId={10} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Add Player Directly')).toBeInTheDocument();
  });
});

describe('AddAudienceMemberModal wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAddParticipant).mockReturnValue(makeMutation() as never);
  });

  it('renders with audience role', () => {
    renderWithProviders(<AddAudienceMemberModal gameId={10} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Add Audience Member Directly')).toBeInTheDocument();
  });
});
