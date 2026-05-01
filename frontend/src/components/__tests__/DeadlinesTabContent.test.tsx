import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { DeadlinesTabContent } from '../DeadlinesTabContent';

vi.mock('../../hooks/useDeadlines', () => ({
  useDeadlines: vi.fn(),
}));

vi.mock('../DeadlineList', () => ({
  DeadlineList: ({ emptyMessage, onEdit, showActions }: { emptyMessage: string; onEdit?: () => void; showActions: boolean }) => (
    <div data-testid="deadline-list">
      <span data-testid="empty-msg">{emptyMessage}</span>
      <span data-testid="show-actions">{String(showActions)}</span>
      {onEdit && <button onClick={() => onEdit({ id: 1, title: 'Test', source_id: 1, deadline: '2024-12-01T00:00:00Z' } as never)}>Edit Deadline</button>}
    </div>
  ),
}));

vi.mock('../CreateDeadlineModal', () => ({
  CreateDeadlineModal: ({ isOpen, onClose, onSubmit }: { isOpen: boolean; onClose: () => void; onSubmit: (data: unknown) => void }) =>
    isOpen ? (
      <div data-testid="create-deadline-modal">
        <button onClick={() => onSubmit({ title: 'New', description: '', deadline: '2024-12-01T00:00:00Z' })}>Submit Create</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../EditDeadlineModal', () => ({
  EditDeadlineModal: ({ isOpen, onClose, onSubmit, deadline }: { isOpen: boolean; onClose: () => void; onSubmit: (id: number, data: unknown) => void; deadline: { source_id: number } | null }) =>
    isOpen && deadline ? (
      <div data-testid="edit-deadline-modal">
        <button onClick={() => onSubmit(deadline.source_id, { title: 'Updated', description: '', deadline: '2024-12-02T00:00:00Z' })}>Submit Edit</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

import { useDeadlines } from '../../hooks/useDeadlines';

const makeMutation = (overrides = {}) => ({
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
  ...overrides,
});

const defaultHook = {
  deadlines: [],
  isLoading: false,
  createDeadlineMutation: makeMutation(),
  updateDeadlineMutation: makeMutation(),
  deleteDeadlineMutation: makeMutation(),
};

describe('DeadlinesTabContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeadlines).mockReturnValue(defaultHook as never);
  });

  it('shows "Add Deadline" button for GM', () => {
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    expect(screen.getByRole('button', { name: /add deadline/i })).toBeInTheDocument();
  });

  it('hides "Add Deadline" button for non-GM', () => {
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM={false} />);
    expect(screen.queryByRole('button', { name: /add deadline/i })).not.toBeInTheDocument();
  });

  it('shows GM-specific empty message for GM', () => {
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    expect(screen.getByTestId('empty-msg')).toHaveTextContent(/click "add deadline"/i);
  });

  it('shows player empty message for non-GM', () => {
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM={false} />);
    expect(screen.getByTestId('empty-msg')).toHaveTextContent(/no deadlines for this game yet/i);
  });

  it('passes showActions=true to DeadlineList for GM', () => {
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    expect(screen.getByTestId('show-actions')).toHaveTextContent('true');
  });

  it('passes showActions=false to DeadlineList for non-GM', () => {
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM={false} />);
    expect(screen.getByTestId('show-actions')).toHaveTextContent('false');
  });

  it('opens create modal when Add Deadline is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    await user.click(screen.getByRole('button', { name: /add deadline/i }));
    expect(screen.getByTestId('create-deadline-modal')).toBeInTheDocument();
  });

  it('calls createDeadlineMutation.mutateAsync on create submit', async () => {
    const user = userEvent.setup();
    const createMutation = makeMutation();
    vi.mocked(useDeadlines).mockReturnValue({ ...defaultHook, createDeadlineMutation: createMutation } as never);
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    await user.click(screen.getByRole('button', { name: /add deadline/i }));
    await user.click(screen.getByText('Submit Create'));
    expect(createMutation.mutateAsync).toHaveBeenCalledWith({ title: 'New', description: '', deadline: '2024-12-01T00:00:00Z' });
  });

  it('opens edit modal when onEdit is triggered from DeadlineList', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    await user.click(screen.getByText('Edit Deadline'));
    expect(screen.getByTestId('edit-deadline-modal')).toBeInTheDocument();
  });

  it('calls updateDeadlineMutation.mutateAsync on edit submit', async () => {
    const user = userEvent.setup();
    const updateMutation = makeMutation();
    vi.mocked(useDeadlines).mockReturnValue({ ...defaultHook, updateDeadlineMutation: updateMutation } as never);
    renderWithProviders(<DeadlinesTabContent gameId={10} isGM />);
    await user.click(screen.getByText('Edit Deadline'));
    await user.click(screen.getByText('Submit Edit'));
    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({ deadlineId: 1, data: { title: 'Updated', description: '', deadline: '2024-12-02T00:00:00Z' } });
  });
});
