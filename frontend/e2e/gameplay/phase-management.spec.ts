import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';
import { assertTabNotVisible } from '../utils/navigation';

/**
 * Journey 4: GM Manages Phases
 *
 * Tests phase creation, activation, and history viewing.
 * Uses E2E fixture game "E2E Test: Action Submission" (already in in_progress state with phases).
 * This speeds up tests by ~5-8 seconds per test by avoiding game creation and state transitions.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 9)
 * - Uses PhaseManagementPage for all interactions
 * - Improved readability and maintainability
 */
test.describe('@mobile Phase Management Flow', () => {
  test('GM can create a phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use E2E Action Submission game (already in in_progress state with phases)
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Create a phase
    const phaseName = `Test Phase ${Date.now()}`;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);

    await phasePage.createPhase({
      type: 'action',
      title: phaseName,
      description: 'Test phase description',
      deadline,
    });

    // Verify phase appears
    await phasePage.verifyPhaseExists(phaseName);

    // Verify "Activate" button is visible (phases are created but not active)
    await expect(page.getByRole('button', { name: 'Activate' }).locator('visible=true').first()).toBeVisible();
  });

  test('GM can activate a phase', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Create a phase to activate
    const phaseName = `Activate Test ${Date.now()}`;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);

    await phasePage.createPhase({
      type: 'action',
      title: phaseName,
      description: 'Phase to be activated',
      deadline,
    });

    // Activate the phase
    await phasePage.activatePhase(phaseName);

    // Verify the SPECIFIC phase we activated shows as "Currently Active"
    // Check the phase card itself shows "Currently Active" indicator
    const activatedPhaseCard = phasePage.getPhaseCard(phaseName);
    await expect(activatedPhaseCard.getByText('Currently Active').locator('visible=true').first()).toBeVisible({ timeout: 10000 });
  });

  test('GM can view history', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures
    // This game already has Phase 2 active, so we can see Phase 1 and Phase 2
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Fixture game has Phase 1 (common room, previous) and Phase 2 (action, active)
    // Verify we can see both phases
    await expect(page.locator('span').filter({ hasText: /^Phase 1$/ }).locator('visible=true').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span').filter({ hasText: /^Phase 2$/ }).locator('visible=true').first()).toBeVisible();

    // Verify phase titles from fixtures
    await expect(page.getByRole('heading', { name: 'Discussion Phase', level: 4 })).toBeVisible(); // Phase 1
    await expect(page.getByRole('heading', { name: 'Action Phase', level: 4 })).toBeVisible(); // Phase 2 (active)
  });

  test('GM can delete a phase with no content', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Create a phase to delete (it will have no content)
    const phaseName = `Delete Test ${Date.now()}`;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 2);

    await phasePage.createPhase({
      type: 'common_room',
      title: phaseName,
      description: 'Phase to be deleted',
      deadline,
    });

    // Verify phase exists
    await phasePage.verifyPhaseExists(phaseName);

    // Verify warning message appears in dialog
    await phasePage.openDeleteDialog(phaseName);
    await expect(page.getByText(/This phase can only be deleted if it has no associated content/)).toBeVisible();

    // Confirm deletion
    await page.getByTestId('delete-phase-confirm-button').click();

    // Verify phase is removed
    const phaseCard = phasePage.getPhaseCard(phaseName);
    await expect(phaseCard).not.toBeVisible({ timeout: 5000 });
  });

  test('Player cannot access phase management', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Player should not see the Phases tab at all
    await assertTabNotVisible(page, 'Phases');
  });

  test('GM can cancel phase deletion', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Try to delete Phase 1 (Discussion Phase) which is NOT active
    const phaseCard = phasePage.getPhaseCard('Discussion Phase');

    // Verify delete button exists (phase is not active)
    await expect(phaseCard.getByRole('button', { name: /delete/i }).first()).toBeVisible();

    // Use POM method to cancel deletion (opens dialog, verifies, and cancels)
    await phasePage.deletePhase('Discussion Phase', false);

    // Verify warning message appeared (after cancel, modal is gone, so check before)
    // Phase should still exist (verified in POM method)
  });
});
