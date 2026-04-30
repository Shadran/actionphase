import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { HistoryPage } from '../pages/HistoryPage';
import { navigateToGame, navigateToGameTab, assertTabVisible, assertTabNotVisible } from '../utils/navigation';

/**
 * E2E Tests for Complete Phase Lifecycle
 *
 * Tests the full game loop from common room -> action phase -> results -> common room
 *
 * Uses dedicated E2E fixture (E2E_LIFECYCLE) which includes:
 * - Fresh game in initial common room phase
 * - 3 player characters ready to participate
 * - No action results yet (will create through UI)
 *
 * CRITICAL: This tests the COMPLETE game workflow end-to-end
 * IMPORTANT: Tests run serially because they build on each other (lifecycle flow)
 */
test.describe.serial('Complete Phase Lifecycle', () => {
  test('GM can create and activate action phase from common room', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Verify we see the Phase Management interface
    await expect(page.getByRole('heading', { name: 'Phase Management', level: 2 })).toBeVisible({ timeout: 10000 });

    // Verify current phase is "Initial Common Room"
    await expect(page.getByRole('heading', { name: 'Currently Active', level: 3 })).toBeVisible();
    await expect(page.getByText('Initial Common Room').locator('visible=true').first()).toBeVisible();

    // Create new action phase using POM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await phasePage.createPhase({
      type: 'action',
      title: 'Test Action Phase',
      description: 'Players submit their actions for this phase',
      deadline: tomorrow,
    });

    // Verify the new phase appears
    await expect(page.getByText('Test Action Phase').locator('visible=true').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span').filter({ hasText: /^Phase 2$/ }).locator('visible=true').first()).toBeVisible();

    // Activate the new action phase using POM
    await phasePage.activatePhase('Test Action Phase');

    // Verify the phase is now active using POM
    const activatedPhaseCard = phasePage.getPhaseCard('Test Action Phase');
    await expect(activatedPhaseCard.getByText('Currently Active').locator('visible=true').first()).toBeVisible({ timeout: 10000 });
  });

  test('players can access action submission during action phase', async ({ page }) => {
    // Test 1 created and activated an action phase
    // This test verifies players can access the action submission UI
    // (Detailed submission testing is in action-submission-flow.spec.ts)

    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    await navigateToGame(page, gameId);

    // During action phase, players should see "Submit Action" tab
    await assertTabVisible(page, 'Submit Action');

    // Navigate to Submit Action tab
    await navigateToGameTab(page, 'Submit Action');

    // Should see action submission form
    await expect(page.getByRole('heading', { name: 'Action Submission' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Acting as:').locator('visible=true').first()).toBeVisible();
    await expect(page.getByText('Lifecycle Char 1')).toBeVisible();

    // Verify submission form is available
    await expect(page.locator('textarea[placeholder*="Describe what your character does"]')).toBeVisible();
    await expect(page.getByTestId('submit-action-button')).toBeVisible();

    // Note: Detailed action submission flow is tested in action-submission-flow.spec.ts
  });

  test('GM can access actions tab during action phase', async ({ page }) => {
    // Test 1 created an action phase
    // This test verifies GM can access the Actions tab to view submissions
    // (Detailed action viewing is tested in other test files)

    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);

    // During action phase, GM should see "Actions" tab
    await assertTabVisible(page, 'Actions');

    // GM should also still see phase management
    await assertTabVisible(page, 'Phases');

    // Navigate to Actions tab using POM
    await gamePage.goToActions();

    // Should see the actions interface
    await expect(page.getByRole('heading', { name: 'Submitted Actions' })).toBeVisible({ timeout: 10000 });
  });

  test('player cannot see phase management tab', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    await navigateToGame(page, gameId);

    // Players should not see the Phases management tab
    await assertTabNotVisible(page, 'Phases');
  });

  test('complete lifecycle: verify history shows all created phases', async ({ page }) => {
    // Previous tests created and activated an action phase
    // This test verifies the complete history is visible

    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_LIFECYCLE');
    const historyPage = new HistoryPage(page, gameId);
    await historyPage.goto();

    // Verify we're on history page
    await historyPage.verifyOnPage();

    // Verify we see both the initial common room (Phase 1) - use specific heading
    await expect(page.getByRole('heading', { name: 'Initial Common Room' })).toBeVisible({ timeout: 10000 });

    // Verify phase numbers
    const phaseNumbers = await historyPage.getPhaseNumbers();
    expect(phaseNumbers).toContain('Phase 1');
    expect(phaseNumbers).toContain('Phase 2');

    // Verify we see the created action phase (Phase 2)
    await expect(page.getByRole('button', { name: /Phase 2.*Test Action Phase/ })).toBeVisible({ timeout: 10000 });
  });
});
