import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { MessagingPage } from '../pages/MessagingPage';

/**
 * E2E Tests for Private Message Deletion
 *
 * Fixture: E2E_MESSAGES (Game #354, worker-offset)
 * Five isolated conversations pre-seeded (9991–9995), one per test, so
 * mutations in one test cannot affect another.
 *
 * Test Coverage:
 * - Delete button visibility (own vs other users' messages)
 * - Confirmation modal flow
 * - Successful deletion (soft-delete: placeholder remains)
 * - Authorization (cannot delete others' messages)
 * - Deleted message visibility to all participants
 */

test.describe('Private Message Deletion', () => {
  test('allows user to delete own message', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Test 1: Delete Own Message');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const initialMessageCount = await page.locator('[data-testid="message"]').count();

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();

    const deleteButton = ownMessage.locator('button[title="Delete message"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    await expect(page.locator('h3:has-text("Delete Message?")')).toBeVisible();
    await expect(page.locator('text=This will permanently delete your message')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete', exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    const deletedMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: '[Message deleted]' })
      .first();
    await expect(deletedMessage).toBeVisible();

    const finalMessageCount = await page.locator('[data-testid="message"]').count();
    expect(finalMessageCount).toBe(initialMessageCount);

    await expect(deletedMessage.locator('[data-testid="message-sender"]')).toContainText('E2E Test Char 1');
  });

  test('cannot delete other users messages', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Test 2: Cannot Delete Others');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const otherMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 2' })
      .first();
    await otherMessage.hover();

    await expect(otherMessage.locator('button[title="Delete message"]')).not.toBeVisible();
  });

  test('deleted message visible to all conversation participants', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Test 3: Visible To All');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();
    await ownMessage.locator('button[title="Delete message"]').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();
    await expect(
      page.locator('[data-testid="message"]').filter({ hasText: '[Message deleted]' }).first()
    ).toBeVisible();

    // Re-login as Player 2 and verify they see the deletion too
    await loginAs(page, 'PLAYER_2');
    const gameId2 = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging2 = new MessagingPage(page);
    await messaging2.goto(gameId2);
    await messaging2.openConversation('Test 3: Visible To All');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('[data-testid="message"]').filter({ hasText: '[Message deleted]' }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('cancel button prevents deletion', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Test 4: Cancel Deletion');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    const originalText = await ownMessage.textContent();

    await ownMessage.hover();
    await ownMessage.locator('button[title="Delete message"]').click();

    await expect(page.locator('h3:has-text("Delete Message?")')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    const messageAfterCancel = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    expect(await messageAfterCancel.textContent()).toBe(originalText);
    await expect(messageAfterCancel).toContainText('Message from Player 1');
  });

  test('deleted message does not show delete button again', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'E2E_MESSAGES');
    const messaging = new MessagingPage(page);
    await messaging.goto(gameId);
    await messaging.openConversation('Test 5: No Delete After');

    await expect(page.locator('[data-testid="message"]').first()).toBeVisible({ timeout: 10000 });

    const ownMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: 'Message from Player 1' })
      .first();
    await ownMessage.hover();
    await ownMessage.locator('button[title="Delete message"]').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    await expect(page.locator('h3:has-text("Delete Message?")')).not.toBeVisible();

    const deletedMessage = page.locator('[data-testid="message"]')
      .filter({ hasText: '[Message deleted]' })
      .first();
    await expect(deletedMessage).toBeVisible();

    await deletedMessage.hover();
    await expect(deletedMessage.locator('button[title="Delete message"]')).not.toBeVisible();
  });
});
