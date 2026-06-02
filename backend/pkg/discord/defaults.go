package discord

import "actionphase/pkg/core"

// DiscordNotificationDefaults maps each notification type to whether Discord
// delivery is ON by default.
//
// Design rationale:
//   - High-value direct events (messages, results, approvals) default to ON —
//     users expect to be notified immediately.
//   - High-volume game-wide events (common room posts, phase changes) default
//     to OFF — would be noisy for most users.
var DiscordNotificationDefaults = map[string]bool{
	core.NotificationTypePrivateMessage:       true,
	core.NotificationTypeActionResult:         true,
	core.NotificationTypeCharacterApproved:    true,
	core.NotificationTypeCharacterRejected:    true,
	core.NotificationTypeApplicationApproved:  true,
	core.NotificationTypeApplicationRejected:  true,
	core.NotificationTypeHandoutPublished:     true,
	core.NotificationTypeCommonRoomPost:       false,
	core.NotificationTypeCommentReply:         false,
	core.NotificationTypeCharacterMention:     false,
	core.NotificationTypeActionSubmitted:      false,
	core.NotificationTypePhaseCreated:         false,
	core.NotificationTypeGameStateChanged:     false,
	core.NotificationTypeApplicationSubmitted: false,
}

// IsEnabledForUser returns true if Discord delivery should be attempted for
// the given notification type, considering the user's stored preferences.
//
// Logic:
//  1. If the user has explicitly set a preference for this type, use it.
//  2. Otherwise fall back to DiscordNotificationDefaults.
//  3. If the type is unknown, default to false (safe).
func IsEnabledForUser(discordPrefs map[string]bool, notifType string) bool {
	if discordPrefs != nil {
		if enabled, ok := discordPrefs[notifType]; ok {
			return enabled
		}
	}

	if defaultEnabled, ok := DiscordNotificationDefaults[notifType]; ok {
		return defaultEnabled
	}

	// Unknown notification type — do not dispatch
	return false
}
