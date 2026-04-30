import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';

/**
 * Character Deletion E2E Tests
 *
 * Tests the complete flow of deleting characters with proper permissions and validation.
 *
 * Feature Requirements:
 * - GM can delete characters with no activity
 * - Confirmation modal appears before deletion
 * - Characters with messages cannot be deleted
 * - Characters with action submissions cannot be deleted
 * - Players cannot see delete button
 * - Successful deletion refreshes character list
 */

test.describe('Character Deletion', () => {
  test('should allow GM to delete character with no activity', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    // Fixture pre-bakes 'Deletable NPC' with no messages or actions
    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    const characterName = 'Deletable NPC';
    expect(await characterWorkflowPage.hasCharacter(characterName)).toBe(true);

    const characterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: characterName }) })
      .locator('visible=true').first();

    const deleteButton = characterCard.locator('button:has([data-testid="delete-character-button"])').locator('visible=true').first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const confirmationModal = page.getByRole('heading', { name: 'Delete Character?' });
    await expect(confirmationModal).toBeVisible();
    await expect(page.getByText(`Are you sure you want to delete ${characterName}?`)).toBeVisible();
    await expect(page.getByText(/This action cannot be undone/)).toBeVisible();

    const confirmButton = page.getByTestId('confirm-delete-character-button');
    await confirmButton.click();

    await expect(confirmationModal).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    expect(await characterWorkflowPage.hasCharacter(characterName)).toBe(false);
  });

  test('should show error when trying to delete character with messages', async ({ page }) => {
    // Uses COMMON_ROOM_DEEP_NESTING (game 610) which has a GM NPC with pre-existing messages.
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_DEEP_NESTING');

    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    // Find the GM's NPC character (has pre-existing messages from fixture)
    const gmCharacterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: 'GM' }) })
      .locator('visible=true').first();
    await expect(gmCharacterCard).toBeVisible();

    const deleteButton = gmCharacterCard.locator('button:has([data-testid="delete-character-button"])').locator('visible=true').first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const confirmationModal = page.getByRole('heading', { name: 'Delete Character?' });
    await expect(confirmationModal).toBeVisible();

    const confirmButton = page.getByTestId('confirm-delete-character-button');
    await confirmButton.click();

    // Backend rejects deletion — error appears and modal stays open
    await expect(page.getByText(/cannot delete character with existing messages/i)).toBeVisible({ timeout: 5000 });
    await expect(confirmationModal).toBeVisible();
  });

  test('should allow canceling character deletion', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    // Fixture pre-bakes 'Cancel Delete NPC' with no messages or actions
    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    const characterName = 'Cancel Delete NPC';
    const characterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: characterName }) })
      .locator('visible=true').first();

    const deleteButton = characterCard.locator('button:has([data-testid="delete-character-button"])').locator('visible=true').first();
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const confirmationModal = page.getByRole('heading', { name: 'Delete Character?' });
    await expect(confirmationModal).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(confirmationModal).toBeHidden({ timeout: 2000 });
    expect(await characterWorkflowPage.hasCharacter(characterName)).toBe(true);
  });

  test('should not show delete button to players', async ({ page }) => {
    // 1. Login as Player
    await loginAs(page, 'PLAYER_1');

    // 2. Navigate to a game where the player is a participant
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    await page.goto(`/games/${gameId}?tab=characters`);
    await page.waitForLoadState('networkidle');

    // 3. Verify delete button is NOT visible
    // The testid is on a span inside the button, so look for buttons containing that span
    const deleteButtons = page.locator('button:has([data-testid="delete-character-button"])');
    await expect(deleteButtons).toHaveCount(0);
  });

});
