import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Infinite scroll E2E tests for the Common Room.
 *
 * Uses Game #710 which has one post with 20 top-level comments.
 * THREADS_PER_PAGE=5 means the sentinel must fire 3 times total to load all 20.
 *
 * With rootMargin=800px the sentinel auto-fires as each page renders — explicit
 * scrolling is not needed in a standard headless viewport. The tests assert the
 * end state (all 20 loaded, no duplicates) rather than the intermediate state.
 */

test.describe('Common Room infinite scroll', () => {
  test('loads all threads via sentinel and shows no duplicates', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'INFINITE_SCROLL');
    await page.goto(`/games/${gameId}?tab=common-room`);

    // Wait for post card to appear (CommonRoom renders as data-testid="post-<id>").
    await expect(page.locator('[data-testid^="post-"]').first()).toBeVisible({ timeout: 15000 });

    // Scroll to the bottom repeatedly until all 20 threads appear. Each scroll
    // brings the sentinel back within the 800px rootMargin and triggers the next
    // page fetch. New content appends below the current position, pushing the
    // sentinel further down, so we need to re-scroll after each fetch.
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const count = await page.getByTestId('threaded-comment').count();
      if (count >= 20) break;
      await page.waitForTimeout(600);
    }

    // All 20 threads must now be present.
    await expect(page.getByTestId('threaded-comment')).toHaveCount(20, { timeout: 5000 });

    // No duplicates: every comment content string must be unique.
    const contents = await page.getByTestId('threaded-comment').allTextContents();
    const unique = new Set(contents.map(t => t.trim()));
    expect(unique.size).toBe(contents.length);

    // Load More button must be gone — has_more should be false after 20 loaded.
    await expect(page.getByRole('button', { name: /Load More Comments/ })).not.toBeVisible();
  });

  test('sentinel triggers loading without manual button clicks', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'INFINITE_SCROLL');
    await page.goto(`/games/${gameId}?tab=common-room`);

    await expect(page.locator('[data-testid^="post-"]').first()).toBeVisible({ timeout: 15000 });

    const loadMoreButton = page.getByRole('button', { name: /Load More Comments/ });

    // Scroll repeatedly to keep the sentinel within range as new pages append.
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const count = await page.getByTestId('threaded-comment').count();
      if (count >= 20) break;
      await page.waitForTimeout(600);
    }

    await expect(page.getByTestId('threaded-comment')).toHaveCount(20, { timeout: 5000 });

    // If we got here without clicking the button, the sentinel did its job.
    await expect(loadMoreButton).not.toBeVisible();
  });
});
