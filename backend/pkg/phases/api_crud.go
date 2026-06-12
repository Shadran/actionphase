package phases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// CreatePhase creates a new game phase (GM only)
func (h *Handler) CreatePhase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_phase")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid create phase request")
		return
	}

	data := &CreatePhaseRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid create phase request", "error", err)
		return
	}

	// Validate phase type
	isValid := false
	for _, validType := range core.ValidPhaseTypes {
		if data.PhaseType == validType {
			isValid = true
			break
		}
	}
	if !isValid {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase type: must be one of common_room, action, interlude")), "Invalid create phase request")
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	// Get game and check GM permissions (considers admin mode)
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game", "error", err)
		return
	}

	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can create phases"), "Phase create permission denied", "game_id", gameID, "user_id", authUser.ID)
		return
	}

	// Create phase
	req := core.CreatePhaseRequest{
		GameID:      int32(gameID),
		PhaseType:   data.PhaseType,
		Title:       data.Title,
		Description: data.Description,
		StartTime:   data.StartTime.ToTimePtr(),
		EndTime:     data.EndTime.ToTimePtr(),
		Deadline:    data.Deadline.ToTimePtr(),
	}

	phase, err := phaseService.CreatePhase(ctx, req)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create phase", "error", err)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			h.renderError(ctx, w, r, core.ErrGameArchived(), "Error in create phase")
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to create phase", "error", err)
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(phase)

	render.Status(r, http.StatusCreated)
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

// GetCurrentPhase retrieves the currently active phase for a game
func (h *Handler) GetCurrentPhase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_current_phase")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get current phase request")
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	phase, err := phaseService.GetActivePhase(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get active phase", "error", err, "game_id", gameID)
		return
	}

	// Convert to response format
	var phaseResponse *PhaseResponse
	if phase != nil {
		response := phaseService.ConvertPhaseToResponse(phase)
		phaseResponse = &PhaseResponse{
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
		}
		// Calculate time remaining and expiry
		phaseResponse.Render(w, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"phase": phaseResponse})
}

// GetGamePhases retrieves all phases for a game
func (h *Handler) GetGamePhases(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_phases")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get game phases request")
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	phases, err := phaseService.GetGamePhases(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game phases", "error", err, "game_id", gameID)
		return
	}

	// Convert to response format
	var response []PhaseResponse
	for _, phase := range phases {
		phaseResp := phaseService.ConvertPhaseToResponse(&phase)
		response = append(response, PhaseResponse{
			ID:          phaseResp.ID,
			GameID:      phaseResp.GameID,
			PhaseType:   phaseResp.PhaseType,
			PhaseNumber: phaseResp.PhaseNumber,
			Title:       phaseResp.Title,
			Description: phaseResp.Description,
			StartTime:   phaseResp.StartTime,
			EndTime:     phaseResp.EndTime,
			Deadline:    phaseResp.Deadline,
			IsActive:    phaseResp.IsActive,
			CreatedAt:   phaseResp.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdatePhaseDeadline extends or changes phase deadline (GM only)
func (h *Handler) UpdatePhaseDeadline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_phase_deadline")()

	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")), "Invalid update phase deadline request")
		return
	}

	data := &UpdateDeadlineRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid update phase deadline request", "error", err)
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
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can update phase deadlines"), "Phase deadline update permission denied", "phase_id", phaseID, "game_id", phase.GameID, "user_id", authUser.ID)
		return
	}

	// Update deadline
	updatedPhase, err := phaseService.ExtendPhaseDeadline(ctx, int32(phaseID), data.Deadline.Time)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to update phase deadline", "error", err)
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(updatedPhase)

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

// UpdatePhase updates phase details (GM only)
func (h *Handler) UpdatePhase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_phase")()

	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")), "Invalid update phase request")
		return
	}

	data := &UpdatePhaseRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid update phase request", "error", err)
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
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can update phases"), "Phase update permission denied", "phase_id", phaseID, "game_id", phase.GameID, "user_id", authUser.ID)
		return
	}

	// Update phase
	req := core.UpdatePhaseRequest{
		ID:        int32(phaseID),
		StartTime: data.StartTime.ToTimePtr(),
		Deadline:  data.Deadline.ToTimePtr(),
	}

	if data.Title != nil {
		req.Title = *data.Title
	}

	if data.Description != nil {
		req.Description = *data.Description
	}

	updatedPhase, err := phaseService.UpdatePhase(ctx, req)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to update phase", "error", err)
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(updatedPhase)

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

// DeletePhase deletes a phase if it has no associated content (GM only)
func (h *Handler) DeletePhase(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_phase")()

	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")), "Invalid delete phase request")
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
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can delete phases"), "Phase delete permission denied", "phase_id", phaseID, "game_id", phase.GameID, "user_id", authUser.ID)
		return
	}

	// Delete phase (validation happens in service layer)
	if err := phaseService.DeletePhase(ctx, int32(phaseID)); err != nil {
		h.renderError(ctx, w, r, core.ErrBadRequest(err), "Failed to delete phase", "error", err)
		return
	}

	// Return 204 No Content on success
	w.WriteHeader(http.StatusNoContent)
}
