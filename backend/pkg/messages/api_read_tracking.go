package messages

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	messagesvc "actionphase/pkg/db/services/messages"
)

// MarkPostRead marks a post (and optionally a specific comment) as read
// POST /api/v1/games/:gameId/posts/:postId/mark-read
func (h *Handler) MarkPostRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_mark_post_read")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	postIDStr := chi.URLParam(r, "postId")
	postID, err := strconv.ParseInt(postIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid post ID")))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	var requestBody struct {
		LastReadCommentID *int32 `json:"last_read_comment_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil && err != io.EOF {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid request body")))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	readMarker, err := messageService.MarkPostAsRead(ctx, userID, int32(gameID), int32(postID), requestBody.LastReadCommentID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to mark post as read", "error", err, "game_id", gameID, "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                   readMarker.ID,
		"user_id":              readMarker.UserID,
		"game_id":              readMarker.GameID,
		"post_id":              readMarker.PostID,
		"last_read_comment_id": readMarker.LastReadCommentID,
		"last_read_at":         readMarker.LastReadAt,
		"created_at":           readMarker.CreatedAt,
		"updated_at":           readMarker.UpdatedAt,
	})
}

// GetGameReadMarkers gets all read markers for the current user in a game
// GET /api/v1/games/:gameId/read-markers
func (h *Handler) GetGameReadMarkers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_read_markers")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	readMarkers, err := messageService.GetUserReadMarkersForGame(ctx, userID, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get read markers", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := make([]map[string]interface{}, 0, len(readMarkers))
	for _, marker := range readMarkers {
		response = append(response, map[string]interface{}{
			"id":                   marker.ID,
			"user_id":              marker.UserID,
			"game_id":              marker.GameID,
			"post_id":              marker.PostID,
			"last_read_comment_id": marker.LastReadCommentID,
			"last_read_at":         marker.LastReadAt,
			"created_at":           marker.CreatedAt,
			"updated_at":           marker.UpdatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetPostsUnreadInfo gets post metadata to determine unread status
// GET /api/v1/games/:gameId/posts-unread-info
func (h *Handler) GetPostsUnreadInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_posts_unread_info")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	postsInfo, err := messageService.GetPostsWithUnreadInfo(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get posts unread info", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := make([]map[string]interface{}, 0, len(postsInfo))
	for _, info := range postsInfo {
		postData := map[string]interface{}{
			"post_id":         info.PostID,
			"post_created_at": info.PostCreatedAt,
			"total_comments":  info.TotalComments,
		}

		if info.LatestCommentAt != nil {
			postData["latest_comment_at"] = info.LatestCommentAt
		}

		response = append(response, postData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUnreadCommentIDs gets the specific IDs of unread comments for all posts in a game
// GET /api/v1/games/:gameId/unread-comment-ids
func (h *Handler) GetUnreadCommentIDs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_unread_comment_ids")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	unreadComments, err := messageService.GetUnreadCommentIDsForPosts(ctx, userID, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get unread comment IDs", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := make([]map[string]interface{}, 0, len(unreadComments))
	for _, uc := range unreadComments {
		response = append(response, map[string]interface{}{
			"post_id":            uc.PostID,
			"unread_comment_ids": uc.UnreadCommentIDs,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ToggleCommentRead marks or unmarks a single comment as manually read by the current user
// POST /api/v1/games/:gameId/posts/:postId/comments/:commentId/toggle-read
func (h *Handler) ToggleCommentRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_toggle_comment_read")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	postIDStr := chi.URLParam(r, "postId")
	postID, err := strconv.ParseInt(postIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid post ID")))
		return
	}

	commentIDStr := chi.URLParam(r, "commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid comment ID")))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	var requestBody struct {
		Read bool `json:"read"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil && err != io.EOF {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid request body")))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	if err := messageService.ToggleCommentRead(ctx, userID, int32(gameID), int32(postID), int32(commentID), requestBody.Read); err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to toggle comment read", "error", err,
			"game_id", gameID, "post_id", postID, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetManualReadCommentIDs gets all comment IDs manually marked as read by the current user in a game
// GET /api/v1/games/:gameId/manual-read-comment-ids
func (h *Handler) GetManualReadCommentIDs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_manual_read_comment_ids")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	manualReads, err := messageService.GetManualReadCommentIDsForGame(ctx, userID, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get manual read comment IDs", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := make([]ManualReadCommentIDsResponse, 0, len(manualReads))
	for _, mr := range manualReads {
		response = append(response, ManualReadCommentIDsResponse{
			PostID:         mr.PostID,
			ReadCommentIDs: mr.ReadCommentIDs,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
