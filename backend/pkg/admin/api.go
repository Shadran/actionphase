package admin

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	messagesvc "actionphase/pkg/db/services/messages"
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

// getUserIDFromContext extracts user ID from authenticated context
func (h *Handler) getUserIDFromContext(r *http.Request) (int32, error) {
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		return 0, errors.New("authentication required")
	}
	return authUser.ID, nil
}

// ListAdmins returns all users with admin privileges
// GET /admin/admins
func (h *Handler) ListAdmins(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	admins, err := userService.ListAdmins(ctx)
	if err != nil {
		h.App.Logger.Error("Failed to list admins", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Listed admins", "count", len(admins))
	render.JSON(w, r, admins)
}

// GrantAdminStatus grants admin privileges to a user
// PUT /admin/users/:id/admin
func (h *Handler) GrantAdminStatus(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get requester ID from context
	requesterID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.App.Logger.Error("Failed to get requester from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	ctx := context.Background()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	err = userService.SetAdminStatus(ctx, int32(userID), true, requesterID)
	if err != nil {
		h.App.Logger.Error("Failed to grant admin status",
			"error", err,
			"target_user_id", userID,
			"requester_id", requesterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Granted admin status",
		"user_id", userID,
		"granted_by", requesterID)

	w.WriteHeader(http.StatusNoContent)
}

// RevokeAdminStatus revokes admin privileges from a user
// DELETE /admin/users/:id/admin
func (h *Handler) RevokeAdminStatus(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get requester ID from context
	requesterID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.App.Logger.Error("Failed to get requester from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	ctx := context.Background()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	err = userService.SetAdminStatus(ctx, int32(userID), false, requesterID)
	if err != nil {
		h.App.Logger.Error("Failed to revoke admin status",
			"error", err,
			"target_user_id", userID,
			"requester_id", requesterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Revoked admin status",
		"user_id", userID,
		"revoked_by", requesterID)

	w.WriteHeader(http.StatusNoContent)
}

// BanUser bans a user from the platform
// POST /admin/users/:id/ban
func (h *Handler) BanUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get admin ID from context
	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.App.Logger.Error("Failed to get admin from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	ctx := context.Background()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	sessionService := &db.SessionService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Ban the user
	err = userService.BanUser(ctx, int32(userID), adminID)
	if err != nil {
		h.App.Logger.Error("Failed to ban user",
			"error", err,
			"target_user_id", userID,
			"admin_id", adminID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Invalidate all sessions for the banned user
	err = sessionService.InvalidateAllUserSessions(ctx, int32(userID))
	if err != nil {
		h.App.Logger.Error("Failed to invalidate sessions for banned user",
			"error", err,
			"user_id", userID)
		// Don't fail the request if session invalidation fails
	}

	h.App.Logger.Info("Banned user",
		"user_id", userID,
		"banned_by", adminID)

	w.WriteHeader(http.StatusNoContent)
}

// UnbanUser removes ban from a user
// DELETE /admin/users/:id/ban
func (h *Handler) UnbanUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get admin ID from context for logging
	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.App.Logger.Error("Failed to get admin from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	ctx := context.Background()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	err = userService.UnbanUser(ctx, int32(userID))
	if err != nil {
		h.App.Logger.Error("Failed to unban user",
			"error", err,
			"target_user_id", userID,
			"admin_id", adminID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Unbanned user",
		"user_id", userID,
		"unbanned_by", adminID)

	w.WriteHeader(http.StatusNoContent)
}

// ListBannedUsers returns all banned users
// GET /admin/users/banned
func (h *Handler) ListBannedUsers(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	bannedUsers, err := userService.ListBannedUsers(ctx)
	if err != nil {
		h.App.Logger.Error("Failed to list banned users", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Listed banned users", "count", len(bannedUsers))
	render.JSON(w, r, bannedUsers)
}

// DeleteMessage soft-deletes a message (post or comment) (admin only)
// DELETE /admin/messages/{messageId}
func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	messageIDStr := chi.URLParam(r, "messageId")
	messageID, err := strconv.ParseInt(messageIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get admin ID from context for logging
	adminID, err := h.getUserIDFromContext(r)
	if err != nil {
		h.App.Logger.Error("Failed to get admin from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	ctx := context.Background()
	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	// Check if user can delete this message (admins always can via admin mode)
	canDelete, err := messageService.CanUserDeleteComment(ctx, int32(messageID), adminID, true)
	if err != nil {
		h.App.Logger.Error("Failed to check delete permission",
			"error", err,
			"message_id", messageID,
			"admin_id", adminID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canDelete {
		h.App.Logger.Warn("Admin attempted to delete already-deleted message",
			"message_id", messageID,
			"admin_id", adminID)
		render.Render(w, r, core.ErrForbidden("Message is already deleted"))
		return
	}

	// Delete the message using the shared service method
	err = messageService.DeleteComment(ctx, int32(messageID), adminID)
	if err != nil {
		h.App.Logger.Error("Failed to delete message",
			"error", err,
			"message_id", messageID,
			"admin_id", adminID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Deleted message",
		"message_id", messageID,
		"deleted_by", adminID)

	w.WriteHeader(http.StatusNoContent)
}
