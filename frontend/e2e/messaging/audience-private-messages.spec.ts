import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { AudiencePage } from '../pages/AudiencePage';

/**
 * E2E Tests: Audience Private Messages View
 *
 * Tests the read-only audience view of all private message conversations.
 * Uses E2E_AUDIENCE_PM fixture (game #360) which pre-seeds:
 *   - "Audience Test Conversation": messages from both Char 1 and Char 2
 *   - "Preview Test Conversation": one message ("Last message preview text")
 *
 * Tests are independent — no runtime conversation creation needed.
 */

test.describe('@mobile Audience Private Messages View', () => {

  test('Audience can view all private messages with enhanced UI', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'E2E_AUDIENCE_PM');

    const audience = new AudiencePage(page);
    await audience.goToAudience(gameId);

    // Verify view is displayed with read-only badge
    await audience.verifyAllPrivateMessagesView();

    // Fixture conversation is visible in the list
    await audience.verifyConversationExists('Audience Test Conversation');

    // Participant avatars are displayed on conversation cards
    const hasAvatars = await audience.verifyParticipantAvatars();
    expect(hasAvatars).toBe(true);

    // Open conversation and verify messages are displayed
    await audience.openConversation('Audience Test Conversation');
    await audience.verifyConversationHeader('Audience Test Conversation');
    await audience.verifyMessageExists('First message from Player 1');
    await audience.verifyMessageExists('Second message from Player 1');

    // Audience cannot post — no message input
    const isReadOnly = await audience.verifyReadOnly();
    expect(isReadOnly).toBe(true);

    // Navigate back to list
    await audience.goBackToConversationList();
    await audience.verifyAllPrivateMessagesView();
  });

  test('Audience can filter conversations by participants', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'E2E_AUDIENCE_PM');

    const audience = new AudiencePage(page);
    await audience.goToAudience(gameId);

    // Wait for conversations to render, then record baseline count
    await expect(page.locator('[data-testid="conversation-item"]').first()).toBeVisible({ timeout: 10000 });
    const totalCount = await page.locator('[data-testid="conversation-item"]').count();
    expect(totalCount).toBeGreaterThan(0);

    // Filter by Char 1 — both fixture conversations include Char 1 as a participant
    await audience.verifyParticipantFilter();
    await audience.filterByParticipant('Audience Test Char 1');
    await page.waitForLoadState('networkidle');

    // After filtering, at least the Audience Test Conversation should be visible
    await audience.verifyConversationExists('Audience Test Conversation');

    // Clear filter and verify count returns to baseline
    await audience.clearFilters();
    await page.waitForLoadState('networkidle');
    const countAfterClear = await page.locator('[data-testid="conversation-item"]').count();
    expect(countAfterClear).toBeGreaterThanOrEqual(totalCount);
  });

  test('Audience cannot interact with conversations (read-only)', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'E2E_AUDIENCE_PM');

    const audience = new AudiencePage(page);
    await audience.goToAudience(gameId);

    // No message input on the conversation list view
    const isReadOnly = await audience.verifyReadOnly();
    expect(isReadOnly).toBe(true);

    // No "New Conversation" button in audience view
    await expect(page.getByRole('button', { name: /New Conversation/i })).not.toBeVisible();
  });

  test('Audience sees last message preview on conversation cards', async ({ page }) => {
    await loginAs(page, 'AUDIENCE');
    const gameId = await getFixtureGameId(page, 'E2E_AUDIENCE_PM');

    const audience = new AudiencePage(page);
    await audience.goToAudience(gameId);

    // "Preview Test Conversation" has a single known last message
    await audience.verifyConversationExists('Preview Test Conversation');
    await audience.verifyLastMessagePreview('Preview Test Conversation', 'Last message preview text');
  });
});
