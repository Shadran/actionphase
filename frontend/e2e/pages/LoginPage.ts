import { Page, Locator } from '@playwright/test';

/**
 * Page Object for User Login
 *
 * Handles user authentication and login flows
 */
export class LoginPage {
  readonly page: Page;

  // Locators
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly signUpButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.usernameInput = page.locator('[data-testid="login-username"]');
    this.passwordInput = page.locator('[data-testid="login-password"]');
    this.loginButton = page.locator('[data-testid="login-submit"]');
    this.signUpButton = page.locator('button:has-text("Don\'t have an account? Sign up")');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    // Navigate with retry logic to handle race conditions during user switching
    let retries = 3;
    while (retries > 0) {
      try {
        await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
        break;
      } catch (error) {
        const isNavigationError = error.message.includes('interrupted by another navigation') ||
                                 error.message.includes('ERR_ABORTED');
        if (isNavigationError && retries > 1) {
          // Wait a bit and retry
          await this.page.waitForTimeout(300);
          retries--;
        } else {
          throw error;
        }
      }
    }
    // Wait for the login form to be visible and network to settle
    // (ensures any in-flight auth requests from prior tests have completed)
    await this.usernameInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Login with credentials
   *
   * @param username - Username
   * @param password - Password
   * @param expectSuccess - Whether login should succeed (default: true)
   * @returns Promise that resolves when login completes
   */
  async login(username: string, password: string, expectSuccess: boolean = true) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();

    if (expectSuccess) {
      // Wait for redirect to dashboard (successful login)
      await this.page.waitForURL('/dashboard', { timeout: 10000 });
    }
  }

  /**
   * Attempt login with invalid credentials (for testing validation)
   */
  async loginInvalid(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    return await this.errorMessage.textContent() || '';
  }

  /**
   * Check if login button is disabled
   */
  async isLoginButtonDisabled(): Promise<boolean> {
    return await this.loginButton.isDisabled();
  }

  /**
   * Navigate to registration page
   */
  async goToSignUp() {
    await this.signUpButton.click();
    await this.page.waitForTimeout(500); // Wait for form to toggle
  }

  /**
   * Fill login form but don't submit
   */
  async fillForm(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Check if user is logged in (authenticated)
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for authenticated navbar (Dashboard or Games link)
      await this.page.waitForSelector('nav a[href="/dashboard"]', { timeout: 2000, state: 'attached' });
      return true;
    } catch {
      return false;
    }
  }
}
