import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { HistoryPage } from '../pages/HistoryPage';
import { getFixtureGameId, setCommentReadMode } from '../fixtures/game-helpers';

/**
 * Manual Comment Read Tracking E2E Tests
 *
 * Tests the manual read/unread tracking feature introduced alongside the
 * "comment_read_mode" user preference.
 *
 * Edge cases covered by unit/component tests:
 * - Opacity-50 fading applied to content div, not outer wrapper (no cascade to replies) ✅
 * - Read button hidden in auto mode ✅
 * - Read button hidden when readOnly=true (history view) ✅
 * - Clicking Read calls onToggleRead with correct args ✅
 *
 * These E2E tests validate the full end-to-end flow:
 * - Mark as read button appears in manual mode
 * - Clicking it toggles to "Unread" and persists after page reload
 * - Button is absent in auto mode
 * - Button is absent in the History (read-only) view
 * - Mark as read works from the New Comments page
 *
 * Fixtures used:
 *   MANUAL_READ_TRACKING (#702) — pre-seeded post 'Read Tracking Test Post' with a
 *                                  Player 2 comment 'Comment for Player 1 to mark as read'
 *   E2E_ACTION_RESULTS (#326)   — completed action phase in history for the read-only test
 */

const FIXTURE_POST = 'Read Tracking Test Post';

test.describe('Manual Comment Read Tracking', () => {
  let gameId: number;

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    gameId = await getFixtureGameId(page, 'MANUAL_READ_TRACKING');
    await setCommentReadMode(page, 'manual');

    // Ensure the fixture comment starts each test as unread.
    // Navigate with manual mode active so the toggle button is visible.
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);
    const btn = page.locator('[data-testid="toggle-read-button"]').first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await btn.textContent().catch(() => '');
      if (text?.trim() === 'Unread') {
        await btn.click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test.afterEach(async ({ page }) => {
    // Reset mode via API — runs even when the test body fails mid-way.
    await setCommentReadMode(page, 'auto');
  });

  test('Read button appears in manual mode and toggles to Unread when clicked', async ({ page }) => {
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    const readButton = page.locator('[data-testid="toggle-read-button"]').first();
    await expect(readButton).toBeVisible({ timeout: 5000 });
    await expect(readButton).toHaveText('Read');

    await readButton.click();
    await page.waitForLoadState('networkidle');
    await expect(readButton).toHaveText('Unread', { timeout: 5000 });
  });

  test('Read state persists after page reload', async ({ page }) => {
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    const readButton = page.locator('[data-testid="toggle-read-button"]').first();
    await expect(readButton).toBeVisible({ timeout: 5000 });
    await readButton.click();
    await expect(readButton).toHaveText('Unread', { timeout: 5000 });

    // Reload and verify the server-side state survived
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    const reloadedButton = page.locator('[data-testid="toggle-read-button"]').first();
    await expect(reloadedButton).toBeVisible({ timeout: 5000 });
    await expect(reloadedButton).toHaveText('Unread');
  });

  test('Can mark comment as read from New Comments page', async ({ page }) => {
    await page.goto(`/games/${gameId}?tab=common-room&view=newComments`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h3:has-text("Recent Comments")', { timeout: 10000 });

    const readButton = page.locator('[data-testid="toggle-read-button"]').first();
    await expect(readButton).toBeVisible({ timeout: 10000 });
    await expect(readButton).toHaveText('Read');

    await readButton.click();
    await page.waitForLoadState('networkidle');
    await expect(readButton).toHaveText('Unread', { timeout: 5000 });
  });
});

// Separate describe block — these tests don't need manual mode set at all,
// so they have no beforeEach/afterEach for mode switching.
test.describe('Comment Read Tracking — button absence', () => {
  test('Read button is absent in auto mode', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'MANUAL_READ_TRACKING');
    // auto is the default; explicitly ensure it in case a previous test leaked state
    await setCommentReadMode(page, 'auto');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    await expect(page.locator('[data-testid="toggle-read-button"]')).toHaveCount(0);
  });

  test('Read button is absent in history (read-only) view', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    // Use the Action Results game — it has a completed action phase in history
    // with Player 1 as a participant, so the history tab is accessible.
    const gameId = await getFixtureGameId(page, 'E2E_ACTION_RESULTS');
    const historyPage = new HistoryPage(page, gameId);
    await historyPage.goto();
    await historyPage.verifyOnPage();
    await historyPage.viewPhaseDetails('Completed Action Phase');

    // History is read-only — toggle-read buttons must never appear here
    // regardless of the user's comment_read_mode preference.
    await expect(page.locator('[data-testid="toggle-read-button"]')).toHaveCount(0);
  });
});
