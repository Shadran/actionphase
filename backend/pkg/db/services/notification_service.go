package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"actionphase/pkg/core"
	"actionphase/pkg/discord"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/observability"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NotificationService implements core.NotificationServiceInterface.
type NotificationService struct {
	DB              *pgxpool.Pool
	Logger          *observability.Logger
	DiscordNotifier core.DiscordClientInterface // optional; nil means no Discord dispatch
}

// appDiscordNotifier is a package-level Discord notifier set by main at startup.
// This enables service-internal usages (conversations, messages, phases) that
// don't have access to h.App to still dispatch Discord DMs.
// Only set once during application initialization; never mutated after that.
var appDiscordNotifier core.DiscordClientInterface

// SetAppDiscordNotifier registers the application-wide Discord notifier.
// Call this once from main.go after the notifier is initialized.
func SetAppDiscordNotifier(n core.DiscordClientInterface) {
	appDiscordNotifier = n
}

// NewNotificationService creates a NotificationService wired with the application-wide
// Discord notifier. Use this in handlers/services that don't hold an App reference.
func NewNotificationService(db *pgxpool.Pool, logger *observability.Logger) *NotificationService {
	return &NotificationService{
		DB:              db,
		Logger:          logger,
		DiscordNotifier: appDiscordNotifier,
	}
}

// Compile-time verification that NotificationService implements the interface
var _ core.NotificationServiceInterface = (*NotificationService)(nil)

// Helper functions for pgtype conversions
func toPgInt4(v *int32) pgtype.Int4 {
	if v == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *v, Valid: true}
}

func fromPgInt4(v pgtype.Int4) *int32 {
	if !v.Valid {
		return nil
	}
	return &v.Int32
}

func toPgText(v *string) pgtype.Text {
	if v == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *v, Valid: true}
}

func fromPgText(v pgtype.Text) *string {
	if !v.Valid {
		return nil
	}
	return &v.String
}

func fromPgBool(v pgtype.Bool) bool {
	if !v.Valid {
		return false
	}
	return v.Bool
}

func fromPgTimestamp(v pgtype.Timestamptz) *time.Time {
	if !v.Valid {
		return nil
	}
	t := v.Time
	return &t
}

// convertDbNotificationToCore converts sqlc Notification to core.Notification
func convertDbNotificationToCore(dbNotif models.Notification) *core.Notification {
	return &core.Notification{
		ID:          dbNotif.ID,
		UserID:      dbNotif.UserID,
		GameID:      fromPgInt4(dbNotif.GameID),
		Type:        dbNotif.Type,
		Title:       dbNotif.Title,
		Content:     fromPgText(dbNotif.Content),
		RelatedType: fromPgText(dbNotif.RelatedType),
		RelatedID:   fromPgInt4(dbNotif.RelatedID),
		LinkURL:     fromPgText(dbNotif.LinkUrl),
		IsRead:      fromPgBool(dbNotif.IsRead),
		ReadAt:      fromPgTimestamp(dbNotif.ReadAt),
		CreatedAt:   dbNotif.CreatedAt.Time,
	}
}

// convertRowToCore converts GetUserNotificationsRow to core.Notification
func convertRowToCore(row models.GetUserNotificationsRow) *core.Notification {
	return &core.Notification{
		ID:          row.ID,
		UserID:      row.UserID,
		GameID:      fromPgInt4(row.GameID),
		Type:        row.Type,
		Title:       row.Title,
		Content:     fromPgText(row.Content),
		RelatedType: fromPgText(row.RelatedType),
		RelatedID:   fromPgInt4(row.RelatedID),
		LinkURL:     fromPgText(row.LinkUrl),
		IsRead:      fromPgBool(row.IsRead),
		ReadAt:      fromPgTimestamp(row.ReadAt),
		CreatedAt:   row.CreatedAt.Time,
	}
}

