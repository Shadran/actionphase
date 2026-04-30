import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { assertTabSelected } from '../utils/navigation';

test.describe('Recent Results Section in Common Room', () => {
  test('should display recent results section for player after action phase', async ({ page }) => {
    // Login as TestPlayer1 (participates in E2E Test: Action Results)
    await loginAs(page, 'PLAYER_1');

    // Navigate to E2E Action Results game Common Room tab
    // This game has Phase 1 (action, expired) → Phase 2 (common room, active)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    await page.goto(`/games/${gameId}?tab=common-room`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify Recent Results Section appears
    await expect(page.getByText('Recent Action Results')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('From Completed Action Phase')).toBeVisible();

    // Verify results badge shows count (player sees only their own result)
    await expect(page.getByText('1 result')).toBeVisible();
  });

  test('should expand and collapse results section', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Initially expanded (first view)
    await expect(page.getByText('Recent Action Results')).toBeVisible({ timeout: 10000 });

    // Check for result content (not username, as that's in a header that stays visible)
    await expect(page.getByText(/You descend into the basement/)).toBeVisible();

    // Click header to collapse
    const header = page.getByText('Recent Action Results');
    await header.click();

    // Should hide result content
    await expect(page.getByText(/You descend into the basement/)).not.toBeVisible();

    // Click header again to expand
    await header.click();

    // Should show result content again
    await expect(page.getByText(/You descend into the basement/)).toBeVisible();
  });

  test('should remember collapsed state on second visit (localStorage)', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    // Clear localStorage so this test always starts from the expanded (first-visit) state
    await page.evaluate(() => localStorage.clear());
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // First visit - should be expanded
    await expect(page.getByText('Recent Action Results')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/You descend into the basement/)).toBeVisible();

    // Reload page (simulates second visit)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Second visit - should be collapsed (auto-collapse after first view)
    await expect(page.getByText('Recent Action Results')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/You descend into the basement/)).not.toBeVisible();
  });

  test('should expand individual result to show full content', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Wait for section to be visible
    await expect(page.getByText('Recent Action Results')).toBeVisible({ timeout: 10000 });

    // Initially shows preview only (first ~150 characters)
    const previewText = page.getByText(/You descend into the basement/);
    await expect(previewText).toBeVisible();

    // Click on the preview text to expand the result
    await previewText.click();

    // Should show full markdown content as heading (from the markdown in the result)
    await expect(page.getByRole('heading', { name: /Basement Investigation Results/i })).toBeVisible();
  });

  test('should navigate to History tab when clicking "View Full Results"', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Recent Action Results')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'View Full Results' }).locator('visible=true').first().click();

    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain(`/games/${gameId}?tab=history&phase=`);
  });

  test('should NOT show results section when previous phase is not action type', async ({ page }) => {
    await loginAs(page, 'GM');

    // Navigate to a game where previous phase is NOT action type
    // Using Game #164 or any game with common_room → common_room sequence
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Common Room tab should be active
    await assertTabSelected(page, 'Common Room');

    // Recent Results Section should NOT appear
    await expect(page.getByText('Recent Action Results')).not.toBeVisible();
  });

  test('should NOT show results to GM (GMs do not see recent results)', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // GM should NOT see Recent Results Section (only players see their results)
    await expect(page.getByText('Recent Action Results')).not.toBeVisible();
  });


});
