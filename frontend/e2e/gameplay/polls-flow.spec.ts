import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { PollsPage } from '../pages/PollsPage';

/**
 * E2E Tests for Common Room Polling System
 *
 * Uses COMMON_ROOM_POLLS fixture which pre-seeds:
 * - Active poll: "What should the party do next?" with 3 options
 * - PLAYER_1's vote pre-cast on "Investigate the mysterious forest"
 *
 * Test categories:
 * 1. Happy Path — basic poll creation and voting
 * 2. Error-Free Behavior — no 403s, no unauthorized API calls
 * 3. State Persistence — vote state survives page reloads
 * 4. Permission Enforcement — role-based access control
 *
 * Tests are independent (no serial dependency) because read/vote/permission
 * tests use the pre-seeded fixture poll rather than the runtime-created one.
 */

const FIXTURE_POLL = 'What should the party do next?';

function setupMonitoring(page: Page) {
  const consoleErrors: string[] = [];
  const apiCalls: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('request', (req) => {
    apiCalls.push(req.url());
  });

  return { consoleErrors, apiCalls };
}

function checkPollErrors(consoleErrors: string[], testName: string) {
  const pollErrors = consoleErrors.filter(err =>
    err.includes('403') || err.includes('Forbidden') ||
    err.includes('/polls/') || err.includes('/results')
  );
  if (pollErrors.length > 0) {
    throw new Error(`[${testName}] Found ${pollErrors.length} poll-related errors:\n${pollErrors.join('\n')}`);
  }
}

test.describe('Polls Flow', () => {

  // ==========================================================================
  // HAPPY PATH
  // ==========================================================================

  test('GM creates player-level poll successfully', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await pollsPage.createPoll({
      question: 'Should we rest before continuing?',
      description: 'The party needs to decide',
      deadline: tomorrow,
      options: ['Rest now', 'Press on'],
      allowOther: false
    });

    // GMs see "Show Results" and "Delete Poll" buttons instead of vote status badges
    await expect(page.getByRole('button', { name: 'Show Results' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Poll' }).first()).toBeVisible();
  });

  test('Player votes on poll and sees correct badge', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();

    // PLAYER_2 has not voted on the fixture poll — cast a fresh vote
    await pollsPage.voteOnPoll(FIXTURE_POLL, 'Explore the abandoned castle');

    expect(await pollsPage.getPollVoteStatus(FIXTURE_POLL)).toBe('voted');
    await expect(page.getByText('Your vote:').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Explore the abandoned castle')).toBeVisible();
  });

  // ==========================================================================
  // ERROR-FREE BEHAVIOR
  // ==========================================================================

  test('Player voting does not trigger 403 errors or Loading results flash', async ({ page }) => {
    const { consoleErrors } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_3');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();
    await pollsPage.voteOnPoll(FIXTURE_POLL, 'Return to town for supplies');

    // "Loading results..." should NEVER appear for players on active polls
    await expect(page.getByText('Loading results...')).not.toBeVisible({ timeout: 100 });
    checkPollErrors(consoleErrors, 'Player voting does not trigger 403 errors');
  });

  test('Players do not make /results API calls on active polls', async ({ page }) => {
    const { apiCalls } = setupMonitoring(page);

    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();
    await page.waitForLoadState('networkidle');

    // No calls to the poll results endpoint (/polls/{id}/results) for active polls
    const pollResultsCalls = apiCalls.filter(url => url.includes('/polls/') && url.includes('/results'));
    if (pollResultsCalls.length > 0) {
      throw new Error(`Made ${pollResultsCalls.length} unauthorized poll results calls: ${pollResultsCalls.join(', ')}`);
    }
  });

  // ==========================================================================
  // STATE PERSISTENCE
  // ==========================================================================

  test('Voted badge and vote summary persist after page reload', async ({ page }) => {
    // PLAYER_1's vote on the fixture poll is pre-seeded — no dependency on test 2
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();
    await expect(page.getByRole('heading', { name: FIXTURE_POLL })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Voted').first()).toBeVisible({ timeout: 5000 });
    expect(await pollsPage.getVotedBadgeCount()).toBeGreaterThanOrEqual(1);

    // Reload and re-navigate
    await page.reload();
    await page.waitForLoadState('networkidle');
    await pollsPage.goto();

    await expect(page.getByText('Loading polls')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: FIXTURE_POLL })).toBeVisible({ timeout: 5000 });

    // Badge persists (tests API contract — user_has_voted field returned from backend)
    await expect(page.getByText('Voted').first()).toBeVisible({ timeout: 5000 });
    expect(await pollsPage.getVotedBadgeCount()).toBeGreaterThanOrEqual(1);

    // "Your vote:" summary persists (fetched fresh from backend on reload)
    await expect(page.getByText('Your vote:').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Investigate the mysterious forest')).toBeVisible();
  });

  // ==========================================================================
  // PERMISSION ENFORCEMENT
  // ==========================================================================

  test('Player cannot view results on active poll', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();
    await expect(page.getByRole('heading', { name: FIXTURE_POLL })).toBeVisible({ timeout: 5000 });

    expect(await pollsPage.canViewResults()).toBe(false);
    await expect(page.getByRole('button', { name: 'Hide Results' })).not.toBeVisible();
  });

  test('GM can view results on active poll', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();
    await expect(page.getByText('Loading polls')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: FIXTURE_POLL })).toBeVisible({ timeout: 5000 });

    expect(await pollsPage.canViewResults()).toBe(true);
    await pollsPage.showResults(0);

    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();
    await expect(page.getByText(/votes?/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide Results' }).first()).toBeVisible();
  });

  test('Audience can toggle results on active poll', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POLLS');
    const pollsPage = new PollsPage(page, gameId);

    await pollsPage.goto();
    await expect(page.getByText('Loading polls')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: FIXTURE_POLL })).toBeVisible({ timeout: 5000 });

    expect(await pollsPage.canViewResults()).toBe(true);

    await pollsPage.showResults(0);
    await expect(page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();

    await pollsPage.hideResults(0);
    await expect(page.getByRole('heading', { name: 'Results' }).first()).not.toBeVisible();
  });
});
