package polls

import (
	"actionphase/pkg/core"
)

// Handler handles HTTP requests for poll-related endpoints
type Handler struct {
	App                 *core.App
	UserService         core.UserServiceInterface
	GameService         core.GameServiceInterface
	PollService         core.PollServiceInterface
	CharacterService    core.CharacterServiceInterface
	NotificationService core.NotificationServiceInterface
}
