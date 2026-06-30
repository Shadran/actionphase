package messages

import (
	"context"
	"fmt"
	"testing"
	"time"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageService_ListRecentCommentsWithParents(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Setup test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create character for player
	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("returns recent comments with parent context", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Parent post content",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create a comment on the post
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "This is a comment reply",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// List recent comments
		comments, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)

		require.NoError(t, err)
		assert.Len(t, comments, 1)
		assert.Equal(t, comment.ID, comments[0].ID)
		assert.Equal(t, "This is a comment reply", comments[0].Content)
		assert.NotNil(t, comments[0].ParentContent)
		assert.Equal(t, "Parent post content", *comments[0].ParentContent)
		assert.NotNil(t, comments[0].ParentMessageType)
		assert.Equal(t, "post", *comments[0].ParentMessageType)
	})

	t.Run("deeply nested comment (5+ levels) has non-nil post_id", func(t *testing.T) {
		// Create root post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Root post for deep nesting test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Chain 5 nested replies: post → c1 → c2 → c3 → c4 → c5
		parentID := post.ID
		var deepComment *models.Message
		for i := 0; i < 5; i++ {
			deepComment, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    parentID,
				Content:     fmt.Sprintf("Deep reply level %d", i+1),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
			parentID = deepComment.ID
		}

		// List recent comments
		comments, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 50, 0)
		require.NoError(t, err)

		var found *core.CommentWithParent
		for i := range comments {
			if comments[i].ID == deepComment.ID {
				found = &comments[i]
				break
			}
		}

		require.NotNil(t, found, "Deeply nested comment should appear in results")
		require.NotNil(t, found.PostID, "post_id must not be nil for deeply nested comments (controls Mark as Read button)")
		assert.Equal(t, post.ID, *found.PostID, "post_id should point to the root post")
	})

	t.Run("returns nested comment with parent comment context", func(t *testing.T) {
		// Create post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Original post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create first comment
		comment1, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "First level comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create nested comment (reply to comment)
		comment2, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    comment1.ID,
			Content:     "Nested reply to comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// List recent comments
		comments, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)

		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(comments), 2)

		// Find the nested comment in results
		var nestedComment *core.CommentWithParent
		for i := range comments {
			if comments[i].ID == comment2.ID {
				nestedComment = &comments[i]
				break
			}
		}

		require.NotNil(t, nestedComment, "Nested comment should be in results")
		assert.Equal(t, "Nested reply to comment", nestedComment.Content)
		assert.NotNil(t, nestedComment.ParentContent)
		assert.Equal(t, "First level comment", *nestedComment.ParentContent)
		assert.NotNil(t, nestedComment.ParentMessageType)
		assert.Equal(t, "comment", *nestedComment.ParentMessageType)
	})

	t.Run("pagination works correctly", func(t *testing.T) {
		// Create post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for pagination test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create 15 comments
		for i := 0; i < 15; i++ {
			_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post.ID,
				Content:     fmt.Sprintf("Comment %d", i),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
			time.Sleep(1 * time.Millisecond) // Ensure different created_at times
		}

		// Get first page (limit 10)
		page1, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)
		require.NoError(t, err)
		assert.LessOrEqual(t, len(page1), 10)

		// Get second page (offset 10)
		page2, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 10)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(page2), 5) // At least the 5 new comments we created

		// Verify no duplicates between pages
		page1IDs := make(map[int32]bool)
		for _, c := range page1 {
			page1IDs[c.ID] = true
		}

		for _, c := range page2 {
			assert.False(t, page1IDs[c.ID], "Comment should not appear in both pages")
		}
	})

	t.Run("excludes deleted comments", func(t *testing.T) {
		// Create post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for deletion test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Comment to be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Verify comment appears
		comments, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)
		require.NoError(t, err)

		found := false
		for _, c := range comments {
			if c.ID == comment.ID {
				found = true
				break
			}
		}
		assert.True(t, found, "Comment should be in results before deletion")

		// Delete the comment
		err = service.DeleteComment(context.Background(), comment.ID, int32(player.ID))
		require.NoError(t, err)

		// Verify comment is excluded
		commentsAfterDelete, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)
		require.NoError(t, err)

		for _, c := range commentsAfterDelete {
			assert.NotEqual(t, comment.ID, c.ID, "Deleted comment should not appear in results")
		}
	})

	t.Run("only shows comments from specified game", func(t *testing.T) {
		// Create second game
		game2 := testDB.CreateTestGame(t, int32(gm.ID), "Second Game")

		// Add player to second game
		_, err := gameService.AddGameParticipant(context.Background(), game2.ID, int32(player.ID), "player")
		require.NoError(t, err)

		// Create character in second game
		char2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game2.ID,
			UserID:        int32Ptr(int32(player.ID)),
			Name:          "Character in Game 2",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		// Create post in second game
		post2, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game2.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char2.ID,
			Content:     "Post in game 2",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create comment in second game
		comment2, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game2.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char2.ID,
			ParentID:    post2.ID,
			Content:     "Comment in game 2",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// List comments from first game
		comments, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)
		require.NoError(t, err)

		// Verify game 2 comment is not in results
		for _, c := range comments {
			assert.NotEqual(t, comment2.ID, c.ID, "Comment from game 2 should not appear in game 1 results")
			assert.Equal(t, game.ID, c.GameID, "All comments should be from game 1")
		}
	})

	t.Run("shows deleted parent with null marker", func(t *testing.T) {
		// Create post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post to be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Reply to post that will be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Delete the parent post (using direct query since we don't have DeletePost method in service interface)
		queries := models.New(testDB.Pool)
		_, err = queries.DeletePost(context.Background(), post.ID)
		require.NoError(t, err)

		// List comments - child comment should still appear
		comments, err := service.ListRecentCommentsWithParents(context.Background(), game.ID, 10, 0)
		require.NoError(t, err)

		// Find our comment
		var foundComment *core.CommentWithParent
		for i := range comments {
			if comments[i].ID == comment.ID {
				foundComment = &comments[i]
				break
			}
		}

		require.NotNil(t, foundComment, "Child comment should still appear even if parent is deleted")
		assert.Equal(t, "Reply to post that will be deleted", foundComment.Content)
		assert.NotNil(t, foundComment.ParentDeletedAt, "Parent should be marked as deleted")
	})
}

func TestMessageService_GetTotalCommentCount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Setup test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create character for player
	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("returns correct count", func(t *testing.T) {
		// Create post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for count test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Initial count (just from any existing comments in other tests)
		initialCount, err := service.GetTotalCommentCount(context.Background(), game.ID)
		require.NoError(t, err)

		// Create 5 comments
		for i := 0; i < 5; i++ {
			_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post.ID,
				Content:     "Test comment",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		// Get count
		count, err := service.GetTotalCommentCount(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Equal(t, initialCount+5, count)
	})

	t.Run("excludes deleted comments from count", func(t *testing.T) {
		// Create post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for count test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Get count before
		countBefore, err := service.GetTotalCommentCount(context.Background(), game.ID)
		require.NoError(t, err)

		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Comment to be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Verify count increased
		countAfterCreate, err := service.GetTotalCommentCount(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Equal(t, countBefore+1, countAfterCreate)

		// Delete comment
		err = service.DeleteComment(context.Background(), comment.ID, int32(player.ID))
		require.NoError(t, err)

		// Verify count decreased
		countAfterDelete, err := service.GetTotalCommentCount(context.Background(), game.ID)
		require.NoError(t, err)
		assert.Equal(t, countBefore, countAfterDelete)
	})
}
