package messages

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	messagesvc "actionphase/pkg/db/services/messages"
	"actionphase/pkg/validation"
)

type Handler struct {
	App *core.App
}

// Request Types
type CreatePostRequest struct {
	PhaseID     *int32 `json:"phase_id,omitempty"`
	CharacterID int32  `json:"character_id" validate:"required"`
	Content     string `json:"content" validate:"required,min=1"`
}

func (r *CreatePostRequest) Bind(req *http.Request) error {
	return nil
}

type CreateCommentRequest struct {
	PhaseID     *int32 `json:"phase_id,omitempty"`
	CharacterID int32  `json:"character_id" validate:"required"`
	Content     string `json:"content" validate:"required,min=1"`
}

func (r *CreateCommentRequest) Bind(req *http.Request) error {
	return nil
}

type UpdateCommentRequest struct {
	Content     string `json:"content" validate:"required,min=1"`
	CharacterID *int32 `json:"character_id,omitempty"`
}

func (r *UpdateCommentRequest) Bind(req *http.Request) error {
	return nil
}

type UpdatePostRequest struct {
	Content string `json:"content" validate:"required,min=1"`
}

func (r *UpdatePostRequest) Bind(req *http.Request) error {
	return nil
}

// ManualReadCommentIDsResponse represents the manual read comment IDs for a post
type ManualReadCommentIDsResponse struct {
	PostID         int32   `json:"post_id"`
	ReadCommentIDs []int32 `json:"read_comment_ids"`
}

