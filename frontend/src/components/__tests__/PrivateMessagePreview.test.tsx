import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils';
import { PrivateMessagePreview } from '../PrivateMessagePreview';
import type { ConversationListItem } from '../../types/conversations';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => (
      <a href={to} className={className}>{children}</a>
    ),
  };
});

const baseConversation: ConversationListItem = {
  id: 1,
  game_id: 10,
  title: 'Secret Plans',
  participant_names: 'Alice, Bob',
  unread_count: 2,
  last_message: 'Meet me at dawn.',
  last_message_at: new Date().toISOString(),
  conversation_type: 'private',
  participant_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('PrivateMessagePreview', () => {
  it('renders nothing when conversations list is empty', () => {
    const { container } = renderWithProviders(
      <PrivateMessagePreview conversations={[]} gameId={10} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders conversation title and last message', () => {
    renderWithProviders(
      <PrivateMessagePreview conversations={[baseConversation]} gameId={10} />
    );
    expect(screen.getByText('Secret Plans')).toBeInTheDocument();
    expect(screen.getByText('Meet me at dawn.')).toBeInTheDocument();
  });

  it('shows unread count badge when unread_count > 0', () => {
    renderWithProviders(
      <PrivateMessagePreview conversations={[baseConversation]} gameId={10} />
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show badge when unread_count is 0', () => {
    const readConversation = { ...baseConversation, unread_count: 0 };
    renderWithProviders(
      <PrivateMessagePreview conversations={[readConversation]} gameId={10} />
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('falls back to participant_names when title is absent', () => {
    const noTitle = { ...baseConversation, title: undefined };
    renderWithProviders(
      <PrivateMessagePreview conversations={[noTitle]} gameId={10} />
    );
    expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
  });

  it('links each conversation to the correct game messages URL', () => {
    renderWithProviders(
      <PrivateMessagePreview conversations={[baseConversation]} gameId={10} />
    );
    const link = screen.getByRole('link', { name: /secret plans/i });
    expect(link).toHaveAttribute('href', '/games/10?tab=messages&conversation=1');
  });

  it('renders multiple conversations', () => {
    const second: ConversationListItem = { ...baseConversation, id: 2, title: 'Another Thread', unread_count: 1 };
    renderWithProviders(
      <PrivateMessagePreview conversations={[baseConversation, second]} gameId={10} />
    );
    expect(screen.getByText('Secret Plans')).toBeInTheDocument();
    expect(screen.getByText('Another Thread')).toBeInTheDocument();
  });
});
