package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// ApplyToGame allows a user to apply to join a game as a player or audience
func (h *Handler) ApplyToGame(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_apply_to_game")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid apply to game request")
		return
	}

	data := &ApplyToGameRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid apply to game request", "error", err, "game_id", gameID)
		return
	}

	// Validate role
	if errResp := ValidateGameRole(data.Role); errResp != nil {
		h.renderError(ctx, w, r, errResp, "Request rejected in apply to game")
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int32(authUser.ID)
	applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Create the application
	application, err := applicationService.CreateGameApplication(ctx, core.CreateGameApplicationRequest{
		GameID:  int32(gameID),
		UserID:  userID,
		Role:    data.Role,
		Message: data.Message,
	})
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create game application", "error", err, "game_id", gameID, "user_id", userID)

		// Check for specific error types to provide better responses
		if fmt.Sprintf("%v", err) == "user already has a pending application for this game" {
			h.renderError(ctx, w, r, core.ErrBadRequest(err), "Bad apply to game request", "error", err)
			return
		}
		if fmt.Sprintf("%v", err) == "user is already a participant in this game" {
			h.renderError(ctx, w, r, core.ErrBadRequest(err), "Bad apply to game request", "error", err)
			return
		}
		if fmt.Sprintf("%v", err) == "game is not currently recruiting" {
			h.renderError(ctx, w, r, core.ErrBadRequest(err), "Bad apply to game request", "error", err)
			return
		}

		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to apply to game", "error", err)
		return
	}

	// Get the game to find the GM
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err == nil {
		// Auto-accept audience applications if setting is enabled
		if data.Role == core.RoleAudience && game.AutoAcceptAudience {
			// Auto-approve the application (creates participant immediately)
			approveErr := applicationService.ApproveGameApplication(ctx, application.ID, game.GmUserID)
			if approveErr != nil {
				h.App.ObsLogger.LogError(ctx, approveErr, "Failed to auto-approve audience application",
					"application_id", application.ID, "user_id", userID, "game_id", gameID)
				// Don't fail the request - application still created as pending
			} else {
				// Delete the application record since user is now a participant
				// This prevents confusion - approved audience members should only exist as participants
				deleteErr := applicationService.DeleteGameApplication(ctx, application.ID, userID)
				if deleteErr != nil {
					h.App.ObsLogger.LogError(ctx, deleteErr, "Failed to delete application after auto-accept",
						"application_id", application.ID, "user_id", userID, "game_id", gameID)
					// Don't fail - participant is created, we can clean up application later
				}

				// Send approval notification to the applicant
				notificationService := db.NewNotificationService(h.App.Pool, h.App.ObsLogger)
				title := fmt.Sprintf("Joined %s", game.Title)
				content := fmt.Sprintf("You have joined %s as an audience member!", game.Title)
				linkURL := fmt.Sprintf("/games/%d", gameID)
				relatedType := core.TableGameParticipants
				_, notifErr := notificationService.CreateNotification(ctx, &core.CreateNotificationRequest{
					UserID:      userID,
					GameID:      &application.GameID,
					Type:        core.NotificationTypeApplicationApproved,
					Title:       title,
					Content:     &content,
					RelatedType: &relatedType,
					RelatedID:   &application.GameID, // Link to game instead of deleted application
					LinkURL:     &linkURL,
				})
				if notifErr != nil {
					// Log error but don't fail the request
					h.App.ObsLogger.LogError(ctx, notifErr, "Failed to send auto-approval notification",
						"user_id", userID, "game_id", gameID)
				}
			}
		}

		notificationService := db.NewNotificationService(h.App.Pool, h.App.ObsLogger)
		roleLabel := "player"
		if data.Role == "audience" {
			roleLabel = "audience member"
		}
		title := fmt.Sprintf("New %s application for %s", roleLabel, game.Title)
		content := fmt.Sprintf("%s applied to join your game as a %s", authUser.Username, roleLabel)
		linkURL := fmt.Sprintf("/games/%d?tab=applications", gameID)
		relatedType := core.TableGameApplications

		_, err = notificationService.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID:      game.GmUserID,
			GameID:      &application.GameID,
			Type:        core.NotificationTypeApplicationSubmitted,
			Title:       title,
			Content:     &content,
			RelatedType: &relatedType,
			RelatedID:   &application.ID,
			LinkURL:     &linkURL,
		})
		if err != nil {
			// Log error but don't fail the request
			h.App.ObsLogger.Error(ctx, "Failed to create notification for GM", "error", err, "game_id", gameID, "gm_user_id", game.GmUserID)
		}
	}

	// Convert to response format
	response := &GameApplicationResponse{
		ID:        application.ID,
		GameID:    application.GameID,
		UserID:    application.UserID,
		Username:  authUser.Username,
		Role:      application.Role,
		Status:    application.Status.String,
		AppliedAt: application.AppliedAt.Time,
	}

	if application.Message.Valid {
		response.Message = application.Message.String
	}
	if application.ReviewedAt.Valid {
		reviewedAt := application.ReviewedAt.Time
		response.ReviewedAt = &reviewedAt
	}
	if application.ReviewedByUserID.Valid {
		reviewedByUserID := application.ReviewedByUserID.Int32
		response.ReviewedByUserID = &reviewedByUserID
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetGameApplications retrieves all applications for a game (GM only)
func (h *Handler) GetGameApplications(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_applications")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get game applications request")
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	// Verify user is GM of this game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game for permission check", "error", err, "game_id", gameID)
		return
	}

	// Check GM permissions (considers admin mode)
	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can view game applications"), "Get game applications forbidden")
		return
	}

	// Get applications for the game
	applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	applications, err := applicationService.GetGameApplications(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game applications", "error", err, "game_id", gameID)
		return
	}

	// Convert to response format
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, app := range applications {
		appData := map[string]interface{}{
			"id":       app.ID,
			"game_id":  app.GameID,
			"user_id":  app.UserID,
			"username": app.Username,
			// Note: Email is intentionally omitted for privacy
			"role":       app.Role,
			"status":     app.Status,
			"applied_at": app.AppliedAt.Time,
		}

		if app.AvatarUrl.Valid {
			appData["avatar_url"] = app.AvatarUrl.String
		}
		if app.Message.Valid {
			appData["message"] = app.Message.String
		}
		if app.ReviewedAt.Valid {
			appData["reviewed_at"] = app.ReviewedAt.Time
		}
		if app.ReviewedByUserID.Valid {
			appData["reviewed_by_user_id"] = app.ReviewedByUserID.Int32
		}

		response = append(response, appData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ReviewGameApplication approves or rejects a game application (GM only)
func (h *Handler) ReviewGameApplication(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_review_game_application")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid review game application request")
		return
	}

	applicationIDStr := chi.URLParam(r, "applicationId")
	applicationID, err := strconv.ParseInt(applicationIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid application ID")), "Invalid review game application request")
		return
	}

	data := &ReviewApplicationRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid review application request", "error", err, "game_id", gameID, "application_id", applicationID)
		return
	}

	// Validate action
	if errResp := ValidateApplicationAction(data.Action); errResp != nil {
		h.renderError(ctx, w, r, errResp, "Request rejected in review game application")
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	// Verify user is GM of this game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game for permission check", "error", err, "game_id", gameID)
		return
	}

	// Check GM permissions (considers admin mode)
	if !core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool) {
		h.renderError(ctx, w, r, core.ErrForbidden("only the GM can review game applications"), "Review game application forbidden")
		return
	}

	// Verify application belongs to this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	application, err := applicationService.GetGameApplication(ctx, int32(applicationID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game application", "error", err, "application_id", applicationID)
		return
	}

	if application.GameID != int32(gameID) {
		h.renderError(ctx, w, r, core.ErrBadRequest(fmt.Errorf("application does not belong to this game")), "Bad review game application request")
		return
	}

	// Perform the action
	if data.Action == "approve" {
		err = applicationService.ApproveGameApplication(ctx, int32(applicationID), authUser.ID)
	} else {
		err = applicationService.RejectGameApplication(ctx, int32(applicationID), authUser.ID)
	}

	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to review game application", "error", err, "application_id", applicationID, "action", data.Action)
		return
	}

	// Return updated application
	updatedApplication, err := applicationService.GetGameApplication(ctx, int32(applicationID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get updated application", "error", err, "application_id", applicationID)
		return
	}

	response := &GameApplicationResponse{
		ID:        updatedApplication.ID,
		GameID:    updatedApplication.GameID,
		UserID:    updatedApplication.UserID,
		Role:      updatedApplication.Role,
		Status:    updatedApplication.Status.String,
		AppliedAt: updatedApplication.AppliedAt.Time,
	}

	if updatedApplication.Message.Valid {
		response.Message = updatedApplication.Message.String
	}
	if updatedApplication.ReviewedAt.Valid {
		reviewedAt := updatedApplication.ReviewedAt.Time
		response.ReviewedAt = &reviewedAt
	}
	if updatedApplication.ReviewedByUserID.Valid {
		reviewedByUserID := updatedApplication.ReviewedByUserID.Int32
		response.ReviewedByUserID = &reviewedByUserID
	}

	render.Render(w, r, response)
}

