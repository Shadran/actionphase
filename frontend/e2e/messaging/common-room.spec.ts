import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { getFixtureGameId, getWorkerGameId } from '../fixtures/game-helpers';
import { assertTextVisible } from '../utils/assertions';

/**
 * Journey 9: Player Posts in Common Room
 *
 * Tests that GMs can create posts and players can view and comment on them.
 * Uses test fixture ("E2E Common Room - Posts") with:
 * - Active common_room phase
 * - GM character
 * - Player 1 and Player 2 characters
 *
 * Created by fixture: backend/pkg/db/test_fixtures/07_common_room.sql
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated waitForTimeout calls (was 18, now 0)
 * - Reduced code by ~45% (173 → ~95 lines)
 * - Improved readability and maintainability
 */
test.describe('@mobile Common Room Flow', () => {

  test('GM can create a post in Common Room', async ({ page }) => {
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_CREATE_POST'); // Game #605
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create a new post
    const postContent = `GM Post ${Date.now()}: Important mission briefing!`;
    await commonRoom.createPost(postContent);

    // Verify the post appears
    await commonRoom.verifyPostExists(postContent);
  });

  test('Player can view GM posts in Common Room', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_VIEW_POSTS'); // Game #606
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Test Post ${Date.now()}: Mission update for all crew`;
      await gmCommonRoom.createPost(postContent);

      // === Player views the post ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      // Verify player can see the GM's post
      await playerCommonRoom.verifyPostExists(postContent);
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Player can comment on GM post', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_COMMENT'); // Game #607
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Discussion Post ${Date.now()}: Let's plan our approach`;
      await gmCommonRoom.createPost(postContent);

      // === Player comments on the post ===
      await loginAs(playerPage, 'PLAYER_1');

      const playerCommonRoom = new CommonRoomPage(playerPage);
      await playerCommonRoom.goto(gameId);

      // Wait for post to be visible
      await playerCommonRoom.verifyPostExists(postContent);

      // Add comment
      const commentContent = `Comment ${Date.now()}: I agree with this plan`;
      await playerCommonRoom.addComment(postContent, commentContent);

      // Verify comment appears
      await playerCommonRoom.verifyCommentExists(commentContent);

      // === GM can see the comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      await gmCommonRoom.goto(gameId);

      // Find the post and expand comments if needed
      const gmPostCard = gmCommonRoom.getPostCard(postContent);
      const commentsButton = gmPostCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const buttonText = await commentsButton.textContent();

      // If comments are hidden, click to show them
      if (buttonText?.includes('Expand')) {
        await commentsButton.click();
        await gmPage.waitForLoadState('networkidle');
      }

      // Verify GM can see the player's comment
      await gmCommonRoom.verifyCommentExists(commentContent);
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('Players can reply to each others comments (nested replies)', async ({ browser }) => {
    test.setTimeout(45000); // Threading replies need more time

    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_NESTED_REPLIES'); // Game #608
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Discussion ${Date.now()}: What should we do next?`;
      await gmCommonRoom.createPost(postContent);

      // === Player 2 comments on the post ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);

      await player2CommonRoom.verifyPostExists(postContent);

      const player2Comment = `Comment ${Date.now()}: I think we should scout ahead`;
      await player2CommonRoom.addComment(postContent, player2Comment);
      await player2CommonRoom.verifyCommentExists(player2Comment);

      // === Player 1 replies to Player 2's comment ===
      await loginAs(player1Page, 'PLAYER_1');

      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);

      // Expand comments if needed
      const postCard = player1CommonRoom.getPostCard(postContent);
      const commentsButton = postCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const buttonText = await commentsButton.textContent();
      if (buttonText?.includes('Expand')) {
        await commentsButton.click();
        await player1Page.waitForLoadState('networkidle');
      }

      // Find Player 2's comment and click Reply
      const commentContainer = player1Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player2Comment }).locator('visible=true').first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
      await replyButton.click();

      // Write the reply
      const player1Reply = `Reply ${Date.now()}: Good idea, let's do it`;
      const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
      await replyTextarea.fill(player1Reply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').locator('visible=true').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await player1Page.waitForLoadState('networkidle');

      // Verify the nested reply appears for Player 1
      const player1NestedReply = player1Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player1Reply }).locator('visible=true').first();
      await expect(player1NestedReply).toBeVisible({ timeout: 10000 });

      // === Player 2 can see the nested reply ===
      await player2Page.reload();
      await player2Page.waitForLoadState('networkidle');
      await player2CommonRoom.goto(gameId);

      // Wait for post to load
      await player2CommonRoom.verifyPostExists(postContent);

      // Expand comments if they're collapsed
      const player2PostCard = player2CommonRoom.getPostCard(postContent);
      const player2CommentsButton = player2PostCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const player2ButtonText = await player2CommentsButton.textContent();
      if (player2ButtonText?.includes('Show')) {
        await player2CommentsButton.click();
        await player2Page.waitForLoadState('networkidle');
      }

      // Wait for Player 2's comment to be visible
      await player2Page.waitForSelector(`text=${player2Comment}`, { timeout: 10000 });

      // Verify Player 2 can see Player 1's reply to their comment
      // Give it more time since nested replies might take longer to load
      await expect(player2Page.getByText(player1Reply).locator('visible=true').locator('visible=true').first()).toBeVisible({ timeout: 15000 });

      // Verify the reply appears as a nested comment (has the threaded-comment test ID)
      const nestedReply = player2Page.locator('[data-testid="threaded-comment"]').filter({ hasText: player1Reply }).locator('visible=true').first();
      await expect(nestedReply).toBeVisible();
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Multiple players can reply to the same comment', async ({ browser }) => {
    const gmContext = await browser.newContext();
    const player1Context = await browser.newContext();
    const player2Context = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const player1Page = await player1Context.newPage();
    const player2Page = await player2Context.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = await getFixtureGameId(gmPage, 'COMMON_ROOM_MULTIPLE_REPLIES'); // Game #609
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Poll ${Date.now()}: Who wants to go north?`;
      await gmCommonRoom.createPost(postContent);

      // === Player 1 replies ===
      await loginAs(player1Page, 'PLAYER_1');

      const player1CommonRoom = new CommonRoomPage(player1Page);
      await player1CommonRoom.goto(gameId);

      const player1Comment = `P1 Reply ${Date.now()}: I do!`;
      await player1CommonRoom.addComment(postContent, player1Comment);

      // === Player 2 also replies to the same post ===
      await loginAs(player2Page, 'PLAYER_2');

      const player2CommonRoom = new CommonRoomPage(player2Page);
      await player2CommonRoom.goto(gameId);

      const player2Comment = `P2 Reply ${Date.now()}: Me too!`;
      await player2CommonRoom.addComment(postContent, player2Comment);

      // === Verify GM sees both replies ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmCommonRoom.goto(gameId);

      // Expand comments
      const postCard = gmCommonRoom.getPostCard(postContent);
      const commentsButton = postCard.locator('button', { hasText: /Comments/ }).locator('visible=true').first();
      const buttonText = await commentsButton.textContent();
      if (buttonText?.includes('Expand')) {
        await commentsButton.click();
        await gmPage.waitForLoadState('networkidle');
      }

      // Verify both comments are visible
      await expect(gmPage.getByText(player1Comment)).toBeVisible({ timeout: 5000 });
      await expect(gmPage.getByText(player2Comment)).toBeVisible({ timeout: 5000 });

      // Success: Both comments are visible to the GM
      // Note: The button text may vary ("2 Comments", "Hide Comments", "New Comments", etc.)
      // but the important verification is that both comments are visible, which we've confirmed above
    } finally {
      await gmContext.close();
      await player1Context.close();
      await player2Context.close();
    }
  });

  test('Deep nesting shows Continue this thread button at max depth', async ({ page }) => {
    // The fixture pre-creates a post "Deep Thread Test Post" with a 6-level nested reply chain.
    // Desktop (max depth=5): Level 4 is the deepest visible comment; Level 5 shows in the modal.
    // Mobile  (max depth=3): Level 2 is the deepest visible comment; Level 3 shows in the modal.
    await loginAs(page, 'PLAYER_1');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_DEEP_NESTING');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    const postContent = 'Deep Thread Test Post';

    // Detect mobile viewport (matches COMMENT_MAX_DEPTH_MOBILE=3 vs COMMENT_MAX_DEPTH=5)
    const isMobile = page.viewportSize()!.width < 768;
    // Mobile (mobileMaxDepth=3): children rendered at depths 0–1 only (depth < 2).
    //   Depth 2 = Level 3 → shows "Continue this thread", no children rendered.
    //   Modal opens from Level 3's children → first comment in modal is Level 4.
    // Desktop (maxDepth=5): deepest visible is Level 4 (depth=3), "Continue this thread" on it.
    //   Modal shows Level 5. (Verified by the original passing desktop test.)
    const deepestComment = isMobile ? 'Nested Reply Level 3' : 'Nested Reply Level 4';
    const modalComment   = isMobile ? 'Nested Reply Level 4' : 'Nested Reply Level 5';

    await expect(page.getByText(postContent).first()).toBeVisible({ timeout: 15000 });

    // Expand comments if collapsed
    const postCard = commonRoom.getPostCard(postContent);
    const commentsToggle = postCard.locator('button', { hasText: /Comments/ }).filter({ visible: true }).first();
    await commentsToggle.waitFor({ state: 'visible', timeout: 10000 });
    if ((await commentsToggle.textContent())?.includes('Expand')) {
      await commentsToggle.click();
      await page.waitForLoadState('networkidle');
    }

    // Wait for the deepest pre-created comment to be visible and scroll to it.
    // The dual-DOM pattern (desktop + mobile renders) means multiple copies exist;
    // use filter({visible:true}) to match only the rendered-for-current-viewport one.
    const deepestCommentLocator = page
      .locator('[data-testid="threaded-comment"]:visible')
      .filter({ has: page.getByText(deepestComment, { exact: true }) })
      .last();
    await expect(deepestCommentLocator).toBeVisible({ timeout: 15000 });

    // Find the threaded-comment container for the deepest comment
    const commentContainer = deepestCommentLocator;

    // "Continue this thread" button should be present at this depth
    const continueButton = commentContainer.getByRole('button', { name: /Continue this thread/ }).locator('visible=true').first();
    await expect(continueButton).toBeVisible({ timeout: 5000 });

    // Click to open the thread modal
    await continueButton.click();

    const modalHeader = page.getByText('Thread View');
    await expect(modalHeader).toBeVisible({ timeout: 5000 });

    const modal = page.locator('.fixed.inset-0').filter({ hasText: 'Thread View' });
    // Modal shows deeper content — next level is visible inside the thread view
    await expect(modal.getByText(modalComment)).toBeVisible({ timeout: 5000 });

    // Reply from within the modal to verify it's fully interactive
    const modalCommentContainer = modal.locator('[data-testid="threaded-comment"]:visible').filter({ hasText: modalComment }).first();
    const modalReplyButton = modalCommentContainer.getByRole('button', { name: /reply/i }).first();
    await expect(modalReplyButton).toBeVisible({ timeout: 10000 });
    await modalReplyButton.click();

    const modalReply = `Modal Reply - ${Date.now()}`;
    const modalReplyTextarea = modalCommentContainer.locator('textarea').locator('visible=true').first();
    await modalReplyTextarea.waitFor({ state: 'visible', timeout: 5000 });
    await modalReplyTextarea.fill(modalReply);

    const modalReplyForm = modalCommentContainer.locator('form').locator('visible=true').first();
    await modalReplyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());
    await page.waitForLoadState('networkidle');

    await expect(modal.getByText(modalReply).locator('visible=true').first()).toBeVisible({ timeout: 10000 });
  });

  test('GM can create posts as NPCs', async ({ page }) => {
    // Test that GMs can select NPCs from the character dropdown and post as them
    // Uses COMMON_ROOM_MISC fixture (game 167) which has an unassigned NPC (Mysterious Stranger)
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create first post as default character
    const post1 = `GM Post 1 ${Date.now()}: Testing NPC posting.`;
    await commonRoom.createPost(post1);
    await commonRoom.verifyPostExists(post1);

    // Create post selecting a specific NPC
    const npcPost = `NPC Message ${Date.now()}: I have information about the quest.`;
    await commonRoom.createPost(npcPost, 'Mysterious Stranger');
    await commonRoom.verifyPostExists(npcPost);
  });

  test('Co-GM can create posts as NPCs', async ({ page }) => {
    // Test that co-GMs have the same NPC posting permissions as GMs
    // Uses stable NPC messaging fixture (game 347) where TestAudience1 is permanently co-GM.
    // NOT game 339, which is mutated by co-gm-management.spec.ts (promote/demote tests).
    await loginAs(page, 'AUDIENCE_1');

    const gameId = getWorkerGameId(347); // Co-GM NPC Messaging fixture (stable)
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create first post as default character
    const post1 = `Co-GM Post 1 ${Date.now()}: Testing co-GM NPC posting.`;
    await commonRoom.createPost(post1);
    await commonRoom.verifyPostExists(post1);

    // Create post selecting a specific NPC
    const npcPost = `Co-GM NPC Post ${Date.now()}: I've been watching from the shadows.`;
    await commonRoom.createPost(npcPost, 'Town Guard');
    await commonRoom.verifyPostExists(npcPost);
  });

  test('Co-GM can reply to threads as NPCs', async ({ browser }) => {
    // Test that co-GMs can comment on posts as NPCs
    const gmContext = await browser.newContext();
    const coGmContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const coGmPage = await coGmContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');

      const gameId = getWorkerGameId(347); // Co-GM NPC Messaging fixture (stable, not mutated by co-gm-management tests)
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `GM Question ${Date.now()}: Has anyone seen unusual activity?`;
      await gmCommonRoom.createPost(postContent);

      // === Co-GM comments as NPC ===
      await loginAs(coGmPage, 'AUDIENCE_1');

      const coGmCommonRoom = new CommonRoomPage(coGmPage);
      await coGmCommonRoom.goto(gameId);

      // Verify co-GM can see the post
      await coGmCommonRoom.verifyPostExists(postContent);

      // Add comment as Mysterious Stranger NPC
      const commentText = `Strange figures were seen near the old mill last night.`;
      await coGmCommonRoom.addComment(postContent, commentText, { asCharacter: 'Mysterious Stranger' });

      // Verify comment appears
      await coGmCommonRoom.verifyCommentExists(commentText);

      // === GM verifies they can see co-GM's NPC comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await gmCommonRoom.verifyCommentExists(commentText);

    } finally {
      await gmContext.close();
      await coGmContext.close();
    }
  });

  test('GM can reply to co-GM comments in threads', async ({ browser }) => {
    test.setTimeout(45000);
    const gmContext = await browser.newContext();
    const coGmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const coGmPage = await coGmContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      const gameId = getWorkerGameId(347); // Co-GM NPC Messaging fixture (stable, TestAudience1 always co-GM)
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Thread ${Date.now()}: Strategic planning discussion`;
      await gmCommonRoom.createPost(postContent);

      // === Co-GM comments on the post as an NPC ===
      await loginAs(coGmPage, 'AUDIENCE_1'); // TestAudience1 is co-GM
      const coGmCommonRoom = new CommonRoomPage(coGmPage);
      await coGmCommonRoom.goto(gameId);

      const coGmComment = `Comment ${Date.now()}: The town guard reports suspicious activity`;
      await coGmCommonRoom.addComment(postContent, coGmComment, { asCharacter: 'Town Guard' });

      // === GM replies to the co-GM's comment ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');

      // Find the co-GM's comment and click Reply
      const commentContainer = gmPage.locator('[data-testid="threaded-comment"]').filter({ hasText: coGmComment }).locator('visible=true').first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
      await replyButton.click();

      // Write the reply
      const gmReply = `Reply ${Date.now()}: Thank you for the report, keep me informed`;
      const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
      await replyTextarea.fill(gmReply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').locator('visible=true').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());

      // Wait for reply to be created
      await gmPage.waitForLoadState('networkidle');

      // Verify GM's reply appears
      await assertTextVisible(gmPage, gmReply);

      // === Co-GM verifies they can see GM's nested reply ===
      await coGmPage.reload();
      await coGmPage.waitForLoadState('networkidle');
      await assertTextVisible(coGmPage, gmReply);

    } finally {
      await gmContext.close();
      await coGmContext.close();
    }
  });

  test('Co-GM can reply to comments as NPCs in threads', async ({ browser }) => {
    test.setTimeout(45000);
    const gmContext = await browser.newContext();
    const coGmContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const coGmPage = await coGmContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      const gameId = getWorkerGameId(347); // Co-GM NPC Messaging fixture (stable, TestAudience1 always co-GM)
      const gmCommonRoom = new CommonRoomPage(gmPage);
      await gmCommonRoom.goto(gameId);

      const postContent = `Thread ${Date.now()}: Town meeting`;
      await gmCommonRoom.createPost(postContent);

      // === GM creates a comment ===
      const gmComment = `Comment ${Date.now()}: Citizens are concerned about recent events`;
      await gmCommonRoom.addComment(postContent, gmComment);

      // === Co-GM replies to GM's comment as an NPC ===
      await loginAs(coGmPage, 'AUDIENCE_1'); // TestAudience1 is co-GM
      const coGmCommonRoom = new CommonRoomPage(coGmPage);
      await coGmCommonRoom.goto(gameId);

      // Find GM's comment and click Reply
      const commentContainer = coGmPage.locator('[data-testid="threaded-comment"]').filter({ hasText: gmComment }).locator('visible=true').first();
      const replyButton = commentContainer.getByRole('button', { name: 'Reply' }).locator('visible=true').first();
      await replyButton.click();

      // Select NPC character for the reply
      const characterSelect = commentContainer.locator('role=combobox').locator('visible=true').first();
      await characterSelect.waitFor({ state: 'visible', timeout: 5000 });
      await characterSelect.selectOption({ label: 'Reply as Mysterious Stranger' });

      // Write the reply
      const coGmReply = `Reply ${Date.now()}: I have information that may shed light on these events`;
      const replyTextarea = commentContainer.locator('textarea').locator('visible=true').first();
      await replyTextarea.waitFor({ state: 'visible', timeout: 5000 });
      await replyTextarea.fill(coGmReply);

      // Submit the reply
      const replyForm = commentContainer.locator('form').locator('visible=true').first();
      await replyForm.evaluate((f: HTMLFormElement) => f.requestSubmit());

      // Wait for reply to be created
      await coGmPage.waitForLoadState('networkidle');

      // Verify co-GM's NPC reply appears
      await assertTextVisible(coGmPage, coGmReply);

      // === GM verifies they can see co-GM's nested NPC reply ===
      await gmPage.reload();
      await gmPage.waitForLoadState('networkidle');
      await assertTextVisible(gmPage, coGmReply);

    } finally {
      await gmContext.close();
      await coGmContext.close();
    }
  });

  test('GM can edit a comment and change the character', async ({ page }) => {
    // Test that editing a comment and changing the character updates the character name immediately
    // This validates the cache update fix for comment character swaps
    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC'); // Uses stable fixture with unassigned NPCs
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create a post as the first NPC
    const postContent = `Test Post ${Date.now()}: Information from the shadows`;
    await commonRoom.createPost(postContent, 'Mysterious Stranger');
    await commonRoom.verifyPostExists(postContent);

    // Create a comment on the post as the second NPC
    const commentContent = `Comment ${Date.now()}: I saw something unusual`;
    await commonRoom.addComment(postContent, commentContent, { asCharacter: 'Town Guard' });
    await commonRoom.verifyCommentExists(commentContent);

    // Verify the comment shows "Town Guard" as the author (scoped to author label, not dropdown options)
    const commentContainer = page.locator('[data-testid="threaded-comment"]').filter({ hasText: commentContent }).locator('visible=true').first();
    await expect(commentContainer.getByTestId('comment-author').filter({ hasText: 'Town Guard' }).locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // Click Edit on the comment
    const editButton = commentContainer.getByRole('button', { name: 'Edit' }).locator('visible=true').first();
    await editButton.click();

    // Change the character to "Mysterious Stranger"
    const characterSelect = commentContainer.locator('select').locator('visible=true').first();
    await characterSelect.waitFor({ state: 'visible', timeout: 5000 });
    await characterSelect.selectOption({ label: 'Edit as Mysterious Stranger' });

    // Save the edit (content stays the same, just changing the character)
    const saveButton = commentContainer.getByRole('button', { name: 'Save' }).locator('visible=true').first();
    await saveButton.click();
    await page.waitForLoadState('networkidle');

    // Verify the author label updates immediately WITHOUT page reload
    // This is the key test - the character name should change from "Town Guard" to "Mysterious Stranger"
    await expect(commentContainer.getByTestId('comment-author').filter({ hasText: 'Mysterious Stranger' }).locator('visible=true').first()).toBeVisible({ timeout: 5000 });

    // Verify "Town Guard" author label is no longer showing (it should have been replaced)
    await expect(commentContainer.getByTestId('comment-author').filter({ hasText: 'Town Guard' }).first()).not.toBeVisible();

    // Verify (edited) marker appears
    await expect(commentContainer.getByText('(edited)').locator('visible=true').first()).toBeVisible({ timeout: 3000 });
  });

  test('Player cannot create posts in Common Room', async ({ page }) => {
    await loginAs(page, 'PLAYER_1');
    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_CREATE_POST');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Players should not see the Create Post form or button
    await expect(commonRoom.createPostHeading).not.toBeVisible({ timeout: 10000 });
  });

  test('GM can edit their own post', async ({ page }) => {
    // Test that GMs can edit their own posts
    // Validates Issue 8.4: GM Can't Edit Common Room Posts

    await loginAs(page, 'GM');

    const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');
    const commonRoom = new CommonRoomPage(page);
    await commonRoom.goto(gameId);

    // Verify Common Room is loaded
    await expect(commonRoom.heading).toBeVisible({ timeout: 5000 });

    // Create a post
    const originalContent = `Original Post ${Date.now()}: This is the initial content`;
    await commonRoom.createPost(originalContent);
    await commonRoom.verifyPostExists(originalContent);

    // Get reference to the post card BEFORE clicking edit
    const postCard = commonRoom.getPostCard(originalContent);

    // Click Edit button
    const editButton = postCard.getByRole('button', { name: /^edit$/i }).locator('visible=true').first();
    await editButton.click();

    // Wait for edit textarea to appear
    const textarea = page.locator('textarea[placeholder*="Edit your post"]').locator('visible=true').first();
    await textarea.waitFor({ state: 'visible', timeout: 5000 });

    // Modify the content
    const updatedContent = `Updated Post ${Date.now()}: This content has been changed`;
    await textarea.fill(updatedContent);

    // Verify the textarea has the new content
    await expect(textarea).toHaveValue(updatedContent);

    // Click Save button
    const saveButton = page.getByRole('button', { name: 'Save' }).locator('visible=true').first();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Wait for edit mode to close (Edit button reappears)
    await expect(page.getByRole('button', { name: /^edit$/i }).locator('visible=true').locator('visible=true').first()).toBeVisible({ timeout: 10000 });

    // Verify the content updates
    await expect(page.getByText(updatedContent)).toBeVisible({ timeout: 5000 });

    // Verify the original content is no longer showing
    await expect(page.getByText(originalContent)).not.toBeVisible();

    // Verify (edited) marker appears
    await expect(page.getByText('(edited)').locator('visible=true').first()).toBeVisible({ timeout: 5000 });
  });
});
