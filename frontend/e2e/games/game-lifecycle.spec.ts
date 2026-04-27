import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';

/**
 * E2E Tests for Game Lifecycle Management
 *
 * Tests GM's ability to manage game state transitions:
 * - Start game (character_creation → in_progress)
 * - Pause game (in_progress → paused)
 * - Resume game (paused → in_progress)
 * - Complete game (in_progress → completed)
 * - Cancel game (recruitment → cancelled)
 *
 * Uses dedicated E2E fixtures (E2E_GAME_LIFECYCLE_*) with games in specific states
 *
 * REFACTORED: Using GameDetailsPage POM exclusively
 * - Eliminated inline selectors
 * - Improved reliability with dedicated POM methods
 */

test.describe('@mobile Game Lifecycle Management', () => {
  // Run tests serially to avoid race conditions with game state changes
  test.describe.configure({ mode: 'serial' });

  test('GM can start game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_START');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify we're on the right game page
    await expect(page.getByText('E2E Test: Game Lifecycle - Start')).toBeVisible({ timeout: 10000 });

    // Should see game actions menu (GM permissions)
    const gameActionsMenu = page.getByLabel('Game actions');
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });

    // Start the game using POM (handles kebab menu)
    await gamePage.startGame();

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still see game actions menu (for pause/complete options)
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });
  });

  test('GM can pause game with confirmation', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_PAUSE');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see game actions menu (GM permissions)
    const gameActionsMenu = page.getByLabel('Game actions');
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });

    // Pause the game using POM (handles confirmation modal)
    await gamePage.pauseGame();

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Game actions menu should still be visible (GM can resume)
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });
  });

  test('GM can resume paused game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_RESUME');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see game actions menu (GM permissions)
    const gameActionsMenu = page.getByLabel('Game actions');
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });

    // Resume the game using POM (handles kebab menu)
    await gamePage.resumeGame();

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Game actions menu should still be visible (GM can pause/complete)
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });
  });

  test('GM can complete game with confirmation', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_COMPLETE');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see game actions menu (GM permissions)
    const gameActionsMenu = page.getByLabel('Game actions');
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });

    // Complete the game using POM (handles confirmation modal)
    await gamePage.completeGame();

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // In completed state, GM management buttons should not be visible
    await expect(page.getByRole('button', { name: /Start Game|Pause Game|Resume Game|Complete Game|Cancel Game/ })).not.toBeVisible();
  });

  test('GM can cancel recruitment game', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_CANCEL');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Should see game actions menu (GM permissions)
    const gameActionsMenu = page.getByLabel('Game actions');
    await expect(gameActionsMenu).toBeVisible({ timeout: 10000 });

    // Cancel the game using POM (handles kebab menu + confirmation modal)
    await gamePage.cancelGame();

    // Refresh to see new state
    await page.reload();
    await page.waitForLoadState('networkidle');

    // In cancelled state, game actions menu should show Delete option
    await expect(gameActionsMenu).toBeVisible();
  });

  test('Player cannot see game lifecycle management controls', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_PAUSE');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Player should not see the game actions menu that contains lifecycle controls
    await expect(page.getByLabel('Game actions')).not.toBeVisible({ timeout: 10000 });
  });

  test('GM can delete cancelled game', async ({ page }) => {
    // Testing game deletion and verification it no longer appears in games list
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_LIFECYCLE_CANCEL');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // Verify game title
    await expect(page.getByText('E2E Test: Game Lifecycle - Cancel')).toBeVisible({ timeout: 10000 });

    // Ensure the game is cancelled before trying to delete it.
    // The prior test may have already cancelled it (serial mode), but if not, cancel it now.
    const statusBadge = page.getByTestId('game-status-badge');
    await statusBadge.waitFor({ state: 'visible', timeout: 5000 });
    const currentStatus = await statusBadge.textContent();
    if (!currentStatus?.toLowerCase().includes('cancel')) {
      await gamePage.cancelGame();
      await page.reload();
      await page.waitForLoadState('networkidle');
    }

    // Now delete the game using POM (handles kebab menu + confirmation modal)
    await gamePage.deleteGame();

    // Should redirect to games list after deletion
    await expect(page).toHaveURL(/\/games$/, { timeout: 10000 });

    // Verify the SPECIFIC game ID no longer appears
    // (Other workers may have games with the same title, so we check the specific ID)
    await page.waitForLoadState('networkidle');
    const deletedGameCard = page.getByTestId(`game-card-${gameId}`);
    await expect(deletedGameCard).not.toBeAttached({ timeout: 5000 });
  });
});
