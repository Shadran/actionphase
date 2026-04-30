import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { waitForVisible } from '../utils/waits';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Character Mentions Feature
 *
 * Tests character mention autocomplete and rendering in Common Room posts.
 * Uses COMMON_ROOM_MENTIONS fixture (game #165) which pre-seeds:
 *   - Active common_room phase
 *   - Characters: "GM Test Character", "Test Player 1 Character", "Test Player 2 Character"
 *   - One GM post: "Mission Briefing: Everyone report in!"
 *
 * Tests are independent — no runtime post creation needed for comment-based tests.
 */

const FIXTURE_POST = 'Mission Briefing: Everyone report in!';

test.describe('Character Mentions', () => {

  test('player can mention character in comment with autocomplete', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    await commonRoom.verifyPostExists(FIXTURE_POST);
    await commonRoom.openCommentForm(FIXTURE_POST);

    // Trigger autocomplete
    await commonRoom.typeInComment(FIXTURE_POST, 'Hey @', true);

    // All game characters appear in dropdown
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Select a character from dropdown and submit
    await commonRoom.selectCharacterFromAutocomplete('Test Player 2 Character');
    const textarea = commonRoom.getCommentTextarea(FIXTURE_POST);
    await textarea.fill('Hey @Test Player 2 Character, what do you think?');
    await commonRoom.submitComment(FIXTURE_POST);

    // Comment appears with mention highlighted
    await commonRoom.verifyCommentExists('what do you think?');
    await commonRoom.verifyMentionRendered('Test Player 2 Character');
  });

  test('autocomplete filters as user types', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    await commonRoom.openCommentForm(FIXTURE_POST);

    // Type @ — all characters appear
    await commonRoom.typeInComment(FIXTURE_POST, '@', true);
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Type "Test" — all three still match
    const textarea = commonRoom.getCommentTextarea(FIXTURE_POST);
    await textarea.pressSequentially('Test');
    await waitForVisible(commonRoom.autocompleteDropdown);
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Type "Player1" — only "Test Player 1 Character" matches
    await textarea.pressSequentially('Player1');
    await waitForVisible(commonRoom.autocompleteDropdown);
    await expect(page.getByRole('listbox').getByText('Test Player 1 Character', { exact: true })).toBeVisible();
    await expect(page.getByRole('listbox').getByText('Test Player 2 Character', { exact: true })).not.toBeVisible();
    await expect(page.getByRole('listbox').getByText('GM Test Character', { exact: true })).not.toBeVisible();
  });

  test('mentions and markdown render correctly together', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    await commonRoom.openCommentForm(FIXTURE_POST);

    const commentWithMarkdown = 'Hey @Test Player 2 Character, check out **this bold text** and *this italic*!';
    const textarea = commonRoom.getCommentTextarea(FIXTURE_POST);
    await textarea.fill(commentWithMarkdown);
    await commonRoom.submitComment(FIXTURE_POST);

    // Bold, italic, and mention all render correctly after round-trip
    await expect(page.locator('strong').filter({ hasText: 'this bold text' }).locator('visible=true').first()).toBeVisible();
    await expect(page.locator('em').filter({ hasText: 'this italic' }).locator('visible=true').first()).toBeVisible();
    await commonRoom.verifyMentionRendered('Test Player 2 Character');
  });

  test('GM can mention player characters in posts (all characters visible in autocomplete)', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Expand post form if collapsed
    const expandButton = page.locator('button:has-text("Create New GM Post")').locator('visible=true').first();
    if (await expandButton.isVisible().catch(() => false)) {
      await expandButton.click();
    }
    await expect(commonRoom.createPostHeading).toBeVisible({ timeout: 5000 });
    await commonRoom.postTextarea.click();
    await commonRoom.postTextarea.pressSequentially('Mission: @');

    // ALL game characters appear — guards the bug where autocomplete only showed GM's own characters
    await commonRoom.verifyAutocompleteCharacters([
      'Test Player 1 Character',
      'Test Player 2 Character',
      'GM Test Character',
    ]);

    // Select a PLAYER character to confirm cross-character mentions work
    await commonRoom.selectCharacterFromAutocomplete('Test Player 1 Character');
    const textareaValue = await commonRoom.postTextarea.inputValue();
    expect(textareaValue).toContain('@Test Player 1 Character');

    // Submit the post and verify mention renders
    const postContent = `Mention Regression ${Date.now()}: @Test Player 1 Character, north gate.`;
    await commonRoom.postTextarea.fill(postContent);
    await commonRoom.createPostButton.click();
    await page.waitForLoadState('networkidle');

    await commonRoom.verifyPostExists('north gate');
    await expect(page.getByText('@Test Player 1 Character').locator('visible=true').first()).toBeVisible({ timeout: 5000 });
  });

  test('mentions inside code blocks are not rendered as mention links', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MENTIONS');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    await commonRoom.openCommentForm(FIXTURE_POST);

    const textarea = commonRoom.getCommentTextarea(FIXTURE_POST);
    await textarea.fill('Try using `@Test Player 2 Character` in your code!');
    await commonRoom.submitComment(FIXTURE_POST);

    await commonRoom.verifyCommentExists('Try using');
    await commonRoom.verifyMentionNotInCodeBlock('@Test Player 2 Character');
  });
});
