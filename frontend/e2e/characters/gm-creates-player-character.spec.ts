import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';

/**
 * GM Creates Player Character E2E Tests
 *
 * Tests the complete flow of a GM creating a player character and assigning it to a specific player.
 *
 * Feature Requirements:
 * - GM can create player characters and assign them to specific players
 * - GM sees character type dropdown (Player Character / NPC)
 * - GM sees player selector when creating player character
 * - Character is created with correct assignment
 * - Character appears in character list with pending status
 */

test.describe('GM Creates Player Character', () => {
  test('should allow GM to create player character and assign to specific player', async ({ page }) => {
    // 1. Login as GM
    await loginAs(page, 'GM');

    // 2. Navigate to character creation game
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    // 3. Verify initial state - get current character count
    const initialCharacters = await characterWorkflowPage.getCharactersList();
    const initialCount = initialCharacters.length;

    // 4. Open create character modal
    await characterWorkflowPage.createCharacterButton.click();

    // Wait for modal to appear
    const characterForm = page.getByTestId('character-form');
    await expect(characterForm).toBeVisible();

    // 5. Verify GM-specific fields are visible
    const characterTypeSelect = page.getByLabel('Character Type');
    await expect(characterTypeSelect).toBeVisible();

    // 6. Fill in character name
    const characterName = `GM Created Player Character ${Date.now()}`;
    const nameInput = page.getByTestId('character-name-input');
    await nameInput.fill(characterName);

    // 7. Select "Player Character" type
    await characterTypeSelect.selectOption('player_character');

    // 8. Verify player selector appears
    const playerSelect = page.getByLabel('Assign to Player');
    await expect(playerSelect).toBeVisible();

    // 9. Select first actual player from dropdown (skip placeholder at index 0)
    const options = await playerSelect.locator('option').all();
    if (options.length < 2) {
      throw new Error('No player options available in selector (only placeholder found)');
    }
    // Get the value from the second option (first real player, not placeholder)
    const firstPlayerValue = await options[1].getAttribute('value') || '';
    if (!firstPlayerValue) {
      throw new Error('Player option has no value attribute');
    }
    await playerSelect.selectOption(firstPlayerValue);

    // 10. Wait for submit button to become enabled (form validation happens)
    const submitButton = page.getByTestId('character-submit-button');
    await expect(submitButton).toBeEnabled({ timeout: 10000 });

    // 11. Submit form
    await submitButton.click();

    // 12. Wait for modal to close
    await expect(characterForm).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // 13. Verify character appears in list
    const hasNewCharacter = await characterWorkflowPage.hasCharacter(characterName);
    expect(hasNewCharacter).toBe(true);

    // 14. Verify character count increased
    const finalCharacters = await characterWorkflowPage.getCharactersList();
    expect(finalCharacters.length).toBe(initialCount + 1);

    // 15. Verify character has pending status
    const characterStatus = await characterWorkflowPage.getCharacterStatus(characterName);
    expect(characterStatus).toBe('pending');

    // 16. Verify character card shows correct player assignment
    // Find the character card and check for player name (TestPlayer1 is the only player in this game)
    const characterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: characterName }) })
      .locator('visible=true').first();

    // Look for the "Player:" label followed by the username (dual-DOM safe)
    const playerAssignment = characterCard.getByText(/Player:.*TestPlayer1/i).locator('visible=true').first();
    await expect(playerAssignment).toBeVisible();
  });

});
