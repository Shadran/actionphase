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

// LeaveGame removes a user from game participants and deactivates their characters
func (h *Handler) LeaveGame(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_leave_game")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
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

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	applicationService := &db.GameApplicationService{DB: h.App.Pool}

	// First, try to remove user from game participants (if they are a participant)
	// Use RemovePlayer which handles both participant removal and character deactivation
	participantRemoved := false
	err = gameService.RemovePlayer(ctx, int32(gameID), userID, userID) // Self-initiated leave
	if err != nil {
		// Log but don't fail - user might not be a participant (might just have an application)
		h.App.ObsLogger.Debug(ctx, "User not found in participants (might have application instead)", "game_id", gameID, "user_id", userID)
	} else {
		participantRemoved = true
		h.App.ObsLogger.Info(ctx, "User left game (participant removed, characters deactivated)", "game_id", gameID, "user_id", userID)
	}

	// Also check for and withdraw any pending applications
	application, err := applicationService.GetGameApplicationByUserAndGame(ctx, int32(gameID), userID)
	if err != nil {
		// User has no application - that's fine if they were a participant
		if !participantRemoved {
			h.App.ObsLogger.Error(ctx, "User is neither participant nor applicant", "error", err, "game_id", gameID, "user_id", userID)
			render.Render(w, r, core.ErrNotFound("you are not associated with this game"))
			return
		}
	} else {
		// Delete the application if it's pending (allows them to reapply if they want)
		if application.Status.String == core.ApplicationStatusPending {
			err = applicationService.DeleteGameApplication(ctx, application.ID, userID)
			if err != nil {
				h.App.ObsLogger.Error(ctx, "Failed to delete application", "error", err, "application_id", application.ID)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			h.App.ObsLogger.Info(ctx, "Deleted pending application", "application_id", application.ID, "game_id", gameID, "user_id", userID)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetGameParticipants retrieves all participants for a game
func (h *Handler) GetGameParticipants(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_participants")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	participants, err := gameService.GetGameParticipants(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game participants", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []map[string]interface{}
	for _, participant := range participants {
		participantData := map[string]interface{}{
			"id":       participant.ID,
			"game_id":  participant.GameID,
			"user_id":  participant.UserID,
			"username": participant.Username,
			// Note: Email is intentionally omitted for privacy
			"role":      participant.Role,
			"status":    participant.Status,
			"joined_at": participant.JoinedAt.Time,
		}

		// Include avatar_url if present
		if participant.AvatarUrl.Valid {
			participantData["avatar_url"] = participant.AvatarUrl.String
		} else {
			participantData["avatar_url"] = nil
		}

		response = append(response, participantData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Player Management Endpoints

// RemovePlayer removes a player from the game and deactivates their characters (GM only)
func (h *Handler) RemovePlayer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_remove_player")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userIDStr := chi.URLParam(r, "userId")
	targetUserID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid user ID")))
		return
	}

	// Get requesting user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	requestingUserID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Verify requesting user is the GM
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrNotFound("game not found"))
		return
	}

	if game.GmUserID != requestingUserID {
		h.App.ObsLogger.Warn(ctx, "Non-GM attempted to remove player", "requesting_user_id", requestingUserID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("only the GM can remove players"))
		return
	}

	// Prevent GM from removing themselves
	if int32(targetUserID) == game.GmUserID {
		h.App.ObsLogger.Warn(ctx, "GM attempted to remove themselves", "game_id", gameID, "gm_user_id", game.GmUserID)
		render.Render(w, r, core.ErrConflict("GM cannot remove themselves from the game"))
		return
	}

	// Remove player and deactivate their characters
	err = gameService.RemovePlayer(ctx, int32(gameID), int32(targetUserID), requestingUserID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to remove player", "error", err, "game_id", gameID, "user_id", targetUserID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Player removed from game", "game_id", gameID, "removed_user_id", targetUserID, "removed_by", requestingUserID)
	w.WriteHeader(http.StatusNoContent)
}

// AddPlayerDirectly adds a player to the game without application process (GM only)
func (h *Handler) AddPlayerDirectly(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_add_player_directly")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse request body
	var req struct {
		UserID int32 `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid request body")))
		return
	}

	if req.UserID == 0 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("user_id is required")))
		return
	}

	// Get requesting user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	requestingUserID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Verify requesting user is the GM
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrNotFound("game not found"))
		return
	}

	if game.GmUserID != requestingUserID {
		h.App.ObsLogger.Warn(ctx, "Non-GM attempted to add player directly", "requesting_user_id", requestingUserID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("only the GM can add players directly"))
		return
	}

	// Verify target user exists
	_, err = userService.GetUserByID(int(req.UserID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Target user not found", "error", err, "user_id", req.UserID)
		render.Render(w, r, core.ErrNotFound("user not found"))
		return
	}

	// Add player directly
	participant, err := gameService.AddPlayerDirectly(ctx, int32(gameID), req.UserID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to add player directly", "error", err, "game_id", gameID, "user_id", req.UserID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Player added directly to game", "game_id", gameID, "added_user_id", req.UserID, "added_by", requestingUserID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(participant)
}

// PromoteToCoGM promotes an audience member to co-GM role (GM only)
func (h *Handler) PromoteToCoGM(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_promote_to_cogm")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userIDStr := chi.URLParam(r, "userId")
	targetUserID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid user ID")))
		return
	}

	// Get requesting user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	requestingUserID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Call service method to promote user
	err = gameService.PromoteToCoGM(ctx, int32(gameID), int32(targetUserID), requestingUserID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to promote to co-GM", "error", err, "game_id", gameID, "user_id", targetUserID)
		// Return 403 for permission errors, 400 for validation errors
		if err.Error() == "only the primary GM can promote users to co-GM" {
			render.Render(w, r, core.ErrForbidden(err.Error()))
			return
		}
		render.Render(w, r, core.ErrBadRequest(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "User promoted to co-GM", "game_id", gameID, "promoted_user_id", targetUserID, "promoted_by", requestingUserID)
	w.WriteHeader(http.StatusNoContent)
}

// DemoteFromCoGM demotes a co-GM back to audience role (GM only)
func (h *Handler) DemoteFromCoGM(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_demote_from_cogm")()

	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userIDStr := chi.URLParam(r, "userId")
	targetUserID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid user ID")))
		return
	}

	// Get requesting user ID from JWT token
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	requestingUserID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Call service method to demote user
	err = gameService.DemoteFromCoGM(ctx, int32(gameID), int32(targetUserID), requestingUserID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to demote from co-GM", "error", err, "game_id", gameID, "user_id", targetUserID)
		// Return 403 for permission errors, 400 for validation errors
		if err.Error() == "only the primary GM can demote co-GMs" {
			render.Render(w, r, core.ErrForbidden(err.Error()))
			return
		}
		render.Render(w, r, core.ErrBadRequest(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Co-GM demoted to audience", "game_id", gameID, "demoted_user_id", targetUserID, "demoted_by", requestingUserID)
	w.WriteHeader(http.StatusNoContent)
}
