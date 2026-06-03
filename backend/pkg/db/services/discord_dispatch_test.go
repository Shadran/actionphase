package db

import (
	"context"
	"fmt"
	"testing"
	"time"

	"actionphase/pkg/core"
	"actionphase/pkg/discord"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNotificationService_NilDiscordNotifier_NoPanic verifies that when DiscordNotifier
// is nil no panic occurs and the notification is still created successfully.
func TestNotificationService_NilDiscordNotifier_NoPanic(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}
	// DiscordNotifier intentionally left nil

	user := testDB.CreateTestUser(t, "userA", "userA@example.com")

	notif, err := svc.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: int32(user.ID),
		Type:   core.NotificationTypePrivateMessage,
		Title:  "test nil notifier",
	})
	require.NoError(t, err)
	assert.NotNil(t, notif)
}

// TestNotificationService_DiscordDispatch_NoAccount verifies no DM is sent when
// the user has no Discord account linked.
func TestNotificationService_DiscordDispatch_NoAccount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	user := testDB.CreateTestUser(t, "userB", "userB@example.com")

	_, err := svc.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: int32(user.ID),
		Type:   core.NotificationTypePrivateMessage,
		Title:  "no discord account",
	})
	require.NoError(t, err)

	// Give the goroutine time to run
	time.Sleep(50 * time.Millisecond)

	assert.Empty(t, mock.SentMessages, "no DM should be sent when user has no Discord account")
}

// TestNotificationService_DiscordDispatch_DisabledType verifies no DM is sent when
// the user has Discord linked but the notification type is disabled in preferences.
func TestNotificationService_DiscordDispatch_DisabledType(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications", "user_preferences")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	user := testDB.CreateTestUser(t, "userC", "userC@example.com")

	// Link Discord account
	discordSvc := &DiscordAccountService{DB: testDB.Pool}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "discord-999",
		DiscordUsername: "testuser",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	// Set preferences: explicitly disable private_message
	prefsSvc := NewUserPreferencesService(testDB.Pool)
	_, err = prefsSvc.UpdateUserPreferences(ctx, int32(user.ID), PreferencesData{
		Theme:           "auto",
		CommentReadMode: "auto",
		DiscordNotifications: map[string]bool{
			core.NotificationTypePrivateMessage: false,
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: int32(user.ID),
		Type:   core.NotificationTypePrivateMessage,
		Title:  "disabled type",
	})
	require.NoError(t, err)

	time.Sleep(50 * time.Millisecond)

	assert.Empty(t, mock.SentMessages, "no DM should be sent when type is disabled in preferences")
}

// TestNotificationService_DiscordDispatch_MissingFrontendURL verifies the embed URL is
// well-formed even when FRONTEND_URL is not set — the link is relative but still
// contains the notif param and does not produce a malformed double-question-mark URL.
func TestNotificationService_DiscordDispatch_MissingFrontendURL(t *testing.T) {
	t.Setenv("FRONTEND_URL", "")

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	user := testDB.CreateTestUser(t, "userE", "userE@example.com")
	discordSvc := &DiscordAccountService{DB: testDB.Pool}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID: int32(user.ID), DiscordUserID: "discord-nourl", DiscordUsername: "nourl", AccessToken: "tok",
	})
	require.NoError(t, err)

	linkURL := "/games/1?tab=messages&conversation=5"
	notif, err := svc.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:  int32(user.ID),
		Type:    core.NotificationTypePrivateMessage,
		Title:   "test message",
		LinkURL: &linkURL,
	})
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	require.Len(t, mock.SentMessages, 1)
	embed := mock.SentMessages[0].Embed
	assert.Equal(t, "test message", embed.Title)
	assert.Contains(t, embed.URL, fmt.Sprintf("notif=%d", notif.ID))
	assert.NotContains(t, embed.URL, "??", "malformed double question mark in URL")
}

