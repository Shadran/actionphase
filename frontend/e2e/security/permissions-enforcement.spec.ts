import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId, getWorkerUsername } from '../fixtures/game-helpers';
import { navigateToGame, navigateToGameTab, assertTabNotVisible } from '../utils/navigation';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * E2E Tests for Permissions & Access Control
 *
 * Tests that security boundaries are properly enforced across the application:
 * - Players cannot access GM-only features
 * - Players cannot edit other players' content
 * - Audience members have read-only access
 * - Character ownership is enforced
 * - API endpoints reject unauthorized requests with 403
 *
 * CRITICAL: These tests verify security controls that protect game integrity
 * and user privacy. Failures here indicate serious security issues.
 */

test.describe('@mobile Permissions & Access Control', () => {

  test.describe('GM-Only Features', () => {
    test('player cannot access phase management tab', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);
      await assertTabNotVisible(page, 'Phases');
    });

    test('player cannot edit game settings', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);
      await assertTabNotVisible(page, 'Settings');
      await expect(page.getByRole('button', { name: /Edit Game|Game Settings/ })).toHaveCount(0);
    });
  });

  test.describe('Character Ownership', () => {
    test('player cannot edit another player\'s character', async ({ page }) => {
      // Single context: log in as Player 2 and verify no Edit button on Player 1's character card.
      // Player 2 DOES see their own Edit button — the absence on Player 1's card is the assertion.
      await loginAs(page, 'PLAYER_2');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);
      await navigateToGameTab(page, 'People');

      // Player 1's character card is visible but must not have an Edit button
      const player1CharacterCard = page.getByTestId('character-card')
        .filter({ hasText: 'E2E Test Char 1' })
        .filter({ hasText: getWorkerUsername('TestPlayer1') });
      await expect(player1CharacterCard.first()).toBeVisible();
      await expect(player1CharacterCard.first().getByRole('button', { name: /Edit/ })).not.toBeVisible();

      // Player 2 DOES see their own Edit button — proves the button exists, just not on others
      const player2CharacterCard = page.getByTestId('character-card')
        .filter({ hasText: 'E2E Test Char 2' })
        .filter({ hasText: getWorkerUsername('TestPlayer2') });
      await expect(player2CharacterCard.first().getByRole('button', { name: /Edit/ })).toBeVisible();
    });

    test('player can only upload avatar for their own character', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      await navigateToGame(page, gameId);
      await navigateToGameTab(page, 'People');

      // Only one visible Edit Sheet button — for Player 1's own character
      const allEditButtons = page.getByRole('button', { name: 'Edit Sheet' }).locator('visible=true');
      await expect(allEditButtons).toHaveCount(1);

      // Opening the sheet shows the upload button — wait for URL and modal to load
      await allEditButtons.first().click();
      await page.waitForURL(/character=/, { timeout: 10000 });
      const uploadButton = page.getByRole('button', { name: 'Upload Avatar' }).or(
        page.locator('button[title="Upload Avatar"]')
      );
      await expect(uploadButton).toBeVisible({ timeout: 15000 });
      await page.keyboard.press('Escape');
    });
  });

  test.describe('Audience Permissions', () => {
    test('audience without characters cannot post in common room', async ({ page }) => {
      // AUDIENCE user is not a participant in game 164 (COMMON_ROOM_POSTS) — only
      // Player 1 and Player 2 have characters there — so no post/comment controls appear.
      await loginAs(page, 'AUDIENCE');
      const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
      await navigateToGame(page, gameId);
      await navigateToGameTab(page, 'Common Room');

      await expect(page.getByRole('button', { name: /Create Post|New Post/ })).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Add Comment' })).toHaveCount(0);
    });

    test('audience members cannot submit actions', async ({ page }) => {
      await loginAs(page, 'AUDIENCE');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await navigateToGame(page, gameId);

      // If the Actions tab is present, opening it must not show a submit button.
      // NPCs cannot submit actions — only player characters can.
      const mobileSelect = page.locator('select#tab-select');
      const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
      const hasActionsTab = isMobile
        ? await mobileSelect.locator('option', { hasText: 'Actions' }).count() > 0
        : await page.getByRole('tab', { name: 'Actions' }).isVisible();

      if (hasActionsTab) {
        await navigateToGameTab(page, 'Actions');
        await expect(page.getByRole('button', { name: /Submit Action|Create Action/ })).not.toBeVisible();
      }
    });
  });

  test.describe('Private Content Access', () => {
    test('player cannot see private conversations they are not part of', async ({ page }) => {
      // Conversation 9992 ("Test 2: Cannot Delete Others") is pre-seeded between
      // Player 1 and Player 2 only. Player 3 is a game participant but NOT in that
      // conversation — they must not see it in their messages list.
      await loginAs(page, 'PLAYER_3');
      const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');

      const messaging = new MessagingPage(page);
      await messaging.goto(gameId);

      // Player 3's conversation list must not contain the Player 1↔Player 2 conversation
      await expect(page.locator('[data-testid="conversation-item"]').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Test 2: Cannot Delete Others')).not.toBeVisible();
    });
  });

  test.describe('API Authorization', () => {
    test('player cannot modify game settings via direct API call', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');

      const response = await page.evaluate(async (gid: number) => {
        const res = await fetch(`/api/v1/games/${gid}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Hacked Game Title' }),
        });
        return { status: res.status, ok: res.ok };
      }, gameId);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.ok).toBe(false);
    });

    test('player cannot create phase via direct API call', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');
      const gameId = await getFixtureGameId(page, 'E2E_ACTION');

      const response = await page.evaluate(async (gid: number) => {
        const res = await fetch(`/api/v1/games/${gid}/phases`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase_type: 'action',
            title: 'Unauthorized Phase',
            description: 'Player tried to create phase',
          }),
        });
        return { status: res.status, ok: res.ok };
      }, gameId);

      expect(response.status).toBe(403);
      expect(response.ok).toBe(false);
    });
  });
});
