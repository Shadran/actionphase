import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { CommentEditor } from './CommentEditor';

/**
 * Renders CommentEditor inside a data router so useBlocker works.
 * Only needed for warnOnUnsavedChanges tests.
 */
function renderWithDataRouter(
  props: Parameters<typeof CommentEditor>[0],
  { additionalRoutes = [] }: { additionalRoutes?: Parameters<typeof createMemoryRouter>[0] } = {}
) {
  const routes = [
    { path: '/', element: <CommentEditor {...props} /> },
    { path: '/other', element: <div>Other page</div> },
    ...additionalRoutes,
  ];
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  return { ...render(<RouterProvider router={router} />), router };
}

describe('CommentEditor', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  describe('Basic Rendering', () => {
    it('renders textarea with placeholder', () => {
      render(<CommentEditor {...defaultProps} placeholder="Test placeholder" />);
      expect(screen.getByPlaceholderText('Test placeholder')).toBeInTheDocument();
    });

    it('renders with default placeholder', () => {
      render(<CommentEditor {...defaultProps} />);
      expect(screen.getByPlaceholderText('Write your comment...')).toBeInTheDocument();
    });

    it('renders with initial value', () => {
      render(<CommentEditor {...defaultProps} value="Initial text" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('Initial text');
    });

    it('renders character counter', () => {
      render(<CommentEditor {...defaultProps} value="Hello" />);
      expect(screen.getByText('5 characters')).toBeInTheDocument();
    });

    it('updates character counter when value changes', () => {
      const { rerender } = render(<CommentEditor {...defaultProps} value="Hello" />);
      expect(screen.getByText('5 characters')).toBeInTheDocument();

      rerender(<CommentEditor {...defaultProps} value="Hello World!" />);
      expect(screen.getByText('12 characters')).toBeInTheDocument();
    });
  });

  describe('Preview Toggle', () => {
    it('shows Write and Preview tab buttons', () => {
      render(<CommentEditor {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Write' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    });

    it('does not show preview by default', () => {
      render(<CommentEditor {...defaultProps} value="**bold**" />);
      expect(screen.queryByText('Preview will appear here...')).not.toBeInTheDocument();
    });

    it('shows preview when Preview tab is clicked', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="" />);

      await user.click(screen.getByRole('button', { name: 'Preview' }));

      expect(screen.getByText('Preview will appear here...')).toBeInTheDocument();
    });

    it('hides preview when Write tab is clicked', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="" showPreviewByDefault />);

      // Preview should be visible initially
      expect(screen.getByText('Preview will appear here...')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Write' }));

      // Preview should be hidden
      expect(screen.queryByText('Preview will appear here...')).not.toBeInTheDocument();
    });

    it('can show preview by default when prop is set', () => {
      render(<CommentEditor {...defaultProps} value="" showPreviewByDefault />);
      expect(screen.getByText('Preview will appear here...')).toBeInTheDocument();
    });
  });

  describe('Live Preview', () => {
    it('renders markdown in preview', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="**bold text**" />);

      await user.click(screen.getByRole('button', { name: 'Preview' }));

      const boldElement = screen.getByText('bold text');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('updates preview as value changes', async () => {
      const _user = userEvent.setup();
      const { rerender, container } = render(<CommentEditor {...defaultProps} value="Hello" showPreviewByDefault />);

      // Check that "Hello" appears in the preview div
      const previewDiv = container.querySelector('.markdown-preview');
      expect(previewDiv).toHaveTextContent('Hello');

      rerender(<CommentEditor {...defaultProps} value="**Bold**" showPreviewByDefault />);

      const boldElement = screen.getByText('Bold');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('shows placeholder message when preview is empty', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="" />);

      await user.click(screen.getByRole('button', { name: 'Preview' }));

      expect(screen.getByText('Preview will appear here...')).toBeInTheDocument();
    });

    it('shows placeholder message for whitespace-only content', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="   " />);

      await user.click(screen.getByRole('button', { name: 'Preview' }));

      expect(screen.getByText('Preview will appear here...')).toBeInTheDocument();
    });
  });

  describe('Markdown Help', () => {
    it('shows markdown help toggle button', () => {
      render(<CommentEditor {...defaultProps} />);
      expect(screen.getByText(/Markdown Help/)).toBeInTheDocument();
    });

    it('does not show help panel by default', () => {
      render(<CommentEditor {...defaultProps} />);
      expect(screen.queryByText('Markdown Quick Reference')).not.toBeInTheDocument();
    });

    it('shows help panel when help button is clicked', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} />);

      await user.click(screen.getByText(/Markdown Help/));

      expect(screen.getByText('Markdown Quick Reference')).toBeInTheDocument();
    });

    it('hides help panel when help button is clicked again', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} />);

      // Open help
      await user.click(screen.getByText(/Markdown Help/));
      expect(screen.getByText('Markdown Quick Reference')).toBeInTheDocument();

      // Close help
      await user.click(screen.getByText(/Markdown Help/));
      expect(screen.queryByText('Markdown Quick Reference')).not.toBeInTheDocument();
    });

    it('displays markdown syntax examples', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} />);

      await user.click(screen.getByText(/Markdown Help/));

      // Check for various markdown examples
      expect(screen.getByText('**bold**')).toBeInTheDocument();
      expect(screen.getByText('*italic*')).toBeInTheDocument();
      expect(screen.getByText('[link](url)')).toBeInTheDocument();
      expect(screen.getByText('`code`')).toBeInTheDocument();
      expect(screen.getByText('# Heading')).toBeInTheDocument();
      expect(screen.getByText('- list item')).toBeInTheDocument();
      expect(screen.getByText('> quote')).toBeInTheDocument();
      expect(screen.getByText('@CharacterName')).toBeInTheDocument();
    });
  });

  describe('User Input', () => {
    it('calls onChange when user types', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello');

      // Should be called for each character typed
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls.length).toBeGreaterThan(0);
    });

    it('calls onChange with correct value', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'New text' } });

      expect(onChange).toHaveBeenCalledWith('New text');
    });

    it('can type markdown syntax', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '**bold** and *italic*' } });

      expect(onChange).toHaveBeenCalledWith('**bold** and *italic*');
    });
  });

  describe('Disabled State', () => {
    it('disables textarea when disabled prop is true', () => {
      render(<CommentEditor {...defaultProps} disabled />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('disables preview toggle when disabled', () => {
      render(<CommentEditor {...defaultProps} disabled />);
      expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    });

    it('disables help toggle when disabled', () => {
      render(<CommentEditor {...defaultProps} disabled />);
      const helpButton = screen.getByRole('button', { name: /Markdown Help/ });
      expect(helpButton).toBeDisabled();
    });
  });

  describe('Custom Props', () => {
    it('respects custom rows prop', () => {
      render(<CommentEditor {...defaultProps} rows={10} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '10');
    });

    it('uses default rows when not specified', () => {
      render(<CommentEditor {...defaultProps} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '4');
    });
  });

  describe('Tab Layout', () => {
    it('shows write tab content when Write is active', () => {
      render(<CommentEditor {...defaultProps} value="Test" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.queryByText('Preview will appear here...')).not.toBeInTheDocument();
    });

    it('shows preview tab content when Preview is active', async () => {
      const user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="Test" />);

      await user.click(screen.getByRole('button', { name: 'Preview' }));

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  describe('Integration with MarkdownPreview', () => {
    it('passes content to MarkdownPreview', async () => {
      const _user = userEvent.setup();
      render(<CommentEditor {...defaultProps} value="# Heading" showPreviewByDefault />);

      const heading = screen.getByText('Heading');
      expect(heading.tagName).toBe('H1');
    });

    it('renders complex markdown correctly in preview', async () => {
      const _user = userEvent.setup();
      const content = `# Title\n\n**Bold** and *italic*\n\n- Item 1\n- Item 2`;
      render(<CommentEditor {...defaultProps} value={content} showPreviewByDefault />);

      expect(screen.getByText('Title').tagName).toBe('H1');
      expect(screen.getByText('Bold').tagName).toBe('STRONG');
      expect(screen.getByText('italic').tagName).toBe('EM');
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible textarea', () => {
      render(<CommentEditor {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('has accessible buttons', () => {
      render(<CommentEditor {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long text', () => {
      const longText = 'a'.repeat(10000);
      render(<CommentEditor {...defaultProps} value={longText} />);
      expect(screen.getByText('10000 characters')).toBeInTheDocument();
    });

    it('handles empty value prop', () => {
      render(<CommentEditor {...defaultProps} value="" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('handles special characters', () => {
      const specialChars = '<script>alert("XSS")</script>';
      render(<CommentEditor {...defaultProps} value={specialChars} showPreviewByDefault />);

      // XSS should be prevented by MarkdownPreview
      const { container } = render(<CommentEditor {...defaultProps} value={specialChars} showPreviewByDefault />);
      expect(container.querySelectorAll('script')).toHaveLength(0);
    });
  });

  describe('Performance Optimizations', () => {
    const mockCharacters = [
      { id: 1, name: 'Aragorn', avatar_url: 'https://example.com/aragorn.jpg' },
      { id: 2, name: 'Gandalf' },
      { id: 3, name: 'Arwen' },
    ];

    it('does not call getCaretCoordinates when typing regular text', () => {
      const onChange = vi.fn();

      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} />);

      // Spy on document.body.appendChild AFTER rendering to avoid capturing RTL's appendChild
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      const textarea = screen.getByRole('textbox');

      // Type regular text (no '@')
      fireEvent.change(textarea, { target: { value: 'Hello world' } });

      // Should not append mirror div to body (getCaretCoordinates not called)
      expect(appendChildSpy).not.toHaveBeenCalled();

      appendChildSpy.mockRestore();
    });

    it('closes autocomplete when mention exceeds 50 characters', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');

      // Type @ to trigger autocomplete
      fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Type more than 50 characters after @
      const longMention = '@' + 'a'.repeat(51);
      fireEvent.change(textarea, { target: { value: longMention, selectionStart: longMention.length } });

      // Autocomplete should close
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Character Mention Autocomplete', () => {
    const mockCharacters = [
      { id: 1, name: 'Aragorn', avatar_url: 'https://example.com/aragorn.jpg' },
      { id: 2, name: 'Gandalf' },
      { id: 3, name: 'Arwen' },
    ];

    it('shows autocomplete when @ is typed', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '@' } });

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('filters characters as user types after @', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '@Ara' } });

      expect(screen.getByText('Aragorn')).toBeInTheDocument();
      expect(screen.queryByText('Gandalf')).not.toBeInTheDocument();
    });

    it('does not show autocomplete if characters array is empty', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={[]} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '@' } });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('does not show autocomplete if characters prop is not provided', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '@' } });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes autocomplete when space is typed after @', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '@' } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: '@ ' } });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('inserts character name when selected from autocomplete', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} value="" />);

      const textarea = screen.getByRole('textbox');

      // Type @ to trigger autocomplete
      fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });

      // Click on Gandalf in autocomplete
      await user.click(screen.getByText('Gandalf'));

      // Should have called onChange with "@Gandalf "
      expect(onChange).toHaveBeenCalledWith('@Gandalf ');
    });

    it('navigates autocomplete with arrow keys', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} value="" />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Trigger autocomplete by changing value and cursor position
      Object.defineProperty(textarea, 'selectionStart', { writable: true, value: 1 });
      fireEvent.change(textarea, { target: { value: '@' } });

      // Arrow down should work (not crash)
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });

      // Arrow up should work
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });

      // Should still have autocomplete open
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes autocomplete with Escape key', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} value="" />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Trigger autocomplete
      Object.defineProperty(textarea, 'selectionStart', { writable: true, value: 1 });
      fireEvent.change(textarea, { target: { value: '@' } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(textarea, { key: 'Escape' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('does not show autocomplete for @ in middle of word', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} characters={mockCharacters} onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'email@example.com', selectionStart: 15 } });

      // Should not show autocomplete because @ is part of email
      // (there's text before @ without space)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Unsaved Changes Warning', () => {
    it('does not show warning dialog when field is empty', async () => {
      const { router } = renderWithDataRouter({
        value: '',
        onChange: vi.fn(),
        warnOnUnsavedChanges: true,
      });

      await act(() => router.navigate('/other'));

      expect(screen.queryByText('Leave page?')).not.toBeInTheDocument();
    });

    it('shows confirmation dialog when navigating away with unsaved content', async () => {
      const { router } = renderWithDataRouter({
        value: 'some draft text',
        onChange: vi.fn(),
        warnOnUnsavedChanges: true,
      });

      await act(() => router.navigate('/other'));

      expect(screen.getByText('Leave page?')).toBeInTheDocument();
      expect(screen.getByText(/you have unsaved text/i)).toBeInTheDocument();
    });

    it('stays on page when user clicks Stay', async () => {
      const user = userEvent.setup();
      const { router } = renderWithDataRouter({
        value: 'some draft text',
        onChange: vi.fn(),
        warnOnUnsavedChanges: true,
      });

      await act(() => router.navigate('/other'));
      expect(screen.getByText('Leave page?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Stay' }));

      await waitFor(() => expect(screen.queryByText('Leave page?')).not.toBeInTheDocument());
      expect(router.state.location.pathname).toBe('/');
    });

    it('navigates away when user clicks Leave', async () => {
      const user = userEvent.setup();
      const { router } = renderWithDataRouter({
        value: 'some draft text',
        onChange: vi.fn(),
        warnOnUnsavedChanges: true,
      });

      await act(() => router.navigate('/other'));
      expect(screen.getByText('Leave page?')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Leave' }));

      expect(router.state.location.pathname).toBe('/other');
    });

    it('does not block navigation when warnOnUnsavedChanges is false', async () => {
      const { router } = renderWithDataRouter({
        value: 'some draft text',
        onChange: vi.fn(),
        warnOnUnsavedChanges: false,
      });

      await act(() => router.navigate('/other'));

      expect(screen.queryByText('Leave page?')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/other');
    });

    it('does not block navigation when warnOnUnsavedChanges is omitted (default off)', async () => {
      const { router } = renderWithDataRouter({
        value: 'some draft text',
        onChange: vi.fn(),
      });

      await act(() => router.navigate('/other'));

      expect(screen.queryByText('Leave page?')).not.toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/other');
    });
  });

  describe('Sheet Item Autocomplete (%% trigger)', () => {
    const mockSheetItems = [
      { id: 'a1', name: 'Fire Bolt', type: 'ability' as const, description: 'Deals fire damage' },
      { id: 's1', name: 'Stealth', type: 'skill' as const },
      { id: 'i1', name: 'Longbow', type: 'item' as const },
    ];

    it('shows sheet autocomplete when %% is typed', () => {
      render(<CommentEditor {...defaultProps} sheetItems={mockSheetItems} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '%%', selectionStart: 2 } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('does not show autocomplete when sheetItems is empty', () => {
      render(<CommentEditor {...defaultProps} sheetItems={[]} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '%%', selectionStart: 2 } });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('filters items by text typed after %%', () => {
      render(<CommentEditor {...defaultProps} sheetItems={mockSheetItems} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '%%bolt', selectionStart: 6 } });
      expect(screen.getByText('Fire Bolt')).toBeInTheDocument();
      expect(screen.queryByText('Stealth')).not.toBeInTheDocument();
    });

    it('inserts [[token]] when item is selected from autocomplete', () => {
      const onChange = vi.fn();
      render(<CommentEditor {...defaultProps} sheetItems={mockSheetItems} onChange={onChange} />);
      const textarea = screen.getByRole('textbox');

      // Trigger autocomplete
      fireEvent.change(textarea, { target: { value: '%%', selectionStart: 2 } });

      // Click the item
      fireEvent.click(screen.getByText('Fire Bolt'));

      // onChange should have been called with the [[token]] replacing %%
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall).toContain('[[Fire Bolt|ability:a1]]');
      expect(lastCall).not.toContain('%%');
    });

    it('closes sheet autocomplete when space is typed after %%', () => {
      render(<CommentEditor {...defaultProps} sheetItems={mockSheetItems} />);
      const textarea = screen.getByRole('textbox');

      fireEvent.change(textarea, { target: { value: '%%', selectionStart: 2 } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: '%% ', selectionStart: 3 } });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes sheet autocomplete when Escape is pressed', () => {
      render(<CommentEditor {...defaultProps} sheetItems={mockSheetItems} />);
      const textarea = screen.getByRole('textbox');

      fireEvent.change(textarea, { target: { value: '%%', selectionStart: 2 } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.keyDown(textarea, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('%% and @ autocompletes are mutually exclusive', () => {
      const mockCharacters = [{ id: 1, name: 'Gandalf' }];
      render(
        <CommentEditor
          {...defaultProps}
          sheetItems={mockSheetItems}
          characters={mockCharacters}
        />
      );
      const textarea = screen.getByRole('textbox');

      // Trigger @ mention
      fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      // Switch to %% — should close @ and open sheet
      fireEvent.change(textarea, { target: { value: '%%', selectionStart: 2 } });
      // Only one listbox should be visible
      expect(screen.getAllByRole('listbox')).toHaveLength(1);
    });
  });
});
