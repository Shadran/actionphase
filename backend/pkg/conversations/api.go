package conversations

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// Handler handles HTTP requests for conversations
type Handler struct {
	App *core.App
}

// RegisterRoutes registers all conversation routes
// Note: This is called from within the games router, so gameId is already in the path context
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/{gameId}/conversations", func(r chi.Router) {
		r.Post("/", h.CreateConversation)                                   // Create new conversation
		r.Get("/", h.GetUserConversations)                                  // Get user's conversations
		r.Get("/{conversationId}", h.GetConversation)                       // Get conversation details
		r.Get("/{conversationId}/messages", h.GetConversationMessages)      // Get messages
		r.Post("/{conversationId}/messages", h.SendMessage)                 // Send message
		r.Delete("/{conversationId}/messages/{messageId}", h.DeleteMessage) // Delete message
		r.Patch("/{conversationId}/messages/{messageId}", h.UpdateMessage)  // Edit message
		r.Post("/{conversationId}/read", h.MarkAsRead)                      // Mark as read
		r.Post("/{conversationId}/participants", h.AddParticipant)          // Add participant
	})
}

// CreateConversationRequest represents the request body for creating a conversation
type CreateConversationRequest struct {
	Title        string  `json:"title"`
	CharacterIDs []int32 `json:"character_ids"` // Characters participating
}

func (r *CreateConversationRequest) Bind(req *http.Request) error {
	return nil
}

