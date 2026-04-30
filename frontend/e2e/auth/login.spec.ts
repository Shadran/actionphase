import { test, expect } from '@playwright/test';
import { loginAs, logout, isAuthenticated, login } from '../fixtures/auth-helpers';
import { assertUrl } from '../utils/assertions';

/**
 * Journey 1: User Authentication Flow
 *
 * Tests the complete login/logout cycle for users
 */
test.describe('User Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test('should successfully login and logout', async ({ page }) => {
    // Login as Game Master
    await loginAs(page, 'GM');

    // Verify we're on the dashboard
    await assertUrl(page, '/dashboard');

    // Verify user is authenticated via helper
    const authenticated = await isAuthenticated(page);
    expect(authenticated).toBe(true);

    // Logout
    await logout(page);

    // Verify we're back on login page
    await assertUrl(page, '/login');
    const stillAuthenticated = await isAuthenticated(page);
    expect(stillAuthenticated).toBe(false);
  });

  test('should allow re-login after logout', async ({ page }) => {
    // First login
    await loginAs(page, 'GM');
    await assertUrl(page, '/dashboard');

    // Logout
    await logout(page);
    await assertUrl(page, '/login');

    // Second login (verify we can login again)
    await loginAs(page, 'GM');
    await assertUrl(page, '/dashboard');
    await expect(page.locator('nav a[href="/dashboard"]').first()).toBeVisible();
  });

  test('should handle invalid credentials', async ({ page }) => {
    // Attempt login with invalid credentials
    await login(page, 'invalid_user', 'wrong_password', false);

    // Should remain on login page
    await assertUrl(page, '/login');

    // Should show error message
    await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible({ timeout: 5000 });

    // Navbar should not be visible (not authenticated)
    await expect(page.locator('nav a[href="/dashboard"]').first()).not.toBeVisible();
  });

  test('should redirect to login when accessing protected route while unauthenticated', async ({ page }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login
    await assertUrl(page, '/login');
  });

  test('should redirect to dashboard when accessing login while authenticated', async ({ page }) => {
    // Login first
    await loginAs(page, 'PLAYER_2');
    await assertUrl(page, '/dashboard');

    // Try to navigate to login page while authenticated
    await page.goto('/login');

    // Should redirect back to dashboard
    await assertUrl(page, '/dashboard');
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    // Login
    await loginAs(page, 'PLAYER_3');
    await assertUrl(page, '/dashboard');

    // Reload the page
    await page.reload();

    // Should still be authenticated
    await assertUrl(page, '/dashboard');
    await expect(page.locator('nav a[href="/dashboard"]').first()).toBeVisible();
  });

});