// TestNotificationService_DiscordDispatch_NotifParamSeparator verifies the notif param
// is appended with ? when the link has no query string, and & when it does.
func TestNotificationService_DiscordDispatch_NotifParamSeparator(t *testing.T) {
	t.Setenv("FRONTEND_URL", "http://localhost:5173")

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	discordSvc := &DiscordAccountService{DB: testDB.Pool}

	cases := []struct {
		linkURL string
		wantSep string
	}{
		{"/games/1?tab=messages&conversation=5", "&notif="},
		{"/games/1", "?notif="},
	}

	for _, tc := range cases {
		mock := &discord.MockClient{}
		svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

		user := testDB.CreateTestUser(t, tc.linkURL, tc.linkURL+"@x.com")
		_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
			UserID: int32(user.ID), DiscordUserID: "d-" + tc.linkURL, DiscordUsername: "u", AccessToken: "tok",
		})
		require.NoError(t, err)

		link := tc.linkURL
		notif, err := svc.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: int32(user.ID), Type: core.NotificationTypePrivateMessage, Title: "t", LinkURL: &link,
		})
		require.NoError(t, err)

		time.Sleep(100 * time.Millisecond)

		require.Len(t, mock.SentMessages, 1)
		embedURL := mock.SentMessages[0].Embed.URL
		assert.Contains(t, embedURL, fmt.Sprintf("%s%d", tc.wantSep, notif.ID), "link: %s, url: %s", tc.linkURL, embedURL)
		assert.NotContains(t, embedURL, "??")
	}
}

// TestNotificationService_DiscordDispatch_Dispatches verifies a DM is sent when
// Discord is linked and the notification type is enabled, and the embed is well-formed.
func TestNotificationService_DiscordDispatch_Dispatches(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications", "user_preferences")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	user := testDB.CreateTestUser(t, "userD", "userD@example.com")

	// Link Discord account
	discordSvc := &DiscordAccountService{DB: testDB.Pool}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID:          int32(user.ID),
		DiscordUserID:   "discord-777",
		DiscordUsername: "dispatchuser",
		AccessToken:     "tok",
	})
	require.NoError(t, err)

	// private_message defaults to true, so no preference override needed
	linkURL := "/games/1?tab=messages&conversation=5"
	_, err = svc.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:  int32(user.ID),
		Type:    core.NotificationTypePrivateMessage,
		Title:   "You have a new message",
		LinkURL: &linkURL,
	})
	require.NoError(t, err)

	// Give the goroutine time to run (short sleep is acceptable in dispatch tests)
	time.Sleep(100 * time.Millisecond)

	require.Len(t, mock.SentMessages, 1, "exactly one DM should be dispatched")
	sent := mock.SentMessages[0]
	assert.Equal(t, "discord-777", sent.DiscordUserID)
	assert.Equal(t, "You have a new message", sent.Embed.Title)
	assert.Equal(t, "ActionPhase", sent.Embed.Footer)
	assert.NotZero(t, sent.Embed.Color)
	assert.Contains(t, sent.Embed.URL, "/games/1")
}

// TestNotificationService_DiscordDispatch_EmbedContent verifies that the Content field
// is surfaced as the embed description when present.
func TestNotificationService_DiscordDispatch_EmbedContent(t *testing.T) {
	t.Setenv("FRONTEND_URL", "http://localhost:5173")

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "user_discord_accounts", "notifications")

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)

	mock := &discord.MockClient{}
	svc := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger, DiscordNotifier: mock}

	user := testDB.CreateTestUser(t, "userF", "userF@example.com")
	discordSvc := &DiscordAccountService{DB: testDB.Pool}
	_, err := discordSvc.UpsertDiscordAccount(ctx, &core.UpsertDiscordAccountRequest{
		UserID: int32(user.ID), DiscordUserID: "discord-888", DiscordUsername: "contentuser", AccessToken: "tok",
	})
	require.NoError(t, err)

	content := "New message from Detective Marcus Kane"
	_, err = svc.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:  int32(user.ID),
		Type:    core.NotificationTypePrivateMessage,
		Title:   "You have a new message",
		Content: &content,
	})
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	require.Len(t, mock.SentMessages, 1)
	embed := mock.SentMessages[0].Embed
	assert.Equal(t, "You have a new message", embed.Title)
	assert.Equal(t, "New message from Detective Marcus Kane", embed.Description)
}
