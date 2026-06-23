package phases

import (
	models "actionphase/pkg/db/models"
)

// convertPhaseToResponse converts a database GamePhase model to a PhaseResponse.
func convertPhaseToResponse(phase *models.GamePhase) *PhaseResponse {
	r := &PhaseResponse{
		ID:          phase.ID,
		GameID:      phase.GameID,
		PhaseType:   phase.PhaseType,
		PhaseNumber: phase.PhaseNumber,
		IsActive:    phase.IsActive.Bool,
		IsPublished: phase.IsPublished,
		CreatedAt:   phase.CreatedAt.Time,
	}

	if phase.Title != "" {
		r.Title = &phase.Title
	}

	if phase.Description.Valid && phase.Description.String != "" {
		r.Description = &phase.Description.String
	}

	if phase.StartTime.Valid {
		r.StartTime = &phase.StartTime.Time
	}

	if phase.EndTime.Valid {
		r.EndTime = &phase.EndTime.Time
	}

	if phase.Deadline.Valid {
		r.Deadline = &phase.Deadline.Time
	}

	if phase.ActivatedAt.Valid {
		r.ActivatedAt = &phase.ActivatedAt.Time
	}

	return r
}
