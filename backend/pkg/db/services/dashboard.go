package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DashboardService handles dashboard data aggregation and business logic
type DashboardService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

// Ensure DashboardService implements the interface
var _ core.DashboardServiceInterface = (*DashboardService)(nil)

// GetUserDashboard retrieves complete dashboard data for a user
func (s *DashboardService) GetUserDashboard(ctx context.Context, userID int32) (*core.DashboardData, error) {
	q := db.New(s.DB)

	// Check if user has any games
	gameCount, err := q.CountUserGames(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to count user games", "user_id", userID)
		return nil, err
	}

	dashboard := &core.DashboardData{
		UserID:            userID,
		HasGames:          gameCount > 0,
		PlayerGames:       []*core.DashboardGameCard{},
		GMGames:           []*core.DashboardGameCard{},
		MixedRoleGames:    []*core.DashboardGameCard{},
		RecentMessages:    []*core.DashboardMessage{},
		UpcomingDeadlines: []*core.DashboardDeadline{},
	}

	// If no games, return early
	if !dashboard.HasGames {
		return dashboard, nil
	}

	// Get games with enriched metadata
	dbGames, err := q.GetUserDashboardGames(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get dashboard games", "user_id", userID)
		return nil, err
	}

	// Transform and group games by role
	dashboard.PlayerGames, dashboard.GMGames, dashboard.MixedRoleGames = groupGamesByRole(dbGames)

	// Get recent messages (limit 5)
	dbMessages, err := q.GetUserRecentMessages(ctx, db.GetUserRecentMessagesParams{
		UserID: userID,
		Limit:  5,
	})
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get recent messages", "user_id", userID)
		return nil, err
	}

	// Transform messages
	dashboard.RecentMessages = transformMessages(dbMessages)

	// Get upcoming deadlines (limit 10)
	dbDeadlines, err := q.GetUserUpcomingDeadlines(ctx, db.GetUserUpcomingDeadlinesParams{
		UserID: userID,
		Limit:  10,
	})
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get upcoming deadlines", "user_id", userID)
		return nil, err
	}

	// Transform deadlines
	dashboard.UpcomingDeadlines = transformDeadlines(dbDeadlines)

	// Get unread notification count
	unreadCount, err := q.GetDashboardUnreadCount(ctx, userID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get unread notification count", "user_id", userID)
		return nil, err
	}
	dashboard.UnreadNotifications = int(unreadCount)

	return dashboard, nil
}

// groupGamesByRole groups games into player, GM, and mixed role categories
func groupGamesByRole(dbGames []db.GetUserDashboardGamesRow) (
	playerGames []*core.DashboardGameCard,
	gmGames []*core.DashboardGameCard,
	mixedGames []*core.DashboardGameCard,
) {
	// Initialize slices to ensure they serialize as [] not null
	playerGames = make([]*core.DashboardGameCard, 0)
	gmGames = make([]*core.DashboardGameCard, 0)
	mixedGames = make([]*core.DashboardGameCard, 0)

	for _, game := range dbGames {
		card := transformGameCard(game)

		// Determine role grouping
		switch card.UserRole {
		case "player":
			playerGames = append(playerGames, card)
		case "gm", "co_gm":
			card.UserRole = "gm" // Normalize co_gm to gm
			gmGames = append(gmGames, card)
		default:
			// If role is something else (future: both player and gm), put in mixed
			mixedGames = append(mixedGames, card)
		}
	}

	return
}

