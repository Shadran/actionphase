package deadlines

import (
	"actionphase/pkg/core"
)

// Handler handles HTTP requests for deadline-related endpoints
type Handler struct {
	App             *core.App
	UserService     core.UserServiceInterface
	GameService     core.GameServiceInterface
	DeadlineService core.DeadlineServiceInterface
}