// convertUnreadRowToCore converts GetUnreadNotificationsRow to core.Notification
func convertUnreadRowToCore(row models.GetUnreadNotificationsRow) *core.Notification {
	return &core.Notification{
		ID:          row.ID,
		UserID:      row.UserID,
		GameID:      fromPgInt4(row.GameID),
		Type:        row.Type,
		Title:       row.Title,
		Content:     fromPgText(row.Content),
		RelatedType: fromPgText(row.RelatedType),
		RelatedID:   fromPgInt4(row.RelatedID),
		LinkURL:     fromPgText(row.LinkUrl),
		IsRead:      fromPgBool(row.IsRead),
		ReadAt:      fromPgTimestamp(row.ReadAt),
		CreatedAt:   row.CreatedAt.Time,
	}
}

// CreateNotification creates a new notification for a user.
func (s *NotificationService) CreateNotification(ctx context.Context, req *core.CreateNotificationRequest) (*core.Notification, error) {
	s.Logger.Info(ctx, "Creating notification",
		"user_id", req.UserID,
		"type", req.Type,
		"game_id", req.GameID,
	)

	// Validate the request
	if err := req.Validate(); err != nil {
		s.Logger.Warn(ctx, "Invalid notification request",
			"user_id", req.UserID,
			"type", req.Type,
			"error", err,
		)
		return nil, fmt.Errorf("invalid notification request: %w", err)
	}

	queries := models.New(s.DB)

	params := models.CreateNotificationParams{
		UserID:      req.UserID,
		GameID:      toPgInt4(req.GameID),
		Type:        req.Type,
		Title:       req.Title,
		Content:     toPgText(req.Content),
		RelatedType: toPgText(req.RelatedType),
		RelatedID:   toPgInt4(req.RelatedID),
		LinkUrl:     toPgText(req.LinkURL),
	}

	dbNotif, err := queries.CreateNotification(ctx, params)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to create notification",
			"user_id", req.UserID,
			"type", req.Type,
			"game_id", req.GameID,
		)
		return nil, fmt.Errorf("failed to create notification: %w", err)
	}

	s.Logger.Info(ctx, "Notification created successfully",
		"notification_id", dbNotif.ID,
		"user_id", req.UserID,
		"type", req.Type,
	)

	notification := convertDbNotificationToCore(dbNotif)

	// Fire-and-forget Discord DM dispatch (does not block the API response)
	if s.DiscordNotifier != nil {
		go s.dispatchDiscordDM(context.Background(), notification)
	}

	return notification, nil
}

// dispatchDiscordDM sends a Discord DM for a notification if:
//   - The recipient has a linked Discord account
//   - The notification type is enabled in their preferences
//
// Errors are logged but never propagated — Discord dispatch is best-effort.
func (s *NotificationService) dispatchDiscordDM(ctx context.Context, notification *core.Notification) {
	discordSvc := &DiscordAccountService{DB: s.DB}
	prefsSvc := NewUserPreferencesService(s.DB)

	// 1. Get Discord account for user
	acct, err := discordSvc.GetDiscordAccount(ctx, notification.UserID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Discord dispatch: failed to get discord account",
			"user_id", notification.UserID)
		return
	}
	if acct == nil {
		// No Discord account linked — skip silently
		return
	}

	// 2. Check user preferences
	prefs, err := prefsSvc.GetUserPreferences(ctx, notification.UserID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Discord dispatch: failed to get user preferences",
			"user_id", notification.UserID)
		return
	}

	if !discord.IsEnabledForUser(prefs.DiscordNotifications, notification.Type) {
		return
	}

	// 3. Build message
	frontendURL := os.Getenv("FRONTEND_URL")
	var msg string
	if notification.LinkURL != nil && *notification.LinkURL != "" {
		msg = fmt.Sprintf("[ActionPhase] %s — %s%s", notification.Title, frontendURL, *notification.LinkURL)
	} else {
		msg = fmt.Sprintf("[ActionPhase] %s", notification.Title)
	}

	// 4. Send DM — log error but never propagate
	if err := s.DiscordNotifier.SendDM(ctx, acct.DiscordUserID, msg); err != nil {
		s.Logger.LogError(ctx, err, "Discord dispatch: failed to send DM",
			"user_id", notification.UserID,
			"discord_user_id", acct.DiscordUserID,
			"notification_type", notification.Type,
		)
	}
}

