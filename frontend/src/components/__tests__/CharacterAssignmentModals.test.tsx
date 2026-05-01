import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { AssignNPCModal } from '../AssignNPCModal';
import { ReassignCharacterModal } from '../ReassignCharacterModal';
import type { Character } from '../../types/characters';

vi.mock('../../hooks/useCharacters', () => ({
  useAssignNPC: vi.fn(),
}));

vi.mock('../../hooks/usePlayerManagement', () => ({
  useReassignCharacter: vi.fn(),
  useGameParticipants: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contexts/AuthContext')>();
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

import { useAssignNPC } from '../../hooks/useCharacters';
import { useReassignCharacter, useGameParticipants } from '../../hooks/usePlayerManagement';
import { useAuth } from '../../contexts/AuthContext';

const makeMutation = (overrides = {}) => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  reset: vi.fn(),
  ...overrides,
});

const baseCharacter: Character = {
  id: 7,
  name: 'Elara',
  game_id: 10,
  character_type: 'npc',
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  original_owner_username: 'gmuser',
} as unknown as Character;

const audienceParticipant = { id: 1, user_id: 99, username: 'watcher', role: 'audience' };
const playerParticipant = { id: 2, user_id: 42, username: 'player1', role: 'player' };

describe('AssignNPCModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAssignNPC).mockReturnValue(makeMutation() as never);
    vi.mocked(useGameParticipants).mockReturnValue({ data: [audienceParticipant] } as never);
    vi.mocked(useAuth).mockReturnValue({ currentUser: { id: 1, username: 'gmuser' } } as never);
  });

  it('renders character name in modal title', () => {
    renderWithProviders(<AssignNPCModal character={baseCharacter} gameId={10} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Assign Elara')).toBeInTheDocument();
  });

  it('shows only audience members in the dropdown', () => {
    vi.mocked(useGameParticipants).mockReturnValue({ data: [audienceParticipant, playerParticipant] } as never);
    renderWithProviders(<AssignNPCModal character={baseCharacter} gameId={10} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'watcher' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /player1/i })).not.toBeInTheDocument();
  });

  it('hides dropdown when assign-to-self is checked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AssignNPCModal character={baseCharacter} gameId={10} isOpen onClose={vi.fn()} />);
    await user.click(screen.getByRole('checkbox'));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('calls assignNPC.mutateAsync with self user id when assign-to-self checked', async () => {
    const user = userEvent.setup();
    const mutation = makeMutation();
    vi.mocked(useAssignNPC).mockReturnValue(mutation as never);
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <AssignNPCModal character={baseCharacter} gameId={10} isOpen onClose={onClose} onSuccess={onSuccess} />
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /assign npc/i }));

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith({ characterId: 7, assignedUserId: 1, gameId: 10 });
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('calls assignNPC.mutateAsync with selected user id', async () => {
    const user = userEvent.setup();
    const mutation = makeMutation();
    vi.mocked(useAssignNPC).mockReturnValue(mutation as never);
    const onClose = vi.fn();

    renderWithProviders(
      <AssignNPCModal character={baseCharacter} gameId={10} isOpen onClose={onClose} />
    );
    await user.selectOptions(screen.getByRole('combobox'), '99');
    await user.click(screen.getByRole('button', { name: /assign npc/i }));

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith({ characterId: 7, assignedUserId: 99, gameId: 10 });
    });
  });

  it('calls onClose when Cancel clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<AssignNPCModal character={baseCharacter} gameId={10} isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ReassignCharacterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReassignCharacter).mockReturnValue(makeMutation() as never);
    vi.mocked(useGameParticipants).mockReturnValue({ data: [audienceParticipant, playerParticipant] } as never);
    vi.mocked(useAuth).mockReturnValue({ currentUser: { id: 1, username: 'gmuser' } } as never);
  });

  it('renders character name in modal title', () => {
    renderWithProviders(<ReassignCharacterModal character={baseCharacter} gameId={10} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('Reassign Elara')).toBeInTheDocument();
  });

  it('shows all participants in dropdown', () => {
    renderWithProviders(<ReassignCharacterModal character={baseCharacter} gameId={10} isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('option', { name: /watcher/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /player1/i })).toBeInTheDocument();
  });

  it('calls reassignCharacter.mutateAsync with self user id when assign-to-self checked', async () => {
    const user = userEvent.setup();
    const mutation = makeMutation();
    vi.mocked(useReassignCharacter).mockReturnValue(mutation as never);
    const onSuccess = vi.fn();
    const onClose = vi.fn();

    renderWithProviders(
      <ReassignCharacterModal character={baseCharacter} gameId={10} isOpen onClose={onClose} onSuccess={onSuccess} />
    );
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /reassign character/i }));

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith({ characterId: 7, newOwnerUserId: 1 });
      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('calls reassignCharacter.mutateAsync with selected user id', async () => {
    const user = userEvent.setup();
    const mutation = makeMutation();
    vi.mocked(useReassignCharacter).mockReturnValue(mutation as never);
    const onClose = vi.fn();

    renderWithProviders(
      <ReassignCharacterModal character={baseCharacter} gameId={10} isOpen onClose={onClose} />
    );
    await user.selectOptions(screen.getByRole('combobox'), '42');
    await user.click(screen.getByRole('button', { name: /reassign character/i }));

    await waitFor(() => {
      expect(mutation.mutateAsync).toHaveBeenCalledWith({ characterId: 7, newOwnerUserId: 42 });
    });
  });
});
