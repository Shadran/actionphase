import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../fixtures/test-tags';

/**
 * Journey: User Registration Flow
 *
 * Tests the complete registration workflow including:
 * - Successful registration
 * - Error handling and validation
 * - Error state management (preventing cached error display)
 * - Form toggling between login and registration
 *
 * REGRESSION TESTS:
 * - Ensures registration errors don't persist when navigating away and back
 * - Verifies captcha is hidden in development environment
 */
test.describe('User Registration', () => {
  test.beforeEach(async ({ page }) => {
    // Start from login page
    await page.goto('/login');
  });

  test(tagTest([tags.AUTH], 'should toggle to registration form'), async ({ page }) => {
    // Verify we're on login initially
    await expect(page.getByTestId('login-form')).toBeVisible();

    // Click the toggle to show registration
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // Verify registration form appears
    await expect(page.getByRole('heading', { name: /^register$/i })).toBeVisible();
    await expect(page.getByTestId('register-username')).toBeVisible();
    await expect(page.getByTestId('register-email')).toBeVisible();
    await expect(page.getByTestId('register-password')).toBeVisible();

    // Verify toggle button changed
    await expect(page.getByRole('button', { name: /Already have an account\? Sign in/i })).toBeVisible();
  });

  test(tagTest([tags.AUTH], 'should toggle back to login form'), async ({ page }) => {
    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();
    await expect(page.getByRole('heading', { name: /^register$/i })).toBeVisible();

    // Toggle back to login
    await page.getByRole('button', { name: /Already have an account\? Sign in/i }).click();

    // Verify login form appears
    await expect(page.getByRole('heading', { name: /^login$/i })).toBeVisible();
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  test(tagTest([tags.AUTH, tags.REGRESSION], 'registration errors do not persist when navigating away'), async ({ page }) => {
    // REGRESSION TEST for cached error display bug
    // Bug: Error from previous failed registration appeared immediately when opening form
    // Fix: Only show errors after form submission (submittedOnce state flag)

    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // Try to register with invalid data (too short password, invalid username)
    await page.getByTestId('register-username').fill('a');
    await page.getByTestId('register-email').fill('test@example.com');
    await page.getByTestId('register-password').fill('short');
    await page.getByTestId('register-confirm-password').fill('short');
    await page.getByTestId('register-submit').click();

    // Error should appear after submission (mapped to user-friendly message)
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/invalid request/i')).toBeVisible();

    // Navigate back to login form
    await page.getByRole('button', { name: /Already have an account\? Sign in/i }).click();
    await expect(page.getByRole('heading', { name: /^login$/i })).toBeVisible();

    // Navigate back to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // CRITICAL: Error should NOT be visible on fresh form load
    await expect(page.getByTestId('error-message')).not.toBeVisible();
    await expect(page.locator('text=/invalid request/i')).not.toBeVisible();

    // Form should be clean and ready for input
    await expect(page.getByTestId('register-username')).toHaveValue('');
    await expect(page.getByTestId('register-email')).toHaveValue('');
    await expect(page.getByTestId('register-password')).toHaveValue('');
    await expect(page.getByTestId('register-confirm-password')).toHaveValue('');
  });

  test(tagTest([tags.AUTH], 'should display validation errors after failed registration'), async ({ page }) => {
    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // No error should be visible initially
    await expect(page.getByTestId('error-message')).not.toBeVisible();

    // Try to register with data that will fail backend validation
    await page.getByTestId('register-username').fill('x'); // Too short
    await page.getByTestId('register-email').fill('invalid@test.com');
    await page.getByTestId('register-password').fill('short'); // Too short
    await page.getByTestId('register-confirm-password').fill('short');
    await page.getByTestId('register-submit').click();

    // Error should appear after submission attempt
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 5000 });

    // Submit button should be re-enabled for retry
    await expect(page.getByTestId('register-submit')).not.toBeDisabled();
  });

  test(tagTest([tags.AUTH], 'should successfully register a new user'), async ({ page }) => {
    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // Prefix matches reset script pattern (test_%@example.com) for cleanup
    const timestamp = Date.now();
    const username = `TestE2EReg_${timestamp}`;
    const email = `test_e2ereg_${timestamp}@example.com`;
    const password = 'securepassword123';

    // Fill in valid registration data
    await page.getByTestId('register-username').fill(username);
    await page.getByTestId('register-email').fill(email);
    await page.getByTestId('register-password').fill(password);
    await page.getByTestId('register-confirm-password').fill(password);

    // Submit the form
    await page.getByTestId('register-submit').click();

    // Should redirect to dashboard after successful registration
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

    // Should be authenticated (navbar with Dashboard link visible)
    await expect(page.locator('nav a[href="/dashboard"]').locator('visible=true').first()).toBeVisible();
  });

  test(tagTest([tags.AUTH, tags.SMOKE], 'captcha widget is hidden in development'), async ({ page }) => {
    // REGRESSION TEST for captcha appearing in dev environment
    // Bug: Non-functional hCaptcha widget displayed in development
    // Fix: Conditional rendering based on VITE_HCAPTCHA_ENABLED

    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // hCaptcha widget should NOT be visible in development environment
    await expect(page.locator('[data-testid="hcaptcha-mock"]')).not.toBeVisible();
    await expect(page.locator('.h-captcha')).not.toBeVisible();
  });

  test(tagTest([tags.AUTH], 'should handle duplicate username error'), async ({ page }) => {
    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // Try to register with existing username from fixtures
    const password = 'password123';
    await page.getByTestId('register-username').fill('TestPlayer1');
    await page.getByTestId('register-email').fill('newemail@example.com');
    await page.getByTestId('register-password').fill(password);
    await page.getByTestId('register-confirm-password').fill(password);
    await page.getByTestId('register-submit').click();

    // Should show error about username being taken
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 5000 });

    // Should remain on registration form (not redirect)
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /^register$/i })).toBeVisible();
  });

  test(tagTest([tags.AUTH], 'should handle duplicate email error'), async ({ page }) => {
    // Navigate to registration form
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // Generate unique username but use existing email
    const timestamp = Date.now();
    const password = 'password123';
    await page.getByTestId('register-username').fill(`unique_${timestamp}`);
    await page.getByTestId('register-email').fill('test_player1@example.com'); // Existing email
    await page.getByTestId('register-password').fill(password);
    await page.getByTestId('register-confirm-password').fill(password);
    await page.getByTestId('register-submit').click();

    // Should show error
    await expect(page.getByTestId('error-message')).toBeVisible({ timeout: 5000 });

    // Should remain on registration form
    await expect(page).toHaveURL(/\/login/);
  });
});
