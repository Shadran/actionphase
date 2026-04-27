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
    // 1. Login as GM
    await loginAs(page, 'GM');

    // 2. Navigate to character creation game
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    // 3. Create a test character to delete
    await characterWorkflowPage.createCharacterButton.click();

    const characterForm = page.getByTestId('character-form');
    await expect(characterForm).toBeVisible();

    const characterName = `Delete Test Character ${Date.now()}`;
    await page.getByTestId('character-name-input').fill(characterName);

    // Create as NPC (simpler, no player assignment needed)
    const characterTypeSelect = page.getByLabel('Character Type');
    await characterTypeSelect.selectOption('npc');

    const submitButton = page.getByTestId('character-submit-button');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Wait for modal to close and character to appear
    await expect(characterForm).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Verify character was created
    const hasNewCharacter = await characterWorkflowPage.hasCharacter(characterName);
    expect(hasNewCharacter).toBe(true);

    // 4. Find the delete button for the newly created character
    const characterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: characterName }) })
      .locator('visible=true').first();

    // The testid is on a span inside the button, so we need to find the button containing it
    const deleteButton = characterCard.locator('button:has([data-testid="delete-character-button"])').locator('visible=true').first();
    await expect(deleteButton).toBeVisible();

    // 5. Click delete button
    await deleteButton.click();

    // 6. Verify confirmation modal appears
    const confirmationModal = page.getByRole('heading', { name: 'Delete Character?' });
    await expect(confirmationModal).toBeVisible();

    // Verify character name is shown in modal body (inside the confirmation text)
    const modalBody = page.getByText(`Are you sure you want to delete ${characterName}?`);
    await expect(modalBody).toBeVisible();

    // Verify warning message
    const warningMessage = page.getByText(/This action cannot be undone/);
    await expect(warningMessage).toBeVisible();

    // 7. Confirm deletion
    const confirmButton = page.getByTestId('confirm-delete-character-button');
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // 8. Wait for deletion to complete and modal to close
    await expect(confirmationModal).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // 9. Verify character no longer exists in the list
    const characterStillExists = await characterWorkflowPage.hasCharacter(characterName);
    expect(characterStillExists).toBe(false);
  });

  test('should show error when trying to delete character with messages', async ({ page }) => {
    // 1. Login as GM
    await loginAs(page, 'GM');

    // 2. Navigate to the Common Room Posts game
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');

    // 3. First, create a message in Common Room using one of the characters
    await page.goto(`/games/${gameId}?tab=common-room`);
    await page.waitForLoadState('networkidle');

    // Fill in a GM post
    const postTextarea = page.getByRole('textbox', { name: /Post Content/i });
    await postTextarea.fill('Test post to prevent character deletion');

    // Submit the post
    const createPostButton = page.getByRole('button', { name: 'Create GM Post' });
    await expect(createPostButton).toBeEnabled();
    await createPostButton.click();
    await page.waitForLoadState('networkidle');

    // 4. Now navigate to People tab → Characters sub-tab
    await page.goto(`/games/${gameId}?tab=people`);
    await page.waitForLoadState('networkidle');

    // Click on Characters sub-tab within People view
    const charactersSubTab = page.getByRole('button', { name: 'Characters', exact: false });
    await charactersSubTab.waitFor({ state: 'visible', timeout: 2000 });
    await charactersSubTab.click();
    await page.waitForLoadState('networkidle');

    // 5. Find the GM's NPC character (which now has a message)
    const npcSection = page.locator('h3:has-text("NPCs")').locator('..');
    const gmCharacterCard = npcSection.getByTestId('character-card').locator('visible=true').first();
    await expect(gmCharacterCard).toBeVisible();

    const deleteButton = gmCharacterCard.getByTestId('delete-character-button').locator('visible=true').first();
    await expect(deleteButton).toBeVisible();

    // 6. Click delete button
    await deleteButton.click();

    // 7. Verify confirmation modal appears
    const confirmationModal = page.getByRole('heading', { name: 'Delete Character?' });
    await expect(confirmationModal).toBeVisible();

    // 8. Click confirm to attempt deletion
    const confirmButton = page.getByTestId('confirm-delete-character-button');
    await confirmButton.click();

    // 9. Error message should appear in the modal (backend rejects deletion)
    await expect(page.getByText(/cannot delete character with existing messages/i)).toBeVisible({ timeout: 5000 });

    // 10. Verify modal stays open (deletion failed)
    await expect(confirmationModal).toBeVisible();
  });

  test('should allow canceling character deletion', async ({ page }) => {
    // 1. Login as GM
    await loginAs(page, 'GM');

    // 2. Navigate to character creation game
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    // 3. Create a test character
    await characterWorkflowPage.createCharacterButton.click();

    const characterForm = page.getByTestId('character-form');
    await expect(characterForm).toBeVisible();

    const characterName = `Cancel Delete Test ${Date.now()}`;
    await page.getByTestId('character-name-input').fill(characterName);

    const characterTypeSelect = page.getByLabel('Character Type');
    await characterTypeSelect.selectOption('npc');

    const submitButton = page.getByTestId('character-submit-button');
    await submitButton.click();

    await expect(characterForm).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // 4. Click delete button
    const characterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: characterName }) })
      .locator('visible=true').first();

    // The testid is on a span inside the button, so we need to find the button containing it
    const deleteButton = characterCard.locator('button:has([data-testid="delete-character-button"])').locator('visible=true').first();
    await deleteButton.click();

    // 5. Verify confirmation modal appears
    const confirmationModal = page.getByRole('heading', { name: 'Delete Character?' });
    await expect(confirmationModal).toBeVisible();

    // 6. Click cancel button
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();

    // 7. Verify modal closes
    await expect(confirmationModal).toBeHidden({ timeout: 2000 });

    // 8. Verify character still exists
    const characterStillExists = await characterWorkflowPage.hasCharacter(characterName);
    expect(characterStillExists).toBe(true);
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

  test('should only show delete button to GM', async ({ page }) => {
    // 1. Login as GM
    await loginAs(page, 'GM');

    // 2. Navigate to character creation game
    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_CREATION');

    const characterWorkflowPage = new CharacterWorkflowPage(page, gameId);
    await characterWorkflowPage.goto();

    // 3. Create a test character
    await characterWorkflowPage.createCharacterButton.click();

    const characterForm = page.getByTestId('character-form');
    await expect(characterForm).toBeVisible();

    const characterName = `GM Permission Test ${Date.now()}`;
    await page.getByTestId('character-name-input').fill(characterName);

    const characterTypeSelect = page.getByLabel('Character Type');
    await characterTypeSelect.selectOption('npc');

    const submitButton = page.getByTestId('character-submit-button');
    await submitButton.click();

    await expect(characterForm).toBeHidden({ timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // 4. Verify GM can see delete button
    const characterCard = page
      .getByTestId('character-card')
      .filter({ has: page.getByTestId('character-name').filter({ hasText: characterName }) })
      .locator('visible=true').first();

    // The testid is on a span inside the button, so we need to find the button containing it
    const deleteButton = characterCard.locator('button:has([data-testid="delete-character-button"])').locator('visible=true').first();
    await expect(deleteButton).toBeVisible();
  });
});
