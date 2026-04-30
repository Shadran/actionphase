import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Tests for Character Avatar Feature
 *
 * REFACTORED: Minimal E2E tests following testing pyramid principles
 *
 * These tests verify USER JOURNEYS only:
 * - Users can upload avatars
 * - Users can delete avatars
 * - GMs have special upload permissions
 *
 * Tests that were REMOVED (moved to backend):
 * - File type validation (backend/pkg/avatars/service_test.go)
 * - File size validation (backend/pkg/avatars/service_test.go)
 * - Storage path verification (backend/pkg/storage/*_test.go)
 * - Permission checks at API level (backend tests)
 * - Cancel dialog behavior (UI implementation detail)
 *
 * Why this refactoring was needed:
 * - Original tests were flaky due to filesystem state persistence
 * - Tests were verifying implementation details, not user journeys
 * - Too many tests at expensive E2E layer
 * - Parallel execution caused race conditions with shared Game #168
 */

test.describe('Character Avatar Feature', () => {

  test('Character owner can upload, view, and delete avatar', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // Open character sheet
    const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    await expect(page.locator('h2:has-text("E2E Test Char 1")')).toBeVisible();

    // UPLOAD: Click upload button
    const uploadButton = page.locator('button[title="Upload Avatar"]');
    await expect(uploadButton).toBeVisible();
    await uploadButton.click();

    // Upload modal should appear
    await expect(page.locator('text=Upload Avatar for E2E Test Char 1')).toBeVisible();

    // Select and upload file
    const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testImagePath);

    // Preview should appear
    await expect(page.locator('text=Preview:')).toBeVisible();

    // Submit upload
    const submitButton = page.locator('button:has-text("Upload")').locator('visible=true').first();
    await expect(submitButton).toBeEnabled();

    const uploadPromise = page.waitForResponse(
      resp => resp.url().includes('/avatar') && resp.request().method() === 'POST',
      { timeout: 15000 }
    );

    await submitButton.click();
    await uploadPromise;

    // Modal should close
    await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 5000 });

    // Avatar should be visible in character sheet
    const avatarImg = page.locator('[data-testid="character-avatar"] img').locator('visible=true').first();
    await expect(avatarImg).toBeVisible({ timeout: 10000 });

    // DELETE: Click delete button
    const deleteButton = page.locator('button[title="Delete Avatar"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Confirm dialog
    await page.locator('button:has-text("Delete")').locator('visible=true').last().click();

    // Wait for deletion to complete
    await page.waitForResponse(
      resp => resp.url().includes('/avatar') && resp.request().method() === 'DELETE',
      { timeout: 10000 }
    );

    // Avatar image should be removed
    await expect(avatarImg).not.toBeVisible({ timeout: 10000 });

    // Upload button should be visible again (avatar removed)
    await expect(uploadButton).toBeVisible();
  });

  test('Non-owner player cannot upload avatar for another player character', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // Find Player 1's character card — must exist before asserting the upload button is absent
    const player1CharCard = page.getByTestId('character-card').filter({ hasText: 'E2E Test Char 1' });
    await expect(player1CharCard).toBeVisible({ timeout: 10000 });

    // Player 2 should not see an upload button on another player's character
    await expect(player1CharCard.locator('button[title="Upload Avatar"]')).not.toBeVisible();
  });

  test('GM can upload avatar for any character', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

    const gamePage = new GameDetailsPage(page);
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    // GM should see Edit Sheet buttons for all characters
    const editButtons = page.locator('button:has-text("Edit Sheet")').locator('visible=true');
    await expect(editButtons.first()).toBeVisible({ timeout: 10000 });

    // Open first character (not GM's own character)
    await editButtons.first().click();

    // Upload button should be visible (GM has permission)
    const uploadButton = page.locator('button[title="Upload Avatar"]');
    await expect(uploadButton).toBeVisible({ timeout: 5000 });

    // Click upload to verify modal opens (don't actually upload)
    await uploadButton.click();
    await expect(page.locator('text=Upload Avatar for')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });
});
