package messages

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	messagesvc "actionphase/pkg/db/services/messages"
	"actionphase/pkg/validation"
)

// CreatePost creates a new post in the common room
func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_post")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreatePostRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check if user is GM or co-GM (only GM/co-GM can create posts)
	queries := models.New(h.App.Pool)
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	isGMOrCoGM := game.GmUserID == userID || core.IsUserCoGM(ctx, h.App.Pool, int32(gameID), userID)

	if !isGMOrCoGM {
		h.App.ObsLogger.Warn(ctx, "Non-GM/co-GM user attempted to create post", "user_id", userID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("Only the Game Master or co-GM can create posts"))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	post, err := messageService.CreatePost(ctx, core.CreatePostRequest{
		GameID:      int32(gameID),
		PhaseID:     data.PhaseID,
		AuthorID:    userID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		Visibility:  "game", // Common Room posts are always visible to game
	})

	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create post", "error", err, "game_id", gameID, "user_id", userID)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Post created successfully", "post_id", post.ID, "game_id", gameID, "author_id", userID)

	// Fetch full post details to return with metadata
	postDetails, err := messageService.GetPost(ctx, post.ID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to fetch post details", "error", err, "post_id", post.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(postDetails)
	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetGamePosts retrieves all posts for a game
func (h *Handler) GetGamePosts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_game_posts")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse optional query parameters
	phaseIDStr := r.URL.Query().Get("phase_id")
	var phaseID *int32
	if phaseIDStr != "" {
		pid, err := strconv.ParseInt(phaseIDStr, 10, 32)
		if err == nil {
			pid32 := int32(pid)
			phaseID = &pid32
		}
	}

	limitStr := r.URL.Query().Get("limit")
	limit := int32(50) // Default limit
	if limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err == nil && l > 0 && l <= 100 {
			limit = int32(l)
		}
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := int32(0)
	if offsetStr != "" {
		o, err := strconv.ParseInt(offsetStr, 10, 32)
		if err == nil && o >= 0 {
			offset = int32(o)
		}
	}

	// Fetch game for anonymous mode check
	queries := models.New(h.App.Pool)
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	userID, _ := getUserIDFromToken(r, h.App)
	showUsernames := core.CanSeeUsernamesInAnonymousGame(ctx, h.App.Pool, game, userID)

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	posts, err := messageService.GetGamePosts(ctx, int32(gameID), phaseID, limit, offset)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game posts", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0)
	for _, post := range posts {
		authorUsername := post.AuthorUsername
		if !showUsernames {
			authorUsername = ""
		}
		postData := map[string]interface{}{
			"id":                   post.ID,
			"game_id":              post.GameID,
			"author_id":            post.AuthorID,
			"character_id":         post.CharacterID,
			"content":              post.Content,
			"message_type":         string(post.MessageType),
			"thread_depth":         post.ThreadDepth,
			"author_username":      authorUsername,
			"character_name":       post.CharacterName,
			"character_avatar_url": post.CharacterAvatarUrl,
			"comment_count":        post.CommentCount,
			"is_edited":            post.IsEdited,
			"is_deleted":           post.IsDeleted,
			"created_at":           post.CreatedAt,
		}

		if post.PhaseID.Valid {
			postData["phase_id"] = post.PhaseID.Int32
		}
		if post.ParentID.Valid {
			postData["parent_id"] = post.ParentID.Int32
		}

		response = append(response, postData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateComment creates a comment on a post or another comment
func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_comment")()

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

	data := &CreateCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	comment, err := messageService.CreateComment(ctx, core.CreateCommentRequest{
		GameID:      int32(gameID),
		PhaseID:     data.PhaseID,
		AuthorID:    userID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		ParentID:    int32(postID),
		Visibility:  "game",
	})

	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create comment", "error", err, "game_id", gameID, "post_id", postID, "user_id", userID)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Comment created successfully", "comment_id", comment.ID, "post_id", postID, "author_id", userID)

	// Fetch full comment details
	commentDetails, err := messageService.GetComment(ctx, comment.ID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to fetch comment details", "error", err, "comment_id", comment.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(commentDetails)
	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetMessage retrieves a single message by ID (for deep linking)
func (h *Handler) GetMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_message")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	messageIDStr := chi.URLParam(r, "messageId")
	messageID, err := strconv.ParseInt(messageIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid message ID")))
		return
	}

	queries := models.New(h.App.Pool)
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	userID, _ := getUserIDFromToken(r, h.App)
	showUsernames := core.CanSeeUsernamesInAnonymousGame(ctx, h.App.Pool, game, userID)

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	message, err := messageService.GetMessage(ctx, int32(messageID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get message", "error", err, "message_id", messageID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(message)
	if !showUsernames {
		response.AuthorUsername = ""
	}
	render.Render(w, r, response)
}

// GetPostComments retrieves direct comments for a post
func (h *Handler) GetPostComments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_post_comments")()

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

	// Fetch game for anonymous mode check
	queries := models.New(h.App.Pool)
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	userID, _ := getUserIDFromToken(r, h.App)
	showUsernames := core.CanSeeUsernamesInAnonymousGame(ctx, h.App.Pool, game, userID)

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}
	comments, err := messageService.GetPostComments(ctx, int32(postID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get post comments", "error", err, "post_id", postID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0)
	for _, comment := range comments {
		authorUsername := comment.AuthorUsername
		if !showUsernames {
			authorUsername = ""
		}
		commentData := map[string]interface{}{
			"id":                      comment.ID,
			"game_id":                 comment.GameID,
			"author_id":               comment.AuthorID,
			"character_id":            comment.CharacterID,
			"content":                 comment.Content,
			"message_type":            string(comment.MessageType),
			"thread_depth":            comment.ThreadDepth,
			"author_username":         authorUsername,
			"character_name":          comment.CharacterName,
			"character_avatar_url":    comment.CharacterAvatarUrl,
			"reply_count":             comment.ReplyCount,
			"is_edited":               comment.IsEdited,
			"is_deleted":              comment.IsDeleted,
			"mentioned_character_ids": comment.MentionedCharacterIds,
			"created_at":              comment.CreatedAt,
		}

		if comment.PhaseID.Valid {
			commentData["phase_id"] = comment.PhaseID.Int32
		}
		if comment.ParentID.Valid {
			commentData["parent_id"] = comment.ParentID.Int32
		}

		response = append(response, commentData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetPostCommentsWithThreads fetches paginated top-level comments with nested replies
// GET /api/v1/games/:gameId/posts/:postId/comments-with-threads?limit=200&offset=0&max_depth=5
// Returns comments at depths 0 through (max_depth - 1) so Reply buttons appear on all visible comments
// "Continue thread" button shows on comments at (max_depth - 1) that have deeper replies
func (h *Handler) GetPostCommentsWithThreads(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_post_comments_with_threads")()

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

	// Parse query parameters with defaults
	limitStr := r.URL.Query().Get("limit")
	limit := int32(200) // Default: 200 top-level comments
	if limitStr != "" {
		limitInt, err := strconv.ParseInt(limitStr, 10, 32)
		if err != nil || limitInt < 1 || limitInt > 500 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid limit parameter (must be 1-500)")))
			return
		}
		limit = int32(limitInt)
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := int32(0)
	if offsetStr != "" {
		offsetInt, err := strconv.ParseInt(offsetStr, 10, 32)
		if err != nil || offsetInt < 0 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid offset parameter (must be >= 0)")))
			return
		}
		offset = int32(offsetInt)
	}

	maxDepthStr := r.URL.Query().Get("max_depth")
	maxDepth := int32(h.App.Config.App.CommentMaxDepth)
	if maxDepthStr != "" {
		maxDepthInt, err := strconv.ParseInt(maxDepthStr, 10, 32)
		if err != nil || maxDepthInt < 0 || maxDepthInt > 10 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid max_depth parameter (must be 0-10)")))
			return
		}
		maxDepth = int32(maxDepthInt)
	}

	// Fetch game for anonymous mode check
	queries := models.New(h.App.Pool)
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	userID, _ := getUserIDFromToken(r, h.App)
	showUsernames := core.CanSeeUsernamesInAnonymousGame(ctx, h.App.Pool, game, userID)

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	commentsWithDepth, err := messageService.GetPostCommentsWithThreads(ctx, int32(postID), limit, offset, maxDepth)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get post comments with threads", "error", err, "post_id", postID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	totalCount, err := messageService.CountTopLevelComments(ctx, int32(postID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to count top-level comments", "error", err, "post_id", postID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	comments := make([]map[string]interface{}, 0)
	for _, commentWithDepth := range commentsWithDepth {
		comment := commentWithDepth.Comment
		authorUsername := comment.AuthorUsername
		if !showUsernames {
			authorUsername = ""
		}
		commentData := map[string]interface{}{
			"id":                      comment.ID,
			"game_id":                 comment.GameID,
			"author_id":               comment.AuthorID,
			"character_id":            comment.CharacterID,
			"content":                 comment.Content,
			"message_type":            string(comment.MessageType),
			"thread_depth":            comment.ThreadDepth,
			"author_username":         authorUsername,
			"character_name":          comment.CharacterName,
			"character_avatar_url":    comment.CharacterAvatarUrl,
			"reply_count":             comment.ReplyCount,
			"is_edited":               comment.IsEdited,
			"is_deleted":              comment.IsDeleted,
			"mentioned_character_ids": comment.MentionedCharacterIds,
			"created_at":              comment.CreatedAt,
			"depth":                   commentWithDepth.Depth,
		}

		if comment.PhaseID.Valid {
			commentData["phase_id"] = comment.PhaseID.Int32
		}
		if comment.ParentID.Valid {
			commentData["parent_id"] = comment.ParentID.Int32
		}

		comments = append(comments, commentData)
	}

	response := map[string]interface{}{
		"comments":           comments,
		"total_top_level":    totalCount,
		"limit":              limit,
		"offset":             offset,
		"has_more":           totalCount > int64(offset+limit),
		"returned_top_level": countTopLevelInResponse(commentsWithDepth),
		"returned_total":     len(comments),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdatePost updates the content of an existing post
// PATCH /api/v1/games/:gameId/posts/:postId
func (h *Handler) UpdatePost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_post")()

	gameIDStr := chi.URLParam(r, "gameId")
	_, err := strconv.ParseInt(gameIDStr, 10, 32)
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

	data := &UpdatePostRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if len(strings.TrimSpace(data.Content)) == 0 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("content cannot be empty")))
		return
	}

	if err := validation.ValidatePost(data.Content); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	canEdit, err := messageService.CanUserEditPost(ctx, int32(postID), userID)
	if err != nil {
		if strings.Contains(err.Error(), "no rows") {
			h.App.ObsLogger.Warn(ctx, "Post not found", "post_id", postID)
			render.Render(w, r, core.ErrNotFound("post not found"))
			return
		}
		h.App.ObsLogger.Error(ctx, "Failed to check edit permission", "error", err, "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canEdit {
		h.App.ObsLogger.Warn(ctx, "User attempted to edit post without permission", "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrForbidden("You can only edit your own posts"))
		return
	}

	updatedPost, err := messageService.UpdatePost(ctx, int32(postID), data.Content)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update post", "error", err, "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Post updated successfully", "post_id", postID, "user_id", userID, "edit_count", updatedPost.EditCount)

	postDetails, err := messageService.GetPost(ctx, updatedPost.ID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to fetch updated post details", "error", err, "post_id", updatedPost.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(postDetails)
	render.Render(w, r, response)
}

// UpdateComment updates the content of an existing comment
// PATCH /api/v1/games/:gameId/posts/:postId/comments/:commentId
func (h *Handler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_comment")()

	gameIDStr := chi.URLParam(r, "gameId")
	_, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	commentIDStr := chi.URLParam(r, "commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid comment ID")))
		return
	}

	data := &UpdateCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	canEdit, err := messageService.CanUserEditComment(ctx, int32(commentID), userID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check edit permission", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canEdit {
		h.App.ObsLogger.Warn(ctx, "User attempted to edit comment without permission", "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrForbidden("You can only edit your own comments"))
		return
	}

	updatedComment, err := messageService.UpdateComment(ctx, int32(commentID), data.Content, data.CharacterID)
	if err != nil {
		if errors.Is(err, core.ErrCharacterNotControlled) {
			h.App.ObsLogger.Warn(ctx, "User attempted to use character they don't control", "comment_id", commentID, "user_id", userID, "requested_character_id", data.CharacterID)
			render.Render(w, r, core.ErrForbidden("You do not control this character"))
			return
		}
		h.App.ObsLogger.Error(ctx, "Failed to update comment", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Comment updated successfully", "comment_id", commentID, "user_id", userID, "edit_count", updatedComment.EditCount)

	commentDetails, err := messageService.GetComment(ctx, updatedComment.ID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to fetch updated comment details", "error", err, "comment_id", updatedComment.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(commentDetails)
	render.Render(w, r, response)
}

// DeleteComment soft-deletes a comment
// DELETE /api/v1/games/:gameId/posts/:postId/comments/:commentId
func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_comment")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
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

	// Get admin mode header
	adminModeHeader := r.Header.Get("X-Admin-Mode")
	isAdminMode := adminModeHeader == "true"

	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(int(userID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	isAdmin := isAdminMode && user.IsAdmin

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger, Metrics: h.App.Observability.OTELMetrics}

	canDelete, err := messageService.CanUserDeleteComment(ctx, int32(commentID), userID, isAdmin)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check delete permission", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canDelete {
		h.App.ObsLogger.Warn(ctx, "User attempted to delete comment without permission",
			"comment_id", commentID,
			"user_id", userID,
			"is_admin", isAdmin)
		render.Render(w, r, core.ErrForbidden("You don't have permission to delete this comment"))
		return
	}

	err = messageService.DeleteComment(ctx, int32(commentID), userID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to delete comment", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Comment deleted successfully",
		"comment_id", commentID,
		"game_id", gameID,
		"deleted_by_user_id", userID,
		"is_admin", isAdmin)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Comment deleted successfully",
		"id":      commentID,
	})
}
