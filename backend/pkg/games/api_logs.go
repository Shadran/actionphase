package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// Logs retrieves all logs for a given game
// GET /api/v1/games/:id/logs
func (h *Handler) GetGameLogs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_logs")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")), "Invalid logs request")
		return
	}

	// Get authenticated user
	user := core.GetAuthenticatedUser(ctx)
	if user == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user found")
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Verify user is GM of this game
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game for permission check", "error", err, "game_id", gameID)
		return
	}

	if game.State.String != core.GameStateCompleted && game.State.String != core.GameStateCancelled {
		// Check GM permissions if the game is still incomplete (considers admin mode)
		if !core.IsUserGameMaster(r, user.ID, user.IsAdmin, *game, h.App.Pool) {
			h.renderError(ctx, w, r, core.ErrForbidden("only the GM can retrieve game logs while the game is running"), "Game logs access forbidden")
			return
		}
	}

	logs, err := gameService.GetGameLogs(ctx, int32(gameID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game logs", "error", err, "game_id", gameID)
		return
	}

	// Convert to response format
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, log := range logs {
		logData := map[string]interface{}{
			"id":         log.ID,
			"game_id":    log.GameID,
			"type":       log.Type,
			"message":    log.Message.String,
			"created_at": log.CreatedAt.Time,
		}
		response = append(response, logData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
