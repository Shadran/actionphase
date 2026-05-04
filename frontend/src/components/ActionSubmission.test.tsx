import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ActionSubmission } from './ActionSubmission';
import type { GamePhase } from '../types/phases';

vi.mock('../hooks/useUserCharacters', () => ({
  useUserCharacters: vi.fn(() => ({ characters: [], isLoading: false })),
}));

vi.mock('../lib/api', () => ({
  apiClient: {
    phases: {
      getUserActions: vi.fn(() => Promise.resolve({ data: [] })),
    },
  },
}));

const baseActionPhase: GamePhase = {
  id: 42,
  game_id: 1,
  phase_type: 'action',
  phase_number: 2,
  is_active: true,
  is_published: false,
  created_at: new Date().toISOString(),
};

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter([{ path: '/', element: <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider> }], { initialEntries: ['/'] });
  return render(<RouterProvider router={router} />);
};

describe('ActionSubmission subtitle text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows phase description when the GM provided one', () => {
    const phase = { ...baseActionPhase, description: 'Scouts report movement to the north.' };
    renderWithClient(<ActionSubmission gameId={1} currentPhase={phase} />);
    expect(screen.getByText('Scouts report movement to the north.')).toBeInTheDocument();
    expect(screen.queryByText('Submit your private action to the GM')).not.toBeInTheDocument();
  });

  it('falls back to default text when no description is set', () => {
    renderWithClient(<ActionSubmission gameId={1} currentPhase={baseActionPhase} />);
    expect(screen.getByText('Submit your private action to the GM')).toBeInTheDocument();
  });

  it('falls back to default text when description is an empty string', () => {
    const phase = { ...baseActionPhase, description: '' };
    renderWithClient(<ActionSubmission gameId={1} currentPhase={phase} />);
    expect(screen.getByText('Submit your private action to the GM')).toBeInTheDocument();
  });
});
