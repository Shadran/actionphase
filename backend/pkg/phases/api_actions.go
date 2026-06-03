package phases

import (
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
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &SubmitActionRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}

	// Check if user can submit actions
	canSubmit, err := phaseService.CanUserSubmitActions(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check action submission permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canSubmit {
		render.Render(w, r, core.ErrForbidden("you cannot submit actions for this game"))
		return
	}

	// Get active phase
	activePhase, err := phaseService.GetActivePhase(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get active phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if activePhase == nil {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("no active phase for this game")))
		return
	}

	// Submit action
	req := core.SubmitActionRequest{
		GameID:      int32(gameID),
		UserID:      int32(authUser.ID),
		PhaseID:     activePhase.ID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		IsDraft:     data.IsDraft,
	}

	action, err := actionService.SubmitAction(ctx, req)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to submit action", "error", err)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Notify GM when a player submits an action (not a draft)
	if !data.IsDraft {
		gameService := &gamesvc.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
		game, gameErr := gameService.GetGame(ctx, int32(gameID))
		if gameErr == nil {
			// Get character name if available
			characterName := "Unknown Character"
			if action.CharacterID.Valid {
				var charName string
				charQuery := `SELECT name FROM characters WHERE id = $1`
				if charErr := h.App.Pool.QueryRow(ctx, charQuery, action.CharacterID.Int32).Scan(&charName); charErr == nil {
					characterName = charName
				}
			}

			// Create notification content
			content := fmt.Sprintf("%s has submitted an action for the current phase", characterName)
			linkURL := fmt.Sprintf("/games/%d?tab=actions", gameID)
			relatedType := "action_submission"
			notificationService := gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)
			_, notifErr := notificationService.CreateNotification(ctx, &core.CreateNotificationRequest{
				UserID:      game.GmUserID,
				GameID:      &action.GameID,
				Type:        core.NotificationTypeActionSubmitted,
				Title:       "New Action Submitted",
				Content:     &content,
				RelatedType: &relatedType,
				RelatedID:   &action.ID,
				LinkURL:     &linkURL,
			})
			if notifErr != nil {
				// Log error but don't fail the submission
				h.App.ObsLogger.LogError(ctx, notifErr, "Failed to create GM notification for action submission",
					"action_id", action.ID,
					"gm_user_id", game.GmUserID,
				)
			}
		}
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
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}
	actions, err := actionService.GetUserActions(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user actions", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
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
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.App.ObsLogger.Error(ctx, "No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Check permissions
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	canManage, err := phaseService.CanUserManagePhases(ctx, int32(gameID), int32(authUser.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can view all actions"))
		return
	}

	actionService := &actionsvc.ActionSubmissionService{DB: h.App.Pool, Logger: h.App.ObsLogger, NotificationService: gamesvc.NewNotificationService(h.App.Pool, h.App.ObsLogger)}
	actions, err := actionService.GetGameActions(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game actions", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
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
