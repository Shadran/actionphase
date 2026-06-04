import { Page, Locator, expect } from '@playwright/test';
import { navigateToGameAndTab } from '../utils/navigation';
import { waitForVisible, waitForModal } from '../utils/waits';

/**
 * Page Object Model for Phase Management
 *
 * Encapsulates all phase management interactions including:
 * - Creating phases
 * - Activating phases
 * - Updating phase deadlines
 * - Publishing results
 */
export class PhaseManagementPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the Phases tab
   */
  async goto(gameId: number) {
    await navigateToGameAndTab(this.page, gameId, 'Phases');
  }

  /**
   * Get the Phase Management heading
   */
  get heading(): Locator {
    return this.page.locator('h2:has-text("Phase Management")');
  }

  /**
   * Get the Create Phase button
   */
  get createPhaseButton(): Locator {
    return this.page.locator('button:has-text("New Phase")');
  }

  /**
   * Get phase type select dropdown
   */
  get phaseTypeSelect(): Locator {
    return this.page.locator('select#phase-type');
  }

  /**
   * Get phase title input
   */
  get phaseTitleInput(): Locator {
    return this.page.locator('input#phase-title');
  }

  /**
   * Get phase description textarea
   */
  get phaseDescriptionTextarea(): Locator {
    return this.page.locator('textarea[data-testid="phase-description"]');
  }

  /**
   * Get phase deadline input
   */
  get phaseDeadlineInput(): Locator {
    return this.page.locator('input#phase-deadline');
  }

  /**
   * Get the submit button in the modal
   */
  get submitButton(): Locator {
    return this.page.locator('button:has-text("Create"), button[type="submit"]');
  }

  /**
   * Open the Create Phase modal
   */
  async openCreatePhaseModal() {
    await this.createPhaseButton.click();
    await waitForModal(this.page, 'Create Phase');
  }

  /**
   * Create a new phase
   * @param options - Phase creation options
   */
  async createPhase(options: {
    type: 'common_room' | 'action' | 'results';
    title: string;
    description?: string;
    deadline?: Date;
  }) {
    await this.openCreatePhaseModal();

    // Select phase type
    await this.phaseTypeSelect.selectOption(options.type);

    // Fill in phase details
    await this.phaseTitleInput.fill(options.title);

    if (options.description) {
      await this.phaseDescriptionTextarea.fill(options.description);
    }

    if (options.deadline) {
      // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
      const formatted = options.deadline.toISOString().slice(0, 16);
      await this.phaseDeadlineInput.fill(formatted);
    }

    // Submit form
    await this.submitButton.click();

    // Wait for phase to appear - filter to visible element (viewport-agnostic)
    await this.page.waitForLoadState('networkidle');
    await expect(this.page.getByText(options.title).locator('visible=true').first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Find a phase card by title
   * @param title - Phase title
   */
  getPhaseCard(title: string): Locator {
    // Use data-testid for more specific matching
    // Filter to the specific phase card that contains the title
    return this.page.locator('[data-testid="phase-card"]').filter({ hasText: title });
  }

  /**
   * Activate a phase
   * @param phaseTitle - Title of the phase to activate
   * @param publishResults - Whether to publish unpublished results first
   */
  async activatePhase(phaseTitle: string, publishResults = false) {
    const phaseCard = this.getPhaseCard(phaseTitle);

    // Scroll the activate button into view and ensure it's visible
    const activateButton = phaseCard.locator('button:has-text("Activate")').locator('visible=true').first();
    await activateButton.scrollIntoViewIfNeeded();
    await activateButton.waitFor({ state: 'visible', timeout: 5000 });

    // Click the activate button
    await activateButton.click();

    // Wait for confirmation dialog to appear (look for the dialog container)
    const confirmDialog = this.page.locator('.fixed.inset-0').filter({ hasText: 'Activate Phase' });
    await confirmDialog.waitFor({ state: 'visible', timeout: 5000 });

    // Wait for confirmation dialog button to appear and click it
    if (publishResults) {
      // Wait for and click "Publish & Activate Phase" button
      const publishButton = confirmDialog.locator('button', { hasText: 'Publish & Activate Phase' });
      await publishButton.waitFor({ state: 'visible', timeout: 5000 });
      await publishButton.click();
    } else {
      // Look for either "Activate Phase" or "Activate Without Publishing" button
      // Try both selectors and click whichever is found
      const activateButton = confirmDialog.locator('button', { hasText: 'Activate Phase' });
      const activateWithoutPublishingButton = confirmDialog.locator('button', { hasText: 'Activate Without Publishing' });

      // Wait for one of the buttons to appear
      try {
        await activateButton.waitFor({ state: 'visible', timeout: 2000 });
        await activateButton.click();
      } catch {
        // If "Activate Phase" not found, try "Activate Without Publishing"
        await activateWithoutPublishingButton.waitFor({ state: 'visible', timeout: 3000 });
        await activateWithoutPublishingButton.click();
      }
    }

    await this.page.waitForLoadState('networkidle');

    // Verify the phase is now active by checking for "Currently Active" badge
    await this.page.waitForTimeout(1000); // Brief wait for UI update
  }

  /**
   * Update phase deadline
   * @param phaseTitle - Title of the phase to update
   * @param newDeadline - New deadline date
   */
  async updateDeadline(phaseTitle: string, newDeadline: Date) {
    const phaseCard = this.getPhaseCard(phaseTitle);

    // Find deadline input in the phase card
    const deadlineInput = phaseCard.locator('input[type="datetime-local"]');

    // Format date for datetime-local input
    const formatted = newDeadline.toISOString().slice(0, 16);
    await deadlineInput.fill(formatted);

    // Click save/update button
    await phaseCard.locator('button:has-text("Save"), button:has-text("Update")').click();

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Edit a phase
   * @param phaseTitle - Title of the phase to edit
   * @param updates - Fields to update
   */
  async editPhase(
    phaseTitle: string,
    updates: {
      title?: string;
      description?: string;
      deadline?: Date;
    }
  ) {
    const phaseCard = this.getPhaseCard(phaseTitle);
    await phaseCard.locator('button:has-text("Edit")').click();

    await waitForModal(this.page, 'Edit Phase');

    if (updates.title) {
      await this.phaseTitleInput.fill(updates.title);
    }

    if (updates.description) {
      await this.phaseDescriptionTextarea.fill(updates.description);
    }

    if (updates.deadline) {
      const formatted = updates.deadline.toISOString().slice(0, 16);
      await this.phaseDeadlineInput.fill(formatted);
    }

    await this.submitButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get count of phases
   */
  async getPhaseCount(): Promise<number> {
    const phases = this.page.locator('[data-testid="phase-card"], .phase-card');
    return await phases.count();
  }

  /**
   * Verify phase exists
   * @param phaseTitle - Phase title to verify
   */
  async verifyPhaseExists(phaseTitle: string) {
    // Filter to visible element (viewport-agnostic)
    await expect(this.page.getByText(phaseTitle).locator('visible=true').first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify phase is active
   * @param phaseTitle - Phase title to verify
   */
  async verifyPhaseActive(phaseTitle: string) {
    const phaseCard = this.getPhaseCard(phaseTitle);
    const activeBadge = phaseCard.locator('text=Active, text=Current').first();
    await waitForVisible(activeBadge);
  }

  /**
   * Get unpublished results count
   */
  async getUnpublishedResultsCount(): Promise<number> {
    const countElement = this.page.locator('text=/\\d+ unpublished results/i');
    const text = await countElement.textContent();
    const match = text?.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Publish all phase results
   */
  async publishAllResults() {
    await this.page.click('button:has-text("Publish All Results")');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Delete a phase
   * @param phaseTitle - Title of the phase to delete
   * @param confirm - Whether to confirm the deletion (default: true)
   */
  async deletePhase(phaseTitle: string, confirm = true) {
    const phaseCard = this.getPhaseCard(phaseTitle);

    // Click delete button (use .first() since there's mobile + desktop versions)
    const deleteButton = phaseCard.getByRole('button', { name: /delete/i }).first();
    await deleteButton.scrollIntoViewIfNeeded();
    await deleteButton.click();

    // Wait for delete dialog buttons to appear (more reliable than heading)
    await expect(this.page.getByTestId('delete-phase-confirm-button')).toBeVisible({ timeout: 5000 });

    if (confirm) {
      // Click confirm button
      await this.page.getByTestId('delete-phase-confirm-button').click();

      // Wait for network to settle (delete API call)
      await this.page.waitForLoadState('networkidle');

      // Wait for phase card to disappear
      await expect(phaseCard).not.toBeVisible({ timeout: 5000 });
    } else {
      // Click cancel button
      await this.page.getByTestId('delete-phase-cancel-button').click();

      // Verify phase card still exists
      await expect(phaseCard).toBeVisible();
    }
  }

  /**
   * Add a draft post to a pending phase via the DraftPostSection
   */
  async addDraftPost(phaseTitle: string, options: { content: string; characterName?: string }): Promise<void> {
    const phaseCard = this.getPhaseCard(phaseTitle);
    const addBtn = phaseCard.getByTestId('add-draft-post-btn');
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    await this.page.locator('h2, h3').filter({ hasText: 'Write Draft Opening Post' }).waitFor({ state: 'visible', timeout: 5000 });

    if (options.characterName) {
      await this.page.locator('#create-draft-character').selectOption({ label: options.characterName });
    }

    await this.page.getByTestId('create-draft-content').fill(options.content);
    await this.page.locator('button:has-text("Save Draft")').click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Edit an existing draft post on a pending phase
   */
  async editDraftPost(phaseTitle: string, newContent: string): Promise<void> {
    const phaseCard = this.getPhaseCard(phaseTitle);
    const editBtn = phaseCard.getByTestId('edit-draft-btn');
    await editBtn.scrollIntoViewIfNeeded();
    await editBtn.click();

    await this.page.locator('h2, h3').filter({ hasText: 'Edit Draft Opening Post' }).waitFor({ state: 'visible', timeout: 5000 });

    await this.page.getByTestId('edit-draft-content').fill(newContent);
    await this.page.locator('button:has-text("Save Changes")').click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Get the draft post preview element on a phase card (the truncated italic preview text)
   */
  getDraftPostPreview(phaseTitle: string): Locator {
    return this.getPhaseCard(phaseTitle).locator('.line-clamp-2');
  }

  /**
   * Open delete phase dialog
   * @param phaseTitle - Title of the phase
   */
  async openDeleteDialog(phaseTitle: string) {
    const phaseCard = this.getPhaseCard(phaseTitle);

    // Click delete button (use .first() since there's mobile + desktop versions)
    const deleteButton = phaseCard.getByRole('button', { name: /delete/i }).first();
    await deleteButton.scrollIntoViewIfNeeded();
    await deleteButton.click();

    // Wait for delete dialog buttons to appear (more reliable than heading)
    await expect(this.page.getByTestId('delete-phase-confirm-button')).toBeVisible({ timeout: 5000 });
  }
}
