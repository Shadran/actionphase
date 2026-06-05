package phases

import (
	"context"
	"errors"
	"fmt"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// CreatePhase creates a new game phase
func (ps *PhaseService) CreatePhase(ctx context.Context, req core.CreatePhaseRequest) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	// Validate game is not completed/cancelled (archived games are read-only)
	game, err := queries.GetGame(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	if err := core.ValidateGameNotCompleted(ctx, &game); err != nil {
		return nil, err
	}

	// Validate phase type
	isValid := false
	for _, validType := range core.ValidPhaseTypes {
		if req.PhaseType == validType {
			isValid = true
			break
		}
	}
	if !isValid {
		return nil, fmt.Errorf("invalid phase type: %s (must be one of: common_room, action, interlude)", req.PhaseType)
	}

	// Get next phase number
	latestPhaseNum, err := queries.GetLatestPhaseNumber(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phase number: %w", err)
	}

	// Convert interface{} to int32 safely
	var phaseNumber int32 = 1
	if latestPhaseNum != nil {
		switch val := latestPhaseNum.(type) {
		case int32:
			phaseNumber = val + 1
		case int64:
			phaseNumber = int32(val) + 1
		}
	}

	// Convert times to pgtype.Timestamptz
	params := models.CreateGamePhaseParams{
		GameID:      req.GameID,
		PhaseType:   req.PhaseType,
		PhaseNumber: phaseNumber,
		Title:       req.Title,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	}

	// Only set start_time when explicitly provided — it means "auto-activate at this time".
	// NULL = no scheduled activation. activated_at tracks when the phase actually became active.
	if req.StartTime != nil {
		params.StartTime = pgtype.Timestamptz{Time: *req.StartTime, Valid: true}
	}

	if req.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *req.EndTime, Valid: true}
	}

	if req.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *req.Deadline, Valid: true}
	}

	phase, err := queries.CreateGamePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create phase: %w", err)
	}

	return &phase, nil
}

// GetActivePhase retrieves the currently active phase for a game
func (ps *PhaseService) GetActivePhase(ctx context.Context, gameID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.GetActivePhase(ctx, gameID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No active phase
		}
		return nil, fmt.Errorf("failed to get active phase: %w", err)
	}

	return &phase, nil
}

// GetGamePhases retrieves all phases for a game
func (ps *PhaseService) GetGamePhases(ctx context.Context, gameID int32) ([]models.GamePhase, error) {
	queries := models.New(ps.DB)

	phases, err := queries.GetGamePhases(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game phases: %w", err)
	}

	return phases, nil
}

// GetPhase retrieves a specific phase by ID
func (ps *PhaseService) GetPhase(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("phase not found")
		}
		return nil, fmt.Errorf("failed to get phase: %w", err)
	}

	return &phase, nil
}

// UpdatePhase updates an existing phase
func (ps *PhaseService) UpdatePhase(ctx context.Context, req core.UpdatePhaseRequest) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	params := models.UpdatePhaseParams{
		ID:          req.ID,
		Title:       req.Title,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	}

	if req.StartTime != nil {
		params.StartTime = pgtype.Timestamptz{Time: *req.StartTime, Valid: true}
	}
	if req.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *req.EndTime, Valid: true}
	}
	if req.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *req.Deadline, Valid: true}
	}

	phase, err := queries.UpdatePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update phase: %w", err)
	}

	return &phase, nil
}

// DeletePhase deletes a phase if it has no associated content
func (ps *PhaseService) DeletePhase(ctx context.Context, phaseID int32) error {
	// Validate phase can be deleted (no associated content)
	if err := ps.CanDeletePhase(ctx, phaseID); err != nil {
		return err
	}

	queries := models.New(ps.DB)

	// Remove draft posts first (they are not counted by CanDeletePhase and must be cleaned up)
	if err := queries.DeleteDraftPostsForPhase(ctx, pgtype.Int4{Int32: phaseID, Valid: true}); err != nil {
		return fmt.Errorf("failed to delete draft posts for phase: %w", err)
	}

	// Delete the phase
	if err := queries.DeletePhase(ctx, phaseID); err != nil {
		return fmt.Errorf("failed to delete phase: %w", err)
	}

	return nil
}