// Response Types
type MessageResponse struct {
	ID                    int32      `json:"id"`
	GameID                int32      `json:"game_id"`
	PhaseID               *int32     `json:"phase_id,omitempty"`
	AuthorID              int32      `json:"author_id"`
	CharacterID           int32      `json:"character_id"`
	Content               string     `json:"content"`
	MessageType           string     `json:"message_type"`
	ParentID              *int32     `json:"parent_id,omitempty"`
	ThreadDepth           int32      `json:"thread_depth"`
	AuthorUsername        string     `json:"author_username"`
	CharacterName         string     `json:"character_name"`
	CharacterAvatarUrl    *string    `json:"character_avatar_url,omitempty"`
	CommentCount          int64      `json:"comment_count"` // Always include, even if 0
	ReplyCount            int64      `json:"reply_count,omitempty"`
	IsEdited              bool       `json:"is_edited"`
	IsDeleted             bool       `json:"is_deleted"`
	MentionedCharacterIds []int32    `json:"mentioned_character_ids,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	DeletedAt             *time.Time `json:"deleted_at,omitempty"`
	DeletedByUserID       *int32     `json:"deleted_by_user_id,omitempty"`
	EditedAt              *time.Time `json:"edited_at,omitempty"`
	EditCount             int32      `json:"edit_count"`
}

func (rd *MessageResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// Helper function to get user ID from JWT token
func getUserIDFromToken(r *http.Request, app *core.App) (int32, error) {
	userService := &db.UserService{DB: app.Pool, Logger: app.ObsLogger}
	userID, errResp := core.GetUserIDFromJWT(r.Context(), userService)
	if errResp != nil {
		return 0, fmt.Errorf("authentication failed")
	}
	return userID, nil
}

// Helper function to convert MessageWithDetails to MessageResponse
func messageWithDetailsToResponse(msg *core.MessageWithDetails) *MessageResponse {
	response := &MessageResponse{
		ID:                    msg.ID,
		GameID:                msg.GameID,
		AuthorID:              msg.AuthorID,
		CharacterID:           msg.CharacterID,
		Content:               msg.Content,
		MessageType:           string(msg.MessageType),
		ThreadDepth:           msg.ThreadDepth,
		AuthorUsername:        msg.AuthorUsername,
		CharacterName:         msg.CharacterName,
		CharacterAvatarUrl:    msg.CharacterAvatarUrl,
		IsEdited:              msg.IsEdited,
		IsDeleted:             msg.IsDeleted,
		MentionedCharacterIds: msg.MentionedCharacterIds,
		CreatedAt:             msg.CreatedAt.Time,
		EditCount:             msg.EditCount,
	}

	if msg.PhaseID.Valid {
		phaseID := msg.PhaseID.Int32
		response.PhaseID = &phaseID
	}

	if msg.ParentID.Valid {
		parentID := msg.ParentID.Int32
		response.ParentID = &parentID
	}

	if msg.DeletedAt.Valid {
		deletedAt := msg.DeletedAt.Time
		response.DeletedAt = &deletedAt
	}

	if msg.DeletedByUserID.Valid {
		deletedByUserID := msg.DeletedByUserID.Int32
		response.DeletedByUserID = &deletedByUserID
	}

	if msg.EditedAt.Valid {
		editedAt := msg.EditedAt.Time
		response.EditedAt = &editedAt
	}

	// Set either CommentCount or ReplyCount depending on message type
	if string(msg.MessageType) == "post" {
		response.CommentCount = msg.CommentCount
	} else {
		response.ReplyCount = msg.ReplyCount
	}

	return response
}

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

	isPrimaryGM := game.GmUserID == userID || core.IsUserCoGM(ctx, h.App.Pool, int32(gameID), userID)
	isCoGM := core.IsUserCoGM(ctx, h.App.Pool, int32(gameID), userID)

	if !isPrimaryGM && !isCoGM {
		h.App.ObsLogger.Warn(ctx, "Non-GM/co-GM user attempted to create post", "user_id", userID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("Only the Game Master or co-GM can create posts"))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
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

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse post ID
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
	offset := int32(0) // Default: start from beginning
	if offsetStr != "" {
		offsetInt, err := strconv.ParseInt(offsetStr, 10, 32)
		if err != nil || offsetInt < 0 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid offset parameter (must be >= 0)")))
			return
		}
		offset = int32(offsetInt)
	}

	maxDepthStr := r.URL.Query().Get("max_depth")
	maxDepth := int32(h.App.Config.App.CommentMaxDepth) // Default from config
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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Get paginated comments with threads
	commentsWithDepth, err := messageService.GetPostCommentsWithThreads(ctx, int32(postID), limit, offset, maxDepth)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get post comments with threads", "error", err, "post_id", postID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get total count for pagination
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
			"depth":                   commentWithDepth.Depth, // NEW: depth for tree building
		}

		if comment.PhaseID.Valid {
			commentData["phase_id"] = comment.PhaseID.Int32
		}
		if comment.ParentID.Valid {
			commentData["parent_id"] = comment.ParentID.Int32
		}

		comments = append(comments, commentData)
	}

	// Response with pagination metadata
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

// countTopLevelInResponse counts how many top-level comments (depth=0) are in the response
func countTopLevelInResponse(comments []core.CommentWithDepth) int {
	count := 0
	for _, c := range comments {
		if c.Depth == 0 {
			count++
		}
	}
	return count
}

// ============================================================================
// READ TRACKING HANDLERS
// ============================================================================

// MarkPostRead marks a post (and optionally a specific comment) as read
// POST /api/v1/games/:gameId/posts/:postId/mark-read
func (h *Handler) MarkPostRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_mark_post_read")()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse post ID
	postIDStr := chi.URLParam(r, "postId")
	postID, err := strconv.ParseInt(postIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid post ID")))
		return
	}

	// Get user ID from JWT
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Parse request body for optional last_read_comment_id
	var requestBody struct {
		LastReadCommentID *int32 `json:"last_read_comment_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil && err != io.EOF {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid request body")))
		return
	}

	// Mark as read
	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	readMarker, err := messageService.MarkPostAsRead(ctx, userID, int32(gameID), int32(postID), requestBody.LastReadCommentID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to mark post as read", "error", err, "game_id", gameID, "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Return the read marker
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

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Get read markers
	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	readMarkers, err := messageService.GetUserReadMarkersForGame(ctx, userID, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get read markers", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
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

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get posts unread info
	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	postsInfo, err := messageService.GetPostsWithUnreadInfo(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get posts unread info", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
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

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Get unread comment IDs
	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	unreadComments, err := messageService.GetUnreadCommentIDsForPosts(ctx, userID, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get unread comment IDs", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
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

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
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

// UpdatePost updates the content of an existing post
// PATCH /api/v1/games/:gameId/posts/:postId
func (h *Handler) UpdatePost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_post")()

	// Parse IDs
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

	// Parse request body
	data := &UpdatePostRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate content is not empty
	if len(strings.TrimSpace(data.Content)) == 0 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("content cannot be empty")))
		return
	}

	// Validate content length
	if err := validation.ValidatePost(data.Content); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from token
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Check if user can edit this post (must be author)
	canEdit, err := messageService.CanUserEditPost(ctx, int32(postID), userID)
	if err != nil {
		// Check if error is due to post not existing
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

	// Update the post
	updatedPost, err := messageService.UpdatePost(ctx, int32(postID), data.Content)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to update post", "error", err, "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Post updated successfully", "post_id", postID, "user_id", userID, "edit_count", updatedPost.EditCount)

	// Fetch full post details to return
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

	// Parse IDs
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

	// Parse request body
	data := &UpdateCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from token
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Check if user can edit this comment (must be author)
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

	// Update the comment
	updatedComment, err := messageService.UpdateComment(ctx, int32(commentID), data.Content, data.CharacterID)
	if err != nil {
		// Check if this is a permission error
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

	// Fetch full comment details to return
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

	// Parse IDs
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

	// Get user ID from token
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Get admin mode header
	adminModeHeader := r.Header.Get("X-Admin-Mode")
	isAdminMode := adminModeHeader == "true"

	// Get user service to check if user is admin
	userService := &db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := userService.GetUserByID(int(userID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Admin mode only works for actual admins
	isAdmin := isAdminMode && user.IsAdmin

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Check if user can delete this comment
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

	// Delete the comment
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

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Comment deleted successfully",
		"id":      commentID,
	})
}

// ListRecentCommentsWithParents lists recent comments with their parent messages for the "New Comments" view
// GET /api/v1/games/:gameId/comments/recent
func (h *Handler) ListRecentCommentsWithParents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_recent_comments_with_parents")()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	// Default limit is 10, max is 50
	limit := 10
	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err != nil || parsedLimit < 1 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid limit parameter")))
			return
		}
		if parsedLimit > 50 {
			parsedLimit = 50
		}
		limit = parsedLimit
	}

	// Default offset is 0
	offset := 0
	if offsetStr != "" {
		parsedOffset, err := strconv.Atoi(offsetStr)
		if err != nil || parsedOffset < 0 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid offset parameter")))
			return
		}
		offset = parsedOffset
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

	// Get comments with parents from service
	// Note: No permission check required - comments are publicly viewable like posts
	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	comments, err := messageService.ListRecentCommentsWithParents(ctx, int32(gameID), int32(limit), int32(offset))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list recent comments", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get total comment count for pagination metadata
	totalCount, err := messageService.GetTotalCommentCount(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get total comment count", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.ObsLogger.Info(ctx, "Listed recent comments with parents",
		"game_id", gameID,
		"limit", limit,
		"offset", offset,
		"count", len(comments),
		"total", totalCount)

	// Convert to response format
	response := map[string]interface{}{
		"comments": commentsWithParentsToResponse(comments, showUsernames),
		"pagination": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  totalCount,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper function to convert CommentWithParent slice to response format
func commentsWithParentsToResponse(comments []core.CommentWithParent, showUsernames bool) []map[string]interface{} {
	result := make([]map[string]interface{}, len(comments))
	for i, comment := range comments {
		authorUsername := comment.AuthorUsername
		if !showUsernames {
			authorUsername = ""
		}
		commentData := map[string]interface{}{
			"id":                   comment.ID,
			"game_id":              comment.GameID,
			"parent_id":            comment.ParentID,
			"post_id":              comment.PostID,
			"author_id":            comment.AuthorID,
			"character_id":         comment.CharacterID,
			"content":              comment.Content,
			"created_at":           comment.CreatedAt.Format(time.RFC3339),
			"edited_at":            formatTimePtr(comment.EditedAt),
			"edit_count":           comment.EditCount,
			"deleted_at":           formatTimePtr(comment.DeletedAt),
			"is_deleted":           comment.IsDeleted,
			"author_username":      authorUsername,
			"character_name":       comment.CharacterName,
			"character_avatar_url": comment.CharacterAvatarUrl,
		}

		// Add parent data if exists
		if comment.ParentContent != nil {
			parentAuthorUsername := comment.ParentAuthorUsername
			if !showUsernames {
				emptyStr := ""
				parentAuthorUsername = &emptyStr
			}
			commentData["parent"] = map[string]interface{}{
				"content":              comment.ParentContent,
				"created_at":           formatTimePtr(comment.ParentCreatedAt),
				"deleted_at":           formatTimePtr(comment.ParentDeletedAt),
				"is_deleted":           comment.ParentIsDeleted,
				"message_type":         comment.ParentMessageType,
				"author_username":      parentAuthorUsername,
				"character_name":       comment.ParentCharacterName,
				"character_avatar_url": comment.ParentCharacterAvatarUrl,
			}
		}

		result[i] = commentData
	}
	return result
}

// Helper function to format *time.Time as RFC3339 string or nil
func formatTimePtr(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t.Format(time.RFC3339)
}

// GetCharacterComments retrieves paginated public posts and comments by a specific character
func (h *Handler) GetCharacterComments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_character_comments")()

	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 20
	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err != nil || parsedLimit < 1 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid limit parameter")))
			return
		}
		if parsedLimit > 50 {
			parsedLimit = 50
		}
		limit = parsedLimit
	}

	offset := 0
	if offsetStr != "" {
		parsedOffset, err := strconv.Atoi(offsetStr)
		if err != nil || parsedOffset < 0 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid offset parameter")))
			return
		}
		offset = parsedOffset
	}

	queries := models.New(h.App.Pool)

	character, err := queries.GetCharacter(ctx, int32(characterID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get character", "error", err, "character_id", characterID)
		render.Render(w, r, core.ErrNotFound("character not found"))
		return
	}

	game, err := queries.GetGame(ctx, character.GameID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game for character", "error", err, "game_id", character.GameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	userID, _ := getUserIDFromToken(r, h.App)
	showUsernames := core.CanSeeUsernamesInAnonymousGame(ctx, h.App.Pool, game, userID)

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	messages, err := messageService.ListCharacterPostsAndComments(ctx, int32(characterID), int32(limit), int32(offset))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list character messages", "error", err, "character_id", characterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	totalCount, err := messageService.CountCharacterPostsAndComments(ctx, int32(characterID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to count character messages", "error", err, "character_id", characterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	result := make([]map[string]interface{}, len(messages))
	for i, msg := range messages {
		authorUsername := msg.AuthorUsername
		if !showUsernames {
			authorUsername = ""
		}
		msgData := map[string]interface{}{
			"id":                   msg.ID,
			"game_id":              msg.GameID,
			"parent_id":            msg.ParentID,
			"author_id":            msg.AuthorID,
			"character_id":         msg.CharacterID,
			"content":              msg.Content,
			"message_type":         msg.MessageType,
			"created_at":           msg.CreatedAt.Format(time.RFC3339),
			"edited_at":            formatTimePtr(msg.EditedAt),
			"edit_count":           msg.EditCount,
			"deleted_at":           formatTimePtr(msg.DeletedAt),
			"is_deleted":           msg.IsDeleted,
			"author_username":      authorUsername,
			"character_name":       msg.CharacterName,
			"character_avatar_url": msg.CharacterAvatarUrl,
		}

		if msg.ParentContent != nil {
			parentAuthorUsername := msg.ParentAuthorUsername
			if !showUsernames {
				parentAuthorUsername = nil
			}
			msgData["parent"] = map[string]interface{}{
				"content":              msg.ParentContent,
				"created_at":           formatTimePtr(msg.ParentCreatedAt),
				"deleted_at":           formatTimePtr(msg.ParentDeletedAt),
				"is_deleted":           msg.ParentIsDeleted,
				"message_type":         msg.ParentMessageType,
				"author_username":      parentAuthorUsername,
				"character_name":       msg.ParentCharacterName,
				"character_avatar_url": msg.ParentCharacterAvatarUrl,
			}
		}

		result[i] = msgData
	}

	response := map[string]interface{}{
		"messages": result,
		"pagination": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  totalCount,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
