import { Page, Locator, expect } from '@playwright/test';
import { navigateToGameAndTab } from '../utils/navigation';
import { waitForVisible } from '../utils/waits';
import { assertTextVisible } from '../utils/assertions';

/**
 * Page Object Model for Common Room interactions
 *
 * Encapsulates all Common Room page interactions including:
 * - Creating posts
 * - Adding comments
 * - Character mentions with autocomplete
 * - Post and comment visibility
 */
export class CommonRoomPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the Common Room tab for a specific game
   */
  async goto(gameId: number) {
    await navigateToGameAndTab(this.page, gameId, 'Common Room');
  }

  /**
   * Get the Common Room heading element
   */
  get heading(): Locator {
    return this.page.locator('h2:has-text("Common Room")');
  }

  /**
   * Get the GM post creation form heading
   */
  get createPostHeading(): Locator {
    return this.page.locator('h3:has-text("Create New GM Post")');
  }

  /**
   * Get the post creation textarea
   */
  get postTextarea(): Locator {
    return this.page.locator('textarea[placeholder*="Phase Title"]');
  }

  /**
   * Get the create GM post button
   */
  get createPostButton(): Locator {
    return this.page.locator('button:has-text("Create GM Post")');
  }

  /**
   * Get the autocomplete dropdown
   */
  get autocompleteDropdown(): Locator {
    return this.page.locator('[role="listbox"]');
  }

  /**
   * Get the character selector dropdown
   */
  get characterSelector(): Locator {
    return this.page.locator('select#character');
  }

  /**
   * Select a character to post as
   * @param characterName - Name of the character to select
   */
  async selectCharacter(characterName: string) {
    // Wait for the selector to be visible AND enabled
    await waitForVisible(this.characterSelector);
    await this.characterSelector.waitFor({ state: 'attached' });

    // Wait for selector to be enabled (not disabled)
    await expect(this.characterSelector).toBeEnabled({ timeout: 5000 });

    // Select the character by visible text
    await this.characterSelector.selectOption({ label: characterName });

    // Wait for selection to process
    await this.page.waitForTimeout(300);
  }

  /**
   * Create a new GM post
   * @param content - Post content
   * @param characterName - Optional character name to post as (for GMs/co-GMs with multiple characters)
   */
  async createPost(content: string, characterName?: string) {
    // Wait for either the expand button or the textarea to be visible,
    // then expand if needed. Using a race avoids a no-timeout isVisible() check
    // that races the page render and silently skips the expand click.
    const expandButton = this.page.locator('button:has-text("Create New GM Post")').locator('visible=true').first();
    const expandButtonVisible = await expandButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (expandButtonVisible) {
      await expandButton.click();
      // Wait for form to expand and textarea to be visible
      await waitForVisible(this.postTextarea);
    }

    // If a character name is provided, select it
    if (characterName) {
      await this.selectCharacter(characterName);
    }

    // Ensure textarea is ready
    await waitForVisible(this.postTextarea);
    await this.postTextarea.fill(content);
    await this.page.waitForTimeout(500); // Allow form to process input
    await this.createPostButton.click();

    // Wait for post to appear using network idle (more reliable than timeout)
    await this.page.waitForLoadState('networkidle');

    // Verify post appears
    await assertTextVisible(this.page, content);

    // Wait for form to fully collapse and reset before next operation
    await this.page.waitForTimeout(500);
  }

  /**
   * Find a post card by its content
   * @param content - Partial or full post content
   */
  getPostCard(content: string): Locator {
    // Scope to the common-room container to avoid matching the create-post form or
    // other page elements. Within that scope, find the post card by its content.
    return this.page
      .getByTestId('common-room-container')
      .locator('[data-testid^="post-"]')
      .filter({ hasText: content });
  }

  /**
   * Click "Add Comment" button on a specific post
   * @param postContent - Post content to identify the post
   */
  async openCommentForm(postContent: string) {
    const postCard = this.getPostCard(postContent);
    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    await postCard.locator('button:has-text("Add Comment")').locator('visible=true').first().click();

    // Wait for comment textarea to be visible
    const textarea = postCard.locator('textarea[placeholder*="Write a comment"]');
    await waitForVisible(textarea);

    // Give the form a moment to fully render (character selector may appear after textarea)
    // and for React useEffect to auto-select the first character
    await this.page.waitForTimeout(800);
  }

  /**
   * Get comment textarea for a specific post
   * @param postContent - Post content to identify the post
   */
  getCommentTextarea(postContent: string): Locator {
    const postCard = this.getPostCard(postContent);
    return postCard.locator('textarea[placeholder*="Write a comment"]');
  }

  /**
   * Type text in comment textarea with autocomplete support
   * @param postContent - Post content to identify the post
   * @param text - Text to type
   * @param useSequential - Whether to use sequential typing (for autocomplete)
   */
  async typeInComment(postContent: string, text: string, useSequential = false) {
    const textarea = this.getCommentTextarea(postContent);
    await textarea.click(); // Focus the textarea

    if (useSequential) {
      // Use pressSequentially for autocomplete testing
      await textarea.pressSequentially(text);
    } else {
      // Use fill for faster typing
      await textarea.fill(text);
    }

    await this.page.waitForTimeout(500); // Allow autocomplete to process
  }

  /**
   * Select a character from autocomplete dropdown
   * @param characterName - Character name to select
   */
  async selectCharacterFromAutocomplete(characterName: string) {
    await waitForVisible(this.autocompleteDropdown);
    await this.page.click(`[role="listbox"] >> text=${characterName}`);
    await this.page.waitForTimeout(500); // Allow mention to be inserted
  }

  /**
   * Submit a comment on a post
   * @param postContent - Post content to identify the post
   */
  async submitComment(postContent: string) {
    const postCard = this.getPostCard(postContent);
    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    const form = postCard.locator('form').locator('visible=true').first();

    await form.evaluate((f: HTMLFormElement) => f.requestSubmit());

    // Wait for comment to be created
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Add a comment to a post (complete flow)
   * @param postContent - Post content to identify the post
   * @param commentText - Comment text
   * @param options - Additional options
   */
  async addComment(
    postContent: string,
    commentText: string,
    options: { withMention?: string; useSequential?: boolean; asCharacter?: string } = {}
  ) {
    await this.openCommentForm(postContent);

    // Select character if specified (for NPCs and multiple characters)
    if (options.asCharacter) {
      const postCard = this.getPostCard(postContent);
      // The select only appears when there are multiple characters
      // Find it within the comment form - look for a combobox role which is more specific
      const characterSelect = postCard.locator('role=combobox').first();

      // Wait for it to be visible (it appears after opening comment form)
      await characterSelect.waitFor({ state: 'visible', timeout: 5000 });

      // Select by the label text (e.g., "Reply as Mysterious Stranger")
      await characterSelect.selectOption({ label: `Reply as ${options.asCharacter}` });

      // Wait for the selection to be processed
      await this.page.waitForTimeout(500);
    }

    if (options.withMention) {
      // Type text before mention
      const textBeforeMention = commentText.split('@')[0];
      await this.typeInComment(postContent, textBeforeMention + '@', options.useSequential ?? true);

      // Select character from autocomplete
      await this.selectCharacterFromAutocomplete(options.withMention);

      // Complete the comment if there's more text after the mention
      const fullComment = commentText.replace('@', `@${options.withMention}`);
      const textarea = this.getCommentTextarea(postContent);
      await textarea.fill(fullComment);
    } else {
      await this.typeInComment(postContent, commentText, options.useSequential);
    }

    // Submit the comment
    await this.submitComment(postContent);
  }

  /**
   * Verify autocomplete shows specific characters
   * @param characterNames - Character names to verify
   */
  async verifyAutocompleteCharacters(characterNames: string[]) {
    await waitForVisible(this.autocompleteDropdown);

    for (const name of characterNames) {
      const option = this.page.locator(`[role="listbox"] >> text=${name}`);
      await expect(option).toBeVisible();
    }
  }

  /**
   * Verify a mention is rendered correctly
   * @param characterName - Character name to verify
   */
  async verifyMentionRendered(characterName: string) {
    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    const mention = this.page.locator(`mark[data-mention-id]:has-text("@${characterName}")`).locator('visible=true').first();
    await waitForVisible(mention);
  }

  /**
   * Verify a post exists with specific content
   * @param content - Post content to verify
   */
  async verifyPostExists(content: string) {
    await assertTextVisible(this.page, content);
  }

  /**
   * Verify a comment exists with specific content
   * @param content - Comment content to verify
   */
  async verifyCommentExists(content: string, timeout = 10000) {
    await assertTextVisible(this.page, content, { timeout });
  }

  /**
   * Get autocomplete position info for positioning tests
   */
  async getAutocompletePosition() {
    await waitForVisible(this.autocompleteDropdown);
    return await this.autocompleteDropdown.boundingBox();
  }

  /**
   * Get textarea position info for positioning tests
   * @param postContent - Post content to identify the post
   */
  async getTextareaPosition(postContent: string) {
    const textarea = this.getCommentTextarea(postContent);
    return await textarea.boundingBox();
  }

  /**
   * Verify code block does NOT render mentions
   * @param codeText - Text inside code block (e.g., "@CharacterName")
   */
  async verifyMentionNotInCodeBlock(codeText: string) {
    // Find code element with the text
    // Filter to visible element (viewport-agnostic for dual-DOM pattern)
    const codeElement = this.page.locator(`code:has-text("${codeText}")`).locator('visible=true').first();
    await waitForVisible(codeElement);

    // Verify the code element does not contain a mark element (mention)
    // Search within the code element, not globally, to avoid test pollution
    const mentionInCode = codeElement.locator('mark[data-mention-id]');
    await expect(mentionInCode).toHaveCount(0);
  }
}
