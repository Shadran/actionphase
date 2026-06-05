package messages

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
)

// ValidateCharacterOwnership verifies character belongs to author and game
func (s *MessageService) ValidateCharacterOwnership(ctx context.Context, characterID, authorID, gameID int32) error {
	queries := models.New(s.DB)

	// Get the character to verify it belongs to the game
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("character not found: %w", err)
	}

	// Verify character belongs to the game
	if character.GameID != gameID {
		return errors.New("character does not belong to this game")
	}

	// Use centralized NPC control check (handles player characters, NPCs, GM, co-GM, and assignments)
	if !core.CanUserControlNPC(ctx, s.DB, characterID, authorID) {
		return errors.New("character does not belong to this user")
	}

	return nil
}

// notifyCharacterMentions triggers notifications for all characters mentioned in a message
// This runs in a goroutine and should not fail the parent operation
func (s *MessageService) notifyCharacterMentions(ctx context.Context, mentionedCharacterIDs []int32, authorCharacterID, authorUserID, gameID, messageID int32) {
	if len(mentionedCharacterIDs) == 0 {
		return
	}

	queries := models.New(s.DB)
	notificationService := db.NewNotificationService(s.DB, s.Logger)

	// Get the author character's name
	authorChar, err := queries.GetCharacter(ctx, authorCharacterID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get author character for mention notifications",
			"character_id", authorCharacterID,
			"game_id", gameID,
		)
		return
	}

	// For each mentioned character, notify the owner
	for _, mentionedCharID := range mentionedCharacterIDs {
		mentionedChar, err := queries.GetCharacter(ctx, mentionedCharID)
		if err != nil {
			s.Logger.LogError(ctx, err, "Failed to get mentioned character",
				"character_id", mentionedCharID,
				"game_id", gameID,
			)
			continue
		}

		// Don't notify if user is mentioning their own character
		var characterOwnerID int32
		if mentionedChar.UserID.Valid {
			characterOwnerID = mentionedChar.UserID.Int32
		} else {
			// NPC - check if assigned to an audience member first
			assignment, err := queries.GetNPCAssignment(ctx, mentionedCharID)
			if err == nil {
				// NPC is assigned to a user (e.g., audience member)
				characterOwnerID = assignment.AssignedUserID
			} else {
				// Unassigned NPC - notify the GM
				game, err := queries.GetGame(ctx, gameID)
				if err != nil {
					s.Logger.LogError(ctx, err, "Failed to get game for NPC mention notification",
						"game_id", gameID,
					)
					continue
				}
				characterOwnerID = game.GmUserID
			}
		}

		// Skip if author is the character owner (don't notify self)
		if characterOwnerID == authorUserID {
			continue
		}

		// Trigger notification
		err = notificationService.NotifyCharacterMention(
			ctx,
			characterOwnerID,
			messageID,
			gameID,
			authorChar.Name,
			mentionedChar.Name,
		)
		if err != nil {
			s.Logger.LogError(ctx, err, "Failed to send character mention notification",
				"mentioned_character_id", mentionedCharID,
				"message_id", messageID,
				"game_id", gameID,
			)
			s.Metrics.RecordBackgroundJobFailure(ctx, "mention_notification")
		} else {
			s.Logger.Debug(ctx, "Character mention notification sent",
				"mentioned_character_id", mentionedCharID,
				"message_id", messageID,
				"game_id", gameID,
			)
		}
	}
}

// notifyCommentReply triggers a notification when someone replies to a comment
// This runs in a goroutine and should not fail the parent operation
func (s *MessageService) notifyCommentReply(ctx context.Context, parentMessageID, replierCharacterID, replierUserID, gameID, replyMessageID int32) {
	queries := models.New(s.DB)
	notificationService := db.NewNotificationService(s.DB, s.Logger)

	// Get the parent message
	parentMessage, err := queries.GetComment(ctx, parentMessageID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get parent message for reply notification",
			"parent_id", parentMessageID,
			"game_id", gameID,
		)
		return
	}

	// Don't notify if replying to own comment
	if parentMessage.AuthorID == replierUserID {
		return
	}

	// Get the replier character's name
	replierChar, err := queries.GetCharacter(ctx, replierCharacterID)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to get replier character",
			"character_id", replierCharacterID,
			"game_id", gameID,
		)
		return
	}

	// Trigger notification to the parent comment author
	err = notificationService.NotifyCommentReply(
		ctx,
		parentMessage.AuthorID,
		replyMessageID,
		gameID,
		replierChar.Name,
	)
	if err != nil {
		s.Logger.LogError(ctx, err, "Failed to send comment reply notification",
			"parent_author_id", parentMessage.AuthorID,
			"reply_message_id", replyMessageID,
			"game_id", gameID,
		)
		s.Metrics.RecordBackgroundJobFailure(ctx, "reply_notification")
	} else {
		s.Logger.Debug(ctx, "Comment reply notification sent",
			"parent_author_id", parentMessage.AuthorID,
			"reply_message_id", replyMessageID,
			"game_id", gameID,
		)
	}
}

// extractCharacterMentions parses content for @CharacterName mentions and returns character IDs.
// It deduplicates mentions and gracefully handles non-existent character names.
// It skips mentions inside code blocks (inline backticks or fenced code blocks).
//
// Strategy: Get all characters in the game, then check if @CharacterName appears in content.
// This approach handles multi-word names correctly (e.g., "Test Player 2 Character").
func (s *MessageService) extractCharacterMentions(ctx context.Context, content string, gameID int32) ([]int32, error) {
	queries := models.New(s.DB)

	// Get all characters in this game
	characters, err := queries.GetCharactersByGame(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game characters: %w", err)
	}

	// Remove code blocks before extracting mentions
	// This regex matches:
	// - Fenced code blocks (```lang\ncode\n``` or ```code```)
	// - Inline code (`code`)
	codeBlockRegex := regexp.MustCompile("```[\\s\\S]*?```|`[^`\\n]+?`")
	contentWithoutCode := codeBlockRegex.ReplaceAllString(content, "")

	mentionedIDs := make([]int32, 0)
	seenIDs := make(map[int32]bool)

	// For each character, check if @CharacterName appears in non-code content
	for _, char := range characters {
		// Escape special regex characters in character name
		escapedName := regexp.QuoteMeta(char.Name)

		// Match @CharacterName ensuring @ is not part of another mention
		// Use word boundary \b before @ (or start of string)
		// After the name, use \b or non-alphanumeric (allows punctuation like comma, period)
		mentionPattern := fmt.Sprintf(`(?:^|\s|[^\w@])@%s(?:\s|[^\w]|$)`, escapedName)
		mentionRegex := regexp.MustCompile(mentionPattern)

		matched := mentionRegex.MatchString(contentWithoutCode)
		if matched {
			// Deduplicate - only add each character ID once
			if !seenIDs[char.ID] {
				mentionedIDs = append(mentionedIDs, char.ID)
				seenIDs[char.ID] = true
			}
		}
	}

	return mentionedIDs, nil
}
