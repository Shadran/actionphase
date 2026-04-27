import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { CharacterSheetPage } from '../pages/CharacterSheetPage';

/**
 * E2E Tests for Draft Character Updates Feature
 *
 * Tests the complete workflow for GMs creating and managing character sheet updates
 * when writing action results, focusing on:
 * - Opening Update Character Sheet modal
 * - Creating draft updates (abilities as primary example)
 * - Publishing results with character updates
 * - Confirmation dialog showing pending updates
 *
 * Uses dedicated E2E fixture (E2E_GM_EDITING_RESULTS) which includes:
 * - Game with active action phase
 * - Unpublished result for Player 3 (GM can add character updates)
 *
 * CRITICAL: This tests CORE GM workflow - managing character progression via results
 */

test.describe('Draft Character Updates - Core Workflow', () => {

  test('GM can open Update Character Sheet modal and see sections', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Click "Update Character Sheet" button
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();

    // Modal should open with section heading
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    // Section nav buttons should be visible
    await expect(page.getByRole('button', { name: 'abilities', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'inventory', exact: true })).toBeVisible();

    // Abilities sub-tabs should be visible by default
    await expect(page.getByRole('button', { name: /Abilities/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Skills/ })).toBeVisible();

    // Done button should close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).not.toBeVisible();
  });

  test('GM can add an ability and it persists after reopening', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    // Click "Add Ability" to show form
    await page.getByRole('button', { name: 'Add Ability' }).click();

    // Wait for form to appear
    await expect(page.getByPlaceholder('e.g., Fireball, Sneak Attack')).toBeVisible({ timeout: 5000 });

    // Fill in ability with a unique name to avoid collisions between test runs
    const abilityName = `Persist Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('You can see in darkness within 60 feet');

    // Add the ability
    await page.getByRole('button', { name: 'Add Ability' }).last().click();

    // Should see the ability in the list immediately
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });

    // Close and reopen to verify the draft persisted (not just in-memory)
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).not.toBeVisible();

    // Wait for the debounced save to complete (800ms debounce + API round-trip)
    await page.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 });

    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    // Ability should still be present after closing and reopening
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
  });

  test('GM can remove an ability', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal and add an ability
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Add Ability' }).click();

    const uniqueAbilityName = `Remove Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(uniqueAbilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Test removal');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: uniqueAbilityName })).toBeVisible({ timeout: 5000 });

    // Click the remove button on the ability card
    const abilityCard = page.locator('div').filter({ has: page.getByRole('heading', { name: uniqueAbilityName }) });
    await abilityCard.getByRole('button', { name: 'Remove ability' }).click();

    await expect(page.getByRole('heading', { name: uniqueAbilityName })).not.toBeVisible();
  });

  test('GM sees draft count badge on Update Character Sheet button', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Open modal and add an ability
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Add Ability' }).click();
    const abilityName = `Badge Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Description');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });

    // Close modal and wait for save (handleClose flushes pending debounce immediately)
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 }),
      page.getByRole('button', { name: 'Done' }).click(),
    ]);

    // Button should show a badge with a count > 0
    const updateButton = page.getByRole('button', { name: /Update Character Sheet/ });
    await expect(updateButton.locator('span, div').filter({ hasText: /^\d+$/ })).toBeVisible({ timeout: 5000 });
  });

  test('publish confirmation dialog shows character update warning', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Add a character update
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Add Ability' }).click();
    const abilityName = `Publish Dialog Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('This will be published');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 }),
      page.getByRole('button', { name: 'Done' }).click(),
    ]);

    // Open publish dialog
    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });

    // Should show warning about publishing character updates
    await expect(page.getByText(/This will also publish \d+ character sheet update/)).toBeVisible();
  });

  test('GM can successfully publish result with character updates', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Add a character update
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Add Ability' }).click();
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill('Final Ability');
    await page.getByPlaceholder('Describe this ability...').fill('Final test');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: 'Final Ability' })).toBeVisible({ timeout: 5000 });
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 }),
      page.getByRole('button', { name: 'Done' }).click(),
    ]);

    // Publish the result
    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();

    // Wait for dialog to close (indicates publish completed)
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).not.toBeVisible({ timeout: 10000 });

    // Result should move to Published Results section
    await expect(page.getByRole('heading', { name: 'Published Results' })).toBeVisible({ timeout: 10000 });

    // Verify unpublished count is now 0
    await expect(page.getByText('0 Unpublished')).toBeVisible({ timeout: 5000 });
  });

  test('player cannot see Update Character Sheet button', async ({ page }) => {
    await loginAs(page, 'PLAYER_3');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await page.waitForLoadState('networkidle');

    // Players should not see the Update Character Sheet button (GM-only)
    await expect(page.getByRole('button', { name: 'Update Character Sheet' })).not.toBeVisible({ timeout: 10000 });
  });

  test('published ability appears on the player character sheet', async ({ browser }) => {
    test.setTimeout(90000);
    // GM adds ability and publishes
    const gmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();

    const abilityName = `Published Ability ${Date.now()}`;

    try {
      await loginAs(gmPage, 'GM');
      const gameId = await getFixtureGameId(gmPage, 'E2E_GM_EDITING_RESULTS');
      const gamePage = new GameDetailsPage(gmPage);

      await gamePage.goto(gameId);
      await gamePage.goToActions();
      await expect(gmPage.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

      // Add ability draft
      await gmPage.getByRole('button', { name: 'Update Character Sheet' }).click();
      await expect(gmPage.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
      await gmPage.getByRole('button', { name: 'Add Ability' }).click();
      await gmPage.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
      await gmPage.getByPlaceholder('Describe this ability...').fill('Granted by GM on publish');
      await gmPage.getByRole('button', { name: 'Add Ability' }).last().click();
      await expect(gmPage.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
      await Promise.all([
        gmPage.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 }),
        gmPage.getByRole('button', { name: 'Done' }).click(),
      ]);

      // Publish
      await gmPage.getByRole('button', { name: 'Publish Result' }).click();
      await expect(gmPage.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });
      await gmPage.getByRole('button', { name: 'Publish', exact: true }).click();
      await expect(gmPage.getByRole('heading', { name: 'Publish Action Result?' })).not.toBeVisible({ timeout: 10000 });
      await expect(gmPage.getByText('0 Unpublished')).toBeVisible({ timeout: 5000 });
    } finally {
      await gmContext.close();
    }

    // Player 3 checks their character sheet and sees the ability
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(playerPage, 'PLAYER_3');
      const gameId = await getFixtureGameId(playerPage, 'E2E_GM_EDITING_RESULTS');
      const gamePage = new GameDetailsPage(playerPage);
      const characterSheet = new CharacterSheetPage(playerPage);

      // Navigate to the character via People > Characters
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      // Click on Player 3's character (opens inline via Edit Sheet button)
      await playerPage.getByRole('button', { name: 'Edit Sheet' }).click();
      await playerPage.waitForLoadState('networkidle');

      // Go to Abilities & Skills tab
      await characterSheet.goToAbilitiesModule();

      // The ability granted by the GM should now be visible
      await expect(playerPage.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
    } finally {
      await playerContext.close();
    }
  });
});
