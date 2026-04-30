import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { MessagingPage } from '../pages/MessagingPage';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';

/**
 * E2E Tests for Notification System
 *
 * Fixtures:
 *   NOTIFICATION_FLOW  (Game #704) — reply & mention tests
 *     Pre-seeded: GM post "Notification Test Post" + Player 1 comment
 *     so reply/mention tests need only one setup context each.
 *   NOTIFICATION_PHASE (Game #705) — phase activation test
 *     Player 5 as sole participant; GM creates a new action phase at runtime.
 *   E2E_MESSAGES       (Game #354) — polling test (creates own conversation)
 *
 * Each test uses its own fixture game so there is no shared mutable state
 * and no need for serial execution or afterEach DB cleanup.
 */

const FIXTURE_POST = 'Notification Test Post';
const PLAYER_1_COMMENT = 'Player 1 comment on notification test post';

test.describe('Notification System', () => {
  test('notifies user when someone replies to their comment', async ({ browser }) => {
    // Player 2 replies to the pre-seeded Player 1 comment.
    // Player 1 watches from a separate context and waits for the badge.
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      await loginAs(player1Page, 'PLAYER_1');
      await loginAs(player2Page, 'PLAYER_2');

      const gameId = await getFixtureGameId(player1Page, 'NOTIFICATION_FLOW');

      // Player 1 is on the game page watching for the notification
      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);
      await player1CommonRoom.expandComments(FIXTURE_POST);

      // Player 2 replies to Player 1's pre-seeded comment
      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);
      const replyText = `Reply from Player 2 ${Date.now()}`;
      await player2CommonRoom.replyToComment(PLAYER_1_COMMENT, replyText);

      // Player 1 should see the notification badge appear
      const notificationBadge = player1Page.locator('[data-testid="notification-badge"]');
      await expect(notificationBadge).toBeVisible({ timeout: 20000 });

      // Open the dropdown and verify a reply notification is present
      await player1Page.click('[data-testid="notification-bell"]');
      const dropdown = player1Page.locator('[data-testid="notification-dropdown"]');
      await expect(dropdown).toBeVisible();

      // Poll by closing/reopening the bell until the notification arrives
      const replyNotification = player1Page.locator('.notification-item')
        .filter({ hasText: 'replied' })
        .locator('visible=true')
        .first();
      await expect(async () => {
        if (!await replyNotification.isVisible()) {
          await player1Page.click('[data-testid="notification-bell"]');
          await player1Page.click('[data-testid="notification-bell"]');
          await expect(dropdown).toBeVisible();
        }
        await expect(replyNotification).toBeVisible();
      }).toPass({ timeout: 20000, intervals: [1000] });

      // Clicking the notification navigates to the common room
      await replyNotification.click();
      await expect(player1Page).toHaveURL(new RegExp(`/games/${gameId}\\?tab=common-room`));
    } finally {
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('notifies user when their character is mentioned in a comment', async ({ browser }) => {
    // Player 3 mentions Player 4's character in a comment.
    // Player 4 watches from a separate context and waits for the badge.
    const player3Context = await browser.newContext();
    const player4Context = await browser.newContext();
    const player3Page = await player3Context.newPage();
    const player4Page = await player4Context.newPage();

    try {
      await loginAs(player3Page, 'PLAYER_3');
      await loginAs(player4Page, 'PLAYER_4');

      const gameId = await getFixtureGameId(player3Page, 'NOTIFICATION_FLOW');

      // Player 4 is on the game page watching for the notification
      await player4Page.goto(`/games/${gameId}`);
      await player4Page.waitForLoadState('networkidle');

      // Player 3 adds a comment mentioning Player 4's character
      const player3CommonRoom = new CommonRoomPage(player3Page);
      await player3CommonRoom.goto(gameId);
      const mentionComment = `Hey @Test Notify Char 4, what do you think? ${Date.now()}`;
      await player3CommonRoom.addComment(FIXTURE_POST, mentionComment);

      // Player 4 should see the notification badge appear
      const notificationBadge = player4Page.locator('[data-testid="notification-badge"]');
      await expect(notificationBadge).toBeVisible({ timeout: 20000 });

      // Open dropdown and verify a mention notification is present
      await player4Page.click('[data-testid="notification-bell"]');
      const dropdown = player4Page.locator('[data-testid="notification-dropdown"]');
      await expect(dropdown).toBeVisible();

      const mentionNotification = player4Page.locator('.notification-item')
        .filter({ hasText: 'mentioned' })
        .locator('visible=true')
        .first();
      await expect(mentionNotification).toBeVisible({ timeout: 20000 });

      // Clicking navigates to the common room
      await mentionNotification.click();
      await expect(player4Page).toHaveURL(new RegExp(`/games/${gameId}\\?tab=common-room`));
    } finally {
      await player3Context.close();
      await player4Context.close();
    }
  });

  test('notifies all participants when GM activates a new phase', async ({ browser }) => {
    test.setTimeout(60000);

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      await loginAs(gmPage, 'GM');
      await loginAs(playerPage, 'PLAYER_5');

      const gameId = await getFixtureGameId(gmPage, 'NOTIFICATION_PHASE');

      // Player 5 is on the game page before the phase is created
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');

      // GM creates and activates a new action phase
      const phaseManagement = new PhaseManagementPage(gmPage);
      await phaseManagement.goto(gameId);

      const phaseTitle = `E2E Phase ${Date.now()}`;
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 2);

      await phaseManagement.createPhase({
        type: 'action',
        title: phaseTitle,
        description: 'Phase for notification test',
        deadline,
      });
      await phaseManagement.activatePhase(phaseTitle);

      // Player reloads to pick up the notification (avoids waiting for polling interval)
      await playerPage.reload();
      await playerPage.waitForLoadState('networkidle');

      const notificationBadge = playerPage.locator('[data-testid="notification-badge"]');
      await expect(notificationBadge).toBeVisible({ timeout: 10000 });

      // Open dropdown and find the phase notification
      await playerPage.click('[data-testid="notification-bell"]');
      const dropdown = playerPage.locator('[data-testid="notification-dropdown"]');
      await expect(dropdown).toBeVisible();

      const phaseNotification = playerPage.locator('.notification-item')
        .filter({ hasText: phaseTitle })
        .locator('visible=true')
        .first();
      await expect(phaseNotification).toBeVisible({ timeout: 10000 });

      // Clicking navigates to the game
      await phaseNotification.click();
      await expect(playerPage).toHaveURL(new RegExp(`/games/${gameId}`));
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('notification count updates automatically via polling when a private message arrives', async ({ browser }) => {
    test.setTimeout(60000);

    // Player 1 sends a private message to Player 2.
    // Player 2 is on the dashboard (not the game page) and waits for the
    // badge to increment — validating the polling mechanism fires.
    const senderContext = await browser.newContext();
    const recipientContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    const recipientPage = await recipientContext.newPage();

    try {
      await loginAs(senderPage, 'PLAYER_1');
      await loginAs(recipientPage, 'PLAYER_2');

      const gameId = await getFixtureGameId(senderPage, 'E2E_MESSAGES');

      // Recipient is on dashboard — not on the game page — so only polling delivers the update
      await recipientPage.goto('/dashboard');
      await recipientPage.waitForLoadState('networkidle');

      // Record initial unread count before the message is sent
      const notificationBadge = recipientPage.locator('[data-testid="notification-badge"]');
      let initialCount = 0;
      if (await notificationBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
        initialCount = parseInt(await notificationBadge.textContent() ?? '0', 10);
      }

      // Sender creates a new conversation and sends a message
      const messagingPage = new MessagingPage(senderPage);
      await messagingPage.goto(gameId);

      const conversationTitle = `Polling test ${Date.now()}`;
      await messagingPage.createConversation(conversationTitle, ['E2E Test Char 2']);
      await messagingPage.sendMessage(`Polling test message ${Date.now()}`);

      // Badge should increment within the polling interval (~15s); allow 30s headroom
      const expectedCount = String(initialCount + 1);
      await expect(notificationBadge).toBeVisible({ timeout: 30000 });
      await expect(notificationBadge).toHaveText(expectedCount, { timeout: 30000 });
    } finally {
      await senderContext.close();
      await recipientContext.close();
    }
  });

  test('mark all as read clears the notification badge', async ({ page }) => {
    // Uses the pre-seeded unread notification in game 704 to ensure there is
    // always at least one unread notification — no conditional if-guard needed.
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'NOTIFICATION_FLOW');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');

    // Pre-seeded notification guarantees badge is visible
    const notificationBadge = page.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 5000 });

    await page.click('[data-testid="notification-bell"]');
    await page.getByRole('button', { name: 'Mark all read' }).click();
    await page.waitForLoadState('networkidle');

    // Close dropdown and verify badge is gone
    await page.click('[data-testid="notification-bell"]');
    await expect(notificationBadge).not.toBeVisible();
  });
});
