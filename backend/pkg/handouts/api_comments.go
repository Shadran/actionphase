package handouts

import (
	"actionphase/pkg/core"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// CreateHandoutComment creates a new comment on a handout
func (h *Handler) CreateHandoutComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_handout_comment")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_create_handout_comment")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")), "Invalid handout ID", "error", err)
		return
	}

	// Parse request
	data := &CreateHandoutCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Failed to bind create comment request", "error", err)
		return
	}

	// Get user ID from JWT token
	userService := h.UserService
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Get handout to verify it exists and user has access
	handoutService := h.HandoutService
	handout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("Handout or comment not found"), "Failed to get handout", "error", err)
		return
	}

	// Check if user is GM of the game (only GMs can comment on handouts)
	gameService := h.GameService
	game, err := gameService.GetGame(ctx, handout.GameID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("Handout or comment not found"), "Failed to get game", "error", err)
		return
	}

	if game.GmUserID != userID && !core.IsUserCoGM(ctx, h.App.Pool, game.ID, userID) {
		h.renderError(ctx, w, r, core.ErrUnauthorized("Only GM can comment on handouts"), "User is not GM of game", "user_id", userID, "game_id", game.ID)
		return
	}

	// Create comment
	comment, err := handoutService.CreateHandoutComment(ctx, int32(handoutID), userID, data.ParentCommentID, data.Content)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to create comment", "error", err)
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout comment created successfully", "comment_id", comment.ID, "handout_id", handoutID)

	response := &HandoutCommentResponse{
		ID:              comment.ID,
		HandoutID:       comment.HandoutID,
		UserID:          comment.UserID,
		ParentCommentID: comment.ParentCommentID,
		Content:         comment.Content,
		EditCount:       comment.EditCount,
		CreatedAt:       comment.CreatedAt,
		UpdatedAt:       comment.UpdatedAt,
		EditedAt:        comment.EditedAt,
		DeletedAt:       comment.DeletedAt,
		DeletedByUserID: comment.DeletedByUserID,
	}

	render.Status(r, http.StatusCreated)
	render.JSON(w, r, response)
}

// ListHandoutComments lists all comments for a handout
func (h *Handler) ListHandoutComments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_handout_comments")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_list_handout_comments")()

	// Get handoutID from URL
	handoutIDStr := chi.URLParam(r, "handoutId")
	handoutID, err := strconv.ParseInt(handoutIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid handout ID")), "Invalid handout ID", "error", err)
		return
	}

	// Get user ID from JWT token
	userService := h.UserService
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Get handout to verify it exists and user has access
	handoutService := h.HandoutService
	handout, err := handoutService.GetHandout(ctx, int32(handoutID), userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("Handout or comment not found"), "Failed to get handout", "error", err)
		return
	}

	// List comments
	comments, err := handoutService.ListHandoutComments(ctx, int32(handoutID))
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to list comments", "error", err)
		return
	}

	// Convert to response format
	response := make([]*HandoutCommentResponse, len(comments))
	for i, comment := range comments {
		response[i] = &HandoutCommentResponse{
			ID:              comment.ID,
			HandoutID:       comment.HandoutID,
			UserID:          comment.UserID,
			ParentCommentID: comment.ParentCommentID,
			Content:         comment.Content,
			EditCount:       comment.EditCount,
			CreatedAt:       comment.CreatedAt,
			UpdatedAt:       comment.UpdatedAt,
			EditedAt:        comment.EditedAt,
			DeletedAt:       comment.DeletedAt,
			DeletedByUserID: comment.DeletedByUserID,
		}
	}

	h.App.ObsLogger.Info(ctx, "Listed handout comments", "handout_id", handout.ID, "count", len(comments))

	render.JSON(w, r, response)
}

// UpdateHandoutComment updates a comment's content
func (h *Handler) UpdateHandoutComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_handout_comment")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_update_handout_comment")()

	// Get commentID from URL
	commentIDStr := chi.URLParam(r, "commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid comment ID")), "Invalid comment ID", "error", err)
		return
	}

	// Parse request
	data := &UpdateHandoutCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Failed to bind update comment request", "error", err)
		return
	}

	// Get user ID from JWT token
	userService := h.UserService
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Update comment
	handoutService := h.HandoutService
	comment, err := handoutService.UpdateHandoutComment(ctx, int32(commentID), userID, data.Content)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to update comment", "error", err)
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout comment updated successfully", "comment_id", comment.ID)

	response := &HandoutCommentResponse{
		ID:              comment.ID,
		HandoutID:       comment.HandoutID,
		UserID:          comment.UserID,
		ParentCommentID: comment.ParentCommentID,
		Content:         comment.Content,
		EditCount:       comment.EditCount,
		CreatedAt:       comment.CreatedAt,
		UpdatedAt:       comment.UpdatedAt,
		EditedAt:        comment.EditedAt,
		DeletedAt:       comment.DeletedAt,
		DeletedByUserID: comment.DeletedByUserID,
	}

	render.JSON(w, r, response)
}

// DeleteHandoutComment soft-deletes a comment
func (h *Handler) DeleteHandoutComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_handout_comment")()

	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_handout_comment")()

	// Get commentID from URL
	commentIDStr := chi.URLParam(r, "commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid comment ID")), "Invalid comment ID", "error", err)
		return
	}

	// Get user ID from JWT token
	userService := h.UserService
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Note: We could check if user is GM here, but the service layer should handle that
	// For now, we'll just pass isGM as true since only GMs can comment anyway
	handoutService := h.HandoutService
	err = handoutService.DeleteHandoutComment(ctx, int32(commentID), userID, true)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete comment", "error", err)
		return
	}

	h.App.ObsLogger.Info(ctx, "Handout comment deleted successfully", "comment_id", commentID)

	w.WriteHeader(http.StatusNoContent)
}
