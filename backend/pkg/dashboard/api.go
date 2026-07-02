package dashboard

import (
	"actionphase/pkg/core"
	"encoding/json"
	"net/http"
)

// Handler handles HTTP requests for dashboard endpoints
type Handler struct {
	App              *core.App
	UserService      core.UserServiceInterface
	DashboardService core.DashboardServiceInterface
}

// GetUserDashboard handles GET /api/v1/dashboard
// Returns aggregated dashboard data for the authenticated user
func (h *Handler) GetUserDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Track operation timing using observability logger
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_user_dashboard")()

	// Get user ID from JWT token
	userID, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}
	h.App.ObsLogger.Info(ctx, "Authenticated user for dashboard retrieval", "user_id", userID)

	// Get dashboard data from service
	dashboard, err := h.DashboardService.GetUserDashboard(ctx, userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get dashboard data", "error", err, "user_id", userID)
		return
	}

	// Log successful dashboard retrieval
	h.App.ObsLogger.Info(ctx, "Dashboard data retrieved successfully",
		"user_id", userID,
		"has_games", dashboard.HasGames,
		"game_count", len(dashboard.PlayerGames)+len(dashboard.GMGames)+len(dashboard.MixedRoleGames))

	// Send response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(dashboard)
}
