import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for the Settings page
 * Provides methods for interacting with account security features
 */
export class SettingsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Navigation
  async goto() {
    // Navigate to settings and wait for URL to stabilize
    await this.page.goto('/settings');

    // Wait for the Settings heading to be visible (ensures page is fully loaded)
    await this.page.waitForSelector('h1:has-text("Settings")', { state: 'visible', timeout: 10000 });
  }

  /**
   * Navigate to the Account Information section via sidebar navigation
   * Works on both desktop (sidebar button) and mobile (select#section-select dropdown)
   */
  async clickAccountInformation() {
    const mobileSelect = this.page.locator('select#section-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
    if (isMobile) {
      await mobileSelect.selectOption('account');
    } else {
      await this.page.waitForSelector('a:has-text("Account Information")', { state: 'visible' });
      await this.page.click('a:has-text("Account Information")');
    }
  }

  // Change Username Form
  getChangeUsernameForm(): Locator {
    return this.page.getByTestId('change-username-form');
  }

  getCurrentUsernameDisplay(): Locator {
    return this.page.getByTestId('current-username-display');
  }

  getNewUsernameInput(): Locator {
    return this.page.getByTestId('new-username-input');
  }

  getUsernamePasswordInput(): Locator {
    return this.page.getByTestId('username-current-password-input');
  }

  getChangeUsernameSubmit(): Locator {
    return this.page.getByTestId('change-username-submit');
  }

  async fillUsernameForm(newUsername: string, password: string) {
    await this.getNewUsernameInput().fill(newUsername);
    await this.getUsernamePasswordInput().fill(password);
  }

  async submitUsernameChange() {
    await this.getChangeUsernameSubmit().click();
  }

  async changeUsername(newUsername: string, password: string) {
    await this.fillUsernameForm(newUsername, password);
    await this.submitUsernameChange();
  }

  // Change Email Form
  getChangeEmailForm(): Locator {
    return this.page.getByTestId('change-email-form');
  }

  getCurrentEmailDisplay(): Locator {
    return this.page.getByTestId('current-email-display');
  }

  getEmailVerificationInfo(): Locator {
    return this.page.getByTestId('email-verification-info');
  }

  getNewEmailInput(): Locator {
    return this.page.getByTestId('new-email-input');
  }

  getEmailPasswordInput(): Locator {
    return this.page.getByTestId('email-current-password-input');
  }

  getChangeEmailSubmit(): Locator {
    return this.page.getByTestId('change-email-submit');
  }

  async fillEmailForm(newEmail: string, password: string) {
    await this.getNewEmailInput().fill(newEmail);
    await this.getEmailPasswordInput().fill(password);
  }

  async submitEmailChange() {
    await this.getChangeEmailSubmit().click();
  }

  async requestEmailChange(newEmail: string, password: string) {
    await this.fillEmailForm(newEmail, password);
    await this.submitEmailChange();
  }

  // Reading Section

  async clickReadingSection() {
    const mobileSelect = this.page.locator('select#section-select');
    const isMobile = await mobileSelect.isVisible({ timeout: 2000 }).catch(() => false);
    if (isMobile) {
      await mobileSelect.selectOption('reading');
    } else {
      await this.page.click('a:has-text("Reading")');
    }
    await this.page.waitForSelector('[data-testid="read-mode-auto"]', { state: 'visible' });
    // Wait for the preferences query to resolve so radio checked state reflects server data
    await this.page.waitForLoadState('networkidle');
  }

  async selectCommentReadMode(mode: 'auto' | 'manual') {
    await this.page.getByTestId(`read-mode-${mode}`).locator('input[type="radio"]').click();
    await expect(
      this.page.getByTestId(`read-mode-${mode}`).locator('input[type="radio"]')
    ).toBeChecked();
    // Wait for the preference mutation to complete before proceeding
    await this.page.waitForLoadState('networkidle');
  }

  getCommentReadModeRadio(mode: 'auto' | 'manual') {
    return this.page.getByTestId(`read-mode-${mode}`).locator('input[type="radio"]');
  }

  // Assertions helpers
  async expectCurrentUsername(username: string) {
    const display = this.getCurrentUsernameDisplay();
    await display.waitFor({ state: 'visible' });
    const text = await display.textContent();
    return text?.includes(username) ?? false;
  }

  async expectCurrentEmail(email: string) {
    const display = this.getCurrentEmailDisplay();
    await display.waitFor({ state: 'visible' });
    const text = await display.textContent();
    return text?.includes(email) ?? false;
  }
}
