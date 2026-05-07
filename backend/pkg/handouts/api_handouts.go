package handouts

import (
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// verifyUserIsGM checks if a user is the GM or Co-GM of a game
// Returns the game if verification succeeds, or an error response if it fails
func (h *Handler) verifyUserIsGM(ctx context.Context, game *models.Game, userID int32) render.Renderer {
	// Get user to check admin status
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(int(userID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get user")
		return core.ErrUnauthorized("User not found")
	}

	// Check if user is GM, Co-GM, or admin with admin mode enabled
	if !core.IsUserGameMasterCtx(ctx, userID, user.IsAdmin, *game, h.App.Pool) {
		h.App.ObsLogger.Warn(ctx, "User is not authorized to manage handouts", "user_id", userID, "game_id", game.ID)
		return core.ErrUnauthorized("Only GM or Co-GM can manage handouts")
	}

	return nil
}

// CreateHandout creates a new handout for a game
func (h *Handler) CreateHandout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_handout")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_create_handout")()

	// Get gameID from URL
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid game ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse request
	data := &CreateHandoutRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind create handout request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Check if user is GM or Co-GM of the game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	if errResp := h.verifyUserIsGM(ctx, game, userID); errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Create handout
	handoutService := &db.HandoutService{DB: h.App.Pool}
	handout, err := handoutService.CreateHandout(ctx, int32(gameID), data.Title, data.Content, data.Status, userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to create handout")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout created successfully", "handout_id", handout.ID, "game_id", gameID)

	response := &HandoutResponse{
		ID:        handout.ID,
		GameID:    handout.GameID,
		Title:     handout.Title,
		Content:   handout.Content,
		Status:    handout.Status,
		CreatedAt: handout.CreatedAt,
		UpdatedAt: handout.UpdatedAt,
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, response)
}

// GetHandout retrieves a specific handout
func (h *Handler) GetHandout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_handout")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_get_handout")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid handout ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get handout (service will check permissions)
	handoutService := &db.HandoutService{DB: h.App.Pool}
	handout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get handout")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	response := &HandoutResponse{
		ID:        handout.ID,
		GameID:    handout.GameID,
		Title:     handout.Title,
		Content:   handout.Content,
		Status:    handout.Status,
		CreatedAt: handout.CreatedAt,
		UpdatedAt: handout.UpdatedAt,
	}

	render.JSON(w, r, response)
}

// ListHandouts lists all handouts for a game
func (h *Handler) ListHandouts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_handouts")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_list_handouts")()

	// Get gameID from URL
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid game ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Check if user is GM
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	// Check if user is GM or Co-GM (they can see draft handouts)
	isGM := game.GmUserID == userID || core.IsUserCoGM(ctx, h.App.Pool, int32(gameID), userID)

	// List handouts
	handoutService := &db.HandoutService{DB: h.App.Pool}
	handouts, err := handoutService.ListHandouts(ctx, int32(gameID), userID, isGM)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to list handouts")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]*HandoutResponse, len(handouts))
	for i, handout := range handouts {
		response[i] = &HandoutResponse{
			ID:        handout.ID,
			GameID:    handout.GameID,
			Title:     handout.Title,
			Content:   handout.Content,
			Status:    handout.Status,
			CreatedAt: handout.CreatedAt,
			UpdatedAt: handout.UpdatedAt,
		}
	}

	render.JSON(w, r, response)
}

// UpdateHandout updates a handout
func (h *Handler) UpdateHandout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_handout")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_update_handout")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid handout ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")))
		return
	}

	// Parse request
	data := &UpdateHandoutRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind update handout request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get existing handout to check ownership
	handoutService := &db.HandoutService{DB: h.App.Pool}
	existingHandout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get handout")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	// Check if user is GM of the game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, existingHandout.GameID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	if errResp := h.verifyUserIsGM(ctx, game, userID); errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Update handout
	handout, err := handoutService.UpdateHandout(ctx, int32(handoutID), data.Title, data.Content, data.Status, userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to update handout")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout updated successfully", "handout_id", handout.ID)

	response := &HandoutResponse{
		ID:        handout.ID,
		GameID:    handout.GameID,
		Title:     handout.Title,
		Content:   handout.Content,
		Status:    handout.Status,
		CreatedAt: handout.CreatedAt,
		UpdatedAt: handout.UpdatedAt,
	}

	render.JSON(w, r, response)
}

