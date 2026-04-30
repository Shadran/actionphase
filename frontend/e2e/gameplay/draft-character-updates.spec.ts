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
 * - Creating draft updates (abilities as primary example)
 * - Publishing results with character updates
 * - Confirmation dialog showing pending updates
 * - Published ability appearing on the player's character sheet
 *
 * Uses dedicated E2E fixture (E2E_GM_EDITING_RESULTS) which includes:
 * - Game with active action phase
 * - Unpublished result for Player 3 (GM can add character updates)
 *
 * CRITICAL: Serial mode required — test 5 publishes the unpublished result,
 * consuming the shared fixture state. Tests build on each other.
 */
test.describe('Draft Character Updates - Core Workflow', () => {
  test.describe.configure({ mode: 'serial' });

  test('GM can add an ability and it persists after reopening', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Add Ability' }).click();
    await expect(page.getByPlaceholder('e.g., Fireball, Sneak Attack')).toBeVisible({ timeout: 5000 });

    const abilityName = `Persist Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('You can see in darkness within 60 feet');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });

    // Close and wait for debounced save to complete, then reopen
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).not.toBeVisible();
    await page.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 });

    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    // Ability should still be present after closing and reopening (not just in-memory)
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
  });

  test('GM can remove an ability', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Add Ability' }).click();
    const uniqueAbilityName = `Remove Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(uniqueAbilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Test removal');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: uniqueAbilityName })).toBeVisible({ timeout: 5000 });

    const abilityCard = page.locator('div.rounded-lg.border.p-5').filter({ has: page.getByRole('heading', { name: uniqueAbilityName }) });
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

    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Add Ability' }).click();
    const abilityName = `Badge Test ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Description');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });

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

    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/This will also publish \d+ character sheet update/)).toBeVisible();

    // Dismiss without publishing — test 5 needs the unpublished result intact
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).not.toBeVisible();
  });

  test('publishing result applies ability to player character sheet', async ({ page }) => {
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);
    await gamePage.goToActions();
    await expect(page.getByText('Unpublished Results (Editable)')).toBeVisible({ timeout: 10000 });

    // Add the ability that will be published to the player's sheet
    await page.getByRole('button', { name: 'Update Character Sheet' }).click();
    await expect(page.getByRole('heading', { name: 'Update Character Sheet' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Add Ability' }).click();
    const abilityName = `Final Ability ${Date.now()}`;
    await page.getByPlaceholder('e.g., Fireball, Sneak Attack').fill(abilityName);
    await page.getByPlaceholder('Describe this ability...').fill('Granted by GM on publish');
    await page.getByRole('button', { name: 'Add Ability' }).last().click();
    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
    await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/character-updates') && resp.status() === 200, { timeout: 5000 }),
      page.getByRole('button', { name: 'Done' }).click(),
    ]);

    // Publish the result
    await page.getByRole('button', { name: 'Publish Result' }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Publish Action Result?' })).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('0 Unpublished')).toBeVisible({ timeout: 5000 });

    // Switch to Player 3 and verify the ability now appears on their character sheet
    await loginAs(page, 'PLAYER_3');
    await gamePage.goto(gameId);
    await gamePage.goToCharacters();

    await page.getByRole('button', { name: 'Edit Sheet' }).click();

    const characterSheet = new CharacterSheetPage(page);
    await characterSheet.goToAbilitiesModule();

    await expect(page.getByRole('heading', { name: abilityName })).toBeVisible({ timeout: 5000 });
  });

  test('player cannot see Update Character Sheet button', async ({ page }) => {
    await loginAs(page, 'PLAYER_3');
    const gameId = await getFixtureGameId(page, 'E2E_GM_EDITING_RESULTS');
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);

    // Players should not see the Update Character Sheet button (GM-only)
    await expect(page.getByRole('button', { name: 'Update Character Sheet' })).not.toBeVisible({ timeout: 10000 });
  });
});
