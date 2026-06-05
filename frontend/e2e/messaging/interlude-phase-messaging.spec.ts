import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { MessagingPage } from '../pages/MessagingPage';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';

/**
 * Interlude Phase: Private Messaging
 *
 * Regression test for a bug where the frontend PM gate only allowed messaging
 * during 'common_room' phases, blocking PMs during the new 'interlude' phase type
 * even though the backend correctly permitted it.
 *
 * Verifies:
 * - GM can create and activate an Interlude phase
 * - Player can send a PM during an Interlude phase (no restriction banner)
 * - The restriction banner does NOT appear during an Interlude phase
 */
test.describe('Interlude Phase: Private Messaging', () => {
  test('Players can send private messages during an interlude phase', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates and activates an Interlude phase ===
      await loginAs(gmPage, 'GM');
      const gameId = await getFixtureGameId(gmPage, 'E2E_MESSAGES');

      const phasePage = new PhaseManagementPage(gmPage);
      await phasePage.goto(gameId);

      const interludeTitle = `Interlude ${Date.now()}`;
      await phasePage.createPhase({
        type: 'interlude',
        title: interludeTitle,
      });

      await phasePage.activatePhase(interludeTitle);

      // === Player navigates to Messages tab ===
      await loginAs(playerPage, 'PLAYER_1');
      const playerMessaging = new MessagingPage(playerPage);
      await playerMessaging.goto(gameId);

      // The restriction banner should NOT be shown
      await expect(
        playerPage.getByText(/new messages can only be sent during common room phases/i)
      ).not.toBeVisible();

      // === Player can create a conversation and send a message ===
      const convoTitle = `Interlude Planning ${Date.now()}`;
      await playerMessaging.createConversation(convoTitle, ['E2E Test Char 2']);

      const messageContent = `Secret plans during the interlude at ${Date.now()}`;
      await playerMessaging.sendMessage(messageContent);

      await playerMessaging.verifyMessageExists(messageContent);

    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
