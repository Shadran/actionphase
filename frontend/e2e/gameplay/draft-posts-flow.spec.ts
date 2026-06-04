import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { PhaseManagementPage } from '../pages/PhaseManagementPage';
import { CommonRoomPage } from '../pages/CommonRoomPage';

/**
 * E2E Tests for Draft Posts Feature
 *
 * Tests the full draft post lifecycle:
 *   GM adds draft → GM edits draft → GM activates phase → post visible to GM and player
 *
 * Uses dedicated E2E fixture (E2E_DRAFT_POSTS) which includes:
 *   - Phase 1: active common room ("The Lobby")
 *   - Phase 2: pending common room ("The Gathering Storm") — subject of draft post tests
 *   - GM NPC character "The Narrator" — populates the character selector
 *   - Player1 character "Scout"
 *
 * IMPORTANT: Serial tests 1–3 build on each other (draft state flows between them).
 * Test 4 is standalone and tests the inline draft path in CreatePhaseModal.
 */

const PENDING_PHASE = 'The Gathering Storm';
const DRAFT_V1 = `Draft post ${Date.now()} — initial content`;
const DRAFT_V2 = `Draft post ${Date.now()} — edited content`;

test.describe.serial('Draft Posts Flow', () => {
  test('GM can add a draft post to a pending phase', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_DRAFT_POSTS');
    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Verify the pending phase card is visible
    await expect(phasePage.getPhaseCard(PENDING_PHASE).locator('visible=true').first()).toBeVisible({ timeout: 10000 });

    // Add draft post via DraftPostSection
    await phasePage.addDraftPost(PENDING_PHASE, {
      characterName: 'The Narrator',
      content: DRAFT_V1,
    });

    // Draft preview should now be visible on the phase card
    await expect(phasePage.getDraftPostPreview(PENDING_PHASE)).toBeVisible({ timeout: 5000 });

    // Edit and delete buttons should appear (draft exists)
    const phaseCard = phasePage.getPhaseCard(PENDING_PHASE);
    await expect(phaseCard.getByTestId('edit-draft-btn')).toBeVisible();
    await expect(phaseCard.getByTestId('delete-draft-btn')).toBeVisible();
  });

  test('GM can edit an existing draft post', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_DRAFT_POSTS');
    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Verify previous draft content is visible on the card
    await expect(phasePage.getDraftPostPreview(PENDING_PHASE)).toBeVisible({ timeout: 10000 });

    // Edit the draft
    await phasePage.editDraftPost(PENDING_PHASE, DRAFT_V2);

    // Preview should now reflect the updated content
    await expect(phasePage.getDraftPostPreview(PENDING_PHASE)).toContainText(DRAFT_V2.slice(0, 40));
  });

  test('activating phase publishes the draft — post visible to GM and player', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'E2E_DRAFT_POSTS');
    const phasePage = new PhaseManagementPage(page);
    await phasePage.goto(gameId);

    // Activate the pending phase
    await phasePage.activatePhase(PENDING_PHASE);

    // Phase card should now show "Currently Active"
    await expect(
      phasePage.getPhaseCard(PENDING_PHASE).getByText('Currently Active').locator('visible=true').first()
    ).toBeVisible({ timeout: 10000 });

    // GM navigates to Common Room — draft post should now be a published post
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);
    await expect(commonRoom.getPostCard(DRAFT_V2)).toBeVisible({ timeout: 10000 });

    // Player also sees the published post
    await loginAs(page, 'PLAYER_1');
    await commonRoom.goto(gameId);
    await expect(commonRoom.getPostCard(DRAFT_V2)).toBeVisible({ timeout: 10000 });
  });
});

test('GM can create a phase with an inline draft post via CreatePhaseModal', async ({ page }) => {
  await loginAs(page, 'GM');

  const gameId = await getFixtureGameId(page, 'E2E_DRAFT_POSTS');
  const phasePage = new PhaseManagementPage(page);
  await phasePage.goto(gameId);

  const phaseTitle = `Inline Draft Phase ${Date.now()}`;
  const inlineDraftContent = `Inline draft content ${Date.now()}`;

  // Open create phase modal
  await phasePage.openCreatePhaseModal();

  // common_room is the default — just fill in the title
  await phasePage.phaseTitleInput.fill(phaseTitle);

  // Expand the draft post section
  await page.getByTestId('draft-post-toggle').click();
  await expect(page.getByTestId('draft-post-content')).toBeVisible({ timeout: 3000 });

  // Select character and fill content
  await page.getByTestId('draft-character-select').selectOption({ label: 'The Narrator' });
  await page.getByTestId('draft-post-content').fill(inlineDraftContent);

  // Submit
  await page.locator('button:has-text("Create Phase")').click();
  await page.waitForLoadState('networkidle');

  // New phase card should appear with a draft preview
  await expect(phasePage.getPhaseCard(phaseTitle).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
  await expect(phasePage.getDraftPostPreview(phaseTitle)).toBeVisible();
});
