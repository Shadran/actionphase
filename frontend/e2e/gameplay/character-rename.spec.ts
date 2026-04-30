import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { CharacterSheetPage } from '../pages/CharacterSheetPage';

/**
 * Character Rename E2E Tests
 *
 * Tests the inline character rename functionality from the character sheet.
 * Uses CHARACTER_AVATARS fixture — characters: E2E Test Char 1–4.
 *
 * Serial mode: tests 1 and 3 both mutate E2E Test Char 1's name.
 */
test.describe('Character Rename', () => {
  test.describe.configure({ mode: 'serial' });

  test('GM can rename character using inline edit', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();
    await characterPage.openCharacterSheet('E2E Test Char 1');
    await expect(page.getByRole('heading', { name: 'E2E Test Char 1', level: 2 })).toBeVisible({ timeout: 10000 });

    const sheetPage = new CharacterSheetPage(page);
    const newName = `Renamed ${Date.now()}`;
    await sheetPage.renameCharacter(newName);

    await expect(page.getByRole('heading', { name: newName, level: 2 })).toBeVisible();
    await expect(sheetPage.getRenameInput()).not.toBeVisible();
  });

  test('Can cancel rename with Cancel button', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Use Char 2 so this test is independent of the rename in test 1
    await characterPage.openCharacterSheet('E2E Test Char 2');
    await expect(page.getByRole('heading', { name: 'E2E Test Char 2', level: 2 })).toBeVisible({ timeout: 10000 });

    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startAndCancelRename('Should Not Save');

    await expect(page.getByRole('heading', { name: 'E2E Test Char 2', level: 2 })).toBeVisible();
    await expect(sheetPage.getRenameInput()).not.toBeVisible();
  });

  test('Can save rename with Enter key', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();
    await characterPage.openCharacterSheet('E2E Test Char 3');
    await expect(page.getByRole('heading', { name: 'E2E Test Char 3', level: 2 })).toBeVisible({ timeout: 10000 });

    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startRename();

    const nameInput = sheetPage.getRenameInput();
    const newName = `Enter Key ${Date.now()}`;
    await nameInput.clear();
    await nameInput.fill(newName);
    await nameInput.press('Enter');

    await expect(page.getByRole('heading', { name: newName, level: 2 })).toBeVisible();
  });

  test('Can cancel rename with Escape key', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();
    await characterPage.openCharacterSheet('E2E Test Char 4');
    await expect(page.getByRole('heading', { name: 'E2E Test Char 4', level: 2 })).toBeVisible({ timeout: 10000 });

    const sheetPage = new CharacterSheetPage(page);
    await sheetPage.startRename();

    const nameInput = sheetPage.getRenameInput();
    await nameInput.clear();
    await nameInput.fill('Escape Cancel');
    await nameInput.press('Escape');

    await expect(page.getByRole('heading', { name: 'E2E Test Char 4', level: 2 })).toBeVisible();
  });

  test('Player cannot rename another player\'s character', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();
    await characterPage.openCharacterSheet('E2E Test Char 2');
    await expect(page.getByRole('heading', { name: 'E2E Test Char 2', level: 2 })).toBeVisible({ timeout: 10000 });

    const sheetPage = new CharacterSheetPage(page);
    expect(await sheetPage.canRename()).toBe(false);
  });
});
