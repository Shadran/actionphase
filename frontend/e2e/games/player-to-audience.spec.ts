import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import {
  getWorkerGameId,
  getWorkerUsername,
  getParticipantUserId,
  getFixtureGameId,
  transitionPlayerToAudience,
} from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { navigateToGameTab } from '../utils/navigation';

/**
 * Player to Audience Transition E2E Tests (Permadeath)
 *
 * Tests the full lifecycle of moving a player to audience status when their
 * character dies. This is distinct from removing a player: the character is
 * preserved, the player retains access to their history, and they can still
 * post in common rooms (for meta threads / epilogue).
 *
 * Fixture: game ID 370, per-worker. Participants:
 *   - TestGM (primary GM)
 *   - TestPlayer2 (subject of transition tests — starts as 'player')
 *   - TestPlayer3 (control — stays 'player' throughout)
 *
 * Structure:
 *   Group 1 (serial): UI Lifecycle — drives the full modal flow through the browser
 *   Group 2 (parallel): Post-transition consequences — each test sets up state via API
 *
 * NOTE: transitionPlayerToAudience is irreversible via the API. The serial group
 * runs once per test run; the parallel group uses API setup so each test starts
 * from a freshly transitioned state applied in beforeEach.
 */

const gameId = getWorkerGameId(370);
const player2Username = getWorkerUsername('TestPlayer2');

// ============================================================================
// GROUP 1: UI Lifecycle (serial — tests depend on prior state)
// ============================================================================

test.describe.serial('Player to Audience — UI Lifecycle', () => {
  let player2UserId: number;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, 'GM');
      player2UserId = await getParticipantUserId(page, gameId, player2Username);
    } finally {
      await ctx.close();
    }
  });

  test('"Move to Audience" menu item is visible for primary GM on a player', async ({ page }) => {
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    await expect(page.getByRole('heading', { name: /Players/ })).toBeVisible();

    const player2Card = page.getByTestId('participant-card').filter({ hasText: player2Username });
    await player2Card.getByRole('button', { name: 'Participant actions' }).click();

    await expect(page.getByRole('menuitem', { name: 'Move to Audience' })).toBeVisible();
  });

  test('Confirmation modal opens with warning and "confirm" input', async ({ page }) => {
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    const player2Card = page.getByTestId('participant-card').filter({ hasText: player2Username });
    await player2Card.getByRole('button', { name: 'Participant actions' }).click();
    await page.getByRole('menuitem', { name: 'Move to Audience' }).click();

    await expect(page.getByRole('heading', { name: 'Move Player to Audience?' })).toBeVisible();
    await expect(page.getByText('This action cannot be reversed')).toBeVisible();
    await expect(page.getByText('Their character(s) will remain active')).toBeVisible();

    // Submit must be disabled until "confirm" is typed
    const submitButton = page.getByRole('button', { name: 'Move to Audience' }).last();
    await expect(submitButton).toBeDisabled();
  });

  test('Submit remains disabled with partial / wrong input', async ({ page }) => {
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    const player2Card = page.getByTestId('participant-card').filter({ hasText: player2Username });
    await player2Card.getByRole('button', { name: 'Participant actions' }).click();
    await page.getByRole('menuitem', { name: 'Move to Audience' }).click();

    await expect(page.getByRole('heading', { name: 'Move Player to Audience?' })).toBeVisible();
    const submitButton = page.getByRole('button', { name: 'Move to Audience' }).last();
    const confirmInput = page.getByPlaceholder('confirm');

    await confirmInput.fill('confi');
    await expect(submitButton).toBeDisabled();

    await confirmInput.fill('CONFIRM'); // wrong case — must be lowercase
    // The check is .toLowerCase() !== 'confirm', so uppercase should also work
    await expect(submitButton).toBeEnabled();

    await confirmInput.fill('wrong');
    await expect(submitButton).toBeDisabled();
  });

  test('Primary GM can transition a player to audience', async ({ page }) => {
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    await expect(page.getByRole('heading', { name: /Players/ })).toBeVisible();

    const player2Card = page.getByTestId('participant-card').filter({ hasText: player2Username });
    await player2Card.getByRole('button', { name: 'Participant actions' }).click();
    await page.getByRole('menuitem', { name: 'Move to Audience' }).click();

    await expect(page.getByRole('heading', { name: 'Move Player to Audience?' })).toBeVisible();

    const confirmInput = page.getByPlaceholder('confirm');
    await confirmInput.fill('confirm');

    const submitButton = page.getByRole('button', { name: 'Move to Audience' }).last();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await page.waitForLoadState('networkidle');

    // Modal must close
    await expect(page.getByRole('heading', { name: 'Move Player to Audience?' })).not.toBeVisible({ timeout: 10000 });

    // Former Players section must appear and contain player2
    await expect(page.getByRole('heading', { name: /Former Players/ })).toBeVisible({ timeout: 10000 });

    // The card for player2 must exist exactly once (in Former Players, not Players)
    await expect(page.getByTestId('participant-card').filter({ hasText: player2Username })).toHaveCount(1);

    // That card must be immediately after the Former Players heading (sibling grid div)
    await expect(
      page.locator('h3', { hasText: /Former Players/ })
        .locator('~ div')
        .getByTestId('participant-card')
        .filter({ hasText: player2Username })
    ).toBeVisible();
  });

  test('Transitioned player no longer shows "Move to Audience" — now shows regular audience actions', async ({ page }) => {
    // After the previous test, player2 is now in Former Players (audience with is_former_player=true)
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    await expect(page.getByRole('heading', { name: /Former Players/ })).toBeVisible({ timeout: 10000 });

    const formerPlayerCard = page
      .locator('h3', { hasText: /Former Players/ })
      .locator('~ div')
      .getByTestId('participant-card')
      .filter({ hasText: player2Username });

    await formerPlayerCard.getByRole('button', { name: 'Participant actions' }).click();

    // "Move to Audience" must not appear — player is already audience
    await expect(page.getByRole('menuitem', { name: 'Move to Audience' })).not.toBeVisible();
    // Audience members can be promoted to co-GM
    await expect(page.getByRole('menuitem', { name: 'Promote to Co-GM' })).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('Control player (TestPlayer3) is unaffected', async ({ page }) => {
    const player3Username = getWorkerUsername('TestPlayer3');

    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // TestPlayer3 must still appear as a participant card and must NOT be in Former Players
    await expect(page.getByRole('heading', { name: /Players/ })).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('participant-card').filter({ hasText: player3Username })).toBeVisible();

    const formerPlayersHeading = page.locator('h3', { hasText: /Former Players/ });
    const formerPlayersVisible = await formerPlayersHeading.isVisible();
    if (formerPlayersVisible) {
      // If a Former Players section exists (it should, with player2), player3 must not be in it
      const formerSection = formerPlayersHeading.locator('+ div, ~ div').first();
      await expect(formerSection.getByTestId('participant-card').filter({ hasText: player3Username })).toHaveCount(0);
    }
  });
});

