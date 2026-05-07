package actions

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	"actionphase/pkg/observability"
)

// ActionSubmissionService implements the ActionSubmissionServiceInterface for action submission management.
type ActionSubmissionService struct {
	DB                  *pgxpool.Pool
	Logger              *observability.Logger
	NotificationService core.NotificationServiceInterface
}

// Compile-time verification that ActionSubmissionService implements ActionSubmissionServiceInterface
var _ core.ActionSubmissionServiceInterface = (*ActionSubmissionService)(nil)

// Request/Response types for action submission management

type ActionSubmissionRequest struct {
	GameID      int32
	UserID      int32
	PhaseID     int32
	CharacterID *int32
	Content     string
}

type ActionResponse struct {
	ID          int32     `json:"id"`
	GameID      int32     `json:"game_id"`
	UserID      int32     `json:"user_id"`
	PhaseID     int32     `json:"phase_id"`
	CharacterID *int32    `json:"character_id,omitempty"`
	Content     string    `json:"content"`
	SubmittedAt time.Time `json:"submitted_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
