import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { PollsPage } from '../pages/PollsPage';

/**
 * E2E Tests for Common Room Polling System
 *
 * Test Structure (following Test Pyramid principles):
 * 1. Happy Path - Basic smoke test that polls work end-to-end
 * 2. Error-Free Behavior - No console errors, no unauthorized API calls
 * 3. State Persistence - State survives page reloads
 * 4. Permission Enforcement - Role-based access control
 *
 * IMPORTANT: These tests validate USER EXPERIENCE, not just UI state:
 * - Visual feedback (badges, results)
 * - Error-free behavior (no 403s, no loading flashes)
 * - State persistence (reload page, state maintained)
 * - Permission enforcement (players can't see what they shouldn't)
 *
 * See .claude/planning/POLL_VOTING_BUGS.md for detailed analysis of why
 * testing only UI state is insufficient.
 */

/**
 * Helper: Monitor console errors and API calls
 */
function setupMonitoring(page: { on: (event: string, handler: (arg: { type: () => string; text: () => string } | { url: () => string }) => void) => void }) {
  const consoleErrors: string[] = [];
  const apiCalls: string[] = [];

  page.on('console', (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('request', (req: { url: () => string }) => {
    apiCalls.push(req.url());
  });

  return { consoleErrors, apiCalls };
}

/**
 * Helper: Check for poll-related errors
 */
function checkPollErrors(consoleErrors: string[], testName: string) {
  const pollErrors = consoleErrors.filter(err =>
    err.includes('403') ||
    err.includes('Forbidden') ||
    err.includes('/polls/') ||
    err.includes('/results')
  );

  if (pollErrors.length > 0) {
    throw new Error(
      `[${testName}] Found ${pollErrors.length} poll-related errors:\n${pollErrors.join('\n')}`
    );
  }
}


// ============================================================================
// ALL POLL TESTS (SERIAL)
// ============================================================================
// All tests run serially to allow polls created in early tests to persist
// for later tests (testing state persistence, permissions, etc.)

test.describe.serial('Polls Flow', () => {
  // ==========================================================================
  // TEST CATEGORY 1: HAPPY PATH (Smoke Test)
  // ==========================================================================
  // Purpose: Verify basic poll functionality works end-to-end
  // This is the "does the feature work at all?" test

  test('GM creates player-level poll successfully', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Create poll using POM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await pollsPage.createPoll({
      question: 'What should the party do next?',
      description: 'Vote for the next adventure direction',
      deadline: tomorrow,
      options: [
        'Explore the abandoned castle',
        'Investigate the mysterious forest',
        'Return to town for supplies'
      ],
      allowOther: true
    });

    // GMs see "Show Results" and "Delete Poll" buttons instead of vote status badges
    await expect(page.getByRole('button', { name: 'Show Results' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Poll' })).toBeVisible();
  });

  test('Player votes on poll and sees correct badge', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Vote using POM
    await pollsPage.voteOnPoll('What should the party do next?', 'Investigate the mysterious forest');

    // Verify badge updated
    expect(await pollsPage.getPollVoteStatus('What should the party do next?')).toBe('voted');

    // Verify "Your vote:" summary appears with the selected option
    await expect(page.getByText('Your vote:').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Investigate the mysterious forest')).toBeVisible();
  });

  // ==========================================================================
  // TEST CATEGORY 2: ERROR-FREE BEHAVIOR
  // ==========================================================================
  // Purpose: Validate that poll voting does NOT produce errors or unauthorized calls
  // These tests explicitly check for bugs that were missed by only testing UI state
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Player voting does not trigger 403 errors or Loading results flash', async ({ page }) => {
    const { consoleErrors } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    await pollsPage.voteOnPoll('What should the party do next?', 'Explore the abandoned castle');

    // CRITICAL: "Loading results..." should NEVER appear for players on active polls
    await expect(page.getByText('Loading results...')).not.toBeVisible({ timeout: 100 });

    // EXPLICIT check for 403 errors
    checkPollErrors(consoleErrors, 'Player voting does not trigger 403 errors or Loading results flash');
  });

  test('Players do not make /results API calls on active polls', async ({ page }) => {
    const { apiCalls } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Just navigate to polls tab - should not make /results calls
    // Small settle time to capture any async calls triggered on mount
    await page.waitForLoadState('networkidle');

    // Verify NO calls to POLL results endpoint (/polls/{id}/results) for active polls
    // Note: /games/{id}/results/mine is a different endpoint for action results, which is OK
    const pollResultsCalls = apiCalls.filter(url => url.includes('/polls/') && url.includes('/results'));
    if (pollResultsCalls.length > 0) {
      throw new Error(
        `[Players do not make /results API calls on active polls] Made ${pollResultsCalls.length} unauthorized poll results calls: ${pollResultsCalls.join(', ')}`
      );
    }
  });

  // ==========================================================================
  // TEST CATEGORY 3: STATE PERSISTENCE
  // ==========================================================================
  // Purpose: Verify that poll state (voted badges) persists across page reloads
  // This would have caught Bug #4 (missing user_has_voted field in backend)
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Voted badge persists after page reload (player vote)', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Wait for vote status badges to load (populated by separate API call)
    await expect(page.getByText('Voted').first()).toBeVisible({ timeout: 5000 });

    // Verify badge shows "Voted" for previously voted poll
    expect(await pollsPage.getVotedBadgeCount()).toBe(1);

    // Reload page (loses query params, so we need to navigate again)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Navigate back to polls tab
    await pollsPage.goto();

    // Wait for loading state to clear
    await expect(page.getByText('Loading polls')).not.toBeVisible({ timeout: 5000 });

    // Wait for polls to load after reload
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Wait for vote status badges to load after reload
    await expect(page.getByText('Voted').first()).toBeVisible({ timeout: 5000 });

    // Badge should STILL show "Voted" (tests API contract persists across reload)
    expect(await pollsPage.getVotedBadgeCount()).toBe(1);
  });

  test('Your vote summary persists after page reload', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for poll to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Reload page and re-navigate to polls
    await page.reload();
    await page.waitForLoadState('networkidle');
    await pollsPage.goto();

    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // "Your vote:" summary should still be visible (fetched fresh from backend)
    // Use .first() as multiple polls may show "Your vote:" (PLAYER_1 voted on both polls)
    await expect(page.getByText('Your vote:').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Investigate the mysterious forest')).toBeVisible();
  });

  test('Voted badge count remains correct after page reload', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Wait for vote status badges to load (populated by separate API call)
    await expect(page.getByText('Voted').first()).toBeVisible({ timeout: 5000 });

    // Should have 1 "Voted" badge from previous tests
    expect(await pollsPage.getVotedBadgeCount()).toBe(1);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    await pollsPage.goto();

    // Wait for polls to load after reload
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Wait for vote status badges to load after reload
    await expect(page.getByText('Voted').first()).toBeVisible({ timeout: 5000 });

    // Should STILL have 1 "Voted" badge (validates vote persistence)
    expect(await pollsPage.getVotedBadgeCount()).toBe(1);
  });

  // ==========================================================================
  // TEST CATEGORY 4: PERMISSION ENFORCEMENT
  // ==========================================================================
  // Purpose: Verify role-based access control for poll results
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Player cannot view results on active poll', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Player should NOT see "Show Results" button on ANY active poll
    expect(await pollsPage.canViewResults()).toBe(false);
    await expect(page.getByRole('button', { name: 'Hide Results' })).not.toBeVisible();
  });

  test('GM can view results on active poll', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for loading state to clear
    await expect(page.getByText('Loading polls')).not.toBeVisible({ timeout: 5000 });

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // GM should see "Show Results" button
    expect(await pollsPage.canViewResults()).toBe(true);

    // Show results using POM
    await pollsPage.showResults(0);

    // Should see results
    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();
    await expect(page.getByText(/votes/)).toBeVisible();

    // Button changes to "Hide Results"
    await expect(page.getByRole('button', { name: 'Hide Results' }).first()).toBeVisible();
  });

  test('Audience can toggle results on active poll', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for loading state to clear
    await expect(page.getByText('Loading polls')).not.toBeVisible({ timeout: 5000 });

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Audience should see "Show Results" button
    expect(await pollsPage.canViewResults()).toBe(true);

    // Toggle results using POM
    await pollsPage.showResults(0);
    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();

    await pollsPage.hideResults(0);
    await expect(page.getByRole('heading', { name: 'Results' }).first()).not.toBeVisible();
  });

  // ==========================================================================
  // TEST CATEGORY 5: ADDITIONAL FEATURES
  // ==========================================================================
  // Purpose: Test other poll features (filtering, etc.)
  // NOTE: These tests depend on polls created in Happy Path tests above

  test('Poll filtering shows/hides expired polls', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // Wait for polls to load
    await expect(page.getByRole('heading', { name: 'What should the party do next?' })).toBeVisible({ timeout: 5000 });

    // Should show "Active Polls" by default
    await expect(page.getByText(/Active Polls/)).toBeVisible();

    // If there's an expired polls toggle, test it
    const expiredToggle = page.locator('input[type="checkbox"][id="show-expired"]');
    if (await expiredToggle.isVisible()) {
      await pollsPage.toggleExpiredPolls();
      await expect(page.getByText(/Expired Polls/)).toBeVisible({ timeout: 3000 });
    }
  });
});
