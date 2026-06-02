package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"fmt"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Request struct {
	*core.User
	HCaptchaToken string `json:"hcaptcha_token"`
	HoneypotValue string `json:"honeypot_value"`
	Fingerprint   string `json:"fingerprint"`
}

func (r *Request) Bind(req *http.Request) error {
	if r.User == nil {
		return fmt.Errorf("missing required User fields")
	}
	if len(r.Fingerprint) > 512 {
		return fmt.Errorf("fingerprint exceeds maximum length")
	}
	return nil
}

type Handler struct {
	App *core.App
}

type Response struct {
	*core.User
	Token string
}

func (rd *Response) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// V1Me returns the current user's information, or null if not authenticated.
// This is a probe endpoint — it never returns 401. Unauthenticated requests
// receive 200 with a null user so the frontend can check auth state without
// triggering console errors.
func (h *Handler) V1Me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_current_user")()

	token, _, err := jwtauth.FromContext(ctx)
	if err != nil || token == nil {
		render.JSON(w, r, map[string]interface{}{"user": nil})
		return
	}

	// Verify the session still exists in the DB. A valid JWT whose session has been
	// invalidated (ban, forced logout) must be treated as unauthenticated here, or
	// the frontend will see the user as logged in despite the session being gone.
	// Only tokens issued via the login flow carry a session_id claim; tokens without
	// it (e.g. test tokens) skip the check.
	if sessionIDVal, ok := token.Get("session_id"); ok {
		var sessionID int32
		switch v := sessionIDVal.(type) {
		case float64:
			sessionID = int32(v)
		case int32:
			sessionID = v
		case int64:
			sessionID = int32(v)
		}
		if sessionID > 0 {
			sessionSvc := &db.SessionService{DB: h.App.Pool, Logger: h.App.ObsLogger}
			session, err := sessionSvc.GetSessionByID(ctx, sessionID)
			if err != nil || session == nil {
				render.JSON(w, r, map[string]interface{}{"user": nil})
				return
			}
		}
	}

	userIDStr, ok := token.Get("sub")
	if !ok {
		render.JSON(w, r, map[string]interface{}{"user": nil})
		return
	}

	var uid int
	if _, err := fmt.Sscanf(userIDStr.(string), "%d", &uid); err != nil || uid == 0 {
		render.JSON(w, r, map[string]interface{}{"user": nil})
		return
	}

	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(uid)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to find user", "error", err, "user_id", uid)
		render.JSON(w, r, map[string]interface{}{"user": nil})
		return
	}

	h.App.ObsLogger.Info(ctx, "Current user retrieved", "user_id", uid)

	response := &Response{
		User:  user,
		Token: "",
	}
	render.Render(w, r, response)
}

// PreferencesRequest represents a request to update user preferences
type PreferencesRequest struct {
	Preferences *db.PreferencesData `json:"preferences"`
}

func (r *PreferencesRequest) Bind(req *http.Request) error {
	if r.Preferences == nil {
		return fmt.Errorf("missing required preferences field")
	}
	return nil
}

// PreferencesResponse represents the preferences response
type PreferencesResponse struct {
	Preferences *db.PreferencesData `json:"preferences"`
}

func (rd *PreferencesResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// V1GetPreferences returns the current user's preferences
func (h *Handler) V1GetPreferences(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_user_preferences")()

	// Get user_id from JWT token (stored in "sub" claim)
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	userIDStr, ok := token.Get("sub")
	if !ok {
		h.App.ObsLogger.Error(ctx, "User ID not found in token")
		render.Render(w, r, core.ErrUnauthorized("user id not found in token"))
		return
	}

	// Parse user ID
	var userID int
	fmt.Sscanf(userIDStr.(string), "%d", &userID)

	// Look up current user
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(userID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to find user", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Get preferences
	prefsService := db.NewUserPreferencesService(h.App.Pool)
	prefs, err := prefsService.GetUserPreferences(ctx, int32(user.ID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user preferences", "error", err, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "User preferences retrieved", "user_id", user.ID)

	response := &PreferencesResponse{
		Preferences: prefs,
	}

	render.Render(w, r, response)
}

// V1UpdatePreferences updates the current user's preferences
func (h *Handler) V1UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_user_preferences")()

	// Get user_id from JWT token (stored in "sub" claim)
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	userIDStr, ok := token.Get("sub")
	if !ok {
		h.App.ObsLogger.Error(ctx, "User ID not found in token")
		render.Render(w, r, core.ErrUnauthorized("user id not found in token"))
		return
	}

	// Parse user ID
	var userID int
	fmt.Sscanf(userIDStr.(string), "%d", &userID)

	// Look up current user
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(userID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to find user", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Parse request
	data := &PreferencesRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.Warn(ctx, "Invalid request body", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Update preferences
	prefsService := db.NewUserPreferencesService(h.App.Pool)
	prefs, err := prefsService.UpdateUserPreferences(ctx, int32(user.ID), *data.Preferences)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update user preferences", "error", err, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "User preferences updated", "user_id", user.ID, "theme", prefs.Theme)

	response := &PreferencesResponse{
		Preferences: prefs,
	}

	render.Render(w, r, response)
}

// UserSearchResult represents a single user in search results
type UserSearchResult struct {
	ID        int32  `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"created_at"`
}

// SearchUsersResponse represents the search results
type SearchUsersResponse struct {
	Users []UserSearchResult `json:"users"`
}

func (rd *SearchUsersResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// V1SearchUsers searches for users by username
// Query parameter: q (search query)
func (h *Handler) V1SearchUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_search_users")()

	// Get search query from URL parameters
	query := r.URL.Query().Get("q")
	if query == "" {
		h.App.ObsLogger.Warn(ctx, "Search query parameter missing")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("search query parameter 'q' is required")))
		return
	}

	// Search users
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	users, err := userService.SearchUsers(ctx, query)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to search users", "error", err, "query", query)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "User search completed", "query", query, "result_count", len(users))

	// Convert to response format
	results := make([]UserSearchResult, 0, len(users))
	for _, user := range users {
		results = append(results, UserSearchResult{
			ID:        user.ID,
			Username:  user.Username,
			CreatedAt: user.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	response := &SearchUsersResponse{
		Users: results,
	}

	render.Render(w, r, response)
}
