import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { navigateToGameTab } from '../utils/navigation';

/**
 * E2E Tests for Character Approval Workflow
 *
 * Tests the complete character approval process including:
 * - Character starts in pending state after creation
 * - GM can approve characters
 * - Approved characters appear in game
 * - Character resubmission workflow (rejected → edited → resubmitted → pending)
 *
 * Fixture characters are pre-baked in 14_character_workflows.sql — no runtime
 * character creation is needed for these tests.
 */

test.describe('@mobile Character Approval Workflow', () => {

  test('character starts in pending state after creation', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_PENDING_STATE');

    // Fixture pre-bakes 'Pending State Test Character' in pending status for PLAYER_1
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    const characterName = 'Pending State Test Character';
    expect(await characterPage.hasCharacter(characterName)).toBe(true);
    const status = await characterPage.getCharacterStatus(characterName);
    expect(status).toBe('pending');

    // Player should not see an Approve button for their own pending character
    await expect(page.getByRole('button', { name: 'Approve' })).not.toBeVisible();
  });

  test('GM can approve character', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_1');

      // Fixture pre-bakes 'Approval Test Character' in pending status for PLAYER_1
      const gameId = await getFixtureGameId(gmPage, 'E2E_CHARACTER_APPROVE');

      const gmCharPage = new CharacterWorkflowPage(gmPage, gameId);
      await gmCharPage.goto();

      const characterName = 'Approval Test Character';
      await gmCharPage.approveCharacter(characterName);

      // Verify character now shows as approved on GM view
      const gmStatus = await gmCharPage.getCharacterStatus(characterName);
      expect(gmStatus).toBe('approved');

      // Player should see approved status too
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();
      const playerStatus = await playerCharPage.getCharacterStatus(characterName);
      expect(playerStatus).toBe('approved');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('rejected character can be edited and resubmitted', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();

    try {
      await loginAs(gmPage, 'GM');

      // Fixture pre-bakes 'Resubmitted Test Character' in pending status, simulating
      // the rejected → edited → resubmitted workflow
      const gameId = await getFixtureGameId(gmPage, 'E2E_CHARACTER_RESUBMIT');

      const gmCharPage = new CharacterWorkflowPage(gmPage, gameId);
      await gmCharPage.goto();

      // Character that was previously rejected and has been resubmitted (now pending)
      const characterName = 'Resubmitted Test Character';
      await expect(gmPage.getByText(characterName).locator('visible=true').first()).toBeVisible({ timeout: 5000 });

      // Verify it's in pending state (simulating resubmission after rejection)
      const status = await gmCharPage.getCharacterStatus(characterName);
      expect(status).toBe('pending');

      // GM approves the resubmitted character
      await gmCharPage.approveCharacter(characterName);

      // Verify character now shows as approved
      const approvedStatus = await gmCharPage.getCharacterStatus(characterName);
      expect(approvedStatus).toBe('approved');
    } finally {
      await gmContext.close();
    }
  });

  test('approved characters appear in active game', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_3'); // Player 3 has the approved character in fixture

      const gameId = await getFixtureGameId(playerPage, 'E2E_CHARACTER_IN_GAME');

      // Verify approved character exists
      const characterName = 'Approved Test Character';
      const playerCharPage = new CharacterWorkflowPage(playerPage, gameId);
      await playerCharPage.goto();

      const status = await playerCharPage.getCharacterStatus(characterName);
      expect(status).toBe('approved');

      // GM starts the game using POM
      const gmGamePage = new GameDetailsPage(gmPage);
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmGamePage.startGame();

      // Verify game is now in_progress
      await expect(gmPage.getByText(/current phase|in progress/i)).toBeVisible({ timeout: 10000 });

      // Navigate to People tab (in_progress games)
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');

      await navigateToGameTab(gmPage, 'People');

      // Verify approved character is visible
      await expect(gmPage.getByText(characterName).locator('visible=true').first()).toBeVisible({ timeout: 10000 });

      // Player should also see their character in the active game
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');

      await navigateToGameTab(playerPage, 'People');

      await expect(playerPage.getByText(characterName).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
