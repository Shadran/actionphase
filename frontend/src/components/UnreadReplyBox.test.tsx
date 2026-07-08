import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnreadReplyBox } from './UnreadReplyBox';
import type { Character } from '../types/characters';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 1,
    game_id: 12,
    name: 'My Character',
    status: 'approved',
    is_active: true,
    ...overrides,
  };
}

describe('UnreadReplyBox', () => {
  it("shows a fallback message and no editor when the user controls no character", () => {
    render(
      <UnreadReplyBox
        controllableCharacters={[]}
        mentionableCharacters={[]}
        defaultCharacterId={null}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText(/you don't control a character in this game/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Write a reply...')).not.toBeInTheDocument();
  });

  it('does not show a character picker when there is only one controllable character', () => {
    render(
      <UnreadReplyBox
        controllableCharacters={[makeCharacter({ id: 7, name: 'Solo Character' })]}
        mentionableCharacters={[]}
        defaultCharacterId={7}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.queryByLabelText('Reply as')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Write a reply...')).toBeInTheDocument();
  });

  it('shows a character picker defaulted to defaultCharacterId when there are multiple controllable characters', () => {
    render(
      <UnreadReplyBox
        controllableCharacters={[
          makeCharacter({ id: 7, name: 'First Character' }),
          makeCharacter({ id: 8, name: 'Second Character' }),
        ]}
        mentionableCharacters={[]}
        defaultCharacterId={8}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />
    );

    expect(screen.getByText('Reply as')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('8');
  });

  it('calls onSubmit with the selected character id and trimmed content, and clears nothing until parent re-renders', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <UnreadReplyBox
        controllableCharacters={[
          makeCharacter({ id: 7, name: 'First Character' }),
          makeCharacter({ id: 8, name: 'Second Character' }),
        ]}
        mentionableCharacters={[]}
        defaultCharacterId={8}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />
    );

    await user.type(screen.getByPlaceholderText('Write a reply...'), '  Sounds good!  ');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(handleSubmit).toHaveBeenCalledWith(8, 'Sounds good!');
  });

  it('does not call onSubmit when content is empty or only whitespace', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <UnreadReplyBox
        controllableCharacters={[makeCharacter({ id: 7 })]}
        mentionableCharacters={[]}
        defaultCharacterId={7}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />
    );

    // Send button is disabled while content is empty.
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Write a reply...'), '   ');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('falls back to the first controllable character when no character has been explicitly selected', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <UnreadReplyBox
        controllableCharacters={[
          makeCharacter({ id: 7, name: 'First Character' }),
          makeCharacter({ id: 8, name: 'Second Character' }),
        ]}
        mentionableCharacters={[]}
        defaultCharacterId={null}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />
    );

    await user.type(screen.getByPlaceholderText('Write a reply...'), 'Hi there');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(handleSubmit).toHaveBeenCalledWith(7, 'Hi there');
  });

  it('disables the editor and shows a loading Send button while submitting', () => {
    render(
      <UnreadReplyBox
        controllableCharacters={[makeCharacter({ id: 7 })]}
        mentionableCharacters={[]}
        defaultCharacterId={7}
        onSubmit={vi.fn()}
        isSubmitting
      />
    );

    expect(screen.getByPlaceholderText('Write a reply...')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('shows the error alert when error is set', () => {
    render(
      <UnreadReplyBox
        controllableCharacters={[makeCharacter({ id: 7 })]}
        mentionableCharacters={[]}
        defaultCharacterId={7}
        onSubmit={vi.fn()}
        isSubmitting={false}
        error="Failed to send reply. Please try again."
      />
    );

    expect(screen.getByText('Failed to send reply. Please try again.')).toBeInTheDocument();
  });
});
