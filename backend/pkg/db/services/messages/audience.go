package messages

import (
	"context"
	"fmt"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// ============================================================================
// Audience Participation Methods (Private Conversation Viewing)
// ============================================================================

// ListAllPrivateConversations lists all private conversations in a game (for audience/GM)
// Returns conversation metadata including message counts and latest activity
// Supports pagination and filtering by participant names
func (ms *MessageService) ListAllPrivateConversations(ctx context.Context, params core.ListAllPrivateConversationsParams) ([]models.ListAllPrivateConversationsRow, error) {
	queries := models.New(ms.DB)

	// Convert to sqlc params
	sqlcParams := models.ListAllPrivateConversationsParams{
		GameID:           params.GameID,
		ParticipantNames: params.ParticipantNames,
		ResultLimit:      params.Limit,
		ResultOffset:     params.Offset,
	}

	conversations, err := queries.ListAllPrivateConversations(ctx, sqlcParams)
	if err != nil {
		return nil, fmt.Errorf("failed to list all private conversations: %w", err)
	}

	return conversations, nil
}

// CountAllPrivateConversations returns the total number of private conversations in a game,
// applying the same participant filter as ListAllPrivateConversations.
func (ms *MessageService) CountAllPrivateConversations(ctx context.Context, gameID int32, participantNames []string) (int64, error) {
	queries := models.New(ms.DB)

	count, err := queries.CountAllPrivateConversations(ctx, models.CountAllPrivateConversationsParams{
		GameID:           gameID,
		ParticipantNames: participantNames,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to count all private conversations: %w", err)
	}

	return count, nil
}

// GetConversationParticipantNames returns all participant names that appear in at least
// one conversation in the game, optionally narrowed to those who share a conversation
// with all of the given selected names.
func (ms *MessageService) GetConversationParticipantNames(ctx context.Context, gameID int32, selectedNames []string) ([]string, error) {
	queries := models.New(ms.DB)

	rows, err := queries.GetConversationParticipantNames(ctx, models.GetConversationParticipantNamesParams{
		GameID:        gameID,
		SelectedNames: selectedNames,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation participant names: %w", err)
	}

	names := make([]string, 0, len(rows))
	for _, r := range rows {
		if name, ok := r.(string); ok && name != "" {
			names = append(names, name)
		}
	}
	return names, nil
}

// GetAudienceConversationMessages retrieves all messages in a conversation (for audience/GM)
// Returns messages with sender information and character details
func (ms *MessageService) GetAudienceConversationMessages(ctx context.Context, conversationID int32) ([]models.GetAudienceConversationMessagesRow, error) {
	queries := models.New(ms.DB)

	messages, err := queries.GetAudienceConversationMessages(ctx, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get conversation messages: %w", err)
	}

	return messages, nil
}
