import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { NotificationDigest } from '../NotificationDigest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

describe('NotificationDigest', () => {
  it('renders nothing when there are no notifications', () => {
    const { container } = renderWithProviders(
      <NotificationDigest notificationsByType={{}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when all counts are zero', () => {
    const { container } = renderWithProviders(
      <NotificationDigest notificationsByType={{ private_message: 0, comment_reply: 0 }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows singular label for count of 1', () => {
    renderWithProviders(
      <NotificationDigest notificationsByType={{ private_message: 1 }} gameId={5} />
    );
    expect(screen.getByText('1 private message')).toBeInTheDocument();
  });

  it('shows plural label for count > 1', () => {
    renderWithProviders(
      <NotificationDigest notificationsByType={{ private_message: 3 }} gameId={5} />
    );
    expect(screen.getByText('3 private messages')).toBeInTheDocument();
  });

  it('links player-facing notification to the correct game tab', () => {
    renderWithProviders(
      <NotificationDigest notificationsByType={{ action_result: 2 }} gameId={5} />
    );
    const link = screen.getByRole('link', { name: /2 action results published/i });
    expect(link).toHaveAttribute('href', '/games/5?tab=actions');
  });

  it('collapses GM-type notifications into "other" bucket', () => {
    renderWithProviders(
      <NotificationDigest notificationsByType={{ application_submitted: 4 }} gameId={5} />
    );
    expect(screen.getByText('4 other notifications')).toBeInTheDocument();
  });

  it('collapses unknown types into "other" bucket', () => {
    renderWithProviders(
      <NotificationDigest notificationsByType={{ some_unknown_type: 1 }} gameId={5} />
    );
    expect(screen.getByText('1 other notification')).toBeInTheDocument();
  });

  it('links to /notifications when no gameId provided', () => {
    renderWithProviders(
      <NotificationDigest notificationsByType={{ handout_published: 1 }} />
    );
    const link = screen.getByRole('link', { name: /1 new handout/i });
    expect(link).toHaveAttribute('href', '/notifications?tab=handouts');
  });

  it('renders multiple notification types in priority order', () => {
    renderWithProviders(
      <NotificationDigest
        notificationsByType={{ comment_reply: 1, private_message: 2 }}
        gameId={5}
      />
    );
    const links = screen.getAllByRole('link');
    // private_message has higher priority than comment_reply
    expect(links[0]).toHaveTextContent('2 private messages');
    expect(links[1]).toHaveTextContent('1 reply to your comment');
  });
});
