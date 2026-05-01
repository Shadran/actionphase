import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils/render';
import { AudienceView } from '../AudienceView';

vi.mock('../AllPrivateMessagesView', () => ({
  AllPrivateMessagesView: ({ gameId }: { gameId: number }) => (
    <div data-testid="all-private-messages">Private Messages {gameId}</div>
  ),
}));

vi.mock('../AllActionSubmissionsView', () => ({
  AllActionSubmissionsView: ({ gameId }: { gameId: number }) => (
    <div data-testid="all-action-submissions">Action Submissions {gameId}</div>
  ),
}));

describe('AudienceView', () => {
  it('shows Private Messages tab by default', () => {
    renderWithProviders(<AudienceView gameId={5} />);
    expect(screen.getByTestId('all-private-messages')).toBeInTheDocument();
    expect(screen.queryByTestId('all-action-submissions')).not.toBeInTheDocument();
  });

  it('passes gameId to the active tab content', () => {
    renderWithProviders(<AudienceView gameId={5} />);
    expect(screen.getByText('Private Messages 5')).toBeInTheDocument();
  });

  it('switches to Action Submissions tab on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AudienceView gameId={5} />);

    await user.click(screen.getByRole('button', { name: /action submissions/i }));

    expect(screen.getByTestId('all-action-submissions')).toBeInTheDocument();
    expect(screen.queryByTestId('all-private-messages')).not.toBeInTheDocument();
  });

  it('switches back to Private Messages tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AudienceView gameId={5} />);

    await user.click(screen.getByRole('button', { name: /action submissions/i }));
    await user.click(screen.getByRole('button', { name: /private messages/i }));

    expect(screen.getByTestId('all-private-messages')).toBeInTheDocument();
    expect(screen.queryByTestId('all-action-submissions')).not.toBeInTheDocument();
  });

  it('renders both tab buttons', () => {
    renderWithProviders(<AudienceView gameId={5} />);
    expect(screen.getByRole('button', { name: /private messages/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /action submissions/i })).toBeInTheDocument();
  });
});