// CreateBulkNotifications creates notifications for multiple users (fire-and-forget).
func (s *NotificationService) CreateBulkNotifications(ctx context.Context, userIDs []int32, req *core.CreateNotificationRequest) error {
	if len(userIDs) == 0 {
		return nil
	}

	s.Logger.Info(ctx, "Creating bulk notifications",
		"user_count", len(userIDs),
		"type", req.Type,
		"game_id", req.GameID,
	)

	// Create notifications for each user
	successCount := 0
	for _, userID := range userIDs {
		bulkReq := &core.CreateNotificationRequest{
			UserID:      userID,
			GameID:      req.GameID,
			Type:        req.Type,
			Title:       req.Title,
			Content:     req.Content,
			RelatedType: req.RelatedType,
			RelatedID:   req.RelatedID,
			LinkURL:     req.LinkURL,
		}

		// Fire-and-forget: ignore errors to not block main operation
		if _, err := s.CreateNotification(ctx, bulkReq); err == nil {
			successCount++
		}
	}

	s.Logger.Info(ctx, "Bulk notification creation completed",
		"total_users", len(userIDs),
		"successful", successCount,
		"type", req.Type,
	)

	return nil
}

// GetUserNotifications retrieves a paginated list of notifications for a user.
func (s *NotificationService) GetUserNotifications(ctx context.Context, userID int32, limit, offset int) ([]*core.Notification, error) {
	queries := models.New(s.DB)

	rows, err := queries.GetUserNotifications(ctx, models.GetUserNotificationsParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user notifications: %w", err)
	}

	notifications := make([]*core.Notification, len(rows))
	for i, row := range rows {
		notifications[i] = convertRowToCore(row)
	}

	return notifications, nil
}

// GetUnreadCount returns the count of unread notifications for a user.
func (s *NotificationService) GetUnreadCount(ctx context.Context, userID int32) (int64, error) {
	queries := models.New(s.DB)

	count, err := queries.GetUnreadNotificationCount(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread notification count: %w", err)
	}

	return count, nil
}

// GetUnreadNotifications retrieves unread notifications for a user.
func (s *NotificationService) GetUnreadNotifications(ctx context.Context, userID int32, limit int) ([]*core.Notification, error) {
	queries := models.New(s.DB)

	rows, err := queries.GetUnreadNotifications(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get unread notifications: %w", err)
	}

	// Apply limit
	if limit > 0 && len(rows) > limit {
		rows = rows[:limit]
	}

	notifications := make([]*core.Notification, len(rows))
	for i, row := range rows {
		notifications[i] = convertUnreadRowToCore(row)
	}

	return notifications, nil
}

// MarkAsRead marks a single notification as read.
func (s *NotificationService) MarkAsRead(ctx context.Context, notificationID, userID int32) error {
	s.Logger.Info(ctx, "Marking notification as read",
		"notification_id", notificationID,
		"user_id", userID,
	)

	queries := models.New(s.DB)

	_, err := queries.MarkNotificationRead(ctx, models.MarkNotificationReadParams{
		ID:     notificationID,
		UserID: userID,
	})
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to mark notification as read",
			"notification_id", notificationID,
			"user_id", userID,
		)
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	return nil
}

// MarkAllAsRead marks all notifications as read for a user.
func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID int32) error {
	s.Logger.Info(ctx, "Marking all notifications as read",
		"user_id", userID,
	)

	queries := models.New(s.DB)

	err := queries.MarkAllNotificationsRead(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to mark all notifications as read",
			"user_id", userID,
		)
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}

	s.Logger.Info(ctx, "All notifications marked as read",
		"user_id", userID,
	)

	return nil
}