// GetMyGameApplication retrieves the current user's application for a game
func (h *Handler) GetMyGameApplication(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_my_game_application")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get my game application request")
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int32(authUser.ID)

	// Find user's application for this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	application, err := applicationService.GetGameApplicationByUserAndGame(ctx, int32(gameID), userID)
	if err != nil {
		// User has no application - return 200 null (expected, not an error)
		render.JSON(w, r, nil)
		return
	}

	// Determine what status to show to the applicant
	// If status hasn't been published, show "pending" regardless of actual status
	displayStatus := application.Status.String
	if !application.IsPublished {
		displayStatus = core.ApplicationStatusPending
	}

	// Convert to response format
	response := &GameApplicationResponse{
		ID:        application.ID,
		GameID:    application.GameID,
		UserID:    application.UserID,
		Role:      application.Role,
		Status:    displayStatus,
		AppliedAt: application.AppliedAt.Time,
	}

	if application.Message.Valid {
		response.Message = application.Message.String
	}
	// Only include review information if status is published
	if application.IsPublished {
		if application.ReviewedAt.Valid {
			reviewedAt := application.ReviewedAt.Time
			response.ReviewedAt = &reviewedAt
		}
		if application.ReviewedByUserID.Valid {
			reviewedByUserID := application.ReviewedByUserID.Int32
			response.ReviewedByUserID = &reviewedByUserID
		}
	}

	render.Render(w, r, response)
}

