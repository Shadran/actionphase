package phases

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	gamesvc "actionphase/pkg/db/services"
	actionsvc "actionphase/pkg/db/services/actions"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// SubmitAction submits an action during action phase
func (h *Handler) SubmitAction(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_submit_action")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid submit action request")
		return
	}

	data := &SubmitActionRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid submit action request", "error", err)
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}

	// Check if user can submit actions
	canSubmit, err := phaseService.CanUserSubmitActions(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to check action submission permission", "error", err)
		return
	}

	if !canSubmit {
		h.renderError(ctx, w, r, core.ErrForbidden("you cannot submit actions for this game"), "Action submission permission denied", "game_id", gameID, "user_id", authUser.ID)
		return
	}

	// Get active phase
	activePhase, err := phaseService.GetActivePhase(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get active phase", "error", err)
		return
	}

	if activePhase == nil {
		h.renderError(ctx, w, r, core.ErrBadRequest(fmt.Errorf("no active phase for this game")), "Bad submit action request")
		return
	}

	if activePhase.PhaseType != core.PhaseTypeAction {
		h.renderError(ctx, w, r, core.ErrForbidden("actions can only be submitted during an action phase"), "Action submission rejected: not an action phase", "game_id", gameID, "phase_type", activePhase.PhaseType)
		return
	}

	// Submit action
	req := core.SubmitActionRequest{
		GameID:      int32(gameID),
		UserID:      int32(authUser.ID),
		PhaseID:     activePhase.ID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
	}

	action, err := actionService.SubmitAction(ctx, req)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to submit action", "error", err)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			h.renderError(ctx, w, r, core.ErrGameArchived(), "Error in submit action")
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to submit action", "error", err)
		return
	}

	// Notify GM and co-GMs on first-time submission only.
	// submitted_at == updated_at only on insert; edits leave submitted_at unchanged.
	isFirstSubmission := action.SubmittedAt.Valid && action.UpdatedAt.Valid &&
		action.SubmittedAt.Time.Equal(action.UpdatedAt.Time)
	if isFirstSubmission {
		characterName := "Unknown Character"
		if action.CharacterID.Valid {
			var charName string
			if charErr := h.App.Pool.QueryRow(ctx, `SELECT name FROM characters WHERE id = $1`, action.CharacterID.Int32).Scan(&charName); charErr == nil {
				characterName = charName
			}
		}
		go func() {
			notifCtx := context.Background()
			notifSvc := gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)
			if err := notifSvc.NotifyActionSubmitted(notifCtx, action.ID, action.GameID, int32(authUser.ID), characterName); err != nil {
				h.App.ObsLogger.LogError(notifCtx, err, "Failed to notify GM of action submission", "action_id", action.ID)
			}
		}()
	}

	// Convert action model to response format
	var characterID *int32
	if action.CharacterID.Valid {
		characterID = &action.CharacterID.Int32
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, &ActionResponse{
		ID:          action.ID,
		GameID:      action.GameID,
		UserID:      action.UserID,
		PhaseID:     action.PhaseID,
		CharacterID: characterID,
		Content:     action.Content,
		SubmittedAt: action.SubmittedAt.Time,
		UpdatedAt:   action.UpdatedAt.Time,
	})
}

// GetUserActions retrieves user's action submissions for a game
func (h *Handler) GetUserActions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_user_actions")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get user actions request")
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}
	actions, err := actionService.GetUserActions(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get user actions", "error", err)
		return
	}

	// Convert to response format
	var response []ActionWithDetailsResponse
	for _, action := range actions {
		actionResp := ActionWithDetailsResponse{
			ID:          action.ID,
			GameID:      action.GameID,
			UserID:      action.UserID,
			PhaseID:     action.PhaseID,
			Content:     action.Content,
			SubmittedAt: action.SubmittedAt.Time,
			UpdatedAt:   action.UpdatedAt.Time,
			PhaseType:   &action.PhaseType,
			PhaseNumber: &action.PhaseNumber,
		}

		if action.CharacterID.Valid {
			actionResp.CharacterID = &action.CharacterID.Int32
		}

		if action.CharacterName.Valid {
			actionResp.CharacterName = &action.CharacterName.String
		}

		response = append(response, actionResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGameActions retrieves all actions for a game (GM only)
func (h *Handler) GetGameActions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_actions")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get game actions request")
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	// Check permissions
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	canManage, err := phaseService.CanUserManagePhases(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to check phase management permission", "error", err)
		return
	}

	if !canManage {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can view all actions"), "Get game actions forbidden")
		return
	}

	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}
	actions, err := actionService.GetGameActions(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game actions", "error", err)
		return
	}

	// Convert to response format
	var response []ActionWithDetailsResponse
	for _, action := range actions {
		actionResp := ActionWithDetailsResponse{
			ID:          action.ID,
			GameID:      action.GameID,
			UserID:      action.UserID,
			PhaseID:     action.PhaseID,
			Content:     action.Content,
			SubmittedAt: action.SubmittedAt.Time,
			UpdatedAt:   action.UpdatedAt.Time,
			Username:    action.Username,
			PhaseType:   &action.PhaseType,
			PhaseNumber: &action.PhaseNumber,
		}

		if action.CharacterID.Valid {
			actionResp.CharacterID = &action.CharacterID.Int32
		}

		if action.CharacterName.Valid {
			actionResp.CharacterName = &action.CharacterName.String
		}

		response = append(response, actionResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