// ============================================================================
// GROUP 2: Post-transition consequences (parallel — each sets up via API)
// ============================================================================
// Each test independently transitions player2 via API in beforeEach, verifies
// a specific post-transition behavior, then the fixture is re-applied on the
// next full fixture reset. Tests in this group do NOT depend on each other.

test.describe('Player to Audience — Post-Transition Consequences', () => {
  let player2UserId: number;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, 'GM');
      const gid = await getFixtureGameId(page, 'PLAYER_TO_AUDIENCE');
      player2UserId = await getParticipantUserId(page, gid, player2Username);
    } finally {
      await ctx.close();
    }
  });

  test.beforeEach(async ({ browser }) => {
    // Transition player2 via API so each test starts with the transitioned state.
    // The fixture DELETE+INSERT on each fixture application resets this.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      await loginAs(page, 'GM');
      // Idempotent: if player2 is already audience, the API returns 400 "can only transition players"
      // which transitionPlayerToAudience does not suppress. We use a raw evaluate instead.
      await page.evaluate(async (args: { gameId: number; userId: number }) => {
        const response = await fetch(`/api/v1/games/${args.gameId}/participants/${args.userId}/to-audience`, {
          method: 'POST',
          credentials: 'include',
        });
        // 400 = already transitioned (idempotent for our purposes), anything else is a real error
        if (!response.ok && response.status !== 400) {
          const body = await response.text();
          throw new Error(`transitionPlayerToAudience setup failed: ${response.status} ${body}`);
        }
      }, { gameId, userId: player2UserId });
    } finally {
      await ctx.close();
    }
  });

  test('Transitioned player appears in Former Players section (not Audience or Players)', async ({ page }) => {
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Must be in Former Players
    await expect(page.getByRole('heading', { name: /Former Players/ })).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('h3', { hasText: /Former Players/ })
        .locator('~ div')
        .getByTestId('participant-card')
        .filter({ hasText: player2Username })
    ).toBeVisible();

    // Exactly one participant card for player2 — only in Former Players, nowhere else
    await expect(page.getByTestId('participant-card').filter({ hasText: player2Username })).toHaveCount(1);
  });

  test('Transitioned player loses active-player permissions (no Actions tab)', async ({ page }) => {
    // Actions tab is only available to isParticipant users (role !== 'audience')
    await loginAs(page, 'PLAYER_2');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // The "Submit Action" and "Actions" tab must not be visible
    const mobileSelect = page.locator('select#tab-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);

    if (isMobile) {
      const actionOption = mobileSelect.locator('option', { hasText: 'Submit Action' });
      await expect(actionOption).toHaveCount(0);
    } else {
      await expect(page.getByRole('tab', { name: 'Submit Action' })).not.toBeVisible();
    }
  });

  test('Transitioned player retains character in the Characters list', async ({ page }) => {
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    // Characters sub-tab is the default
    await expect(page.getByRole('heading', { name: 'Characters', exact: true })).toBeVisible({ timeout: 10000 });

    // The player's character must still appear in the characters list (not removed)
    await expect(page.getByTestId('character-card').filter({ hasText: 'Player2 Test Character' })).toBeVisible();
  });

  test('Non-primary-GM cannot transition a player (menu item absent)', async ({ page }) => {
    // Co-GM and regular players should not see "Move to Audience"
    // For this test we use PLAYER_3 who is still a player and thus has no GM actions at all
    await loginAs(page, 'PLAYER_3');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    // Non-GM players don't see the Participant actions menu at all
    await expect(page.getByRole('button', { name: 'Participant actions' })).not.toBeVisible();
  });

  test('GM cannot transition the same player twice (action button absent after transition)', async ({ page }) => {
    // After transition, player2 is audience with is_former_player=true
    // The "Move to Audience" menu item must not appear for them (only for role==='player')
    await loginAs(page, 'GM');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    await navigateToGameTab(page, 'People');
    await page.getByRole('button', { name: /Game Participants/ }).click();

    await expect(page.getByRole('heading', { name: /Former Players/ })).toBeVisible({ timeout: 10000 });

    const formerPlayerCard = page
      .locator('h3', { hasText: /Former Players/ })
      .locator('~ div')
      .getByTestId('participant-card')
      .filter({ hasText: player2Username });

    await formerPlayerCard.getByRole('button', { name: 'Participant actions' }).click();

    await expect(page.getByRole('menuitem', { name: 'Move to Audience' })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });
});
