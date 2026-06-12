package phases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	gamesvc "actionphase/pkg/db/services"
	actionsvc "actionphase/pkg/db/services/actions"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// ActivatePhase activates a phase (GM only)
func (h *Handler) ActivatePhase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_activate_phase")()

	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")), "Invalid activate phase request")
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Get phase to check game ID
	phase, err := phaseService.GetPhase(ctx, int32(phaseID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get phase", "error", err)
		return
	}

	// Get game and check GM permissions (considers admin mode)
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, phase.GameID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game", "error", err)
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can activate phases"), "Activate phase forbidden")
		return
	}

	// Activate phase
	err = phaseService.ActivatePhase(ctx, int32(phaseID), authUser.ID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to activate phase", "error", err)
		return
	}

	// Get the updated phase after activation
	activePhase, err := phaseService.GetPhase(ctx, int32(phaseID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get activated phase", "error", err)
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(activePhase)

	render.Render(w, r, &PhaseResponse{
		ID:          response.ID,
		GameID:      response.GameID,
		PhaseType:   response.PhaseType,
		PhaseNumber: response.PhaseNumber,
		Title:       response.Title,
		Description: response.Description,
		StartTime:   response.StartTime,
		EndTime:     response.EndTime,
		Deadline:    response.Deadline,
		IsActive:    response.IsActive,
		CreatedAt:   response.CreatedAt,
	})
}

// PublishAllPhaseResults publishes all unpublished results for a phase (GM only)
func (h *Handler) PublishAllPhaseResults(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_publish_all_phase_results")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid publish all phase results request")
		return
	}

	phaseIDStr := chi.URLParam(r, "phaseId")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")), "Invalid publish all phase results request")
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	// Get game and check GM permissions (considers admin mode)
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game", "error", err)
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can publish action results"), "Publish all phase results forbidden")
		return
	}

	// Publish all unpublished results for the phase
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}
	err = actionService.PublishAllPhaseResults(ctx, int32(phaseID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to publish all phase results", "error", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "All results published successfully",
	})
}

// GetUnpublishedResultsCount retrieves the count of unpublished results for a phase (GM only)
func (h *Handler) GetUnpublishedResultsCount(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_unpublished_results_count")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get unpublished results count request")
		return
	}

	phaseIDStr := chi.URLParam(r, "phaseId")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")), "Invalid get unpublished results count request")
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	// Get game and check GM permissions (considers admin mode)
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game", "error", err)
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can view result counts"), "Get unpublished results count forbidden")
		return
	}

	// Get count of unpublished results
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}
	count, err := actionService.GetUnpublishedResultsCount(ctx, int32(phaseID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get unpublished results count", "error", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": count,
	})
}
