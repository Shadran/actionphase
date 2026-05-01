import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { AllActionSubmissionsView } from '../AllActionSubmissionsView';

vi.mock('../../lib/api', () => ({
  apiClient: {
    auth: { getCurrentUser: vi.fn().mockResolvedValue(null) },
    phases: {
      getGamePhases: vi.fn(),
      getGameResults: vi.fn(),
    },
  },
}));

vi.mock('../../hooks/useAudience', () => ({
  useAllActionSubmissions: vi.fn(),
}));

vi.mock('../../contexts/GameContext', () => ({
  useGameContext: vi.fn(),
}));

vi.mock('../CharacterAvatar', () => ({
  default: ({ characterName }: { characterName: string }) => (
    <span data-testid="char-avatar">{characterName[0]}</span>
  ),
}));

vi.mock('../MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

import { apiClient } from '../../lib/api';
import { useAllActionSubmissions } from '../../hooks/useAudience';
import { useGameContext } from '../../contexts/GameContext';

const makeSubmission = (overrides = {}) => ({
  id: 1,
  status: 'submitted',
  character_id: 10,
  character_name: 'Elara',
  username: 'alice',
  submission_number: 1,
  created_at: '2024-01-01T00:00:00Z',
  submitted_at: '2024-01-01T10:00:00Z',
  last_updated: '2024-01-01T10:00:00Z',
  content: 'I attack the goblin.',
  ...overrides,
});

const makeInfiniteData = (submissions: ReturnType<typeof makeSubmission>[], total = submissions.length) => ({
  pages: [{ action_submissions: submissions, total }],
  pageParams: [undefined],
});

const defaultHookResult = {
  data: makeInfiniteData([]),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
  isLoading: false,
  error: null,
};

describe('AllActionSubmissionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({ data: [] } as never);
    vi.mocked(useAllActionSubmissions).mockReturnValue(defaultHookResult as never);
    vi.mocked(useGameContext).mockReturnValue({ allGameCharacters: [] } as never);
  });

  it('shows loading spinner while phases or submissions are loading', () => {
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      isLoading: true,
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    expect(document.querySelector('[role="status"]') || screen.queryByText(/loading/i)).toBeTruthy();
  });

  it('shows error message on failure', async () => {
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      error: new Error('Network error'),
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => {
      expect(screen.getByText(/failed to load action submissions.*network error/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no submissions in phase', async () => {
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => {
      expect(screen.getByText(/no action submissions in this phase/i)).toBeInTheDocument();
    });
  });

  it('renders submission cards for each submission', async () => {
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      data: makeInfiniteData([makeSubmission(), makeSubmission({ id: 2, character_name: 'Borin', username: 'bob' })]),
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => {
      expect(screen.getByText('Elara')).toBeInTheDocument();
    });
    expect(screen.getByText('Borin')).toBeInTheDocument();
  });

  it('shows phase switcher when action phases exist', async () => {
    vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({
      data: [
        { id: 1, phase_type: 'action', phase_number: 1, title: 'Phase One', is_active: false },
        { id: 2, phase_type: 'action', phase_number: 2, title: 'Phase Two', is_active: true },
      ],
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /phase \d/i }).length).toBeGreaterThan(0);
    });
  });

  it('does not show phase switcher for non-action phases', async () => {
    vi.mocked(apiClient.phases.getGamePhases).mockResolvedValue({
      data: [{ id: 1, phase_type: 'narrative', phase_number: 1, title: 'Intro', is_active: false }],
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => {
      expect(screen.queryByText('Select Action Phase')).not.toBeInTheDocument();
    });
  });

  it('expands submission to show content on click', async () => {
    const user = userEvent.setup();
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      data: makeInfiniteData([makeSubmission()]),
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);

    // Wait for render, then find and click the expand button
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());
    const expandButton = screen.getByRole('button', { name: /▶/ });
    await user.click(expandButton);
    expect(screen.getByText('I attack the goblin.')).toBeInTheDocument();
  });

  it('shows "No result posted yet" for submitted status when expanded', async () => {
    const user = userEvent.setup();
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      data: makeInfiniteData([makeSubmission({ status: 'submitted' })]),
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);

    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /▶/ }));
    expect(screen.getByText(/no result posted yet/i)).toBeInTheDocument();
  });

  it('fetches and shows action result when expanded for result_posted submission', async () => {
    const user = userEvent.setup();
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      data: makeInfiniteData([makeSubmission({ status: 'result_posted', action_result_id: 99 })]),
    } as never);
    vi.mocked(apiClient.phases.getGameResults).mockResolvedValue({
      data: [{ id: 99, action_submission_id: 1, content: 'The goblin falls!' }],
    } as never);

    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => expect(screen.getByText('Elara')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /▶/ }));

    await waitFor(() => {
      expect(screen.getByText('The goblin falls!')).toBeInTheDocument();
    });
    expect(apiClient.phases.getGameResults).toHaveBeenCalledWith(5);
  });

  it('shows "End of action submissions" when all pages loaded', async () => {
    vi.mocked(useAllActionSubmissions).mockReturnValue({
      ...defaultHookResult,
      data: makeInfiniteData([makeSubmission()]),
      hasNextPage: false,
    } as never);
    renderWithProviders(<AllActionSubmissionsView gameId={5} />);
    await waitFor(() => {
      expect(screen.getByText('End of action submissions')).toBeInTheDocument();
    });
  });
});
