package characters

import (
	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// CharacterStatsResponse represents the activity stats response for a character.
type CharacterStatsResponse struct {
	PublicMessages  int64  `json:"public_messages"`
	PrivateMessages *int64 `json:"private_messages,omitempty"`
}

func (rd *CharacterStatsResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// GetCharacterStats returns public and (conditionally) private message counts for a character.
//
// Authorization for private message count:
//   - GMs and co-GMs always see it
//   - Audience members always see it
//   - The character's owner always sees their own count
//   - Any authenticated user sees it when the game is completed
//   - Other players in active/in-progress games do NOT see others' private counts
func (h *Handler) GetCharacterStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_character_stats")()

	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")), "Invalid get character stats request")
		return
	}

	characterService := &services.CharacterService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	character, err := characterService.GetCharacter(ctx, int32(characterID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("character not found"), "Failed to get character for stats", "error", err, "character_id", characterID)
		return
	}

	gameService := &services.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, character.GameID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get game for stats", "error", err, "game_id", character.GameID)
		return
	}

	authUser := core.GetAuthenticatedUser(ctx)

	// Determine whether the requester can see private message counts.
	canSeePrivate := false
	if authUser != nil {
		isGM := core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game, h.App.Pool)
		isAudience := core.IsUserAudience(ctx, h.App.Pool, character.GameID, authUser.ID)
		isCompleted := game.State.String == "completed"
		isOwner := character.UserID.Valid && character.UserID.Int32 == authUser.ID
		canSeePrivate = isGM || isAudience || isCompleted || isOwner
	}

	stats, err := characterService.GetCharacterActivityStats(ctx, int32(characterID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get character activity stats", "error", err, "character_id", characterID)
		return
	}

	resp := &CharacterStatsResponse{
		PublicMessages: stats.PublicMessages,
	}
	if canSeePrivate {
		resp.PrivateMessages = stats.PrivateMessages
	}

	render.Render(w, r, resp)
}
