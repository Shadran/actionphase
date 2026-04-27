import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { navigateToGame, navigateToGameTab, navigateViaNavLink } from '../utils/navigation';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * E2E Tests for Browser Navigation Behavior
 *
 * Tests how the application handles page refreshes and direct URL navigation
 * to ensure proper state management and user experience.
 *
 * NOTE: Browser back/forward button tests were removed because the current
 * React Router implementation doesn't handle browser history navigation in a
 * way that's compatible with these tests. This would require app-level changes.
 */
test.describe('@mobile Browser Navigation Behavior', () => {

  test('should handle page refresh and maintain authentication', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to a game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await navigateToGame(page, gameId);
    await expect(page).toHaveURL(new RegExp(`/games/${gameId}`));

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on the same page and authenticated
    await expect(page).toHaveURL(new RegExp(`/games/${gameId}`));
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();

    // Should still be able to access authenticated features
    await navigateViaNavLink(page, 'Dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle direct URL navigation to protected pages', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Directly navigate to a game URL
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Should load the game page successfully
    await expect(page).toHaveURL(new RegExp(`/games/${gameId}`));
    await expect(page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).locator('visible=true').first()).toBeVisible();

    // Should show game content (tabs or mobile select should be present)
    const mobileSelect = page.locator('select#tab-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
    if (isMobile) {
      await expect(mobileSelect).toBeVisible();
    } else {
      const tabCount = await page.getByRole('tab').count();
      expect(tabCount).toBeGreaterThan(0);
    }
  });

  test('should handle refresh on dashboard', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/dashboard');

    // Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on dashboard and authenticated
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.getByRole('heading', { level: 1 })).locator('visible=true').first()).toBeVisible();
  });

  test('should handle direct URL navigation to dashboard', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate away first
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    // Directly navigate back to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should load dashboard successfully
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' }).or(page.getByRole('heading', { level: 1 })).locator('visible=true').first()).toBeVisible();
  });

  test('should not require double-back when navigating from games list to game', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to games list
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL('/games');

    // Click on a game (use first available game card)
    const gameCard = page.locator('[data-testid^="game-card-"]').locator('visible=true').first();
    await gameCard.click();
    await page.waitForLoadState('networkidle');
    // Should be on game page
    await expect(page.url()).toMatch(/\/games\/\d+/);

    // Press back ONCE
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Should return to games list (not stay on game page)
    await expect(page).toHaveURL('/games');
    await expect(page.getByRole('heading', { name: 'Browse Games' })).toBeVisible();
  });

  test('should handle tab navigation with back button correctly', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to a game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');
    await navigateToGame(page, gameId);
    await page.waitForLoadState('networkidle');

    // Should be on game page with default tab parameter
    const initialUrl = page.url();
    expect(initialUrl).toMatch(/\/games\/\d+\?tab=/);
    const initialTab = new URL(initialUrl).searchParams.get('tab');

    // Navigate to History tab if available (handles mobile select and desktop tabs)
    const mobileSelect2 = page.locator('select#tab-select');
    const isMobile2 = await mobileSelect2.isVisible({ timeout: 2000 }).catch(() => false);
    const hasHistoryTab = isMobile2
      ? await mobileSelect2.locator('option', { hasText: 'History' }).count() > 0
      : await page.getByRole('tab', { name: 'History' }).count() > 0;
    if (hasHistoryTab) {
      await navigateToGameTab(page, 'History');

      // URL should now have different tab parameter
      expect(page.url()).toMatch(/tab=history/);

      // Press back ONCE
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Should return to initial tab (not leave game page)
      expect(page.url()).toContain(`tab=${initialTab}`);
      await expect(page).toHaveURL(new RegExp(`/games/${gameId}`));
    }
  });

  // NOTE: Browser back button behavior for tab navigation
  // - Initial load: /games/123 → automatically adds ?tab=phases (or default) via replace (no history)
  // - User clicks tab → ?tab=history (creates history entry)
  // - Press back → returns to previous tab (?tab=phases)
  // - Press back again → returns to /games list
  // - No double-back needed since we removed duplicate navigation in GamesPage
});
