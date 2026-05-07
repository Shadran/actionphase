package phases

import (
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	"actionphase/pkg/observability"
)

// PhaseService implements the PhaseServiceInterface for game phase management.
type PhaseService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

// Compile-time verification that PhaseService implements PhaseServiceInterface
var _ core.PhaseServiceInterface = (*PhaseService)(nil)

// Request/Response types for phase management

type CreatePhaseRequest struct {
	GameID    int32
	PhaseType string // "common_room" or "action"
	StartTime *time.Time
	EndTime   *time.Time
	Deadline  *time.Time
}

type PhaseResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	PhaseType   string     `json:"phase_type"`
	PhaseNumber int32      `json:"phase_number"`
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	StartTime   *time.Time `json:"start_time,omitempty"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	IsActive    bool       `json:"is_active"`
	IsPublished bool       `json:"is_published"`
	CreatedAt   time.Time  `json:"created_at"`
}
