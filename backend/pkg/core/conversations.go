package core

// CreateConversationRequest is the domain request for creating a conversation.
type CreateConversationRequest struct {
	GameID          int32
	Title           string
	CreatedByUserID int32
	ParticipantIDs  []int32 // Character IDs
}

// SendConversationMessageRequest is the domain request for sending a private message.
type SendConversationMessageRequest struct {
	ConversationID    int32
	SenderUserID      int32
	SenderCharacterID int32
	Content           string
}
