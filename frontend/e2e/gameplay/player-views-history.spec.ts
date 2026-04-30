import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { HistoryPage } from '../pages/HistoryPage';

/**
 * Journey 7: Player Views History
 *
 * Tests that players can view history and navigate through past phases.
 * Uses E2E fixture game "E2E Test: Action Submission" with Phase 1 (common_room) and Phase 2 (action).
 *
 * REFACTORED: Using HistoryPage POM exclusively
 * - Eliminated all inline selectors
 * - Improved reliability with dedicated POM methods
 */
test.describe('@mobile Player Views History', () => {
  test('Player can view history list', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use E2E Action Submission game which has history
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const historyPage = new HistoryPage(page, gameId);
    await historyPage.goto();

    // Verify we're on history page
    await historyPage.verifyOnPage();

    // Verify phase numbers are visible
    const phaseNumbers = await historyPage.getPhaseNumbers();
    expect(phaseNumbers).toContain('Phase 1');
    expect(phaseNumbers).toContain('Phase 2');

    // Verify phase titles from E2E fixtures are displayed
    await historyPage.verifyPhaseExists('Discussion Phase'); // Phase 1 (common_room)
    await historyPage.verifyPhaseExists('Action Phase'); // Phase 2 (active action)

    // Verify active phase is marked as "Active"
    const hasActive = await historyPage.hasActivePhase();
    expect(hasActive).toBe(true);
  });

  test('Player can navigate back from phase details', async ({ page }) => {
    // Login as Player 1
    await loginAs(page, 'PLAYER_1');

    // Use E2E Action Submission game
    const gameId = await getFixtureGameId(page, 'E2E_ACTION');

    const historyPage = new HistoryPage(page, gameId);
    await historyPage.goto();

    // Click on Phase 1 (common_room phase)
    await historyPage.viewPhaseDetails('Discussion Phase');

    // Verify we're viewing phase details by checking for Common Room content
    const hasCommonRoom = await historyPage.hasCommonRoomContent();
    expect(hasCommonRoom).toBe(true);

    // Navigate back
    await historyPage.goBackToHistory();

    // Verify we're back at the phase list
    await historyPage.verifyOnPage();
    const phaseNumbers = await historyPage.getPhaseNumbers();
    expect(phaseNumbers).toContain('Phase 1');
  });
});
