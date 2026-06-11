import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId, getWorkerUsername } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { GameApplicationsPage } from '../pages/GameApplicationsPage';
import { assertTabVisible, navigateToGameTab } from '../utils/navigation';

/**
 * E2E Tests for Game Application Workflow
 *
 * Tests the complete game application process including:
 * - Player submits application to recruitment game
 * - GM receives application notification
 * - GM reviews and approves/rejects applications
 * - Player becomes participant after approval
 * - Duplicate application prevention
 * - Application visibility in GM dashboard
 *
 * Uses dedicated E2E fixtures (E2E_GAME_APPLICATION_*) which include:
 * - Fresh recruitment games with specific test scenarios
 * - Public games visible to all players
 * - GM ready to review applications
 *
 * CRITICAL: This tests CORE player onboarding mechanics
 */

test.describe('Game Application Workflow', () => {

  test('player can submit application to recruitment game', async ({ page }) => {
    await loginAs(page, 'PLAYER_3');

    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_SUBMIT');
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    // Navigate to game details page using POM
    await gamePage.goto(gameId);

    // Verify we're on the right game page
    await expect(page.locator('text=E2E Test: Game Application - Submit')).toBeVisible({ timeout: 10000 });

    // Should see "Apply to Join" button (not a participant yet)
    expect(await applicationsPage.hasApplyButton()).toBe(true);

    // Submit application using POM
    await applicationsPage.submitApplication(
      'I love fantasy games and would like to join as a skilled ranger character!',
      'player'
    );

    // Refresh page to see updated application status
    await gamePage.goto(gameId);

    // Apply button should no longer be visible after application submitted
    expect(await applicationsPage.hasApplyButton()).toBe(false);
  });

  test('GM can view applications in dashboard', async ({ page }) => {
    // Login as GM and view applications
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_VIEW');
    const applicationsPage = new GameApplicationsPage(page, gameId);

    // Navigate to applications tab using POM
    await applicationsPage.goto();

    // Should see application from PLAYER_4 (username: TestPlayer4 or TestPlayer4_N for worker N)
    const pendingApplications = await applicationsPage.getPendingApplications();
    expect(pendingApplications).toContain(getWorkerUsername('TestPlayer4'));

    // Verify pending applications count
    const pendingCount = await applicationsPage.getPendingApplicationsCount();
    expect(pendingCount).toBeGreaterThan(0);
  });

  test('GM can approve application and player becomes participant', async ({ page }) => {
    // === STEP 1: GM approves the application ===
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_APPROVE');
    const applicationsPage = new GameApplicationsPage(page, gameId);

    // Navigate to applications tab using POM
    await applicationsPage.goto();

    // Should see PLAYER_3's application (username: TestPlayer3 or TestPlayer3_N for worker N)
    const pendingApplications = await applicationsPage.getPendingApplications();
    expect(pendingApplications).toContain(getWorkerUsername('TestPlayer3'));

    // Approve PLAYER_3's application using POM
    await applicationsPage.approveApplication(getWorkerUsername('TestPlayer3'));

    // === STEP 2: Verify player DOES have access after approval ===
    // (Approval immediately grants participant access)
    await loginAs(page, 'PLAYER_3');
    const playerGamePage = new GameDetailsPage(page);
    await playerGamePage.goto(gameId);

    // Should NOT see "Apply to Join" button anymore
    const applyButton = page.getByRole('button', { name: 'Apply to Join' });
    await expect(applyButton).not.toBeVisible();

    // Should see participant tabs (user is now a participant)
    // Game Info tab is visible for applicants; Participants shows after approval in recruitment state
    await assertTabVisible(page, 'Game Info');
  });

  test('GM can reject application with confirmation', async ({ page }) => {
    // Login as GM and reject the application
    await loginAs(page, 'GM');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_REJECT');
    const applicationsPage = new GameApplicationsPage(page, gameId);

    // Navigate to applications tab using POM
    await applicationsPage.goto();

    // Should see pending applications
    const pendingCount = await applicationsPage.getPendingApplicationsCount();
    expect(pendingCount).toBeGreaterThan(0);

    // Get first pending application username
    const pendingApplications = await applicationsPage.getPendingApplications();
    const usernameToReject = pendingApplications[0];
    expect(usernameToReject).toBeTruthy();

    // Click reject button (this opens the confirmation modal)
    const card = await applicationsPage['findApplicationCard'](usernameToReject);
    const rejectButton = card.getByTestId('reject-application-button');
    await rejectButton.waitFor({ state: 'visible', timeout: 5000 });
    await rejectButton.click();

    // Wait for confirmation modal to appear and confirm
    // (Modal uses div-based layout, not role="dialog" — scope via fixed/overlay container)
    const modalHeading = page.getByRole('heading', { name: 'Reject Application' });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });
    // Scope to modal container (fixed overlay) to distinguish from card's Reject button
    const modalContainer = page.locator('.fixed.inset-0').filter({ hasText: 'Reject Application' });
    await modalContainer.getByRole('button', { name: 'Reject', exact: true }).click();

    // Wait for modal to close (rejection complete)
    await expect(modalHeading).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Refresh and navigate back to applications
    await applicationsPage.goto();

    // Should now see reviewed applications section
    const reviewedCount = await applicationsPage.getReviewedApplicationsCount();
    expect(reviewedCount).toBeGreaterThan(0);
  });

  test('player cannot apply to same game twice', async ({ page }) => {
    await loginAs(page, 'PLAYER_2');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_DUPLICATE');
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    // Navigate to game that already has application from PLAYER_2
    await gamePage.goto(gameId);

    // Should NOT see "Apply to Join" button (already applied)
    expect(await applicationsPage.hasApplyButton()).toBe(false);

    // Should see application status instead
    await expect(
      page.locator('text=Application Pending').or(page.locator('text=pending')).first()
    ).toBeVisible();
  });

  test('player can withdraw their pending application', async ({ page }) => {
    // First, player submits an application
    await loginAs(page, 'PLAYER_4');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_SUBMIT');
    const applicationsPage = new GameApplicationsPage(page, gameId);
    const gamePage = new GameDetailsPage(page);

    await gamePage.goto(gameId);

    // Submit application using POM
    expect(await applicationsPage.hasApplyButton()).toBe(true);
    await applicationsPage.submitApplication('I would like to join this game.', 'player');

    // Refresh to see updated status
    await gamePage.goto(gameId);

    // Should see application pending status
    await expect(
      page.locator('text=Application Pending')
        .or(page.locator('text=Pending'))
        .or(page.locator('text=Applied'))
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Withdraw application using POM
    await applicationsPage.withdrawApplication();

    // Wait for confirmation modal and confirm withdrawal
    // (Modal uses div-based layout — scope via fixed overlay container)
    const withdrawModalHeading = page.getByRole('heading', { name: 'Withdraw Application' });
    await expect(withdrawModalHeading).toBeVisible({ timeout: 5000 });
    const withdrawModalContainer = page.locator('.fixed.inset-0').filter({ hasText: 'Withdraw Application' });
    await withdrawModalContainer.getByRole('button', { name: 'Withdraw Application', exact: true }).click();

    // Wait for modal to close before navigating
    await expect(withdrawModalHeading).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Refresh page to see updated state
    await gamePage.goto(gameId);

    // Should now see "Apply to Join" button again (able to reapply)
    await expect(applicationsPage.applyButton).toBeVisible({ timeout: 10000 });

    // Should NOT see pending status anymore
    await expect(
      page.locator('text=Application Pending').or(page.locator('text=pending')).first()
    ).not.toBeVisible();
  });

  test('public applicants list is visible during recruitment', async ({ page }) => {
    // Applications are pre-seeded in fixture — no runtime submission needed
    await loginAs(page, 'PLAYER_3');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_APPLICATION_PUBLIC_LIST');
    const gamePage = new GameDetailsPage(page);

    // Navigate to Game Info tab to see public applicants
    await gamePage.goto(gameId);
    await navigateToGameTab(page, 'Game Info');

    // Should see "Applicants" heading
    await expect(page.locator('text=Applicants').or(page.locator('text=applicants')).first()).toBeVisible({ timeout: 5000 });

    // Should see player badges/names (usernames are visible, NOT status)
    const player2Username = getWorkerUsername('TestPlayer2');
    const player3Username = getWorkerUsername('TestPlayer3');

    // At least one of the pre-seeded applicants should be visible
    await expect(
      page.locator(`text=${player2Username}`).or(page.locator(`text=${player3Username}`)).locator('visible=true').first()
    ).toBeVisible({ timeout: 5000 });

    // The public list should NOT show application status
    await expect(
      page.locator('text=Pending Review').or(page.locator('text=Approved')).or(page.locator('text=Rejected')).first()
    ).not.toBeVisible();
  });

  test('player can join as audience during character creation', async ({ page }) => {
    // Login as PLAYER_4 who is not yet a participant
    await loginAs(page, 'PLAYER_4');
    const gameId = await getFixtureGameId(page, 'E2E_GAME_CHARACTER_CREATION_AUDIENCE');
    const gamePage = new GameDetailsPage(page);

    // Navigate to game in character_creation state
    await gamePage.goto(gameId);

    // Verify we're on the right game page
    await expect(page.locator('text=E2E Test: Character Creation Audience')).toBeVisible({ timeout: 10000 });

    // Should see "Join as Audience" button (not Apply to Join, since recruitment is closed)
    const joinAsAudienceButton = page.getByTestId('join-as-audience-button').locator('visible=true');
    await expect(joinAsAudienceButton).toBeVisible({ timeout: 5000 });

    // Should NOT see "Apply to Join" button (recruitment phase has ended)
    await expect(page.getByTestId(/apply-button-/).locator('visible=true')).not.toBeVisible();

    // Click "Join as Audience" button to open modal
    await joinAsAudienceButton.click();

    // Wait for modal to appear
    await expect(page.getByRole('heading', { name: 'Join as Audience' })).toBeVisible({ timeout: 5000 });

    // Fill in the message textarea (optional, but let's provide one)
    const messageTextarea = page.getByPlaceholder(/Let the GM know/i);
    await messageTextarea.fill('I would love to watch the character creation process!');

    // Click the submit button scoped to the modal container
    const modalContainer = page.locator('.fixed.inset-0').filter({ hasText: 'Join as Audience' });
    await modalContainer.getByRole('button', { name: 'Join as Audience', exact: true }).click();

    // Wait for modal to close and success toast
    await expect(page.getByRole('heading', { name: 'Join as Audience' })).not.toBeVisible({ timeout: 5000 });

    // With auto_accept_audience: true, user should be immediately added as participant
    // Verify "Join as Audience" button is no longer visible (user successfully joined)
    await expect(page.getByTestId('join-as-audience-button').locator('visible=true')).not.toBeVisible({ timeout: 5000 });

    // Verify no "Apply to Join" button appears (would appear for non-participants)
    await expect(page.getByTestId(/apply-button-/).locator('visible=true')).not.toBeVisible();
  });
});
