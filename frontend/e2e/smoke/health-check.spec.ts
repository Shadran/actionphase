import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../fixtures/test-tags';

/**
 * Smoke Tests: Application Health Checks
 *
 * Quick 5-minute tests to verify basic application functionality
 * Run before every deployment to catch critical failures
 *
 * Target execution time: < 5 minutes
 */
test.describe('Smoke: Application Health', () => {

  test(tagTest([tags.SMOKE], 'Frontend loads successfully'), async ({ page }) => {
    // Navigate to home page
    await page.goto('/');

    // Verify the page loaded
    await expect(page.getByRole('heading', { name: /ActionPhase/i, level: 1 })).toBeVisible();

    // Verify login link is present
    await expect(page.getByRole('link', { name: /Sign In|Log In|Login/i }).locator('visible=true').first()).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'API health endpoint responds'), async ({ request }) => {
    // Check if backend API is responding
    const response = await request.get('http://localhost:3000/health');

    expect(response.status()).toBe(200);
  });

  test(tagTest([tags.SMOKE], 'Login page is accessible'), async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Verify login form is present
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-username"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'Dashboard requires authentication'), async ({ page }) => {
    // Try to access dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test(tagTest([tags.SMOKE], 'Games list page requires auth'), async ({ page }) => {
    // Navigate to games list without being logged in
    await page.goto('/games');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test(tagTest([tags.SMOKE, tags.AUTH], 'Can toggle to registration form'), async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Click the toggle to show registration
    await page.getByRole('button', { name: /Don't have an account\? Sign up/i }).click();

    // Verify registration form appears
    await expect(page.getByText(/Already have an account\? Sign in/i)).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'Static assets load correctly'), async ({ page }) => {
    // Navigate to home
    await page.goto('/');

    // Check for 404 errors in console
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for page to fully load before checking for errors
    await page.waitForLoadState('networkidle');

    // Should not have critical asset loading errors
    // Exclude expected 401 errors from auth checks (AuthContext checking if user is logged in)
    const criticalErrors = errors.filter(e =>
      (e.includes('404') || e.includes('Failed to load')) &&
      !e.includes('401') && // Exclude expected auth check failures
      !e.includes('Unauthorized') &&
      !e.includes('AuthContext')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test(tagTest([tags.SMOKE], 'Unknown routes redirect appropriately'), async ({ page }) => {
    // Navigate to non-existent route
    await page.goto('/this-page-does-not-exist-12345');

    // Should redirect to login (if not authenticated)
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe.configure({ mode: 'serial' });

test.describe('Smoke: Notification System', () => {
  test(tagTest([tags.SMOKE], 'Notification bell is visible after login'), async ({ page }) => {
    const { loginAs } = await import('../fixtures/auth-helpers');

    // Use PLAYER_5 to avoid conflicts with password change tests that use PLAYER_1-4
    await loginAs(page, 'PLAYER_5');
    // loginAs already redirects to /dashboard, no need for page.goto
    await page.waitForLoadState('networkidle');

    // Notification bell should be visible
    const notificationBell = page.locator('[data-testid="notification-bell"]');
    await expect(notificationBell).toBeVisible();
  });

  test(tagTest([tags.SMOKE], 'Notification API endpoint responds'), async ({ page }) => {
    const { loginAs } = await import('../fixtures/auth-helpers');

    // Use PLAYER_5 to avoid conflicts with password change tests that use PLAYER_1-4
    await loginAs(page, 'PLAYER_5');

    // Wait for unread count API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/v1/notifications/unread-count')
    );

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify the API response
    const response = await responsePromise;
    expect(response.status()).toBe(200);
  });
});
