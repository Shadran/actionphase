import { test, expect } from '@playwright/test';
import { login } from '../fixtures/auth-helpers';
import { setCommentReadMode } from '../fixtures/game-helpers';
import { SettingsPage } from '../pages/SettingsPage';

// Use TestPlayer3 to avoid session contention with manual-read-tracking.spec.ts
// which uses TestPlayer1 and TestPlayer2.
const SETTINGS_USER = { username: 'TestPlayer3', password: 'testpassword123' };

/**
 * Comment Read Mode Settings E2E Tests
 *
 * Tests the Reading preference in Settings that controls whether the user
 * uses auto (NEW badge) or manual (mark as read) comment tracking.
 *
 * Edge cases covered by unit/component tests:
 * - Default mode is 'auto' ✅ (backend + frontend)
 * - Invalid mode values rejected ✅ (backend)
 * - Preference persists across sessions ✅ (component)
 *
 * These E2E tests validate the Settings UI works end-to-end.
 */
test.describe('Comment Read Mode Setting', () => {
  test.afterEach(async ({ page }) => {
    await setCommentReadMode(page, 'auto');
  });

  test('auto mode is selected by default', async ({ page }) => {
    await login(page, SETTINGS_USER.username, SETTINGS_USER.password);
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickReadingSection();

    await expect(settingsPage.getCommentReadModeRadio('auto')).toBeChecked();
  });

  test('preference persists after page reload', async ({ page }) => {
    await login(page, SETTINGS_USER.username, SETTINGS_USER.password);
    const settingsPage = new SettingsPage(page);
    await settingsPage.goto();
    await settingsPage.clickReadingSection();

    await settingsPage.selectCommentReadMode('manual');

    await page.reload();
    await page.waitForSelector('h1:has-text("Settings")', { state: 'visible' });
    await settingsPage.clickReadingSection();

    await expect(settingsPage.getCommentReadModeRadio('manual')).toBeChecked();
  });
});
