import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Action Submission
 *
 * Handles submitting and managing player actions during action phases
 * Actions are accessed via the game's Actions tab during in-progress games
 */
export class ActionSubmissionPage {
  readonly page: Page;
  readonly gameId: number;
  readonly phaseId?: number;

  // Locators
  readonly actionSubmissionForm: Locator;
  readonly actionTextarea: Locator;
  readonly submitActionButton: Locator;
  readonly editActionButton: Locator;
  readonly currentActionDisplay: Locator;
  readonly actionContent: Locator;
  readonly actionStatus: Locator;

  constructor(page: Page, gameId: number, phaseId?: number) {
    this.page = page;
    this.gameId = gameId;
    this.phaseId = phaseId;

    // Define locators using data-testid
    this.actionSubmissionForm = page.getByTestId('action-submission-form');
    this.actionTextarea = page.getByTestId('action-textarea');
    this.submitActionButton = page.getByTestId('submit-action-button');
    this.editActionButton = page.getByTestId('edit-action-button');
    this.currentActionDisplay = page.getByTestId('current-action-display');
    this.actionContent = page.getByTestId('action-content');
    this.actionStatus = page.getByTestId('action-status');
  }

  /**
   * Navigate to game's actions tab
   *
   * Navigates directly via URL param to avoid matching the dynamic tab label
   * ('Submit Action' vs 'Action Submitted ✓' vs 'Actions' for GM).
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}?tab=actions`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Submit a new action
   *
   * @param content - Action content
   * @param characterId - Optional character ID to act as
   */
  async submitAction(content: string, characterId?: number) {
    // Wait for form to be visible
    await this.actionSubmissionForm.waitFor({ state: 'visible', timeout: 5000 });

    // Select character if specified and multiple characters available
    if (characterId) {
      const characterSelect = this.page.getByTestId('character-select');
      const isSelectVisible = await characterSelect.isVisible().catch(() => false);

      if (isSelectVisible) {
        await characterSelect.selectOption(characterId.toString());
      }
    }

    // Fill action content
    await this.actionTextarea.fill(content);

    // Submit action
    await this.submitActionButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Edit existing action
   *
   * @param newContent - New action content
   */
  async editAction(newContent: string) {
    // Click edit button to expand form
    await this.editActionButton.waitFor({ state: 'visible', timeout: 3000 });
    await this.editActionButton.click();

    // Wait for form to appear
    await this.actionSubmissionForm.waitFor({ state: 'visible', timeout: 3000 });

    // Update content
    await this.actionTextarea.clear();
    await this.actionTextarea.fill(newContent);

    // Submit updated action
    await this.submitActionButton.click();
    await this.page.waitForLoadState('networkidle');

    // Give UI time to update
    await this.page.waitForTimeout(500);
  }

  /**
   * Get current action status
   *
   * @returns Action status message or null if no action
   */
  async getActionStatus(): Promise<string | null> {
    try {
      await this.currentActionDisplay.waitFor({ state: 'visible', timeout: 3000 });
      const statusText = await this.actionStatus.textContent();
      return statusText?.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Get current action content
   *
   * @returns Action content or null if no action
   */
  async getCurrentActionContent(): Promise<string | null> {
    try {
      await this.currentActionDisplay.waitFor({ state: 'visible', timeout: 3000 });
      const content = await this.actionContent.textContent();
      return content?.trim() || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user has submitted an action for current phase
   */
  async hasSubmittedAction(): Promise<boolean> {
    try {
      await this.currentActionDisplay.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if user can submit actions (form is visible and enabled)
   */
  async canSubmitAction(): Promise<boolean> {
    try {
      await this.actionSubmissionForm.waitFor({ state: 'visible', timeout: 3000 });
      const isDisabled = await this.submitActionButton.isDisabled();
      return !isDisabled;
    } catch {
      return false;
    }
  }

  /**
   * Check if user can edit their action
   */
  async canEditAction(): Promise<boolean> {
    try {
      await this.editActionButton.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * View action history (if available)
   */
  async viewActionHistory() {
    // Look for "Previous Actions" or "History" section
    const historyButton = this.page.locator('button:has-text("Previous Actions"), button:has-text("History")');
    const isVisible = await historyButton.isVisible().catch(() => false);

    if (isVisible) {
      await historyButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Get list of previous action submissions
   *
   * @returns Array of action contents from previous phases
   */
  async getPreviousActions(): Promise<string[]> {
    await this.viewActionHistory();

    const previousActionElements = await this.page
      .locator('[data-testid^="previous-action-"], .previous-action')
      .all();

    const actions: string[] = [];
    for (const element of previousActionElements) {
      const content = await element.textContent();
      if (content) {
        actions.push(content.trim());
      }
    }

    return actions;
  }

  /**
   * Wait for phase deadline countdown
   *
   * @returns Whether deadline element is visible
   */
  async hasDeadline(): Promise<boolean> {
    try {
      const deadline = this.page.getByTestId('phase-deadline');
      await deadline.waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
