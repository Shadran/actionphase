package characters

import (
	"actionphase/pkg/core"
	"fmt"
	"net/http"
)

// Handler handles character-related HTTP requests
type Handler struct {
	App                 *core.App
	UserService         core.UserServiceInterface
	CharacterService    core.CharacterServiceInterface
	GameService         core.GameServiceInterface
	NotificationService core.NotificationServiceInterface
}

// getUserIDFromToken extracts user ID from JWT token
func (h *Handler) getUserIDFromToken(r *http.Request) (int32, error) {
	userID, errResp := core.GetUserIDFromJWT(r.Context(), h.UserService)
	if errResp != nil {
		return 0, fmt.Errorf("authentication failed")
	}
	return userID, nil
}

// All handler methods are organized into separate files:
// - api_crud.go: Character CRUD operations (Create, Get characters)
// - api_management.go: Character approval and NPC assignment
// - api_data.go: Character data fields management
//
// Request and response types are in:
// - requests.go: All request types with Bind methods
// - responses.go: All response types with Render methods
