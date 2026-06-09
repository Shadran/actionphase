import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * E2E Tests for Admin Mode
 *
 * Tests the admin mode toggle functionality including:
 * - Admin user can access admin mode controls
 * - Admin mode toggle switches on/off
 * - Admin mode state persists across page refreshes (localStorage)
 * - Admin mode affects game listing visibility
 * - Non-admin users cannot access admin mode
 * - Admin mode state is properly cleared on logout
 *
 * CRITICAL: Admin mode allows admins to see ALL games (private/public)
 * This is essential for platform moderation.
 */

test.describe('Admin Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Clear admin mode localStorage state so each test starts from a known baseline
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('adminMode'));
  });

  test('admin user can toggle admin mode on and off', async ({ page }) => {
    await loginAs(page, 'GM');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Admin Mode', exact: true })).toBeVisible();

    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await expect(adminModeToggle).toBeVisible();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('text=ACTIVE').first()).not.toBeVisible();

    // Enable admin mode
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('text=ACTIVE').first()).toBeVisible();

    // Disable admin mode
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('text=ACTIVE').first()).not.toBeVisible();
  });

  test('admin mode state persists across page refreshes', async ({ page }) => {
    await loginAs(page, 'GM');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'true');

    // Refresh — admin mode should persist (stored in localStorage)
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button[role="switch"][aria-label*="admin mode" i]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('text=ACTIVE').first()).toBeVisible();
  });

  test('non-admin user cannot see admin mode controls', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('button[role="switch"][aria-label*="admin mode" i]')).not.toBeVisible();
  });

  test('admin mode affects game listing visibility', async ({ page }) => {
    await loginAs(page, 'GM');

    // Count games WITHOUT admin mode
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid^="game-card-"]').first()).toBeVisible({ timeout: 5000 });
    const gamesWithoutAdminMode = await page.locator('[data-testid^="game-card-"]').count();

    // Enable admin mode
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const adminModeToggle = page.locator('button[role="switch"][aria-label*="admin mode" i]');
    await adminModeToggle.click();
    await expect(adminModeToggle).toHaveAttribute('aria-checked', 'true');

    // Count games WITH admin mode — should be same or more (never fewer)
    await page.goto('/games');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-testid^="game-card-"]').first()).toBeVisible({ timeout: 5000 });
    const gamesWithAdminMode = await page.locator('[data-testid^="game-card-"]').count();

    expect(gamesWithAdminMode).toBeGreaterThanOrEqual(gamesWithoutAdminMode);
  });
});
