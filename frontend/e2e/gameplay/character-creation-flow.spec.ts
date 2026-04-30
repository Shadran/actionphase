import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 3: Player Creates Character & Joins Game
 *
 * Uses dedicated E2E fixtures to avoid expensive runtime game/application setup.
 * - E2E_CHARACTER_CREATION: game already in character_creation state with approved player
 * - COMMON_ROOM_MISC: in_progress game for GM NPC creation
 */
test.describe('Character Creation Flow', () => {

  test('Player can create a character', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();

    await assertTextVisible(page, 'Characters');
    expect(await charPage.canCreateCharacter()).toBe(true);

    const characterName = `Test Character ${Date.now()}`;
    await charPage.createCharacter(characterName);

    expect(await charPage.hasCharacter(characterName)).toBe(true);
    await assertTextVisible(page, 'Your Character');
  });

  test('GM can create NPC characters', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');

    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();

    await assertTextVisible(page, 'Characters');
    expect(await charPage.canCreateCharacter()).toBe(true);

    const npcName = `Test NPC ${Date.now()}`;
    await charPage.createCharacter(npcName, 'npc');

    expect(await charPage.hasCharacter(npcName)).toBe(true);
    await assertTextVisible(page, 'NPCs');
  });

  test('Player cannot create NPC characters', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const charPage = new CharacterWorkflowPage(page, gameId);
    await charPage.goto();

    await page.getByTestId('create-character-button').click();
    await page.waitForSelector('#name', { timeout: 5000 });

    // NPC option should not be available in character type dropdown for players
    const npcOption = page.locator('#character_type option[value="npc"]');
    await expect(npcOption).not.toBeAttached();
  });
});
