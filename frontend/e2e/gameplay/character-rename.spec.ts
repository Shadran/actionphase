import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { CharacterSheetPage } from '../pages/CharacterSheetPage';
import { tagTest, tags } from '../fixtures/test-tags';

/**
 * Character Rename E2E Tests
 *
 * Tests the inline character rename functionality from the character sheet.
 * Uses fixtures from CHARACTER_AVATARS game (Game #168) with TestPlayer1-4.
 *
 * Prerequisites verified:
 * - Backend unit tests: 8/8 passing
 * - API endpoint: Returns correct renamed data
 * - Frontend component tests: 13/13 passing
 * - System: Backend and frontend running
 */
test.describe('Character Rename', () => {
  test(tagTest([tags.GAMEPLAY, tags.CHARACTERS], 'GM can rename character using inline edit'), async ({ page }) => {
    // Login as GM who owns characters in CHARACTER_AVATARS game
    await loginAs(page, 'GM');

    // Get the CHARACTER_AVATARS game ID
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    // Navigate to Characters tab
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Get first character from API to get the name
    const charactersResponse = await page.request.get(`http://localhost:3000/api/v1/games/${gameId}/characters`);
    expect(charactersResponse.status()).toBe(200);

    const characters = await charactersResponse.json();
    expect(characters.length).toBeGreaterThan(0);

    const testCharacter = characters[0];
    const originalName = testCharacter.name;

    // Open the character sheet
    await characterPage.openCharacterSheet(originalName);

    // Wait for character sheet modal to load
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible({ timeout: 10000 });

    // Use POM to rename character
    const sheetPage = new CharacterSheetPage(page);
    const newName = `Renamed ${Date.now()}`;
    await sheetPage.renameCharacter(newName);

    // Verify the name has been updated in the UI
    await expect(page.getByRole('heading', { name: newName, level: 2 })).toBeVisible();

    // Verify edit controls are hidden (exited edit mode)
    await expect(sheetPage.getRenameInput()).not.toBeVisible();
  });

  test(tagTest([tags.GAMEPLAY, tags.CHARACTERS], 'Can cancel rename with Cancel button'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Get first character name
    const charactersResponse = await page.request.get(`http://localhost:3000/api/v1/games/${gameId}/characters`);
    const characters = await charactersResponse.json();
    const testCharacter = characters[0];
    const originalName = testCharacter.name;

    // Open character sheet
    await characterPage.openCharacterSheet(originalName);
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible({ timeout: 10000 });

    // Use POM to start and cancel rename
    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startAndCancelRename('Should Not Save');

    // Verify original name is still displayed
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible();

    // Verify edit mode is exited
    await expect(sheetPage.getRenameInput()).not.toBeVisible();
  });

  test(tagTest([tags.GAMEPLAY, tags.CHARACTERS], 'Can save rename with Enter key'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Get first character name
    const charactersResponse = await page.request.get(`http://localhost:3000/api/v1/games/${gameId}/characters`);
    const characters = await charactersResponse.json();
    const testCharacter = characters[0];
    const originalName = testCharacter.name;

    // Open character sheet
    await characterPage.openCharacterSheet(originalName);
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible({ timeout: 10000 });

    // Use POM to start rename, then press Enter
    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startRename();

    const nameInput = sheetPage.getRenameInput();
    const newName = `Enter Key ${Date.now()}`;
    await nameInput.clear();
    await nameInput.fill(newName);
    await nameInput.press('Enter');

    // Wait for mutation to complete
    await page.waitForLoadState('networkidle');

    // Verify the name has been updated
    await expect(page.getByRole('heading', { name: newName, level: 2 })).toBeVisible();
  });

  test(tagTest([tags.GAMEPLAY, tags.CHARACTERS], 'Can cancel rename with Escape key'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Get first character name
    const charactersResponse = await page.request.get(`http://localhost:3000/api/v1/games/${gameId}/characters`);
    const characters = await charactersResponse.json();
    const testCharacter = characters[0];
    const originalName = testCharacter.name;

    // Open character sheet
    await characterPage.openCharacterSheet(originalName);
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible({ timeout: 10000 });

    // Use POM to start rename, then press Escape
    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startRename();

    const nameInput = sheetPage.getRenameInput();
    await nameInput.clear();
    await nameInput.fill('Escape Cancel');
    await nameInput.press('Escape');

    // Verify original name is still displayed
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible();
  });

  test(tagTest([tags.GAMEPLAY, tags.CHARACTERS], 'Save button is disabled for empty name'), async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Get first character name
    const charactersResponse = await page.request.get(`http://localhost:3000/api/v1/games/${gameId}/characters`);
    const characters = await charactersResponse.json();
    const testCharacter = characters[0];
    const originalName = testCharacter.name;

    // Open character sheet
    await characterPage.openCharacterSheet(originalName);
    await expect(page.getByRole('heading', { name: originalName, level: 2 })).toBeVisible({ timeout: 10000 });

    // Use POM to start rename and clear the name
    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startRename();

    const nameInput = sheetPage.getRenameInput();
    await nameInput.clear();

    // Check if save button is disabled using POM
    const isEnabled = await sheetPage.isSaveButtonEnabled();
    expect(isEnabled).toBe(false);
  });

  test(tagTest([tags.GAMEPLAY, tags.CHARACTERS], 'Player cannot see rename button for other players characters'), async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Get all characters to find one NOT owned by PLAYER_1
    const charactersResponse = await page.request.get(`http://localhost:3000/api/v1/games/${gameId}/characters`);
    const characters = await charactersResponse.json();

    // Find a character owned by a different player
    // PLAYER_1 owns "E2E Test Char 1", so we want a different character
    // Fixture has: Char 1 (Player1), Char 2 (Player2), Char 3 (Player3), Char 4 (Player4)
    const otherPlayerChar = characters.find((c: { character_type: string; name: string }) =>
      c.character_type === 'player_character' && c.name === 'E2E Test Char 2'
    );

    expect(otherPlayerChar).toBeDefined();

    // Open that character's sheet
    await characterPage.openCharacterSheet(otherPlayerChar.name);
    await expect(page.getByRole('heading', { name: otherPlayerChar.name, level: 2 })).toBeVisible({ timeout: 10000 });

    // Use POM to check if rename button is visible
    const sheetPage = new CharacterSheetPage(page);
    const canRename = await sheetPage.canRename();
    expect(canRename).toBe(false);
  });
});
