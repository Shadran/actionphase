package phases

import (
	"actionphase/pkg/core"
)

// Handler handles phase-related HTTP requests
type Handler struct {
	App                     *core.App
	PhaseService            core.PhaseServiceInterface
	ActionSubmissionService core.ActionSubmissionServiceInterface
	GameService             core.GameServiceInterface
	NotificationService     core.NotificationServiceInterface
}

// All handler methods are organized into separate files:
// - api_crud.go: Phase CRUD operations (Create, Get, Update, etc.)
// - api_lifecycle.go: Phase lifecycle (Activate, Publish, etc.)
// - api_actions.go: Action submissions (Submit, Get user/game actions)
// - api_results.go: Action results (Create, Get, Update results)
//
// Request and response types are in:
// - requests.go: All request types with Bind methods
// - responses.go: All response types with Render methods
