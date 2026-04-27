import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { waitForVisible } from '../utils/waits';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Character Mentions Feature
 *
 * Tests character mention autocomplete and rendering in Common Room posts.
 * Uses test fixture ("E2E Common Room - Mentions") with:
 * - Active common_room phase
 * - Characters: "GM Test Character", "Test Player 1 Character", "Test Player 2 Character"
 *
 * Created by fixture: backend/pkg/db/test_fixtures/07_common_room.sql
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 28)
 * - Reduced code by ~40% (462 → ~280 lines)
 * - Improved readability and maintainability
 */
test.describe('Character Mentions', () => {

  test('should allow user to mention character in comment with autocomplete', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MENTIONS');
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      // Verify Common Room is loaded
      await expect(gmCommonRoom.heading).toBeVisible({ timeout: 5000 });

      // Create a post
      const postContent = `Mission Briefing ${Date.now()}: Everyone report in!`;
      await gmCommonRoom.createPost(postContent);

      // === Player comments with character mention ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      // Wait for post to be visible
      await playerCommonRoom.verifyPostExists(postContent);

      // Open comment form
      await playerCommonRoom.openCommentForm(postContent);

      // Type text to trigger autocomplete
      await playerCommonRoom.typeInComment(postContent, 'Hey @', true);

      // Verify autocomplete shows all characters
      await playerCommonRoom.verifyAutocompleteCharacters([
        'Test Player 1 Character',
        'Test Player 2 Character',
        'GM Test Character',
      ]);

      // Select a character
      await playerCommonRoom.selectCharacterFromAutocomplete('Test Player 2 Character');

      // Complete and submit the comment
      const commentText = 'Hey @Test Player 2 Character, what do you think?';
      const textarea = playerCommonRoom.getCommentTextarea(postContent);
      await textarea.fill(commentText);

      await playerCommonRoom.submitComment(postContent);

      // Verify comment appears with mention highlighted
      await playerCommonRoom.verifyCommentExists('what do you think?');
      await playerCommonRoom.verifyMentionRendered('Test Player 2 Character');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should filter autocomplete as user types', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Create a post
    const postContent = `Filter Test ${Date.now()}: Testing autocomplete filtering`;
    await commonRoom.createPost(postContent);

    // Open comment form
    await commonRoom.openCommentForm(postContent);

    // Type @ to trigger autocomplete
    await commonRoom.typeInComment(postContent, '@', true);

    // Verify all characters appear initially
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Type filter text
    const textarea = commonRoom.getCommentTextarea(postContent);
    await textarea.pressSequentially('Test');

    // All three characters contain "Test" so they should all still be visible
    await waitForVisible(commonRoom.autocompleteDropdown);
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Type more specific filter
    await textarea.pressSequentially('Player1');

    // Now only "Test Player 1 Character" should match
    await waitForVisible(commonRoom.autocompleteDropdown);
    await expect(page.getByRole('listbox').getByText('Test Player 1 Character', { exact: true })).toBeVisible();

    // Verify other characters are filtered OUT
    await expect(page.getByRole('listbox').getByText('Test Player 2 Character', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('listbox').getByText('GM Test Character', { exact: true })).not.toBeVisible();
  });

  test('should render mentions with markdown formatting', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MENTIONS');
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Markdown Test ${Date.now()}: Testing mentions with markdown`;
      await gmCommonRoom.createPost(postContent);

      // === Player comments with mention and markdown ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      await playerCommonRoom.openCommentForm(postContent);

      // Type comment with markdown and mention
      const commentWithMarkdown = 'Hey @Test Player 2 Character, check out **this bold text** and *this italic*!';
      const textarea = playerCommonRoom.getCommentTextarea(postContent);
      await textarea.fill(commentWithMarkdown);

      await playerCommonRoom.submitComment(postContent);

      // Verify comment with markdown and mention rendering
      await playerCommonRoom.verifyCommentExists('this bold text');

      // Verify bold text is actually bold (rendered in <strong> tag)
      const boldElement = playerPage.locator('strong').filter({ hasText: 'this bold text' }).locator('visible=true').first();
      await expect(boldElement).toBeVisible();

      // Verify italic text is actually italic (rendered in <em> tag)
      const italicElement = playerPage.locator('em').filter({ hasText: 'this italic' }).locator('visible=true').first();
      await expect(italicElement).toBeVisible();

      // Verify mention is highlighted
      await playerCommonRoom.verifyMentionRendered('Test Player 2 Character');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should position autocomplete dropdown near cursor', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM creates a post
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MENTIONS');
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Autocomplete Test ${Date.now()}`;
      await gmCommonRoom.createPost(postContent);

      // Player opens comment form
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      await playerCommonRoom.verifyPostExists(postContent);
      await playerCommonRoom.openCommentForm(postContent);

      // Add text with mention to test positioning
      const prefixText = 'This is a long comment with multiple lines.\nSecond line here.\nThird line @';
      const textarea = playerCommonRoom.getCommentTextarea(postContent);
      await textarea.fill(prefixText);

      // Get positions
      const textareaBox = await playerCommonRoom.getTextareaPosition(postContent);
      const autocompleteBox = await playerCommonRoom.getAutocompletePosition();

      expect(textareaBox).toBeTruthy();
      expect(autocompleteBox).toBeTruthy();

      // Verify autocomplete is positioned correctly
      if (textareaBox && autocompleteBox) {
        // Autocomplete should be at or below textarea
        expect(autocompleteBox.y).toBeGreaterThanOrEqual(textareaBox.y);

        // Autocomplete should be within reasonable distance
        const distance = autocompleteBox.y - textareaBox.y;
        expect(distance).toBeLessThan(500);

        // Autocomplete should be roughly aligned horizontally
        const horizontalOffset = Math.abs(autocompleteBox.x - textareaBox.x);
        expect(horizontalOffset).toBeLessThan(150);
      }
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should allow GM to mention all characters in post creation with autocomplete', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Expand form if collapsed (posts may exist from previous tests)
    const expandButton = page.locator('button:has-text("Create New GM Post")').locator('visible=true').first();
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    }

    await expect(commonRoom.createPostHeading).toBeVisible({ timeout: 5000 });

    // Click to focus the textarea
    await commonRoom.postTextarea.click();

    // Type @ to trigger autocomplete
    await commonRoom.postTextarea.pressSequentially('Mission: @');

    // CRITICAL: Verify ALL game characters appear (including player characters)
    // This ensures the bug fix is working - GM should mention player characters
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Select a PLAYER character to verify cross-character mentions work
    await commonRoom.selectCharacterFromAutocomplete('Test Player 1 Character');

    // Verify the mention was inserted
    const textareaValue = await commonRoom.postTextarea.inputValue();
    expect(textareaValue).toContain('@Test Player 1 Character');

    // Complete the post
    const postContent = `Mission Briefing ${Date.now()}: @Test Player 1 Character, you are assigned to the north gate.`;
    await commonRoom.postTextarea.fill(postContent);

    await commonRoom.createPostButton.click();
    await page.waitForLoadState('networkidle');

    // Verify the post appears with the mention
    await commonRoom.verifyPostExists('you are assigned to the north gate');
    await expect(page.getByText('@Test Player 1 Character').locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // Success! This test verifies the bug fix:
    // - Before fix: Autocomplete only showed GM's characters
    // - After fix: Autocomplete shows ALL game characters (player + GM)
    // - GM can now mention player characters in posts
  });

  test('should not render mentions inside code blocks', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MENTIONS');
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Code Test ${Date.now()}: Testing mentions in code blocks`;
      await gmCommonRoom.createPost(postContent);

      // === Player comments with mention inside code block ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      await playerCommonRoom.openCommentForm(postContent);

      // Type comment with mention inside inline code
      const commentWithCode = 'Try using `@Test Player 2 Character` in your code!';
      const textarea = playerCommonRoom.getCommentTextarea(postContent);
      await textarea.fill(commentWithCode);

      await playerCommonRoom.submitComment(postContent);

      // Verify comment appears
      await playerCommonRoom.verifyCommentExists('Try using');

      // Verify the mention inside code is NOT rendered as a mention
      await playerCommonRoom.verifyMentionNotInCodeBlock('@Test Player 2 Character');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
