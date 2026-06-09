import { Page, expect } from '@playwright/test';

/**
 * Navigation Utilities for E2E Tests
 *
 * Centralized navigation functions to reduce repetition and improve reliability.
 * These functions replace direct page.goto + waitForTimeout patterns.
 *
 * Mobile vs Desktop handling:
 * - Tabs: mobile uses select#tab-select, desktop uses role="tab" elements
 * - Nav links: mobile requires opening hamburger menu first
 */

/**
 * Navigate to a game details page with proper loading
 * @param page - Playwright page object
 * @param gameId - Game ID to navigate to
 */
export async function navigateToGame(page: Page, gameId: number) {
  await page.goto(`/games/${gameId}`);
  await page.waitForLoadState('networkidle');
  // Wait for game title to be visible (ensures page is loaded)
  await page.waitForSelector('h1, h2', { timeout: 5000 });
}

/**
 * Navigate to a tab on the game details page
 * Handles both mobile (select#tab-select dropdown) and desktop (role="tab" elements)
 * @param page - Playwright page object
 * @param tabName - Name of the tab to navigate to
 */
export async function navigateToGameTab(page: Page, tabName: string) {
  // Mobile uses a select dropdown; desktop uses a tablist with role="tab"
  const mobileSelect = page.locator('select#tab-select');
  const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);

  if (isMobile) {
    // Find option by label substring (handles badge counts like "Applications (3)")
    const option = mobileSelect.locator('option', { hasText: tabName });
    const optionValue = await option.first().getAttribute('value');
    if (!optionValue) {
      throw new Error(`Tab "${tabName}" not found in mobile select`);
    }
    await mobileSelect.selectOption(optionValue);
  } else {
    await page.getByRole('tab', { name: tabName }).click();
  }

  // Wait for network activity to settle (important for tabs that load data)
  await page.waitForLoadState('networkidle');

  // Wait for tab content to be visible
  // Different tabs have different indicators
  const tabIndicators: Record<string, string> = {
    'Common Room': 'h2:has-text("Common Room")',
    'Phases': 'h2:has-text("Phase Management")',
    'Phase Management': 'h2:has-text("Phase Management")',
    'Applications': 'h2:has-text("Applications"), h3:has-text("Applications")',
    'Participants': 'h2:has-text("Participants"), h3:has-text("Participants")',
    'People': 'h2:has-text("Characters"), h3:has-text("Characters")',
    'Characters': 'h2:has-text("Characters")',
    'Actions': 'h2:has-text("Actions")',
    // The actions tab label is dynamic ('Submit Action' / 'Action Submitted ✓' / 'Actions' for GM)
    // Prefer navigating via ?tab=actions URL param rather than matching the label directly.
    'Messages': '', // Variable content (heading hidden when conversation is open), networkidle is sufficient
    'History': 'h2:has-text("History")',
    'Handouts': '', // Variable content
    'Audience': '', // Variable content
  };

  const indicator = tabIndicators[tabName];
  if (indicator) {
    await page.waitForSelector(indicator, { timeout: 10000 });
  }

  // For Common Room: wait for comment loading spinners to finish.
  // PostCard fires loadInitialComments in a useEffect *after* paint, so networkidle
  // may resolve before the comment fetch starts. Waiting for "Loading comments..." to
  // disappear ensures any in-flight comment fetches have completed before the test proceeds.
  if (tabName === 'Common Room') {
    await page.waitForSelector('text="Loading comments..."', { state: 'hidden', timeout: 30000 }).catch(() => {
      // If the text never appeared (no posts or already done), that's fine
    });
  }
}

/**
 * Navigate to game and switch to specific tab
 * @param page - Playwright page object
 * @param gameId - Game ID to navigate to
 * @param tabName - Name of the tab to navigate to
 */
export async function navigateToGameAndTab(page: Page, gameId: number, tabName: string) {
  await navigateToGame(page, gameId);
  await navigateToGameTab(page, tabName);
}

/**
 * Navigate to dashboard
 * @param page - Playwright page object
 */
export async function navigateToDashboard(page: Page) {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('h1, h2', { timeout: 5000 });
}

/**
 * Navigate to games list
 * @param page - Playwright page object
 */
export async function navigateToGamesList(page: Page) {
  await page.goto('/games');
  await page.waitForLoadState('networkidle');
}

/**
 * Reload the current page and wait for it to be ready
 * @param page - Playwright page object
 */
export async function reloadPage(page: Page) {
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Click a nav link via in-app React Router navigation (not page.goto).
 * On mobile, opens the hamburger menu first so the link is visible.
 * Use this instead of page.goto when the navigation must go through React Router
 * (e.g., to trigger unsaved-changes dialogs).
 * @param page - Playwright page object
 * @param linkName - Text of the nav link (e.g., 'Dashboard', 'Games')
 */
export async function navigateViaNavLink(page: Page, linkName: string) {
  // Wait for page to finish loading before checking nav state
  await page.waitForLoadState('networkidle');

  const hamburger = page.locator('button[aria-label="Menu"]');
  // Wait up to 5s for the nav to render before deciding mobile vs desktop
  const isMobile = await hamburger.isVisible({ timeout: 5000 }).catch(() => false);

  if (isMobile) {
    await hamburger.click();
    // Wait for the visible nav link in the mobile drawer (desktop link is hidden via CSS)
    const visibleLink = page.getByRole('link', { name: linkName }).locator('visible=true').first();
    await visibleLink.waitFor({ state: 'visible', timeout: 3000 });
    await visibleLink.click();
  } else {
    await page.getByRole('link', { name: linkName }).click();
  }
}

/**
 * Assert that a tab is visible/available for navigation.
 * Mobile: checks that select#tab-select has an option containing tabName.
 * Desktop: checks that getByRole('tab', {name}) is visible.
 * @param page - Playwright page object
 * @param tabName - Display name of the tab
 */
export async function assertTabVisible(page: Page, tabName: string) {
  const mobileSelect = page.locator('select#tab-select');
  const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);

  if (isMobile) {
    const option = mobileSelect.locator('option', { hasText: tabName });
    await expect(option.first()).toBeAttached();
  } else {
    await expect(page.getByRole('tab', { name: tabName })).toBeVisible();
  }
}

/**
 * Assert that a tab is NOT visible/available for navigation.
 * Mobile: checks that select#tab-select has no option containing tabName.
 * Desktop: checks that getByRole('tab', {name}) is not visible.
 * @param page - Playwright page object
 * @param tabName - Display name of the tab
 */
export async function assertTabNotVisible(page: Page, tabName: string) {
  const mobileSelect = page.locator('select#tab-select');
  const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);

  if (isMobile) {
    const option = mobileSelect.locator('option', { hasText: tabName });
    await expect(option).toHaveCount(0);
  } else {
    await expect(page.getByRole('tab', { name: tabName })).not.toBeVisible();
  }
}

/**
 * Assert that a tab is currently selected/active.
 * Mobile: checks that the selected option text includes tabName.
 * Desktop: checks that getByRole('tab', {name, selected:true}) is visible.
 * @param page - Playwright page object
 * @param tabName - Display name of the tab
 */
export async function assertTabSelected(page: Page, tabName: string) {
  const mobileSelect = page.locator('select#tab-select');
  const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);

  if (isMobile) {
    const checkedOption = mobileSelect.locator('option:checked');
    const optionText = await checkedOption.textContent();
    if (!optionText?.includes(tabName)) {
      throw new Error(`Expected active tab "${tabName}" but selected option text is "${optionText}"`);
    }
  } else {
    await expect(page.getByRole('tab', { name: tabName, selected: true })).toBeVisible();
  }
}
