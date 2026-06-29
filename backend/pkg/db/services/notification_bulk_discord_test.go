package db

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"
	"actionphase/pkg/discord"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNotifyCommonRoomPost_DispatchesDiscord verifies that NotifyCommonRoomPost
// dispatches Discord DMs through CreateNotification (not the raw SQL bulk insert).
func TestNotifyCommonRoomPost_DispatchesDiscord(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications", "game_participants", "games")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	factory := core.NewTestDataFactory(testDB, t)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	game, players, _ := factory.CreateGameWithParticipants(2)

	// Link Discord to player 0
	discordSvc := &DiscordAccountService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(players[0].ID),
		DiscordUserID:   "discord-player0",
		DiscordUsername: "player0",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	postID := int32(42)
	err = svc.NotifyCommonRoomPost(ctx, int32(game.ID), postID, "An exciting development", int32(players[1].ID))
	require.NoError(t, err)

	// Give goroutines time to dispatch
	time.Sleep(150 * time.Millisecond)

	msgs := mock.Messages()
	require.Len(t, msgs, 1, "player0 with Discord linked should receive a DM")
	assert.Equal(t, "discord-player0", msgs[0].DiscordUserID)
	assert.Contains(t, msgs[0].Embed.Title, "An exciting development")
}

// TestNotifyPhaseCreated_DispatchesDiscord verifies that NotifyPhaseCreated
// dispatches Discord DMs through CreateNotification (not the raw SQL bulk insert).
func TestNotifyPhaseCreated_DispatchesDiscord(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications", "game_participants", "games")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	factory := core.NewTestDataFactory(testDB, t)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	game, players, _ := factory.CreateGameWithParticipants(2)

	// Link Discord to player 1
	discordSvc := &DiscordAccountService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(players[1].ID),
		DiscordUserID:   "discord-player1",
		DiscordUsername: "player1",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	// phase_created defaults to false in discord prefs, so explicitly enable it
	prefsSvc := NewUserPreferencesService(testDB.Pool)
	_, err = prefsSvc.UpdateUserPreferences(ctx, int32(players[1].ID), PreferencesData{
		Theme:           "auto",
		CommentReadMode: "auto",
		DiscordNotifications: map[string]bool{
			core.NotificationTypePhaseCreated: true,
		},
	})
	require.NoError(t, err)

	phaseID := int32(99)
	err = svc.NotifyPhaseCreated(ctx, int32(game.ID), phaseID, "Phase Two Begins", int32(players[0].ID))
	require.NoError(t, err)

	time.Sleep(150 * time.Millisecond)

	msgs := mock.Messages()
	require.Len(t, msgs, 1, "player1 with Discord linked should receive a DM")
	assert.Equal(t, "discord-player1", msgs[0].DiscordUserID)
	assert.Contains(t, msgs[0].Embed.Title, "Phase Two Begins")
}

// TestNotifyGameStateChanged_DispatchesDiscord verifies that NotifyGameStateChanged
// sends in-app notifications and Discord DMs to all active participants except the GM.
func TestNotifyGameStateChanged_DispatchesDiscord(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications", "game_participants", "games")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	factory := core.NewTestDataFactory(testDB, t)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	game, players, _ := factory.CreateGameWithParticipants(1)

	discordSvc := &DiscordAccountService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(players[0].ID),
		DiscordUserID:   "discord-stateplayer",
		DiscordUsername: "stateplayer",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	// game_state_changed defaults to false in discord prefs, so explicitly enable it
	prefsSvc := NewUserPreferencesService(testDB.Pool)
	_, err = prefsSvc.UpdateUserPreferences(ctx, int32(players[0].ID), PreferencesData{
		Theme:           "auto",
		CommentReadMode: "auto",
		DiscordNotifications: map[string]bool{
			core.NotificationTypeGameStateChanged: true,
		},
	})
	require.NoError(t, err)

	err = svc.NotifyGameStateChanged(ctx, int32(game.ID), "active", game.Title, int32(9999))
	require.NoError(t, err)

	time.Sleep(150 * time.Millisecond)

	msgs := mock.Messages()
	require.Len(t, msgs, 1)
	assert.Equal(t, "discord-stateplayer", msgs[0].DiscordUserID)
	assert.Contains(t, msgs[0].Embed.Title, "active")
}

// TestNotifyCommonRoomPost_ExcludesPoster verifies the poster is not notified.
func TestNotifyCommonRoomPost_ExcludesPoster(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "notifications", "game_participants", "games")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	factory := core.NewTestDataFactory(testDB, t)

	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	game, players, _ := factory.CreateGameWithParticipants(3)

	posterID := int32(players[0].ID)
	err := svc.NotifyCommonRoomPost(ctx, int32(game.ID), 1, "Post Title", posterID)
	require.NoError(t, err)

	// Verify via GetUserNotifications that player0 (poster) has 0 notifs
	allNotifs, err := svc.GetUserNotifications(ctx, posterID, 10, 0)
	require.NoError(t, err)
	assert.Empty(t, allNotifs, "poster should not receive their own post notification")

	// player1 and player2 should each have 1
	for _, p := range players[1:] {
		notifs, err := svc.GetUserNotifications(ctx, int32(p.ID), 10, 0)
		require.NoError(t, err)
		assert.Len(t, notifs, 1, "player %d should have 1 notification", p.ID)
	}
}
