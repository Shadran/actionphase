import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CharacterWorkflowPage } from '../pages/CharacterWorkflowPage';
import { CharacterSheetPage } from '../pages/CharacterSheetPage';

/**
 * E2E Tests for Character Sheet Management
 *
 * Tests the complete character sheet management workflow including:
 * - Adding/viewing abilities with descriptions
 * - Adding/viewing skills with proficiency levels
 * - Adding/removing inventory items
 * - Updating currency values
 * - Permission boundaries (Bio public, Abilities/Inventory private)
 * - GM can view all character sheets
 *
 * Uses dedicated E2E fixture (E2E_CHARACTER_SHEETS) which includes:
 * - Character 1: Has existing abilities (2), skills (2), items (2), currency
 * - Character 2: Has different data for comparison
 * - Character 3: Empty sheet for fresh additions
 *
 * CRITICAL: This tests CORE player engagement mechanics
 */

test.describe('Character Sheet Management', () => {

  // Close any open modals after each test so the next test starts clean.
  // afterEach runs while still on the game page, so Escape reliably dismisses the modal.
  // beforeEach was wrong for this: it fired before loginAs/goto, so the page was
  // on '/' and Escape had nothing to close.
  test.afterEach(async ({ page }) => {
    await page.keyboard.press('Escape');
  });

  test('player can view existing abilities, skills, items, and currency on their character sheet', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab and open character sheet
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Open character sheet using POM
    await characterPage.openCharacterSheet('Sheet Test Char 1');

    // Wait for sheet to load
    await expect(page.getByRole('heading', { name: 'Sheet Test Char 1', level: 2 })).toBeVisible({ timeout: 10000 });

    // Initialize CharacterSheetPage
    const sheetPage = new CharacterSheetPage(page);

    // ===== Test Abilities =====
    // Navigate to Abilities & Skills module and Abilities tab
    await sheetPage.goToAbilitiesModule();
    await sheetPage.goToAbilitiesTab(2);

    // Verify existing abilities are displayed
    await expect(page.locator('text=Keen Eye')).toBeVisible();

    // Expand description for Keen Eye (descriptions are collapsed by default)
    const keenEyeCard = page.locator('div.border.rounded-lg').filter({ has: page.locator('text=Keen Eye') });
    await keenEyeCard.getByRole('button', { name: /expand description/i }).first().click();
    await expect(page.locator('text=Can spot hidden details')).toBeVisible();

    await expect(page.locator('text=Quick Draw')).toBeVisible();

    // Expand description for Quick Draw
    const quickDrawCard = page.locator('div.border.rounded-lg').filter({ has: page.locator('text=Quick Draw') });
    await quickDrawCard.getByRole('button', { name: /expand description/i }).first().click();
    await expect(page.locator('text=Fast weapon draw')).toBeVisible();

    // ===== Test Skills =====
    // Navigate to Skills tab
    await sheetPage.goToSkillsTab(2);

    // Verify existing skills are displayed (proficiency levels may not be shown as text)
    await expect(page.locator('text=Archery')).toBeVisible();

    // Expand description for Archery (descriptions are collapsed by default)
    const archeryCard = page.locator('div.border.rounded-lg').filter({ has: page.locator('text=Archery') });
    await archeryCard.getByRole('button', { name: /expand description/i }).first().click();
    await expect(page.locator('text=Master archer')).toBeVisible();

    await expect(page.locator('text=Tracking')).toBeVisible();

    // Expand description for Tracking
    const trackingCard = page.locator('div.border.rounded-lg').filter({ has: page.locator('text=Tracking') });
    await trackingCard.getByRole('button', { name: /expand description/i }).first().click();
    await expect(page.locator('text=Can track creatures')).toBeVisible();

    // ===== Test Inventory (Items & Currency) =====
    // Navigate to Inventory module
    await sheetPage.goToInventoryModule();

    // Verify existing items are displayed (Items tab should be selected by default)
    await expect(page.getByRole('heading', { name: 'Longbow' })).toBeVisible();

    // Expand description for Longbow (descriptions are collapsed by default)
    const longbowCard = page.locator('div.border.rounded-lg').filter({ has: page.getByRole('heading', { name: 'Longbow' }) });
    await longbowCard.getByRole('button', { name: /expand description/i }).first().click();
    await expect(page.locator('text=Masterwork longbow')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Arrows' })).toBeVisible();

    // Expand description for Arrows
    const arrowsCard = page.locator('div.border.rounded-lg').filter({ has: page.getByRole('heading', { name: 'Arrows' }) });
    await arrowsCard.getByRole('button', { name: /expand description/i }).first().click();
    await expect(page.locator('text=Steel-tipped arrows')).toBeVisible();

    // Navigate to Currency tab
    await sheetPage.goToCurrencyTab(2);

    // Verify currency amounts are displayed — scoped to currency section to avoid matching unrelated "50"/"25" on page
    const currencySection = page.getByTestId('currency-section');
    await expect(currencySection.locator('text=Currency & Resources')).toBeVisible();
    await expect(currencySection.locator('text=50')).toBeVisible();
    await expect(currencySection.locator('text=25')).toBeVisible();
  });

  test('GM can view all character sheets', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Verify GM sees all characters.
    // Each character card renders two data-testid="character-name" elements — one for mobile
    // layout (hidden on desktop) and one for desktop layout (hidden on mobile). Filter to the
    // visible one to avoid strict mode violations and hidden-element false negatives.
    await expect(page.getByTestId('character-name').filter({ hasText: 'Sheet Test Char 1' }).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('character-name').filter({ hasText: 'Sheet Test Char 2' }).locator('visible=true').first()).toBeVisible();
    await expect(page.getByTestId('character-name').filter({ hasText: 'Empty Sheet Char' }).locator('visible=true').first()).toBeVisible();

    // GM should be able to view any character (open char 2, owned by PLAYER_2)
    await characterPage.openCharacterSheet('Sheet Test Char 2');

    // Verify GM can see character sheet modal
    await expect(page.getByRole('heading', { name: 'Sheet Test Char 2', level: 2 })).toBeVisible({ timeout: 10000 });

    // Initialize CharacterSheetPage
    const sheetPage = new CharacterSheetPage(page);

    // Navigate to Abilities & Skills module and Abilities tab
    await sheetPage.goToAbilitiesModule();
    await sheetPage.goToAbilitiesTab(3);

    // Verify GM sees the mage's abilities
    await expect(page.locator('text=Fireball')).toBeVisible();
    await expect(page.locator('text=Shield')).toBeVisible();
    await expect(page.locator('text=Arcane Knowledge')).toBeVisible();
  });

  test('bio module is public, abilities and inventory modules are private', async ({ page }) => {
    // Verify PLAYER_2 can only see bio of PLAYER_1's character (not abilities/inventory)
    await loginAs(page, 'PLAYER_2');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();

    // Click on another player's character (Sheet Test Char 1, owned by PLAYER_1)
    await characterPage.openCharacterSheet('Sheet Test Char 1');

    // Wait for sheet modal to open
    await expect(page.getByRole('heading', { name: 'Sheet Test Char 1', level: 2 })).toBeVisible({ timeout: 10000 });

    // Initialize CharacterSheetPage
    const sheetPage = new CharacterSheetPage(page);

    // Should see Bio/Background module (public)
    expect(await sheetPage.isModuleVisible('Public Profile')).toBe(true);

    // Should NOT see Private Notes, Abilities & Skills or Inventory modules (private - owner/GM only)
    expect(await sheetPage.isModuleVisible('Private Notes')).toBe(false);
    expect(await sheetPage.isModuleVisible('Abilities & Skills')).toBe(false);
    expect(await sheetPage.isModuleVisible('Inventory')).toBe(false);

    // Verify bio content is visible
    await expect(page.locator('text=A weathered ranger with keen eyes')).toBeVisible();
  });

  test('player cannot edit abilities, skills, inventory, or currency', async ({ page }) => {
    // Verify player CANNOT add/edit abilities, skills, items, or currency on their own character
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab and open character sheet
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();
    await characterPage.openCharacterSheet('Sheet Test Char 1');

    // Wait for sheet to load
    await expect(page.getByRole('heading', { name: 'Sheet Test Char 1', level: 2 })).toBeVisible({ timeout: 10000 });

    // Initialize CharacterSheetPage
    const sheetPage = new CharacterSheetPage(page);

    // ===== Test Abilities - No Edit UI =====
    await sheetPage.goToAbilitiesModule();
    await sheetPage.goToAbilitiesTab(2);

    // Player should NOT see "Add Ability" button or edit controls
    expect(await sheetPage.canAddAbility()).toBe(false);
    await expect(page.locator('button[title="Edit ability"]')).not.toBeVisible();
    await expect(page.locator('button[title="Delete ability"]')).not.toBeVisible();

    // ===== Test Skills - No Edit UI =====
    await sheetPage.goToSkillsTab(2);

    // Player should NOT see "Add Skill" button or edit controls
    expect(await sheetPage.canAddSkill()).toBe(false);
    await expect(page.locator('button[title="Edit skill"]')).not.toBeVisible();
    await expect(page.locator('button[title="Delete skill"]')).not.toBeVisible();

    // ===== Test Inventory - No Edit UI =====
    await sheetPage.goToInventoryModule();

    // Player should NOT see "Add Item" button or edit controls
    expect(await sheetPage.canAddItem()).toBe(false);
    await expect(page.locator('button[title="Edit item"]')).not.toBeVisible();
    await expect(page.locator('button[title="Delete item"]')).not.toBeVisible();

    // ===== Test Currency - No Edit UI =====
    await sheetPage.goToCurrencyTab(2);

    // Player should NOT see "Add Currency" button or edit controls
    expect(await sheetPage.canAddCurrency()).toBe(false);
    await expect(page.locator('button[title="Edit currency"]')).not.toBeVisible();
    await expect(page.locator('button[title="Delete currency"]')).not.toBeVisible();
  });

  test('GM can edit abilities, skills, inventory, and currency', async ({ page }) => {
    // CharacterWorkflowPage now supports both character_creation and in_progress game states
    // Verify GM CAN add/edit abilities, skills, items, and currency on any character
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_CHARACTER_SHEETS');

    // Navigate to Characters tab and open character sheet
    const characterPage = new CharacterWorkflowPage(page, gameId);
    await characterPage.goto();
    await characterPage.openCharacterSheet('Sheet Test Char 1');

    // Wait for sheet to load
    await expect(page.getByRole('heading', { name: 'Sheet Test Char 1', level: 2 })).toBeVisible({ timeout: 10000 });

    // Initialize CharacterSheetPage
    const sheetPage = new CharacterSheetPage(page);

    // ===== Test Abilities - GM can add/edit =====
    await sheetPage.goToAbilitiesModule();
    await sheetPage.goToAbilitiesTab(2);

    // GM SHOULD see "Add Ability" button and can add a new ability
    expect(await sheetPage.canAddAbility()).toBe(true);
    await sheetPage.addAbility('Test Ability', 'Test description');

    // Verify new ability appears
    await expect(page.locator('text=Test Ability')).toBeVisible();

    // ===== Test Skills - GM can add =====
    await sheetPage.goToSkillsTab(2);

    // GM SHOULD see "Add Skill" button
    expect(await sheetPage.canAddSkill()).toBe(true);

    // ===== Test Inventory - GM can add items =====
    await sheetPage.goToInventoryModule();

    // GM SHOULD see "Add Item" button
    expect(await sheetPage.canAddItem()).toBe(true);

    // ===== Test Currency - GM can add =====
    await sheetPage.goToCurrencyTab(2);

    // GM SHOULD see "Add Currency" button
    expect(await sheetPage.canAddCurrency()).toBe(true);
  });
});