// DeleteNotification deletes a notification (only if it belongs to the user).
func (s *NotificationService) DeleteNotification(ctx context.Context, notificationID, userID int32) error {
	s.Logger.Info(ctx, "Deleting notification",
		"notification_id", notificationID,
		"user_id", userID,
	)

	queries := models.New(s.DB)

	err := queries.DeleteNotification(ctx, models.DeleteNotificationParams{
		ID:     notificationID,
		UserID: userID,
	})
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to delete notification",
			"notification_id", notificationID,
			"user_id", userID,
		)
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	return nil
}

// DeleteOldReadNotifications deletes read notifications older than 30 days.
func (s *NotificationService) DeleteOldReadNotifications(ctx context.Context) error {
	s.Logger.Info(ctx, "Deleting old read notifications (30+ days)")

	queries := models.New(s.DB)

	err := queries.DeleteOldNotifications(ctx)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to delete old notifications")
		return fmt.Errorf("failed to delete old notifications: %w", err)
	}

	s.Logger.Info(ctx, "Old notifications cleanup completed")

	return nil
}

// Helper methods for specific notification types

// NotifyPrivateMessage creates a notification for a new private message.
func (s *NotificationService) NotifyPrivateMessage(ctx context.Context, recipientUserID int32, messageID int32, gameID int32, conversationID int32, senderCharacterName string) error {
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      recipientUserID,
		GameID:      &gameID,
		Type:        core.NotificationTypePrivateMessage,
		Title:       fmt.Sprintf("New message from %s", senderCharacterName),
		RelatedType: stringPtr("message"),
		RelatedID:   &messageID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d?tab=messages&conversation=%d", gameID, conversationID)),
	})
	return err
}

// NotifyCommentReply creates a notification when someone replies to a comment.
func (s *NotificationService) NotifyCommentReply(ctx context.Context, originalCommentAuthorID int32, replyID int32, gameID int32, replierCharacterName string) error {
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      originalCommentAuthorID,
		GameID:      &gameID,
		Type:        core.NotificationTypeCommentReply,
		Title:       fmt.Sprintf("%s replied to your comment", replierCharacterName),
		RelatedType: stringPtr("comment"),
		RelatedID:   &replyID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d?tab=common-room&comment=%d", gameID, replyID)),
	})
	return err
}

// NotifyCharacterMention creates a notification when a character is mentioned in a comment.
func (s *NotificationService) NotifyCharacterMention(ctx context.Context, characterOwnerID int32, commentID int32, gameID int32, mentioningCharacterName string, mentionedCharacterName string) error {
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      characterOwnerID,
		GameID:      &gameID,
		Type:        core.NotificationTypeCharacterMention,
		Title:       fmt.Sprintf("%s mentioned %s", mentioningCharacterName, mentionedCharacterName),
		RelatedType: stringPtr("comment"),
		RelatedID:   &commentID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d?tab=common-room&comment=%d", gameID, commentID)),
	})
	return err
}

// NotifyActionSubmitted creates a notification for the GM when a player submits an action.
func (s *NotificationService) NotifyActionSubmitted(ctx context.Context, gmUserID int32, actionID int32, gameID int32, characterName string) error {
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      gmUserID,
		GameID:      &gameID,
		Type:        core.NotificationTypeActionSubmitted,
		Title:       fmt.Sprintf("%s submitted an action", characterName),
		RelatedType: stringPtr("action"),
		RelatedID:   &actionID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d?tab=actions", gameID)),
	})
	return err
}

// NotifyActionResult creates a notification for a player when the GM publishes an action result.
func (s *NotificationService) NotifyActionResult(ctx context.Context, playerUserID int32, resultID int32, gameID int32, actionTitle string) error {
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      playerUserID,
		GameID:      &gameID,
		Type:        core.NotificationTypeActionResult,
		Title:       fmt.Sprintf("Action result: %s", actionTitle),
		RelatedType: stringPtr("action_result"),
		RelatedID:   &resultID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d?tab=actions", gameID)),
	})
	return err
}

