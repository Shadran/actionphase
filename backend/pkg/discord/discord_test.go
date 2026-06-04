package discord_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/core"
	"actionphase/pkg/discord"
)

// ─────────────────────────────────────────────────────────────────────────────
// MockClient tests
// ─────────────────────────────────────────────────────────────────────────────

func TestMockClient_RecordsDMs(t *testing.T) {
	mock := &discord.MockClient{}
	ctx := context.Background()

	embed := core.DiscordEmbed{Title: "Hello, ActionPhase!", Color: 0x5865F2, Footer: "ActionPhase"}
	err := mock.SendDM(ctx, "123456789", embed)
	require.NoError(t, err)

	msgs := mock.Messages()
	require.Len(t, msgs, 1)
	assert.Equal(t, "123456789", msgs[0].DiscordUserID)
	assert.Equal(t, "Hello, ActionPhase!", msgs[0].Embed.Title)
}

func TestMockClient_MultipleDMs(t *testing.T) {
	mock := &discord.MockClient{}
	ctx := context.Background()

	_ = mock.SendDM(ctx, "111", core.DiscordEmbed{Title: "First message"})
	_ = mock.SendDM(ctx, "222", core.DiscordEmbed{Title: "Second message"})

	msgs := mock.Messages()
	assert.Len(t, msgs, 2)
	assert.Equal(t, "111", msgs[0].DiscordUserID)
	assert.Equal(t, "222", msgs[1].DiscordUserID)
}

func TestMockClient_ShouldFail(t *testing.T) {
	mock := &discord.MockClient{ShouldFail: true}
	ctx := context.Background()

	err := mock.SendDM(ctx, "123456789", core.DiscordEmbed{Title: "This should fail"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "forced failure")

	// No messages should have been recorded
	assert.Empty(t, mock.Messages())
}

// Compile-time assertion: MockClient implements the interface.
var _ core.DiscordClientInterface = (*discord.MockClient)(nil)

// Compile-time assertion: BotClient implements the interface.
var _ core.DiscordClientInterface = (*discord.BotClient)(nil)

// ─────────────────────────────────────────────────────────────────────────────
// IsEnabledForUser tests
// ─────────────────────────────────────────────────────────────────────────────

func TestIsEnabledForUser_DefaultsForHighValueTypes(t *testing.T) {
	highValueTypes := []string{
		core.NotificationTypePrivateMessage,
		core.NotificationTypeActionResult,
		core.NotificationTypeCharacterApproved,
		core.NotificationTypeApplicationApproved,
		core.NotificationTypeHandoutPublished,
		core.NotificationTypeCommonRoomPost,
	}

	for _, notifType := range highValueTypes {
		t.Run(notifType, func(t *testing.T) {
			enabled := discord.IsEnabledForUser(nil, notifType)
			assert.True(t, enabled, "expected %s to be enabled by default", notifType)
		})
	}
}

func TestIsEnabledForUser_DefaultsForHighVolumeTypes(t *testing.T) {
	highVolumeTypes := []string{
		core.NotificationTypeCommentReply,
		core.NotificationTypeCharacterMention,
		core.NotificationTypeActionSubmitted,
		core.NotificationTypePhaseCreated,
		core.NotificationTypeGameStateChanged,
		core.NotificationTypeApplicationSubmitted,
	}

	for _, notifType := range highVolumeTypes {
		t.Run(notifType, func(t *testing.T) {
			enabled := discord.IsEnabledForUser(nil, notifType)
			assert.False(t, enabled, "expected %s to be disabled by default", notifType)
		})
	}
}

func TestIsEnabledForUser_UserPreferenceOverridesDefault_Enable(t *testing.T) {
	// common_room_post defaults to false; user enables it
	prefs := map[string]bool{
		core.NotificationTypeCommonRoomPost: true,
	}

	enabled := discord.IsEnabledForUser(prefs, core.NotificationTypeCommonRoomPost)
	assert.True(t, enabled)
}

func TestIsEnabledForUser_UserPreferenceOverridesDefault_Disable(t *testing.T) {
	// private_message defaults to true; user disables it
	prefs := map[string]bool{
		core.NotificationTypePrivateMessage: false,
	}

	enabled := discord.IsEnabledForUser(prefs, core.NotificationTypePrivateMessage)
	assert.False(t, enabled)
}

func TestIsEnabledForUser_UnknownTypeReturnsFalse(t *testing.T) {
	enabled := discord.IsEnabledForUser(nil, "totally_unknown_type")
	assert.False(t, enabled)
}

func TestIsEnabledForUser_EmptyPrefsMapUsesDefaults(t *testing.T) {
	emptyPrefs := map[string]bool{}
	enabled := discord.IsEnabledForUser(emptyPrefs, core.NotificationTypePrivateMessage)
	assert.True(t, enabled) // default is true
}
