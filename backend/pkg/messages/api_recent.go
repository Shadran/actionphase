package messages

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	messagesvc "actionphase/pkg/db/services/messages"
)

// ListRecentCommentsWithParents lists recent comments with their parent messages for the "New Comments" view
// GET /api/v1/games/:gameId/comments/recent
func (h *Handler) ListRecentCommentsWithParents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_recent_comments_with_parents")()

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

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
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	userID, _ := getUserIDFromToken(r, h.App)
	showUsernames := core.CanSeeUsernamesInAnonymousGame(ctx, h.App.Pool, game, userID)

	messageService := &messagesvc.MessageService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	comments, err := messageService.ListRecentCommentsWithParents(ctx, int32(gameID), int32(limit), int32(offset))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list recent comments", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

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
			"created_at":           msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
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
