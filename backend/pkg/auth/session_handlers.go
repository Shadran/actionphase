package auth

import (
	"actionphase/pkg/core"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// SessionResponse represents a session in the API response
type SessionResponse struct {
	ID        int32  `json:"id"`
	CreatedAt string `json:"created_at"`
	Expires   string `json:"expires"`
	IsCurrent bool   `json:"is_current"`
}

// SessionsListResponse represents the list of sessions
type SessionsListResponse struct {
	Sessions []SessionResponse `json:"sessions"`
}

func (rd *SessionsListResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// V1ListSessions returns all active sessions for the current user
func (h *Handler) V1ListSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_sessions")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	// Get current token string from Authorization header to identify current session
	currentTokenString := jwtauth.TokenFromHeader(r)

	// Get all sessions for the user
	sessionService := h.SessionService
	sessions, err := sessionService.GetUserSessions(ctx, authUser.ID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get user sessions", "error", err, "user_id", authUser.ID)
		return
	}

	// Convert to response format
	sessionResponses := make([]SessionResponse, 0, len(sessions))
	for _, session := range sessions {
		isCurrent := session.Data == currentTokenString
		sessionResponses = append(sessionResponses, SessionResponse{
			ID:        session.ID,
			CreatedAt: "", // sessions table doesn't have created_at, will show as empty for now
			Expires:   session.Expires.Time.Format("2006-01-02T15:04:05Z07:00"),
			IsCurrent: isCurrent,
		})
	}

	response := &SessionsListResponse{
		Sessions: sessionResponses,
	}

	render.Status(r, http.StatusOK)
	render.Render(w, r, response)
}

// V1RevokeSession revokes a specific session
func (h *Handler) V1RevokeSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_revoke_session")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	// Get session ID from URL parameter
	sessionIDStr := chi.URLParam(r, "sessionID")
	sessionID, err := strconv.ParseInt(sessionIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(errors.New("invalid session ID")), "Invalid v1 revoke session request")
		return
	}

	// Verify the session belongs to the user
	sessionService := h.SessionService
	sessions, err := sessionService.GetUserSessions(ctx, authUser.ID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get user sessions", "error", err, "user_id", authUser.ID)
		return
	}

	// Check if session belongs to user
	found := false
	for _, session := range sessions {
		if session.ID == int32(sessionID) {
			found = true
			break
		}
	}

	if !found {
		h.renderError(ctx, w, r, core.ErrNotFound("session not found or does not belong to user"), "V1 revoke session not found")
		return
	}

	// Delete the session
	err = sessionService.DeleteSession(ctx, int32(sessionID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete session", "error", err, "session_id", sessionID)
		return
	}

	h.App.ObsLogger.Info(ctx, "Session revoked successfully", "user_id", authUser.ID, "session_id", sessionID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Session revoked successfully",
	})
}
