package users

import (
	"context"
	"fmt"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserProfileService implements user profile management.
// Handles profile retrieval, updates, and game history with privacy filtering.
type UserProfileService struct {
	DB *pgxpool.Pool
}

// Compile-time verification that UserProfileService implements UserProfileServiceInterface
var _ core.UserProfileServiceInterface = (*UserProfileService)(nil)

// GetUserProfile retrieves a user's profile information including game history with pagination.
// Returns the user profile, paginated list of games with privacy filtering applied, and pagination metadata.
func (s *UserProfileService) GetUserProfile(ctx context.Context, userID int32, page, pageSize int) (*core.UserProfileResponse, error) {
	queries := db.New(s.DB)

	// Validate and set defaults for pagination
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 12 // Default page size for game history
	}

	// Get user profile
	user, err := queries.GetUserProfile(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user profile: %w", err)
	}

	// Calculate limit and offset
	limit := int32(pageSize)
	offset := int32((page - 1) * pageSize)

	// Get user's game history with pagination
	games, err := s.GetUserGames(ctx, userID, int(limit), int(offset))
	if err != nil {
		return nil, fmt.Errorf("failed to get user games: %w", err)
	}

	// Get total count of games
	totalCount, err := queries.CountUserProfileGames(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to count user games: %w", err)
	}

	// Calculate pagination metadata
	totalPages := (int(totalCount) + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}

	metadata := core.UserGameHistoryMetadata{
		Page:            page,
		PageSize:        pageSize,
		TotalPages:      totalPages,
		TotalCount:      int(totalCount),
		HasNextPage:     page < totalPages,
		HasPreviousPage: page > 1,
	}

	// Convert to response type
	response := &core.UserProfileResponse{
		User: core.UserProfile{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: nullTextToPtr(user.DisplayName),
			Bio:         nullTextToPtr(user.Bio),
			AvatarURL:   nullTextToPtr(user.AvatarUrl),
			CreatedAt:   user.CreatedAt.Time,
			Timezone:    user.Timezone.String,
			IsAdmin:     user.IsAdmin.Bool,
		},
		Games:    games,
		Metadata: metadata,
	}

	return response, nil
}

// GetUserGames retrieves games a user has participated in with pagination.
// Applies privacy filtering for anonymous games (hides character details).
// Groups multiple characters per game into a single game entry.
func (s *UserProfileService) GetUserGames(ctx context.Context, userID int32, limit, offset int) ([]core.UserGame, error) {
	queries := db.New(s.DB)

	// Query returns one row per character, so we need to group by game
	rows, err := queries.GetUserGames(ctx, db.GetUserGamesParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to query user games: %w", err)
	}

	// Group rows by game_id
	gameMap := make(map[int32]*core.UserGame)
	for _, row := range rows {
		game, exists := gameMap[row.GameID]
		if !exists {
			// First time seeing this game, create entry
			game = &core.UserGame{
				GameID:      row.GameID,
				Title:       row.Title,
				State:       row.State.String,
				IsAnonymous: row.IsAnonymous,
				UserRole:    row.UserRole,
				GMUsername:  row.GmUsername,
				CreatedAt:   row.CreatedAt.Time,
				UpdatedAt:   row.UpdatedAt.Time,
				Characters:  []core.UserGameCharacter{},
			}
			gameMap[row.GameID] = game
		}

		// Add character if not anonymous and character exists
		if !row.IsAnonymous && row.CharacterID != nil {
			// Convert interface{} to proper types
			if charID, ok := row.CharacterID.(int32); ok {
				character := core.UserGameCharacter{
					ID: charID,
				}

				// Name
				if row.CharacterName != nil {
					if name, ok := row.CharacterName.(string); ok {
						character.Name = name
					}
				}

				// Avatar URL
				if row.CharacterAvatarUrl != nil {
					if avatarURL, ok := row.CharacterAvatarUrl.(string); ok {
						character.AvatarURL = &avatarURL
					}
				}

				// Character type
				if row.CharacterType != nil {
					if charType, ok := row.CharacterType.(string); ok {
						character.CharacterType = charType
					}
				}

				game.Characters = append(game.Characters, character)
			}
		}
	}

	// Convert map to slice
	games := make([]core.UserGame, 0, len(gameMap))
	for _, game := range gameMap {
		games = append(games, *game)
	}

	return games, nil
}

// UpdateUserProfile updates a user's display name and/or bio.
// Nil values are ignored (fields not updated).
func (s *UserProfileService) UpdateUserProfile(ctx context.Context, userID int32, displayName *string, bio *string) error {
	queries := db.New(s.DB)

	// Convert nil to NULL for COALESCE in SQL
	var displayNameParam, bioParam pgtype.Text

	if displayName != nil {
		displayNameParam = pgtype.Text{String: *displayName, Valid: true}
	}

	if bio != nil {
		bioParam = pgtype.Text{String: *bio, Valid: true}
	}

	err := queries.UpdateUserProfile(ctx, db.UpdateUserProfileParams{
		ID:          userID,
		DisplayName: displayNameParam,
		Bio:         bioParam,
	})

	if err != nil {
		return fmt.Errorf("failed to update user profile: %w", err)
	}

	return nil
}

// Helper functions

// nullTextToPtr converts a pgtype.Text to a string pointer.
// Returns nil if the value is NULL.
func nullTextToPtr(nt pgtype.Text) *string {
	if !nt.Valid {
		return nil
	}
	return &nt.String
}
