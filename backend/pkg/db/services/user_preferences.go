package db

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

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

// PreferencesData represents the structured preferences object
type PreferencesData struct {
	Theme                string          `json:"theme"`                           // "light" | "dark" | "auto"
	CommentReadMode      string          `json:"comment_read_mode"`               // "auto" | "manual"
	DiscordNotifications map[string]bool `json:"discord_notifications,omitempty"` // per-type Discord DM toggles
}

// GetUserPreferences gets user preferences, returning defaults if not found
func (s *UserPreferencesService) GetUserPreferences(ctx context.Context, userID int32) (*PreferencesData, error) {
	prefs, err := s.Queries.GetUserPreferences(ctx, userID)
	if err != nil {
		// Return default preferences if not found
		return &PreferencesData{
			Theme:           "auto",
			CommentReadMode: "manual",
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
