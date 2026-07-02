package handouts

import (
	"actionphase/pkg/core"
)

// Handler handles HTTP requests for handout-related endpoints
type Handler struct {
	App                 *core.App
	UserService         core.UserServiceInterface
	GameService         core.GameServiceInterface
	HandoutService      core.HandoutServiceInterface
	NotificationService core.NotificationServiceInterface
}

// All handler methods are organized into separate files:
// - api_handouts.go: Handout CRUD operations (Create, Get, Update, Delete, Publish, Unpublish)
// - api_comments.go: Comment management (Create, List, Update, Delete)
