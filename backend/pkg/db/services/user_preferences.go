package db

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

var _ core.UserPreferencesServiceInterface = (*UserPreferencesService)(nil)

// UserPreferencesService handles user preferences operations
type UserPreferencesService struct {
	DB      *pgxpool.Pool
	Queries *models.Queries
}

// NewUserPreferencesService creates a new user preferences service
func NewUserPreferencesService(db *pgxpool.Pool) *UserPreferencesService {
	return &UserPreferencesService{
		DB:      db,
		Queries: models.New(db),
	}
}

// PreferencesData is an alias kept for callers that used the old db-package type.
type PreferencesData = core.PreferencesData

// GetUserPreferences gets user preferences, returning defaults if not found
func (s *UserPreferencesService) GetUserPreferences(ctx context.Context, userID int32) (*PreferencesData, error) {
	prefs, err := s.Queries.GetUserPreferences(ctx, userID)
	if err != nil {
		// Return default preferences if not found
		return &PreferencesData{
			Theme:           "auto",
			CommentReadMode: "manual",
			FontSize:        "medium",
		}, nil
	}

	// Parse JSONB into PreferencesData
	var data PreferencesData
	if err := json.Unmarshal(prefs.Preferences, &data); err != nil {
		return nil, fmt.Errorf("failed to parse preferences: %w", err)
	}

	// Apply defaults for any missing fields
	if data.Theme == "" {
		data.Theme = "auto"
	}
	if data.CommentReadMode == "" {
		data.CommentReadMode = "manual"
	}
	if data.FontSize == "" {
		data.FontSize = "medium"
	}

	return &data, nil
}

// UpdateUserPreferences updates or creates user preferences
func (s *UserPreferencesService) UpdateUserPreferences(ctx context.Context, userID int32, prefs PreferencesData) (*PreferencesData, error) {
	// Apply defaults before validation so callers only need to specify fields they care about
	if prefs.Theme == "" {
		prefs.Theme = "auto"
	}
	if prefs.CommentReadMode == "" {
		prefs.CommentReadMode = "manual"
	}
	if prefs.FontSize == "" {
		prefs.FontSize = "medium"
	}

	// Validate theme value
	validThemes := map[string]bool{"light": true, "dark": true, "auto": true}
	if !validThemes[prefs.Theme] {
		return nil, fmt.Errorf("invalid theme value: must be 'light', 'dark', or 'auto'")
	}

	// Validate comment_read_mode value
	validReadModes := map[string]bool{"auto": true, "manual": true}
	if !validReadModes[prefs.CommentReadMode] {
		return nil, fmt.Errorf("invalid comment_read_mode value: must be 'auto' or 'manual'")
	}

	// Validate font_size value
	validFontSizes := map[string]bool{"small": true, "medium": true, "large": true}
	if !validFontSizes[prefs.FontSize] {
		return nil, fmt.Errorf("invalid font_size value: must be 'small', 'medium', or 'large'")
	}

	// Validate discord_notifications keys (if provided)
	if prefs.DiscordNotifications != nil {
		for k := range prefs.DiscordNotifications {
			if !core.IsValidNotificationType(k) {
				return nil, fmt.Errorf("invalid discord notification type: %q", k)
			}
		}
	}

	// Marshal preferences to JSONB
	jsonData, err := json.Marshal(prefs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal preferences: %w", err)
	}

	// Upsert preferences
	_, err = s.Queries.UpsertUserPreferences(ctx, models.UpsertUserPreferencesParams{
		UserID:      userID,
		Preferences: jsonData,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert preferences: %w", err)
	}

	return &prefs, nil
}
