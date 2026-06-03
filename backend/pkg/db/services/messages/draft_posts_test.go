package messages

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	models "actionphase/pkg/db/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupDraftTestData(t *testing.T) (*core.TestDatabase, *MessageService, int32, int32, int32, int32) {
	t.Helper()
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "draft_gm", "draft_gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Draft Test Game")
	phase := testDB.CreateTestPhase(t, game.ID, "common_room", "Test Phase")

	charService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	char, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(gm.ID)),
		Name:          "Narrator",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	return testDB, service, game.ID, phase.ID, int32(gm.ID), char.ID
}

func TestMessageService_GetDraftPostForPhase_NoneExists(t *testing.T) {
	testDB, service, _, phaseID, _, _ := setupDraftTestData(t)
	defer testDB.Close()

	result, err := service.GetDraftPostForPhase(context.Background(), phaseID)
	require.NoError(t, err)
	assert.Nil(t, result, "should return nil when no draft exists")
}

func TestMessageService_CreateDraftPost(t *testing.T) {
	testDB, service, gameID, phaseID, gmID, charID := setupDraftTestData(t)
	defer testDB.Close()

	req := core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     int32Ptr(phaseID),
		AuthorID:    gmID,
		CharacterID: charID,
		Content:     "The fog which surrounded you dissipates...",
		Visibility:  string(models.MessageVisibilityGame),
	}

	t.Run("creates draft successfully", func(t *testing.T) {
		draft, err := service.CreateDraftPost(context.Background(), req)
		require.NoError(t, err)
		require.NotNil(t, draft)
		assert.Equal(t, req.Content, draft.Content)
		assert.Equal(t, charID, draft.CharacterID)
		assert.True(t, draft.IsDraft, "post should be marked as draft")
	})

	t.Run("enforces one-draft-per-phase constraint", func(t *testing.T) {
		_, err := service.CreateDraftPost(context.Background(), req)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "draft post already exists")
	})
}

func TestMessageService_UpdateDraftPost(t *testing.T) {
	testDB, service, gameID, phaseID, gmID, charID := setupDraftTestData(t)
	defer testDB.Close()

	draft, err := service.CreateDraftPost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     int32Ptr(phaseID),
		AuthorID:    gmID,
		CharacterID: charID,
		Content:     "Original content",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("updates content", func(t *testing.T) {
		updated, err := service.UpdateDraftPost(context.Background(), draft.ID, "Updated content")
		require.NoError(t, err)
		require.NotNil(t, updated)
		assert.Equal(t, "Updated content", updated.Content)
		assert.True(t, updated.IsDraft)
	})
}

func TestMessageService_DeleteDraftPost(t *testing.T) {
	testDB, service, gameID, phaseID, gmID, charID := setupDraftTestData(t)
	defer testDB.Close()

	draft, err := service.CreateDraftPost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     int32Ptr(phaseID),
		AuthorID:    gmID,
		CharacterID: charID,
		Content:     "Draft to delete",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("deletes draft successfully", func(t *testing.T) {
		err := service.DeleteDraftPost(context.Background(), draft.ID)
		require.NoError(t, err)

		result, err := service.GetDraftPostForPhase(context.Background(), phaseID)
		require.NoError(t, err)
		assert.Nil(t, result, "draft should be gone after deletion")
	})
}

func TestMessageService_PublishDraftPostsForPhase(t *testing.T) {
	testDB, service, gameID, phaseID, gmID, charID := setupDraftTestData(t)
	defer testDB.Close()

	_, err := service.CreateDraftPost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     int32Ptr(phaseID),
		AuthorID:    gmID,
		CharacterID: charID,
		Content:     "Draft to publish",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("publishes draft posts on activation", func(t *testing.T) {
		err := service.PublishDraftPostsForPhase(context.Background(), phaseID)
		require.NoError(t, err)

		// Draft is now gone (is_draft = false)
		draft, err := service.GetDraftPostForPhase(context.Background(), phaseID)
		require.NoError(t, err)
		assert.Nil(t, draft, "published post should no longer appear as a draft")

		// Published post appears in GetGamePosts
		posts, err := service.GetGamePosts(context.Background(), gameID, int32Ptr(phaseID), 10, 0)
		require.NoError(t, err)
		require.Len(t, posts, 1)
		assert.Equal(t, "Draft to publish", posts[0].Content)
		assert.False(t, posts[0].IsDraft)
	})
}

func TestMessageService_DeleteDraftPostsForPhase(t *testing.T) {
	testDB, service, gameID, phaseID, gmID, charID := setupDraftTestData(t)
	defer testDB.Close()

	_, err := service.CreateDraftPost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     int32Ptr(phaseID),
		AuthorID:    gmID,
		CharacterID: charID,
		Content:     "Draft that will be deleted with phase",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("deletes all drafts for phase", func(t *testing.T) {
		err := service.DeleteDraftPostsForPhase(context.Background(), phaseID)
		require.NoError(t, err)

		result, err := service.GetDraftPostForPhase(context.Background(), phaseID)
		require.NoError(t, err)
		assert.Nil(t, result)
	})
}

func TestMessageService_GetGamePosts_ExcludesDrafts(t *testing.T) {
	testDB, service, gameID, phaseID, gmID, charID := setupDraftTestData(t)
	defer testDB.Close()

	// Create a draft post
	_, err := service.CreateDraftPost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		PhaseID:     int32Ptr(phaseID),
		AuthorID:    gmID,
		CharacterID: charID,
		Content:     "Secret draft",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("GetGamePosts excludes draft posts", func(t *testing.T) {
		posts, err := service.GetGamePosts(context.Background(), gameID, int32Ptr(phaseID), 10, 0)
		require.NoError(t, err)
		assert.Empty(t, posts, "draft posts should not appear in GetGamePosts")
	})
}
