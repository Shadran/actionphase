package messages

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageService_ListCharacterPostsAndComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("returns posts and comments by character", func(t *testing.T) {
		// Create a post by the character
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Character post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create a comment by the character
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Character comment",
			ParentID:    post.ID,
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		result, err := service.ListCharacterPostsAndComments(context.Background(), char.ID, 20, 0)
		require.NoError(t, err)

		// Should have both post and comment
		assert.Len(t, result, 2)

		// Find the comment and verify it has parent data
		var foundComment *core.CharacterMessage
		var foundPost *core.CharacterMessage
		for i := range result {
			if result[i].ID == comment.ID {
				foundComment = &result[i]
			}
			if result[i].ID == post.ID {
				foundPost = &result[i]
			}
		}

		require.NotNil(t, foundComment, "comment not found in results")
		assert.Equal(t, "comment", foundComment.MessageType)
		require.NotNil(t, foundComment.ParentContent, "comment should have parent content")
		assert.Equal(t, "Character post", *foundComment.ParentContent)

		require.NotNil(t, foundPost, "post not found in results")
		assert.Equal(t, "post", foundPost.MessageType)
		assert.Nil(t, foundPost.ParentContent, "post should not have parent content")
	})

	t.Run("returns empty slice for character with no messages", func(t *testing.T) {
		otherChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(gm.ID)),
			Name:          "Empty Character",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		result, err := service.ListCharacterPostsAndComments(context.Background(), otherChar.ID, 20, 0)
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("pagination works correctly", func(t *testing.T) {
		paginatedChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player.ID)),
			Name:          "Paginated Character",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		// Create 3 posts
		for i := 0; i < 3; i++ {
			_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: paginatedChar.ID,
				Content:     "Post content",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		// First page: 2 items
		page1, err := service.ListCharacterPostsAndComments(context.Background(), paginatedChar.ID, 2, 0)
		require.NoError(t, err)
		assert.Len(t, page1, 2)

		// Second page: 1 item
		page2, err := service.ListCharacterPostsAndComments(context.Background(), paginatedChar.ID, 2, 2)
		require.NoError(t, err)
		assert.Len(t, page2, 1)
	})

	t.Run("pages are contiguous in descending date order", func(t *testing.T) {
		orderedChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player.ID)),
			Name:          "Ordered Character",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		// Create 5 posts so we have at least 2 full pages of size 2
		for i := 0; i < 5; i++ {
			_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: orderedChar.ID,
				Content:     "Post content",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		page1, err := service.ListCharacterPostsAndComments(context.Background(), orderedChar.ID, 2, 0)
		require.NoError(t, err)
		require.Len(t, page1, 2)

		page2, err := service.ListCharacterPostsAndComments(context.Background(), orderedChar.ID, 2, 2)
		require.NoError(t, err)
		require.Len(t, page2, 2)

		// The oldest item on page 1 must be newer than the newest item on page 2
		// (descending order, no gaps or repeated rows across pages)
		page1LastCreatedAt := page1[1].CreatedAt
		page2FirstCreatedAt := page2[0].CreatedAt
		assert.True(t, page1LastCreatedAt.After(page2FirstCreatedAt) || page1LastCreatedAt.Equal(page2FirstCreatedAt),
			"last item on page 1 (%v) should be >= first item on page 2 (%v) in descending order",
			page1LastCreatedAt, page2FirstCreatedAt)

		// Also verify no overlap: page 1 IDs and page 2 IDs must be disjoint
		page1IDs := map[int32]bool{page1[0].ID: true, page1[1].ID: true}
		for _, msg := range page2 {
			assert.False(t, page1IDs[msg.ID], "message ID %d appears in both page 1 and page 2", msg.ID)
		}
	})
}

func TestMessageService_ListCharacterPostsAndComments_NPCFilter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm_npc", "gm_npc@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "NPC Filter Test Game")

	npc, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Test NPC",
		CharacterType: "npc",
	})
	require.NoError(t, err)

	// Create a top-level post by the NPC
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(gm.ID),
		CharacterID: npc.ID,
		Content:     "NPC post (should be hidden)",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	// Create a comment by the NPC (should be visible)
	_, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
		GameID:      game.ID,
		AuthorID:    int32(gm.ID),
		CharacterID: npc.ID,
		Content:     "NPC comment (should be visible)",
		ParentID:    post.ID,
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	result, err := service.ListCharacterPostsAndComments(context.Background(), npc.ID, 20, 0)
	require.NoError(t, err)

	// Only the comment should be returned, not the post
	assert.Len(t, result, 1)
	assert.Equal(t, "comment", result[0].MessageType)
}

func TestMessageService_CountCharacterPostsAndComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm2", "gm2@example.com")
	player := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Count Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Count Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Initially 0
	count, err := service.CountCharacterPostsAndComments(context.Background(), char.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	// Create 2 posts
	for i := 0; i < 2; i++ {
		_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
	}

	count, err = service.CountCharacterPostsAndComments(context.Background(), char.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)
}

func TestMessageService_CountCharacterPostsAndComments_NPCFilter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm_npc_count", "gm_npc_count@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "NPC Count Filter Test Game")

	npc, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Count NPC",
		CharacterType: "npc",
	})
	require.NoError(t, err)

	// Create a top-level post (should not be counted for NPC)
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(gm.ID),
		CharacterID: npc.ID,
		Content:     "NPC post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	// Create a comment (should be counted)
	_, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
		GameID:      game.ID,
		AuthorID:    int32(gm.ID),
		CharacterID: npc.ID,
		Content:     "NPC comment",
		ParentID:    post.ID,
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	count, err := service.CountCharacterPostsAndComments(context.Background(), npc.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count, "NPC posts should not be counted, only comments")
}
