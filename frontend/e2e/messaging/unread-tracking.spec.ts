import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';

/**
 * Unread Comment Tracking E2E Tests
 *
 * Fixture: UNREAD_TRACKING (Game #703)
 * - GM post "Unread Tracking Test Post" pre-seeded
 * - Player 1 has a read marker from 3 days ago
 * - Player 2 comment "Unread comment from Player 2" seeded 1 day ago
 *   (after Player 1's read marker → appears as unread to Player 1)
 *
 * Edge cases covered by backend tests:
 * - User's own comments excluded from unread list
 * - Nested comments at all levels included
 * - First visit (no unread markers)
 * - Marking as read updates timestamps
 */

const FIXTURE_POST = 'Unread Tracking Test Post';

test.describe('Unread Comment Tracking', () => {
  test('NEW badge appears on comments posted after user last visited', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'UNREAD_TRACKING');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Expand comments to reveal the thread (Player 1 has a prior read marker
    // so the post is in "already visited" state — new comments since then are unread)
    await commonRoom.expandComments(FIXTURE_POST);

    const postCard = commonRoom.getPostCard(FIXTURE_POST);
    const newBadge = postCard.locator('span:has-text("NEW")').locator('visible=true').first();
    await expect(newBadge).toBeVisible({ timeout: 5000 });
  });

  test('NEW badge is gone after navigating away and back (read state updates on expand)', async ({ page }) => {
    // Use PLAYER_2 so this test has its own isolated read marker and does not
    // corrupt PLAYER_1's state used by the first test
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'UNREAD_TRACKING');

    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // First visit: expand comments — this updates last_read_at, marking all as read
    await commonRoom.expandComments(FIXTURE_POST);

    const postCard = commonRoom.getPostCard(FIXTURE_POST);
    await expect(postCard.locator('span:has-text("NEW")').locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // Navigate away and back — the read state should have been persisted to the DB
    await commonRoom.goto(gameId);
    await commonRoom.expandComments(FIXTURE_POST);

    const reloadedPostCard = commonRoom.getPostCard(FIXTURE_POST);
    await expect(reloadedPostCard.locator('span:has-text("NEW")').locator('visible=true')).toHaveCount(0);
  });
});