// NotifyCommonRoomPost creates a notification for game participants about a new common room post.
func (s *NotificationService) NotifyCommonRoomPost(ctx context.Context, gameID int32, postID int32, postTitle string, excludeUserID int32) error {
	queries := models.New(s.DB)

	// Use bulk query to notify all participants except the poster
	err := queries.NotifyGameParticipants(ctx, models.NotifyGameParticipantsParams{
		GameID:      toPgInt4(&gameID),
		Type:        core.NotificationTypeCommonRoomPost,
		Title:       fmt.Sprintf("New post: %s", postTitle),
		Content:     pgtype.Text{Valid: false},
		RelatedType: toPgText(stringPtr("post")),
		RelatedID:   toPgInt4(&postID),
		LinkUrl:     toPgText(stringPtr(fmt.Sprintf("/games/%d?tab=common-room", gameID))),
		UserID:      excludeUserID,
	})

	if err != nil {
		return fmt.Errorf("failed to notify game participants: %w", err)
	}

	return nil
}

// NotifyPhaseCreated creates a notification for game participants about a new phase.
func (s *NotificationService) NotifyPhaseCreated(ctx context.Context, gameID int32, phaseID int32, phaseTitle string, excludeUserID int32) error {
	queries := models.New(s.DB)

	err := queries.NotifyGameParticipants(ctx, models.NotifyGameParticipantsParams{
		GameID:      toPgInt4(&gameID),
		Type:        core.NotificationTypePhaseCreated,
		Title:       fmt.Sprintf("New phase: %s", phaseTitle),
		Content:     pgtype.Text{Valid: false},
		RelatedType: toPgText(stringPtr("phase")),
		RelatedID:   toPgInt4(&phaseID),
		LinkUrl:     toPgText(stringPtr(fmt.Sprintf("/games/%d?tab=phases", gameID))),
		UserID:      excludeUserID,
	})

	if err != nil {
		return fmt.Errorf("failed to notify game participants: %w", err)
	}

	return nil
}

// NotifyApplicationStatusChange creates a notification when a game application is approved or rejected.
func (s *NotificationService) NotifyApplicationStatusChange(ctx context.Context, playerUserID int32, gameID int32, gameTitle string, approved bool) error {
	var notifType string
	var title string

	if approved {
		notifType = core.NotificationTypeApplicationApproved
		title = fmt.Sprintf("Application approved for %s", gameTitle)
	} else {
		notifType = core.NotificationTypeApplicationRejected
		title = fmt.Sprintf("Application rejected for %s", gameTitle)
	}

	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      playerUserID,
		GameID:      &gameID,
		Type:        notifType,
		Title:       title,
		RelatedType: stringPtr("game"),
		RelatedID:   &gameID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d", gameID)),
	})
	return err
}

// NotifyCharacterStatusChange creates a notification when a character is approved or rejected.
func (s *NotificationService) NotifyCharacterStatusChange(ctx context.Context, playerUserID int32, gameID int32, characterID int32, characterName string, approved bool) error {
	var notifType string
	var title string

	if approved {
		notifType = core.NotificationTypeCharacterApproved
		title = fmt.Sprintf("Character approved: %s", characterName)
	} else {
		notifType = core.NotificationTypeCharacterRejected
		title = fmt.Sprintf("Character needs revision: %s", characterName)
	}

	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      playerUserID,
		GameID:      &gameID,
		Type:        notifType,
		Title:       title,
		RelatedType: stringPtr("character"),
		RelatedID:   &characterID,
		LinkURL:     stringPtr(fmt.Sprintf("/games/%d?tab=characters", gameID)),
	})
	return err
}

// Helper function for creating string pointers
func stringPtr(s string) *string {
	return &s
}