// DeleteHandout deletes a handout
func (h *Handler) DeleteHandout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_handout")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_handout")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid handout ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get existing handout to check ownership
	handoutService := &db.HandoutService{DB: h.App.Pool}
	existingHandout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get handout")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	// Check if user is GM of the game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, existingHandout.GameID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	if errResp := h.verifyUserIsGM(ctx, game, userID); errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Delete handout
	err = handoutService.DeleteHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to delete handout")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout deleted successfully", "handout_id", handoutID)

	w.WriteHeader(http.StatusNoContent)
}

// PublishHandout publishes a draft handout
func (h *Handler) PublishHandout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_publish_handout")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_publish_handout")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid handout ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get existing handout to check ownership
	handoutService := &db.HandoutService{DB: h.App.Pool}
	existingHandout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get handout")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	// Check if user is GM of the game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, existingHandout.GameID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	if errResp := h.verifyUserIsGM(ctx, game, userID); errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Publish handout
	handout, err := handoutService.PublishHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to publish handout")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout published successfully", "handout_id", handout.ID)

	// Create notifications for all players in the game
	go func() {
		// Use background context to avoid cancellation when request completes
		notifCtx := context.Background()

		// Get all participants
		participants, err := gameService.GetGameParticipants(notifCtx, handout.GameID)
		if err != nil {
			h.App.ObsLogger.LogError(notifCtx, err, "Failed to get participants for notification")
			return
		}

		// Filter to players only (exclude GM)
		var playerIDs []int32
		for _, p := range participants {
			if p.Role == "player" || p.Role == "co_gm" {
				playerIDs = append(playerIDs, p.UserID)
			}
		}

		if len(playerIDs) == 0 {
			return
		}

		// Create link URL for handouts tab
		linkURL := fmt.Sprintf("/games/%d?tab=handouts", handout.GameID)

		// Create notification request
		notifService := &db.NotificationService{DB: h.App.Pool, Logger: h.App.ObsLogger}
		notifReq := &core.CreateNotificationRequest{
			GameID:      &handout.GameID,
			Type:        core.NotificationTypeHandoutPublished,
			Title:       fmt.Sprintf("New Handout: %s", handout.Title),
			Content:     nil, // Optional: could add handout preview
			RelatedType: stringPtr("handout"),
			RelatedID:   &handout.ID,
			LinkURL:     &linkURL,
		}

		// Send notifications (fire-and-forget)
		_ = notifService.CreateBulkNotifications(notifCtx, playerIDs, notifReq)
		h.App.ObsLogger.Info(notifCtx, "Sent handout notifications", "handout_id", handout.ID, "player_count", len(playerIDs))
	}()

	response := &HandoutResponse{
		ID:        handout.ID,
		GameID:    handout.GameID,
		Title:     handout.Title,
		Content:   handout.Content,
		Status:    handout.Status,
		CreatedAt: handout.CreatedAt,
		UpdatedAt: handout.UpdatedAt,
	}

	render.JSON(w, r, response)
}

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}

// UnpublishHandout unpublishes a published handout
func (h *Handler) UnpublishHandout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_unpublish_handout")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_unpublish_handout")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid handout ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")))
		return
	}

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get existing handout to check ownership
	handoutService := &db.HandoutService{DB: h.App.Pool}
	existingHandout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get handout")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	// Check if user is GM of the game
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, existingHandout.GameID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Handout not found"))
		return
	}

	if errResp := h.verifyUserIsGM(ctx, game, userID); errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Unpublish handout
	handout, err := handoutService.UnpublishHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to unpublish handout")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout unpublished successfully", "handout_id", handout.ID)

	response := &HandoutResponse{
		ID:        handout.ID,
		GameID:    handout.GameID,
		Title:     handout.Title,
		Content:   handout.Content,
		Status:    handout.Status,
		CreatedAt: handout.CreatedAt,
		UpdatedAt: handout.UpdatedAt,
	}

	render.JSON(w, r, response)
}