// CreateConversation creates a new conversation
func (h *Handler) CreateConversation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreateConversationRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if data.Title == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("conversation title is required")))
		return
	}

	if len(data.CharacterIDs) < 2 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("at least 2 characters required for a conversation")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for conversation validation", "error", err, "game_id", gameID)
		render.Render(w, r, core.HandleDBErrorWithID(err, "game", gameID))
		return
	}
	if !game.AllowGroupConversations && len(data.CharacterIDs) > 2 {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("group conversations are not allowed in this game")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	conv, err := conversationService.CreateConversation(ctx, db.CreateConversationRequest{
		GameID:          int32(gameID),
		Title:           data.Title,
		CreatedByUserID: userID,
		ParticipantIDs:  data.CharacterIDs,
	})
	if err != nil {
		h.App.Logger.Error("Failed to create conversation", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Conversation created successfully", "conversation_id", conv.ID, "game_id", gameID, "user_id", userID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(conv)
}

// GetUserConversations gets all conversations for the current user in a game
func (h *Handler) GetUserConversations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	conversations, err := conversationService.GetUserConversations(ctx, int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get user conversations", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Ensure we return an empty array instead of null
	if conversations == nil {
		conversations = []models.GetUserConversationsRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversations": conversations,
	})
}

// GetConversation gets details about a specific conversation
func (h *Handler) GetConversation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify user has valid access (checks current character ownership, not just participant records)
	canAccess, err := conversationService.CanUserAccessConversation(ctx, int32(conversationID), userID, authUser.IsAdmin)
	if err != nil {
		h.App.Logger.Error("Failed to check conversation access", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !canAccess {
		render.Render(w, r, core.ErrForbidden("you don't have access to this conversation"))
		return
	}

	// Get conversation details
	conv, err := conversationService.Queries.GetConversation(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get conversation", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get participants
	participants, err := conversationService.GetConversationParticipants(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get participants", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversation": conv,
		"participants": participants,
	})
}

// GetConversationMessages gets all messages in a conversation
func (h *Handler) GetConversationMessages(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify user has valid access (checks current character ownership, not just participant records)
	canAccess, err := conversationService.CanUserAccessConversation(ctx, int32(conversationID), userID, authUser.IsAdmin)
	if err != nil {
		h.App.Logger.Error("Failed to check conversation access", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !canAccess {
		render.Render(w, r, core.ErrForbidden("you don't have access to this conversation"))
		return
	}

	messages, err := conversationService.GetConversationMessages(ctx, int32(conversationID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get conversation messages", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Ensure we return an empty array instead of null
	if messages == nil {
		messages = []models.GetConversationMessagesRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"messages": messages,
	})
}

// SendMessageRequest represents the request body for sending a message
type SendMessageRequest struct {
	CharacterID int32  `json:"character_id"` // Character sending the message
	Content     string `json:"content"`
}

func (r *SendMessageRequest) Bind(req *http.Request) error {
	return nil
}

// SendMessage sends a message in a conversation
func (h *Handler) SendMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	data := &SendMessageRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if data.Content == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("message content is required")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify the character is a participant in this conversation
	participants, err := conversationService.GetConversationParticipants(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get conversation participants", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Checking character participation", "character_id", data.CharacterID, "conversation_id", conversationID, "user_id", userID, "participants_count", len(participants))

	// Check if the selected character is in the conversation
	isCharacterInConversation := false
	for _, p := range participants {
		h.App.Logger.Info("Participant check", "participant_user_id", p.UserID, "participant_character_id", p.CharacterID, "target_character_id", data.CharacterID)
		if p.CharacterID.Valid && p.CharacterID.Int32 == data.CharacterID {
			isCharacterInConversation = true
			break
		}
	}

	if !isCharacterInConversation {
		h.App.Logger.Warn("Character not in conversation", "character_id", data.CharacterID, "conversation_id", conversationID)
		render.Render(w, r, core.ErrForbidden("character is not a participant in this conversation"))
		return
	}

	// Verify the user can control this character (either owns it or can control it as NPC)
	if !core.CanUserControlNPC(ctx, h.App.Pool, data.CharacterID, userID) {
		h.App.Logger.Warn("User cannot control character", "character_id", data.CharacterID, "user_id", userID)
		render.Render(w, r, core.ErrForbidden("you cannot send messages as this character"))
		return
	}

	// Get character to access game_id for phase validation
	characterService := &db.CharacterService{DB: h.App.Pool}
	character, err := characterService.GetCharacter(ctx, data.CharacterID)
	if err != nil {
		h.App.Logger.Error("Failed to get character", "error", err, "character_id", data.CharacterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Validate that the game is in a common room phase
	phaseService := &phases.PhaseService{DB: h.App.Pool}
	activePhase, err := phaseService.GetActivePhase(ctx, character.GameID)
	if err != nil {
		h.App.Logger.Error("Failed to get active phase", "error", err, "game_id", character.GameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if activePhase == nil || (activePhase.PhaseType != core.PhaseTypeCommonRoom && activePhase.PhaseType != core.PhaseTypeInterlude) {
		h.App.Logger.Warn("Cannot send private messages outside common room or interlude phase", "game_id", character.GameID, "phase_type", activePhase.PhaseType)
		render.Render(w, r, core.ErrForbidden("private messages can only be sent during common room or interlude phases"))
		return
	}

	message, err := conversationService.SendMessage(ctx, db.SendMessageRequest{
		ConversationID:    int32(conversationID),
		SenderUserID:      userID,
		SenderCharacterID: data.CharacterID,
		Content:           data.Content,
	})
	if err != nil {
		h.App.Logger.Error("Failed to send message", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Message sent successfully", "message_id", message.ID, "conversation_id", conversationID, "author", authUser.Username)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(message)
}

// MarkAsRead marks all messages in a conversation as read
func (h *Handler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)
	if err := conversationService.MarkConversationAsRead(ctx, int32(conversationID), userID); err != nil {
		h.App.Logger.Error("Failed to mark conversation as read", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// AddParticipantRequest represents the request body for adding a participant
type AddParticipantRequest struct {
	CharacterID int32 `json:"character_id"`
}

func (r *AddParticipantRequest) Bind(req *http.Request) error {
	return nil
}

// AddParticipant adds a character to an existing conversation
func (h *Handler) AddParticipant(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify user has valid access (checks current character ownership, not just participant records)
	canAccess, err := conversationService.CanUserAccessConversation(ctx, int32(conversationID), userID, authUser.IsAdmin)
	if err != nil {
		h.App.Logger.Error("Failed to check conversation access", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !canAccess {
		render.Render(w, r, core.ErrForbidden("you don't have access to this conversation"))
		return
	}

	data := &AddParticipantRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if err := conversationService.AddParticipant(ctx, int32(conversationID), data.CharacterID); err != nil {
		h.App.Logger.Error("Failed to add participant", "error", err, "conversation_id", conversationID, "character_id", data.CharacterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Participant added successfully", "conversation_id", conversationID, "character_id", data.CharacterID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
	})
}

// UpdateMessageRequest represents the request body for editing a message
type UpdateMessageRequest struct {
	Content string `json:"content"`
}

func (r *UpdateMessageRequest) Bind(req *http.Request) error {
	return nil
}

// UpdateMessage edits an existing private message
func (h *Handler) UpdateMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	messageIDStr := chi.URLParam(r, "messageId")
	messageID, err := strconv.ParseInt(messageIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid message ID")))
		return
	}

	data := &UpdateMessageRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if data.Content == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("message content is required")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Verify user has valid access to the conversation
	canAccess, err := conversationService.CanUserAccessConversation(ctx, int32(conversationID), userID, authUser.IsAdmin)
	if err != nil {
		h.App.Logger.Error("Failed to check conversation access", "error", err, "conversation_id", conversationID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !canAccess {
		render.Render(w, r, core.ErrForbidden("you don't have access to this conversation"))
		return
	}

	// Get the message to find the character/game for phase validation
	msg, err := conversationService.Queries.GetPrivateMessage(ctx, int32(messageID))
	if err != nil {
		render.Render(w, r, core.ErrNotFound("message not found"))
		return
	}

	// Validate that the game is in a common room phase (same gate as sending)
	conv, err := conversationService.Queries.GetConversation(ctx, int32(conversationID))
	if err != nil {
		h.App.Logger.Error("Failed to get conversation", "error", err, "conversation_id", conversationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	phaseService := &phases.PhaseService{DB: h.App.Pool}
	activePhase, err := phaseService.GetActivePhase(ctx, conv.GameID)
	if err != nil {
		h.App.Logger.Error("Failed to get active phase", "error", err, "game_id", conv.GameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if activePhase == nil || (activePhase.PhaseType != core.PhaseTypeCommonRoom && activePhase.PhaseType != core.PhaseTypeInterlude) {
		render.Render(w, r, core.ErrForbidden("private messages can only be edited during common room or interlude phases"))
		return
	}

	updated, err := conversationService.UpdatePrivateMessage(ctx, int32(messageID), userID, data.Content)
	if err != nil {
		if err.Error() == "message not found" {
			render.Render(w, r, core.ErrNotFound("message not found"))
			return
		}
		if err.Error() == "forbidden: you can only edit your own messages" {
			render.Render(w, r, core.ErrForbidden("you can only edit your own messages"))
			return
		}
		if err.Error() == "cannot edit a deleted message" {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("cannot edit a deleted message")))
			return
		}
		h.App.Logger.Error("Failed to update message", "error", err, "message_id", messageID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Message updated successfully", "message_id", msg.ID, "conversation_id", conversationID, "user_id", userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// DeleteMessage deletes a private message (soft delete)
func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int32(authUser.ID)

	conversationIDStr := chi.URLParam(r, "conversationId")
	conversationID, err := strconv.ParseInt(conversationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid conversation ID")))
		return
	}

	messageIDStr := chi.URLParam(r, "messageId")
	messageID, err := strconv.ParseInt(messageIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid message ID")))
		return
	}

	conversationService := db.NewConversationService(h.App.Pool)

	// Delete the message (service handles authorization check)
	err = conversationService.DeletePrivateMessage(ctx, int32(messageID), userID)
	if err != nil {
		if err.Error() == "message not found" {
			render.Render(w, r, core.ErrNotFound("message not found"))
			return
		}
		if err.Error() == "forbidden: you can only delete your own messages" {
			render.Render(w, r, core.ErrForbidden("you can only delete your own messages"))
			return
		}
		h.App.Logger.Error("Failed to delete message", "error", err, "message_id", messageID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Message deleted successfully", "message_id", messageID, "conversation_id", conversationID, "user_id", userID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Message deleted successfully",
		"id":      messageID,
	})
}
