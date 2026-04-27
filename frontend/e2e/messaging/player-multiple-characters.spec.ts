import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getWorkerGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';

/**
 * Journey: Player with Multiple Characters
 *
 * Tests that a player assigned to multiple characters in a game
 * sees and can use the character selector correctly when commenting.
 *
 * Fixture: Game #340 (Player Multiple Characters Test)
 * - Player 1 has TWO characters: "Aria Moonwhisper" and "Kael Shadowblade"
 * - Player 2 has ONE character: "Theron Brightshield" (control)
 *
 * Note: Players can only comment on posts, not create them.
 * So we use a two-context setup: GM creates post, Player comments on it.
 */
test.describe('Player with Multiple Characters', () => {
  test('Player with multiple characters sees character selector in comment form', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = getWorkerGameId(340); // Player Multiple Characters fixture
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `GM Post ${Date.now()}: Character selector test`;
      await gmCommonRoom.createPost(postContent);

      // === Player 1 (with 2 characters) opens comment form ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      // Wait for post to be visible
      await playerCommonRoom.verifyPostExists(postContent);

      // Open comment form
      await playerCommonRoom.openCommentForm(postContent);

      // CRITICAL: Character selector should be visible for player with multiple characters
      const postCard = playerCommonRoom.getPostCard(postContent);
      const characterSelect = postCard.locator('role=combobox').first();
      await expect(characterSelect).toBeVisible({ timeout: 5000 });

      // Verify both characters are available in the selector
      await expect(characterSelect).toContainText('Aria Moonwhisper');
      await expect(characterSelect).toContainText('Kael Shadowblade');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Player with multiple characters can comment as different characters', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = getWorkerGameId(340);
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Discussion Post ${Date.now()}: Multiple character testing`;
      await gmCommonRoom.createPost(postContent);

      // === Player 1 comments as first character ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      await playerCommonRoom.verifyPostExists(postContent);

      // Add comment as Aria
      const comment1Content = `Comment as Aria ${Date.now()}: First perspective`;
      await playerCommonRoom.addComment(postContent, comment1Content, { asCharacter: 'Aria Moonwhisper' });
      await playerCommonRoom.verifyCommentExists(comment1Content);

      // Verify comment shows "Aria Moonwhisper"
      const comment1 = playerPage.locator('[data-testid="threaded-comment"]').filter({ hasText: comment1Content }).first();
      await expect(comment1.getByText('Aria Moonwhisper').locator('visible=true').first()).toBeVisible();

      // Add comment as Kael
      const comment2Content = `Comment as Kael ${Date.now()}: Second perspective`;
      await playerCommonRoom.addComment(postContent, comment2Content, { asCharacter: 'Kael Shadowblade' });
      await playerCommonRoom.verifyCommentExists(comment2Content);

      // Verify comment shows "Kael Shadowblade"
      const comment2 = playerPage.locator('[data-testid="threaded-comment"]').filter({ hasText: comment2Content }).first();
      await expect(comment2.getByText('Kael Shadowblade').locator('visible=true').first()).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Player with single character does NOT see character selector', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = getWorkerGameId(340);
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Single Character Test ${Date.now()}: No selector needed`;
      await gmCommonRoom.createPost(postContent);

      // === Player 2 (with 1 character) opens comment form ===
      await loginAs(playerPage, 'PLAYER_2');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      await playerCommonRoom.verifyPostExists(postContent);

      // Open comment form
      await playerCommonRoom.openCommentForm(postContent);

      // CRITICAL: Character selector should NOT be visible for player with only 1 character
      const postCard = playerCommonRoom.getPostCard(postContent);
      const characterSelect = postCard.locator('role=combobox');
      await expect(characterSelect).not.toBeVisible();

      // Create a comment - it should auto-use the player's only character
      const commentContent = `Comment ${Date.now()}: Auto-assigned character`;
      const textarea = postCard.locator('textarea[placeholder*="Write a comment"]').first();
      await textarea.fill(commentContent);

      const form = postCard.locator('form').locator('visible=true').first();
      await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await playerPage.waitForLoadState('networkidle');

      // Verify the comment was created with the correct character
      await playerCommonRoom.verifyCommentExists(commentContent);
      const comment = playerPage.locator('[data-testid="threaded-comment"]').filter({ hasText: commentContent }).first();
      await expect(comment.getByText('Theron Brightshield').locator('visible=true').first()).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Player can edit comment and change character assignment', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = getWorkerGameId(340);
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Edit Test Post ${Date.now()}: Character reassignment`;
      await gmCommonRoom.createPost(postContent);

      // === Player 1 comments and then edits to change character ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      await playerCommonRoom.verifyPostExists(postContent);

      // Add comment as Aria
      const commentContent = `Original Comment ${Date.now()}: By Aria`;
      await playerCommonRoom.addComment(postContent, commentContent, { asCharacter: 'Aria Moonwhisper' });
      await playerCommonRoom.verifyCommentExists(commentContent);

      // Verify it shows Aria
      const commentContainer = playerPage.locator('[data-testid="threaded-comment"]').filter({ hasText: commentContent }).locator('visible=true').first();
      await expect(commentContainer.getByText('Aria Moonwhisper').locator('visible=true').first()).toBeVisible();

      // Edit the comment and change to Kael
      const editButton = commentContainer.getByRole('button', { name: 'Edit' }).locator('visible=true').first();
      await editButton.click();

      // Change character to Kael
      const characterSelect = commentContainer.locator('select').locator('visible=true').first();
      await characterSelect.waitFor({ state: 'visible', timeout: 5000 });
      await characterSelect.selectOption({ label: 'Edit as Kael Shadowblade' });

      // Save the edit
      const saveButton = commentContainer.getByRole('button', { name: 'Save' }).locator('visible=true').first();
      await saveButton.click();
      await playerPage.waitForLoadState('networkidle');

      // Verify the character name updated immediately to Kael
      await expect(commentContainer.getByText('Kael Shadowblade').locator('visible=true').first()).toBeVisible({ timeout: 5000 });

      // Verify Aria is no longer showing
      await expect(commentContainer.getByText('Aria Moonwhisper').first()).not.toBeVisible();

      // Verify (edited) marker appears
      await expect(commentContainer.getByText('(edited)').locator('visible=true').first()).toBeVisible({ timeout: 3000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
