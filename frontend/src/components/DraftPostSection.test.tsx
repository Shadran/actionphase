import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import { DraftPostSection } from './DraftPostSection';
import type { Message } from '../types/messages';

vi.mock('../hooks', async () => {
  const actual = await vi.importActual<typeof import('../hooks')>('../hooks');
  return {
    ...actual,
    useDraftPost: vi.fn(),
    useCreateDraftPost: vi.fn(),
    useUpdateDraftPost: vi.fn(),
    useDeleteDraftPost: vi.fn(),
  };
});

vi.mock('../contexts/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../contexts/GameContext')>('../contexts/GameContext');
  return {
    ...actual,
    useOptionalGameContext: vi.fn(() => ({
      userCharacters: [{ id: 1, name: 'Narrator' }],
      allGameCharacters: [{ id: 1, name: 'Narrator' }],
    })),
  };
});

const { useDraftPost, useCreateDraftPost, useUpdateDraftPost, useDeleteDraftPost } = await import('../hooks');

const mockDraft: Message = {
  id: 42,
  game_id: 1,
  phase_id: 10,
  author_id: 1,
  character_id: 1,
  content: 'The fog which surrounded you dissipates and you find yourself in a grand hall.',
  message_type: 'post',
  thread_depth: 0,
  author_username: 'gm_user',
  character_name: 'Narrator',
  is_edited: false,
  is_deleted: false,
  is_draft: true,
  created_at: '2025-11-01T10:00:00Z',
  updated_at: '2025-11-01T10:00:00Z',
};

function makeMutationStub(overrides = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
    isSuccess: false,
    isError: false,
    reset: vi.fn(),
    ...overrides,
  };
}

describe('DraftPostSection', () => {
  const mockOnCreateDraft = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateDraftPost).mockReturnValue(makeMutationStub() as ReturnType<typeof useCreateDraftPost>);
    vi.mocked(useUpdateDraftPost).mockReturnValue(makeMutationStub() as ReturnType<typeof useUpdateDraftPost>);
    vi.mocked(useDeleteDraftPost).mockReturnValue(makeMutationStub() as ReturnType<typeof useDeleteDraftPost>);
  });

  it('shows loading state while fetching', () => {
    vi.mocked(useDraftPost).mockReturnValue({
      data: undefined,
      isLoading: true,
      isSuccess: false,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);
    // Loading state shows an animated placeholder (no text to assert, just no crash)
  });

  it('shows "No draft post" and add button when no draft exists', () => {
    vi.mocked(useDraftPost).mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    expect(screen.getByText('No draft post')).toBeInTheDocument();
    expect(screen.getByTestId('add-draft-post-btn')).toBeInTheDocument();
  });

  it('shows draft preview when draft exists', () => {
    vi.mocked(useDraftPost).mockReturnValue({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    expect(screen.getByText(/The fog which surrounded you/)).toBeInTheDocument();
    expect(screen.getByTestId('edit-draft-btn')).toBeInTheDocument();
    expect(screen.getByTestId('preview-draft-btn')).toBeInTheDocument();
    expect(screen.getByTestId('delete-draft-btn')).toBeInTheDocument();
  });

  it('opens create modal when add button is clicked', () => {
    vi.mocked(useDraftPost).mockReturnValue({
      data: null,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('add-draft-post-btn'));
    expect(screen.getByText('Write Draft Opening Post')).toBeInTheDocument();
  });

  it('shows delete confirmation when delete is clicked', () => {
    vi.mocked(useDraftPost).mockReturnValue({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('delete-draft-btn'));
    expect(screen.getByText('Delete?')).toBeInTheDocument();
  });

  it('calls delete mutation when confirmation is accepted', async () => {
    const mockDelete = makeMutationStub();
    vi.mocked(useDeleteDraftPost).mockReturnValue(mockDelete as ReturnType<typeof useDeleteDraftPost>);

    vi.mocked(useDraftPost).mockReturnValue({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('delete-draft-btn'));
    fireEvent.click(screen.getByText('Yes'));

    await waitFor(() => expect(mockDelete.mutate).toHaveBeenCalled());
  });

  it('opens preview modal when preview is clicked', () => {
    vi.mocked(useDraftPost).mockReturnValue({
      data: mockDraft,
      isLoading: false,
      isSuccess: true,
      isError: false,
    } as ReturnType<typeof useDraftPost>);

    renderWithProviders(<DraftPostSection phaseId={10} onCreateDraft={mockOnCreateDraft} />);

    fireEvent.click(screen.getByTestId('preview-draft-btn'));
    expect(screen.getByText('Draft Post Preview')).toBeInTheDocument();
  });
});
