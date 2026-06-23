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
