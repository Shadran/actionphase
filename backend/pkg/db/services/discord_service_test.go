package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDiscordAccountService_UpsertCreatesNew(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	ctx := context.Background()
	user := testDB.CreateTestUser(t, "discorduser1", "discord1@example.com")

	svc := &DiscordAccountService{DB: testDB.Pool}

	acct, err := svc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "d_id_001",
		DiscordUsername: "Player#0001",
		AccessToken:     "access_token_abc",
	})
	require.NoError(t, err)
	require.NotNil(t, acct)

	assert.Equal(t, int32(user.ID), acct.UserID)
	assert.Equal(t, "d_id_001", acct.DiscordUserID)
	assert.Equal(t, "Player#0001", acct.DiscordUsername)
	assert.Equal(t, "access_token_abc", acct.AccessToken)
	assert.Nil(t, acct.RefreshToken)
	assert.Nil(t, acct.TokenExpiresAt)
}

func TestDiscordAccountService_UpsertUpdatesExisting(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	ctx := context.Background()
	user := testDB.CreateTestUser(t, "discorduser2", "discord2@example.com")

	svc := &DiscordAccountService{DB: testDB.Pool}

	// Initial insert
	_, err := svc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "d_id_002",
		DiscordUsername: "OldName#0002",
		AccessToken:     "old_token",
	})
	require.NoError(t, err)

	// Update with new token and username
	newToken := "refresh_xyz"
	acct, err := svc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "d_id_002",
		DiscordUsername: "NewName#0002",
		AccessToken:     "new_token",
		RefreshToken:    &newToken,
	})
	require.NoError(t, err)
	require.NotNil(t, acct)

	assert.Equal(t, "NewName#0002", acct.DiscordUsername)
	assert.Equal(t, "new_token", acct.AccessToken)
	require.NotNil(t, acct.RefreshToken)
	assert.Equal(t, "refresh_xyz", *acct.RefreshToken)
}

func TestDiscordAccountService_GetReturnsNilWhenNotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	ctx := context.Background()
	user := testDB.CreateTestUser(t, "discorduser3", "discord3@example.com")

	svc := &DiscordAccountService{DB: testDB.Pool}

	acct, err := svc.GetDiscordAccount(ctx, int32(user.ID))
	require.NoError(t, err)
	assert.Nil(t, acct, "GetDiscordAccount should return nil (not an error) when no account is linked")
}

func TestDiscordAccountService_GetReturnsAccount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	ctx := context.Background()
	user := testDB.CreateTestUser(t, "discorduser4", "discord4@example.com")

	svc := &DiscordAccountService{DB: testDB.Pool}

	_, err := svc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "d_id_004",
		DiscordUsername: "GetUser#0004",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	acct, err := svc.GetDiscordAccount(ctx, int32(user.ID))
	require.NoError(t, err)
	require.NotNil(t, acct)
	assert.Equal(t, "d_id_004", acct.DiscordUserID)
	assert.Equal(t, "GetUser#0004", acct.DiscordUsername)
	// AccessToken is intentionally not returned in the interface (it's stored but private)
}

func TestDiscordAccountService_DeleteRemovesAccount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts")

	ctx := context.Background()
	user := testDB.CreateTestUser(t, "discorduser5", "discord5@example.com")

	svc := &DiscordAccountService{DB: testDB.Pool}

	_, err := svc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "d_id_005",
		DiscordUsername: "DeleteMe#0005",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	// Confirm it's there
	acct, err := svc.GetDiscordAccount(ctx, int32(user.ID))
	require.NoError(t, err)
	require.NotNil(t, acct)

	// Delete
	err = svc.DeleteDiscordAccount(ctx, int32(user.ID))
	require.NoError(t, err)

	// Confirm it's gone
	acct, err = svc.GetDiscordAccount(ctx, int32(user.ID))
	require.NoError(t, err)
	assert.Nil(t, acct)
}
