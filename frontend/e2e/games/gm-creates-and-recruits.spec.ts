import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GamesListPage } from '../pages/GamesListPage';
import { GameSettingsPage } from '../pages/GameSettingsPage';
import { navigateToGamesList } from '../utils/navigation';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 2: GM Creates Game & Recruits Players
 *
 * Tests the complete game creation and player recruitment flow
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 1)
 * - Improved consistency with GameDetailsPage
 */
test.describe('GM Creates Game & Recruits Players', () => {

  // Helper function to create a game using POM
  async function createTestGame(page: Page) {
    const timestamp = Date.now();
    const gameTitle = `E2E Test Game ${timestamp}`;
    const gameDescription = `Test game created by E2E tests`;

    await navigateToGamesList(page);

    // Use GamesListPage POM to create the game
    const gamesListPage = new GamesListPage(page);
    await gamesListPage.createGame({
      title: gameTitle,
      description: gameDescription,
      genre: 'Test Genre',
      maxPlayers: 4
    });

    return { gameTitle, gameDescription };
  }

  test('GM can create a game', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Create a game
    const { gameTitle } = await createTestGame(page);

    // Verify we're on game details page with correct title and initial state
    await assertTextVisible(page, gameTitle);
    await expect(page.getByTestId('game-status-badge')).toContainText(/setup/i);
  });

  test('GM can start recruitment for a game', async ({ page }) => {
    await loginAs(page, 'GM');

    // Create a fresh setup-state game to test recruitment transition
    const { gameTitle } = await createTestGame(page);
    await assertTextVisible(page, gameTitle);

    // Start recruitment using GameDetailsPage
    const gamePage = new GameDetailsPage(page);
    await gamePage.startRecruitment();

    // Verify state badge updated to Recruiting Players
    const statusBadge = page.getByTestId('game-status-badge');
    await expect(statusBadge).toContainText(/recruiting/i, { timeout: 10000 });

    // Verify recruitment-specific content appeared
    await expect(page.getByRole('heading', { name: /Recruitment Deadline/i, level: 3 }).locator('visible=true').first()).toBeVisible();
  });

  test('GM can create a game with anonymous mode and auto accept audience enabled', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');
    await expect(page).toHaveURL('/dashboard');

    // Navigate to games list
    await navigateToGamesList(page);

    // Create a game with both settings enabled
    const timestamp = Date.now();
    const gameTitle = `E2E Settings Test ${timestamp}`;
    const gamesListPage = new GamesListPage(page);
    const gameId = await gamesListPage.createGame({
      title: gameTitle,
      description: 'Testing game creation with settings enabled',
      genre: 'Test Genre',
      maxPlayers: 4,
      isAnonymous: true,
      autoAcceptAudience: true
    });

    // Verify we're on game details page
    await assertTextVisible(page, gameTitle);
    await expect(page).toHaveURL(new RegExp(`/games/${gameId}`));

    // Open edit modal to verify settings persisted
    const settingsPage = new GameSettingsPage(page);
    await settingsPage.openEditModal();

    // Verify both settings are enabled
    expect(await settingsPage.isAnonymous()).toBe(true);
    expect(await settingsPage.isAutoAcceptAudience()).toBe(true);

    await settingsPage.cancel();
  });
});