// GetPublicGameApplicants retrieves the public list of applicants for a game
// No authentication required - available to anyone
// Returns only username and role (no status or review information)
func (h *Handler) GetPublicGameApplicants(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_public_game_applicants")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid get public game applicants request")
		return
	}

	// Verify game is in recruiting state
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game for public applicants", "error", err, "game_id", gameID)
		return
	}

	// Only show applicants when game is recruiting
	if !game.State.Valid || game.State.String != core.GameStateRecruitment {
		h.renderError(ctx, w, r, core.ErrForbidden("applicant list is only visible during recruitment"), "Get public game applicants forbidden")
		return
	}

	// Get public applicants list
	applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	applicants, err := applicationService.GetPublicGameApplicants(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get public game applicants", "error", err, "game_id", gameID)
		return
	}

	// Convert to response format - only username and role, NO status
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, applicant := range applicants {
		applicantData := map[string]interface{}{
			"id":         applicant.ID,
			"username":   applicant.Username,
			"role":       applicant.Role,
			"applied_at": applicant.AppliedAt.Time,
		}
		if applicant.AvatarUrl.Valid {
			applicantData["avatar_url"] = applicant.AvatarUrl.String
		}
		response = append(response, applicantData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// WithdrawGameApplication allows a user to withdraw their own application
func (h *Handler) WithdrawGameApplication(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_withdraw_game_application")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid withdraw game application request")
		return
	}

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int32(authUser.ID)

	// Find user's application for this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	application, err := applicationService.GetGameApplicationByUserAndGame(ctx, int32(gameID), userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("no application found for this game"), "Failed to get user's application", "error", err, "game_id", gameID, "user_id", userID)
		return
	}

	// Only allow withdrawal of pending applications
	if application.Status.String != core.ApplicationStatusPending {
		h.renderError(ctx, w, r, core.ErrBadRequest(fmt.Errorf("can only withdraw pending applications")), "Bad withdraw game application request")
		return
	}

	// Delete the application instead of marking as withdrawn
	// This allows users to reapply if they change their mind
	err = applicationService.DeleteGameApplication(ctx, application.ID, userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete application", "error", err, "application_id", application.ID)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
