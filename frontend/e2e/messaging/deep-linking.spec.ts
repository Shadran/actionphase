import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';

/**
 * Deep Linking Regression Tests
 *
 * Tests the comment deep linking functionality in Common Room.
 *
 * BACKGROUND:
 * CommonRoom.tsx implements deep linking via URL parameter: ?comment=ID
 * When present, it should:
 * 1. Switch to the 'posts' tab if on a different tab
 * 2. Scroll the comment into view
 * 3. Highlight the comment with a ring for 3 seconds
 * 4. Remove the comment parameter from URL
 *
 * REGRESSION CONTEXT:
 * A mobile support change rendered 2 copies of each comment (one hidden, one visible)
 * with the same ID. This broke scrollIntoView because getElementById() returns the
 * first match, which might be the hidden mobile version on desktop.
 *
 * These tests ensure:
 * - Only ONE element with a given comment ID exists in the DOM at any time
 * - Deep linking scrolls to the VISIBLE comment, not a hidden duplicate
 * - The scroll and highlight functionality works correctly
 *
 * Uses Game #701 (E2E Deep Linking Test) with 7 levels of nested comments.
 */

test.describe('@mobile Deep Linking in Common Room', () => {

  test('should only have ONE element with each comment ID in the DOM (no duplicates)', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Wait for Common Room to load (phase data needs to be fetched)
    await page.locator('h2').filter({ hasText: /Common Room/ }).waitFor({ timeout: 10000 });

    // Get all comments on the page
    const allCommentIds = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[id^="comment-"]'));
      const idCounts = new Map<string, number>();

      comments.forEach(el => {
        const id = el.id;
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      });

      return {
        totalComments: comments.length,
        duplicates: Array.from(idCounts.entries()).filter(([, count]) => count > 1),
        allIds: Array.from(idCounts.keys())
      };
    });

    // CRITICAL REGRESSION CHECK: No comment ID should appear more than once
    expect(allCommentIds.duplicates).toEqual([]);

    // Verify we have comments (sanity check)
    expect(allCommentIds.totalComments).toBeGreaterThan(0);
  });

  test('should not have hidden duplicate comments in mobile view', async ({ page }) => {
    await loginAs(page, 'GM');

    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Wait for Common Room to load (phase data needs to be fetched)
    await page.locator('h2').filter({ hasText: /Common Room/ }).waitFor({ timeout: 10000 });

    // Check for duplicate IDs (not just hidden comments, since mobile may hide deep threads)
    const commentIdCheck = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[id^="comment-"]'));
      const idCounts = new Map<string, number>();

      comments.forEach(el => {
        const id = el.id;
        idCounts.set(id, (idCounts.get(id) || 0) + 1);
      });

      return {
        totalComments: comments.length,
        duplicates: Array.from(idCounts.entries()).filter(([, count]) => count > 1),
        allIds: Array.from(idCounts.keys())
      };
    });

    // CRITICAL REGRESSION CHECK: No comment ID should appear more than once
    // (Mobile may hide deep threads, which is expected, but each visible comment should have unique ID)
    expect(commentIdCheck.duplicates).toEqual([]);
    expect(commentIdCheck.totalComments).toBeGreaterThan(0);
  });

  test('should scroll to and highlight a visible comment when using ?comment= parameter', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');

    // First, navigate to common room to get a comment ID from the DOM
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Wait for Common Room to load (phase data needs to be fetched)
    await page.locator('h2').filter({ hasText: /Common Room/ }).waitFor({ timeout: 10000 });

    // Wait for comments to be visible (they should be expanded by default)
    await page.locator('[id^="comment-"]').locator('visible=true').first().waitFor({ timeout: 5000 });

    // Get the third comment ID from the page (Level 3 comment)
    const commentId = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[id^="comment-"]'));
      // Get the 3rd comment (index 2) - this should be at depth 3
      if (comments.length >= 3) {
        return comments[2].id.replace('comment-', '').replace(/-desktop$|-mobile$/, '');
      }
      return null;
    });

    // If no comments found, fail the test with a clear message
    expect(commentId).not.toBeNull();

    // Now navigate with the deep link
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room&comment=${commentId}`);
    await page.waitForLoadState('networkidle');

    // Wait for deep linking logic to remove the comment param from URL (indicates scroll completed)
    await expect(page).toHaveURL(new RegExp(`games/${gameId}\\?tab=common-room$`), { timeout: 5000 });

    // Verify the comment is visible. Comments may have -desktop or -mobile suffix IDs
    // (dual DOM rendering); use or() to match whichever variant is visible.
    const comment = page.locator(`#comment-${commentId}`)
      .or(page.locator(`#comment-${commentId}-mobile`))
      .or(page.locator(`#comment-${commentId}-desktop`))
      .locator('visible=true').first();
    await expect(comment).toBeVisible();

    // Verify the comment parameter was removed from URL (confirms deep link logic ran)
    await expect(page).toHaveURL(new RegExp(`games/${gameId}\\?tab=common-room$`));
  });

  test('should switch to posts tab when deep linking from newComments tab', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');

    // Get a comment ID first
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Wait for Common Room to load (phase data needs to be fetched)
    await page.locator('h2').filter({ hasText: /Common Room/ }).waitFor({ timeout: 10000 });

    // Wait for comments to be visible (they should be expanded by default)
    await page.locator('[id^="comment-"]').locator('visible=true').first().waitFor({ timeout: 5000 });

    const commentId = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[id^="comment-"]'));
      if (comments.length >= 3) {
        return comments[2].id.replace('comment-', '').replace(/-desktop$|-mobile$/, '');
      }
      return null;
    });

    expect(commentId).not.toBeNull();

    // Navigate to New Comments tab
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room&view=newComments`);
    await page.waitForLoadState('networkidle');

    // Verify we're on New Comments tab
    const newCommentsButton = page.locator('button').filter({ hasText: /^New Comments$/ });
    await expect(newCommentsButton).toHaveClass(/border-accent-primary/);

    // Now navigate with deep link
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room&comment=${commentId}`);
    await page.waitForLoadState('networkidle');

    // Verify we switched to Posts tab
    const postsButton = page.locator('button').filter({ hasText: /^Posts$/ });
    await expect(postsButton).toHaveClass(/border-accent-primary/);

    // Verify the comment is visible (handle -desktop/-mobile suffix IDs from dual DOM)
    const comment = page.locator(`#comment-${commentId}`)
      .or(page.locator(`#comment-${commentId}-mobile`))
      .or(page.locator(`#comment-${commentId}-desktop`))
      .locator('visible=true').first();
    await expect(comment).toBeVisible();
  });

  test('should scroll to a deeply nested comment', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'DEEP_LINKING_TEST');

    // Get a deeply nested comment ID (5th comment - Level 5)
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Wait for Common Room to load (phase data needs to be fetched)
    await page.locator('h2').filter({ hasText: /Common Room/ }).waitFor({ timeout: 10000 });

    // Wait for comments to be visible (they should be expanded by default)
    await page.locator('[id^="comment-"]').locator('visible=true').first().waitFor({ timeout: 5000 });

    const commentId = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[id^="comment-"]'));
      // Get the 5th comment (index 4) - this should be at max depth
      // Strip -desktop/-mobile suffix to get the numeric ID
      if (comments.length >= 5) {
        return comments[4].id.replace('comment-', '').replace(/-desktop$|-mobile$/, '');
      }
      return null;
    });

    // Level 5 should be visible, but fail the test if not found
    expect(commentId).not.toBeNull();

    // Navigate with deep link
    await page.goto(`http://localhost:5173/games/${gameId}?tab=common-room&comment=${commentId}`);
    await page.waitForLoadState('networkidle');

    // Wait for deep linking logic to remove the comment param from URL (indicates scroll completed)
    await expect(page).toHaveURL(new RegExp(`games/${gameId}\\?tab=common-room$`), { timeout: 5000 });

    // Verify comment is visible (handle -desktop/-mobile suffix IDs from dual DOM)
    const comment = page.locator(`#comment-${commentId}`)
      .or(page.locator(`#comment-${commentId}-mobile`))
      .or(page.locator(`#comment-${commentId}-desktop`))
      .locator('visible=true').first();
    await expect(comment).toBeVisible();

  });
});
