import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';

/**
 * Journey: Player with Multiple Characters
 *
 * Tests that a player assigned to multiple characters in a game
 * sees and can use the character selector correctly when commenting.
 *
 * Fixture: PLAYER_MULTIPLE_CHARACTERS (Game #340, worker-offset)
 * - GM post 'Character Selector Test Post' pre-seeded — no runtime GM setup needed
 * - Player 1 has TWO characters: 'Aria Moonwhisper' and 'Kael Shadowblade'
 * - Player 2 has ONE character: 'Theron Brightshield' (control)
 */

const FIXTURE_POST = 'Character Selector Test Post';

test.describe('Player with Multiple Characters', () => {
  test('Player with multiple characters sees character selector in comment form', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'PLAYER_MULTIPLE_CHARACTERS');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.openCommentForm(FIXTURE_POST);

    const postCard = commonRoom.getPostCard(FIXTURE_POST);
    const characterSelect = postCard.locator('role=combobox').first();
    await expect(characterSelect).toBeVisible({ timeout: 5000 });
    await expect(characterSelect).toContainText('Aria Moonwhisper');
    await expect(characterSelect).toContainText('Kael Shadowblade');
  });

  test('Player with multiple characters can comment as different characters', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'PLAYER_MULTIPLE_CHARACTERS');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    const comment1 = `Comment as Aria ${Date.now()}: First perspective`;
    await commonRoom.addComment(FIXTURE_POST, comment1, { asCharacter: 'Aria Moonwhisper' });

    const comment1Card = page.locator('[data-testid="threaded-comment"]').filter({ hasText: comment1 }).first();
    await expect(comment1Card.getByText('Aria Moonwhisper').locator('visible=true').first()).toBeVisible();

    const comment2 = `Comment as Kael ${Date.now()}: Second perspective`;
    await commonRoom.addComment(FIXTURE_POST, comment2, { asCharacter: 'Kael Shadowblade' });

    const comment2Card = page.locator('[data-testid="threaded-comment"]').filter({ hasText: comment2 }).first();
    await expect(comment2Card.getByText('Kael Shadowblade').locator('visible=true').first()).toBeVisible();
  });

  test('Player with single character does NOT see character selector, auto-assigns their character', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'PLAYER_MULTIPLE_CHARACTERS');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.openCommentForm(FIXTURE_POST);

    const postCard = commonRoom.getPostCard(FIXTURE_POST);
    await expect(postCard.locator('role=combobox')).not.toBeVisible();

    // Submit comment — should auto-assign the player's only character
    const commentContent = `Comment ${Date.now()}: Auto-assigned character`;
    const textarea = postCard.locator('textarea[placeholder*="Write a comment"]').first();
    await textarea.fill(commentContent);
    await postCard.locator('form').locator('visible=true').first().evaluate((f: HTMLFormElement) => f.requestSubmit());
    await page.waitForLoadState('networkidle');

    const commentCard = page.locator('[data-testid="threaded-comment"]').filter({ hasText: commentContent }).first();
    await expect(commentCard.getByText('Theron Brightshield').locator('visible=true').first()).toBeVisible();
  });

  test('Player can edit comment and change character assignment', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'PLAYER_MULTIPLE_CHARACTERS');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    const commentContent = `Original Comment ${Date.now()}: By Aria`;
    await commonRoom.addComment(FIXTURE_POST, commentContent, { asCharacter: 'Aria Moonwhisper' });

    const commentContainer = page.locator('[data-testid="threaded-comment"]').filter({ hasText: commentContent }).locator('visible=true').first();
    await expect(commentContainer.getByText('Aria Moonwhisper').locator('visible=true').first()).toBeVisible();

    await commentContainer.getByRole('button', { name: 'Edit' }).locator('visible=true').first().click();

    const characterSelect = commentContainer.locator('select').locator('visible=true').first();
    await characterSelect.waitFor({ state: 'visible', timeout: 5000 });
    await characterSelect.selectOption({ label: 'Edit as Kael Shadowblade' });

    await commentContainer.getByRole('button', { name: 'Save' }).locator('visible=true').first().click();
    await page.waitForLoadState('networkidle');

    await expect(commentContainer.getByText('Kael Shadowblade').locator('visible=true').first()).toBeVisible({ timeout: 5000 });
    await expect(commentContainer.getByText('Aria Moonwhisper').first()).not.toBeVisible();
    await expect(commentContainer.getByText('(edited)').locator('visible=true').first()).toBeVisible({ timeout: 3000 });
  });
});
