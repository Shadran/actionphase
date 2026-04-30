import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * E2E Tests for Private Message Editing
 *
 * Fixture: E2E_MESSAGES (Game #354, worker-offset)
 * Five isolated conversations pre-seeded (8881–8885), one per test, so
 * mutations in one test cannot affect another.
 *
 * Test Coverage:
 * - Edit button visible for own messages, hidden for others'
 * - Inline editor opens with existing content pre-filled
 * - Cancel discards changes
 * - Save updates message content and shows (edited) label
 * - Edited content visible to other participants
 */

test.describe('Private Message Editing', () => {
  test('edit button visible for own messages and hidden for others', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Edit Test 1: Button Visibility');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();
    await expect(ownMessage.locator('button[title="Edit message"]')).toBeVisible();

    const otherMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 2' })
      .first();
    await otherMessage.hover();
    await expect(otherMessage.locator('button[title="Edit message"]')).not.toBeVisible();
  });

  test('inline editor opens with existing content pre-filled', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Edit Test 2: Editor Pre-fill');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    await ownMessage.hover();
    await ownMessage.locator('button[title="Edit message"]').click();

    const textarea = page.getByTestId('edit-message-textarea');
    await expect(textarea).toBeVisible();
    expect(await textarea.inputValue()).toContain('Message from Player 1');

    await expect(page.getByTestId('save-edit-button')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  });

  test('cancel discards changes without saving', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Edit Test 3: Cancel Discards');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    await ownMessage.hover();
    await ownMessage.locator('button[title="Edit message"]').click();

    const textarea = page.getByTestId('edit-message-textarea');
    await textarea.clear();
    await textarea.fill('This should not be saved');

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(textarea).not.toBeVisible();
    await expect(
      page.locator('[data-testid="message"]').filter({ hasText: 'Message from Player 1' }).first()
    ).toBeVisible();
    await expect(page.getByText('This should not be saved')).not.toBeVisible();
  });

  test('saves edited content and shows (edited) label', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Edit Test 4: Save Shows Edited');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    const editedContent = `Edited message ${Date.now()}`;
    await messaging.editMessage(ownMessage, editedContent);

    await expect(page.getByTestId('edit-message-textarea')).not.toBeVisible();
    await expect(page.getByText(editedContent).locator('visible=true').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('edited-label').first()).toContainText('(edited)');
  });

  test('edited message visible to other participants', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Edit Test 5: Visible To All');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();

    const editedContent = `Player 1 edited this ${Date.now()}`;
    await messaging.editMessage(ownMessage, editedContent);
    await expect(page.getByText(editedContent).locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // Re-login as Player 2 and verify they see the edit too
    await loginAs(page, 'PLAYER_2');
    const gameId2 = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging2 = new MessagingPage(page);
    await messaging2.goto(gameId2);
    await messaging2.openConversation('Edit Test 5: Visible To All');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(editedContent).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('edited-label').first()).toBeVisible();
  });
});
