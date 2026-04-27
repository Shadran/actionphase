import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GameApplicationsPage } from '../pages/GameApplicationsPage';
import { GamesListPage } from '../pages/GamesListPage';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 3: Player Creates Character & Joins Game
 *
 * Tests the complete character creation flow after player is approved.
 * Test 1 creates a full game workflow to test player character creation after approval.
 * Test 2 uses fixtures (Game #165) to test GM NPC creation, saving ~3-4 seconds.
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 11)
 * - Uses GameDetailsPage for tab navigation
 * - Uses assertion utilities for consistency
 * - Uses waitForModal and smart waits
 */
test.describe('Character Creation Flow', () => {
  test('Player can create a character after being approved', async ({ browser }) => {
    // This test requires two users: GM and Player
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM Setup ===
      // Login as GM and create a game using POM
      await loginAs(gmPage, 'GM');
      const timestamp = Date.now();
      const gameTitle = `E2E Character Test ${timestamp}`;

      // Navigate to games list and create game using POM
      await gmPage.goto('/games');
      await gmPage.waitForLoadState('networkidle');

      const gamesListPage = new GamesListPage(gmPage);
      const gameId = await gamesListPage.createGame({
        title: gameTitle,
        description: 'E2E test for player character creation',
        genre: 'Test',
        maxPlayers: 4
      });

      // Start recruitment using POM
      const gmGameDetailsPage = new GameDetailsPage(gmPage);
      await gmGameDetailsPage.startRecruitment();

      // === Player Application ===
      // Login as player and apply to the game using POM
      await loginAs(playerPage, 'PLAYER_1');
      const playerApplicationsPage = new GameApplicationsPage(playerPage, parseInt(gameId!));
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');

      // Apply to join using POM
      await playerApplicationsPage.submitApplication('I would like to join this game', 'player');

      // === GM Approval ===
      // GM approves the player using POM
      const gmApplicationsPage = new GameApplicationsPage(gmPage, parseInt(gameId!));
      await gmApplicationsPage.goto();
      await gmPage.waitForLoadState('networkidle');

      // Approve player using POM
      await gmApplicationsPage.approveApplication('TestPlayer1');

      // GM transitions game to character_creation state using POM (handles kebab menu)
      await gmGameDetailsPage.goto(parseInt(gameId!));
      const gmGameDetailsPage2 = new GameDetailsPage(gmPage);
      await gmGameDetailsPage2.clickMenuButton('Start Character Creation');
      await gmPage.waitForLoadState('networkidle');

      // === Player Creates Character ===
      // Reload player page to see updated game state
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      // Use CharacterWorkflowPage POM for character creation
      const playerCharPage = new CharacterWorkflowPage(playerPage, parseInt(gameId!));
      await playerCharPage.goto();
      await playerPage.waitForLoadState('networkidle');

      // Verify Characters section loaded
      await assertTextVisible(playerPage, 'Characters');

      // Create character using POM
      const characterName = `Test Character ${Date.now()}`;
      await playerCharPage.createCharacter(characterName);

      // Verify character appears using POM
      expect(await playerCharPage.hasCharacter(characterName)).toBe(true);
      await assertTextVisible(playerPage, 'Your Character');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('GM can create NPC characters', async ({ page }) => {
    // Login as GM
    await loginAs(page, 'GM');

    // Use "The Heist at Goldstone Bank" from fixtures (already in in_progress state)
    // This saves ~3-4 seconds by avoiding game creation
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');

    // Use CharacterWorkflowPage POM for navigation
    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();
    await page.waitForLoadState('networkidle');

    // Wait for Characters section to load
    await assertTextVisible(page, 'Characters');

    // GM should see "Create Character" button
    expect(await charPage.canCreateCharacter()).toBe(true);

    // Click "Create Character" and fill form
    await page.click('button[data-testid="create-character-button"]');
    // Wait for the character creation form to appear
    await page.waitForSelector('#name', { timeout: 5000 });

    // Fill in NPC details
    const npcName = `Test NPC ${Date.now()}`;
    await page.fill('#name', npcName);

    // Select "NPC" from character type dropdown
    await page.selectOption('#character_type', 'npc');

    // Submit the form
    await page.click('button[data-testid="character-submit-button"]');
    await page.waitForLoadState('networkidle');

    // Verify NPC appears using POM
    expect(await charPage.hasCharacter(npcName)).toBe(true);

    // Verify it's in the NPCs section
    await assertTextVisible(page, 'NPCs');
  });

  test('Player cannot create NPC characters', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();
    await page.waitForLoadState('networkidle');

    // Click create character to open the form
    await page.click('button[data-testid="create-character-button"]');
    await page.waitForSelector('#name', { timeout: 5000 });

    // NPC option should not be available in character type dropdown for players
    const npcOption = page.locator('#character_type option[value="npc"]');
    await expect(npcOption).not.toBeAttached();
  });

  test('Player can create character using E2E fixture (optimized)', async ({ page }) => {
    // This test uses the E2E_CHARACTER_CREATION fixture
    // which is already in character_creation state with an approved player
    // This saves ~4-5 seconds by avoiding the full game setup workflow

    await loginAs(page, 'PLAYER_1');

    // Use the dedicated character creation fixture
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    // Use CharacterWorkflowPage POM for character creation
    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();
    await page.waitForLoadState('networkidle');

    // Verify Characters section loaded
    await assertTextVisible(page, 'Characters');

    // Player should be able to create a character
    expect(await charPage.canCreateCharacter()).toBe(true);

    // Create character using POM
    const characterName = `Fast Test Character ${Date.now()}`;
    await charPage.createCharacter(characterName);

    // Verify character appears using POM
    expect(await charPage.hasCharacter(characterName)).toBe(true);
    await assertTextVisible(page, 'Your Character');
  });
});
