import { Page } from '@playwright/test';

/**
 * Creates a new game with minimal required fields
 * @param page - Playwright page object
 * @param title - Game title
 * @returns The game ID of the created game
 */
export async function createQuickGame(page: Page, title: string): Promise<number> {
  await page.goto('/games/create');
  await page.waitForLoadState('networkidle');

  // Fill in the game form
  await page.fill('[data-testid="game-title-input"]', title);
  await page.fill('[data-testid="game-description-textarea"]', 'Test game description for E2E testing');

  // Submit the form
  await page.click('[data-testid="create-game-button"]');

  // Wait for redirect to game details page
  await page.waitForURL('**/games/*');

  // Extract game ID from URL
  const url = page.url();
  const match = url.match(/\/games\/(\d+)/);
  if (!match) {
    throw new Error(`Failed to extract game ID from URL: ${url}`);
  }

  const gameId = parseInt(match[1]);
  return gameId;
}

/**
 * Submits an action for the current phase
 * @param page - Playwright page object
 * @param gameId - ID of the game
 * @param action - Action content to submit
 */
export async function submitAction(page: Page, gameId: number, action: string): Promise<void> {
  // Navigate to the game page where action submission is available
  await page.goto(`/games/${gameId}`);
  await page.waitForLoadState('networkidle');

  // Fill in the action textarea
  const actionTextarea = page.locator('[data-testid="action-textarea"]');
  await actionTextarea.waitFor({ state: 'visible' });
  await actionTextarea.fill(action);

  // Submit the action
  await page.click('[data-testid="submit-action-button"]');

  // Wait for submission to complete
  await page.waitForLoadState('networkidle');
}

/**
 * Transitions to the next phase (GM only)
 * @param page - Playwright page object
 * @param gameId - ID of the game
 */
export async function transitionPhase(page: Page, gameId: number): Promise<void> {
  // Navigate to the game management page
  await page.goto(`/games/${gameId}/manage`);
  await page.waitForLoadState('networkidle');

  // Click the transition phase button
  await page.click('[data-testid="transition-phase-button"]');

  // Confirm the transition if there's a confirmation modal
  const confirmButton = page.locator('[data-testid="confirm-transition-button"]');
  if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmButton.click();
  }

  // Wait for the phase transition to complete
  await page.waitForLoadState('networkidle');
}

/**
 * Creates a post in the common room
 * @param page - Playwright page object
 * @param gameId - ID of the game
 * @param content - Post content
 */
export async function createPost(page: Page, gameId: number, content: string): Promise<void> {
  // Navigate to common room
  await page.goto(`/games/${gameId}?tab=common-room`);
  await page.waitForLoadState('networkidle');

  // Find the new post textarea and fill it
  const postTextarea = page.locator('[data-testid="new-post-textarea"]');
  await postTextarea.waitFor({ state: 'visible' });
  await postTextarea.fill(content);

  // Submit the post
  await page.click('[data-testid="post-submit-button"]');

  // Wait for submission to complete
  await page.waitForLoadState('networkidle');
}

/**
 * Applies to join a game
 * @param page - Playwright page object
 * @param gameId - ID of the game to apply to
 */
export async function applyToGame(page: Page, gameId: number): Promise<void> {
  // Navigate to games list or game details
  await page.goto(`/games/${gameId}`);
  await page.waitForLoadState('networkidle');

  // Click the apply button
  await page.locator(`[data-testid="apply-button-${gameId}"]`).locator('visible=true').click();

  // Wait for the application to be submitted
  await page.waitForLoadState('networkidle');
}
