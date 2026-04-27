import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { navigateToGame } from '../utils/navigation';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Concurrent Editing Scenarios
 *
 * Tests how the application handles simultaneous edits by multiple users
 * to the same resource (character sheets, game settings, etc.)
 */
test.describe('@mobile Concurrent Editing', () => {

  test('should handle two players viewing the same game simultaneously', async ({ browser }) => {
    // Create two separate browser contexts for two different users
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // Both players log in
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');

      // Both navigate to the same game
      const gameId = await getFixtureGameId(player1Page, 'E2E_ACTION');
      await navigateToGame(player1Page, gameId);
      await navigateToGame(player2Page, gameId);

      await player1Page.waitForLoadState('networkidle');
      await player2Page.waitForLoadState('networkidle');

      // Both should be able to view the game
      await expect(player1Page.getByRole('heading', { level: 1 }).or(player1Page.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();
      await expect(player2Page.getByRole('heading', { level: 1 }).or(player2Page.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();

      // Both should have tab navigation visible (mobile: select dropdown; desktop: role=tab)
      const p1MobileSelect = player1Page.locator('select#tab-select');
      const p1IsMobile = await p1MobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
      if (p1IsMobile) {
        await expect(p1MobileSelect).toBeVisible();
      } else {
        expect(await player1Page.getByRole('tab').count()).toBeGreaterThan(0);
      }

      const p2MobileSelect = player2Page.locator('select#tab-select');
      const p2IsMobile = await p2MobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
      if (p2IsMobile) {
        await expect(p2MobileSelect).toBeVisible();
      } else {
        expect(await player2Page.getByRole('tab').count()).toBeGreaterThan(0);
      }

    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('should handle GM editing game settings while player views game', async ({ browser }) => {
    // Create two separate browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM and player log in
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Both navigate to the same game
      const gameId = await getFixtureGameId(gmPage, 'E2E_GAME_SETTINGS');
      await navigateToGame(gmPage, gameId);
      await navigateToGame(playerPage, gameId);

      // Player stays on main view
      await playerPage.waitForLoadState('networkidle');
      const playerGameTitle = await playerPage.getByRole('heading', { level: 1 }).or(playerPage.getByRole('heading', { level: 2 })).locator('visible=true').first().textContent();
      expect(playerGameTitle).toBeTruthy();

      // GM should have game actions menu
      const gameActionsMenu = gmPage.getByLabel('Game actions');
      await expect(gameActionsMenu).toBeVisible({ timeout: 5000 });

      // GM opens menu and clicks "Edit Game"
      await gameActionsMenu.click();
      const editButton = gmPage.getByRole('button', { name: 'Edit Game' });
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();
      await gmPage.waitForLoadState('networkidle');

      // GM should see edit form (check for game title input)
      await expect(gmPage.getByTestId('game-title')).toBeVisible();

      // Player should still see game normally (not affected by GM editing)
      await expect(playerPage.getByRole('heading', { level: 1 }).or(playerPage.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should handle GM and player viewing same game from different perspectives', async ({ browser }) => {
    // Create two separate browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM and player log in
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Both navigate to same game
      const gameId = await getFixtureGameId(gmPage, 'E2E_ACTION');
      await navigateToGame(gmPage, gameId);
      await navigateToGame(playerPage, gameId);

      await gmPage.waitForLoadState('networkidle');
      await playerPage.waitForLoadState('networkidle');

      // Both should see the game
      await expect(gmPage.getByRole('heading', { level: 1 }).or(gmPage.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();
      await expect(playerPage.getByRole('heading', { level: 1 }).or(playerPage.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();

      // GM should see game actions menu
      const gmActionsMenu = await gmPage.getByLabel('Game actions').count();
      expect(gmActionsMenu).toBeGreaterThan(0);

      // Player should NOT see game actions menu
      const playerActionsMenu = await playerPage.getByLabel('Game actions').count();
      expect(playerActionsMenu).toBe(0);

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should handle refresh while viewing same game from different accounts', async ({ browser }) => {
    // Create two separate browser contexts
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // GM and player log in
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Both navigate to the same game
      const gameId = await getFixtureGameId(gmPage, 'E2E_ACTION');
      await navigateToGame(gmPage, gameId);
      await navigateToGame(playerPage, gameId);

      await gmPage.waitForLoadState('networkidle');
      await playerPage.waitForLoadState('networkidle');

      // Both should see the game
      const gmGameTitle = await gmPage.getByRole('heading', { level: 1 }).or(gmPage.getByRole('heading', { level: 2 })).locator('visible=true').first().textContent();
      const playerGameTitle = await playerPage.getByRole('heading', { level: 1 }).or(playerPage.getByRole('heading', { level: 2 })).locator('visible=true').first().textContent();

      expect(gmGameTitle).toBeTruthy();
      expect(playerGameTitle).toBeTruthy();

      // Player refreshes their page
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Player should still see game after refresh
      await expect(playerPage.getByRole('heading', { level: 1 }).or(playerPage.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();
      await expect(playerPage).toHaveURL(new RegExp(`/games/${gameId}`));

      // GM's view should be unaffected
      await expect(gmPage.getByRole('heading', { level: 1 }).or(gmPage.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();
      await expect(gmPage).toHaveURL(new RegExp(`/games/${gameId}`));

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
