package deadlines

import (
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5/pgtype"
)

// CreateDeadline creates a new deadline for a game
func (h *Handler) CreateDeadline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_deadline")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_create_deadline")()

	// Get gameID from URL
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid game ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse request
	data := &CreateDeadlineRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind create deadline request")
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

	// Check if user is GM of the game
	_, errResp = h.verifyUserIsGM(ctx, int32(gameID), userID)
	if errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Create deadline
	deadlineService := &db.DeadlineService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	req := core.CreateDeadlineRequest{
		GameID:      int32(gameID),
		Title:       data.Title,
		Description: data.Description,
		Deadline:    data.Deadline,
		CreatedBy:   userID,
	}
	deadline, err := deadlineService.CreateDeadline(ctx, req)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to create deadline")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Deadline created successfully", "deadline_id", deadline.ID, "game_id", gameID)

	response := toDeadlineResponse(deadline)

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, response)
}

// GetGameDeadlines retrieves all deadlines for a game
func (h *Handler) GetGameDeadlines(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_deadlines")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_deadlines")()

	// Get gameID from URL
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid game ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get includeExpired query parameter (defaults to false)
	includeExpired := r.URL.Query().Get("includeExpired") == "true"

	// Verify the game exists
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	_, err = gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		render.Render(w, r, core.ErrNotFound("Game not found"))
		return
	}

	// Get all deadlines (unified view of arbitrary, phase, and poll deadlines)
	deadlineService := &db.DeadlineService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	deadlines, err := deadlineService.GetAllGameDeadlines(ctx, int32(gameID), includeExpired)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get all game deadlines")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]*UnifiedDeadlineResponse, len(deadlines))
	for i := range deadlines {
		response[i] = toUnifiedDeadlineResponse(&deadlines[i])
	}

	render.JSON(w, r, response)
}

// UpdateDeadline updates a deadline
func (h *Handler) UpdateDeadline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_deadline")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_update_deadline")()

	// Get deadlineID from URL
	deadlineIDStr := chi.URLParam(r, "deadlineId")
	deadlineID, err := strconv.ParseInt(deadlineIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid deadline ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid deadline ID")))
		return
	}

	// Parse request
	data := &UpdateDeadlineRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind update deadline request")
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

	// Get existing deadline to check ownership
	deadlineService := &db.DeadlineService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	existingDeadline, err := deadlineService.GetDeadline(ctx, int32(deadlineID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get deadline")
		render.Render(w, r, core.ErrNotFound("Deadline not found"))
		return
	}

	// Check if user is GM of the game
	_, errResp = h.verifyUserIsGM(ctx, existingDeadline.GameID, userID)
	if errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Update deadline
	updateReq := core.UpdateDeadlineRequest{
		Title:       data.Title,
		Description: data.Description,
		Deadline:    data.Deadline,
	}
	deadline, err := deadlineService.UpdateDeadline(ctx, int32(deadlineID), updateReq)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to update deadline")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Deadline updated successfully", "deadline_id", deadline.ID)

	response := toDeadlineResponse(deadline)

	render.JSON(w, r, response)
}