// transformGameCard converts database row to domain model with business logic
func transformGameCard(game db.GetUserDashboardGamesRow) *core.DashboardGameCard {
	card := &core.DashboardGameCard{
		GameID:              game.ID,
		Title:               game.Title,
		State:               stringValue(game.State),
		Genre:               ptrStringValue(game.Genre),
		GMUserID:            game.GmUserID,
		GMUsername:          stringValue(game.GmUsername),
		UserRole:            game.UserRole,
		HasPendingAction:    game.HasPendingAction,
		PendingApplications: int(game.PendingApplicationsCount),
		UnreadMessages:      int(game.UnreadNotificationsCount),
		UpdatedAt:           game.UpdatedAt.Time,
		CreatedAt:           game.CreatedAt.Time,
	}

	// Set description (optional field)
	if game.Description.Valid {
		desc := game.Description.String
		card.Description = &desc
	}

	// Set current phase information
	if game.CurrentPhaseID.Valid {
		phaseID := game.CurrentPhaseID.Int32
		card.CurrentPhaseID = &phaseID
	}

	if game.CurrentPhaseType.Valid {
		phaseType := game.CurrentPhaseType.String
		card.CurrentPhaseType = &phaseType
	}

	if game.CurrentPhaseTitle.Valid {
		phaseTitle := game.CurrentPhaseTitle.String
		card.CurrentPhaseTitle = &phaseTitle
	}

	if game.CurrentPhaseDeadline.Valid {
		deadline := game.CurrentPhaseDeadline.Time
		card.CurrentPhaseDeadline = &deadline

		// Calculate deadline status and urgency
		card.DeadlineStatus = core.CalculateDeadlineStatus(deadline)
		card.IsUrgent = core.IsGameUrgent(game.HasPendingAction, &deadline)
	} else {
		card.DeadlineStatus = "normal"
		card.IsUrgent = false
	}

	return card
}

// transformMessages converts database message rows to domain models.
// Redacts author names for players in anonymous games (GMs and co-GMs retain visibility).
func transformMessages(dbMessages []db.GetUserRecentMessagesRow) []*core.DashboardMessage {
	messages := make([]*core.DashboardMessage, 0, len(dbMessages))

	for _, msg := range dbMessages {
		authorName := msg.AuthorName
		if msg.IsAnonymous && msg.ViewerRole == "player" {
			authorName = ""
		}

		message := &core.DashboardMessage{
			MessageID:   msg.MessageID,
			GameID:      msg.GameID,
			GameTitle:   msg.GameTitle,
			AuthorName:  authorName,
			Content:     core.TruncateContent(msg.Content, 100),
			MessageType: string(msg.MessageType),
			CreatedAt:   msg.CreatedAt.Time,
		}

		// Set optional character name
		if msg.CharacterName.Valid {
			charName := msg.CharacterName.String
			message.CharacterName = &charName
		}

		// Set optional phase ID
		if msg.PhaseID.Valid {
			phaseID := msg.PhaseID.Int32
			message.PhaseID = &phaseID
		}

		messages = append(messages, message)
	}

	return messages
}

// transformDeadlines converts database deadline rows to domain models
func transformDeadlines(dbDeadlines []db.GetUserUpcomingDeadlinesRow) []*core.DashboardDeadline {
	deadlines := make([]*core.DashboardDeadline, 0, len(dbDeadlines))

	for _, dl := range dbDeadlines {
		if !dl.EndTime.Valid {
			continue
		}

		endTime := dl.EndTime.Time
		hoursRemaining := int(time.Until(endTime).Hours())

		deadline := &core.DashboardDeadline{
			PhaseID:              dl.PhaseID,
			GameID:               dl.GameID,
			GameTitle:            dl.GameTitle,
			PhaseType:            dl.PhaseType,
			PhaseTitle:           dl.PhaseTitle,
			PhaseNumber:          dl.PhaseNumber,
			EndTime:              endTime,
			HasPendingSubmission: dl.HasPendingSubmission,
			HoursRemaining:       hoursRemaining,
		}

		deadlines = append(deadlines, deadline)
	}

	return deadlines
}

// Helper functions for nullable fields

func stringValue(v pgtype.Text) string {
	if v.Valid {
		return v.String
	}
	return ""
}

func ptrStringValue(v pgtype.Text) *string {
	if v.Valid {
		s := v.String
		return &s
	}
	return nil
}