// DeleteDeadline deletes a deadline
func (h *Handler) DeleteDeadline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_deadline")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_deadline")()

	// Get deadlineID from URL
	deadlineIDStr := chi.URLParam(r, "deadlineId")
	deadlineID, err := strconv.ParseInt(deadlineIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid deadline ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid deadline ID")))
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

	// Get existing deadline to check ownership
	deadlineService := &db.DeadlineService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	existingDeadline, err := deadlineService.GetDeadline(ctx, int32(deadlineID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get deadline")
		render.Render(w, r, core.ErrNotFound("Deadline not found"))
		return
	}

	// Check if user is GM of the game
	_, errResp = h.verifyUserIsGM(ctx, existingDeadline.GameID, userID)
	if errResp != nil {
		render.Render(w, r, errResp)
		return
	}

	// Delete deadline
	err = deadlineService.DeleteDeadline(ctx, int32(deadlineID), userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to delete deadline")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Deadline deleted successfully", "deadline_id", deadlineID)

	w.WriteHeader(http.StatusNoContent)
}

// GetUpcomingDeadlines retrieves upcoming deadlines across all user's games
func (h *Handler) GetUpcomingDeadlines(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_upcoming_deadlines")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_get_upcoming_deadlines")()

	// Get user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get limit query parameter (defaults to 10)
	limitStr := r.URL.Query().Get("limit")
	limit := int64(10) // default
	if limitStr != "" {
		parsedLimit, err := strconv.ParseInt(limitStr, 10, 32)
		if err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	// Get upcoming deadlines
	deadlineService := &db.DeadlineService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	deadlines, err := deadlineService.GetUpcomingDeadlines(ctx, userID, int32(limit))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get upcoming deadlines")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]*DeadlineWithGameResponse, len(deadlines))
	for i, deadline := range deadlines {
		response[i] = toDeadlineWithGameResponse(&deadline)
	}

	render.JSON(w, r, response)
}

// Helper function to convert database model to API response
func toDeadlineResponse(d *models.GameDeadline) *DeadlineResponse {
	resp := &DeadlineResponse{
		ID:        d.ID,
		GameID:    d.GameID,
		Title:     d.Title,
		CreatedAt: pgTimestampToTimePtr(d.CreatedAt),
		UpdatedAt: pgTimestampToTimePtr(d.UpdatedAt),
	}

	// Handle optional description
	if d.Description.Valid {
		resp.Description = &d.Description.String
	}

	// Handle optional deadline timestamp
	if d.Deadline.Valid {
		deadlineTime := d.Deadline.Time
		resp.Deadline = &deadlineTime
	}

	return resp
}

// Helper function to convert DeadlineWithGame to API response
func toDeadlineWithGameResponse(d *core.DeadlineWithGame) *DeadlineWithGameResponse {
	resp := &DeadlineWithGameResponse{
		ID:        d.ID,
		GameID:    d.GameID,
		GameTitle: d.GameTitle,
		Title:     d.Title,
		CreatedAt: pgTimestampToTimePtr(d.CreatedAt),
		UpdatedAt: pgTimestampToTimePtr(d.UpdatedAt),
	}

	// Handle optional description
	if d.Description.Valid {
		resp.Description = &d.Description.String
	}

	// Handle optional deadline timestamp
	if d.Deadline.Valid {
		deadlineTime := d.Deadline.Time
		resp.Deadline = &deadlineTime
	}

	return resp
}

// Helper function to verify user is GM of a game
// Returns the game if verification succeeds, or an error response if it fails
// Uses the unified permission check for GM, Co-GM, and admin mode support
func (h *Handler) verifyUserIsGM(ctx context.Context, gameID int32, userID int32) (*models.Game, render.Renderer) {
	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, gameID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
		return nil, core.ErrNotFound("Game not found")
	}

	// Get user to check admin status
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(int(userID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get user")
		return nil, core.ErrUnauthorized("User not found")
	}

	// Check if user is GM, Co-GM, or admin with admin mode enabled
	if !core.IsUserGameMasterCtx(ctx, userID, user.IsAdmin, *game, h.App.Pool) {
		h.App.ObsLogger.Warn(ctx, "User is not authorized to manage deadlines", "user_id", userID, "game_id", gameID)
		return nil, core.ErrUnauthorized("Only GM or Co-GM can manage deadlines")
	}

	return game, nil
}

// Helper function to convert pgtype.Timestamptz to *time.Time
func pgTimestampToTimePtr(t pgtype.Timestamptz) *time.Time {
	if t.Valid {
		return &t.Time
	}
	return nil
}

// Helper function to convert core.UnifiedDeadline to UnifiedDeadlineResponse
func toUnifiedDeadlineResponse(d *core.UnifiedDeadline) *UnifiedDeadlineResponse {
	resp := &UnifiedDeadlineResponse{
		DeadlineType:     d.DeadlineType,
		SourceID:         d.SourceID,
		Title:            d.Title,
		Description:      d.Description,
		GameID:           d.GameID,
		PhaseID:          d.PhaseID,
		PollID:           d.PollID,
		IsSystemDeadline: d.IsSystemDeadline,
	}

	// Handle optional deadline timestamp
	if !d.Deadline.IsZero() {
		deadline := d.Deadline
		resp.Deadline = &deadline
	}

	return resp
}
