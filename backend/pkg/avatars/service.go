package avatars

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// MaxAvatarSize is the maximum allowed avatar file size (5MB)
	MaxAvatarSize = 5 * 1024 * 1024 // 5MB in bytes

	// Allowed MIME types for avatar uploads
	MimeTypeJPEG = "image/jpeg"
	MimeTypePNG  = "image/png"
	MimeTypeWebP = "image/webp"
)

var allowedMimeTypes = map[string]bool{
	MimeTypeJPEG: true,
	MimeTypePNG:  true,
	MimeTypeWebP: true,
}

// AvatarService implements avatar management for characters.
// Handles file upload validation, storage, and database updates.
type AvatarService struct {
	DB      *pgxpool.Pool
	Storage core.StorageBackendInterface
}

// Compile-time verification that AvatarService implements AvatarServiceInterface
var _ core.AvatarServiceInterface = (*AvatarService)(nil)

// UploadCharacterAvatar uploads an avatar image for a character.
//
// Validation:
//   - File type must be image/jpeg, image/png, or image/webp
//   - File size must be ≤5MB
//
// Process:
//  1. Validate content type
//  2. Read file into memory (to check size)
//  3. Delete old avatar if exists
//  4. Upload new avatar to storage
//  5. Update database with new avatar URL
//
// Returns the public URL of the uploaded avatar.
func (s *AvatarService) UploadCharacterAvatar(
	ctx context.Context,
	characterID int32,
	file io.Reader,
	filename string,
	contentType string,
) (string, error) {
	// Validate content type
	if !allowedMimeTypes[contentType] {
		return "", fmt.Errorf("invalid file type %s. Only JPG, PNG, and WebP images are allowed", contentType)
	}

	// Read file into memory to check size and enable re-reading
	fileData, _, err := readAndValidateSize(file, MaxAvatarSize)
	if err != nil {
		return "", err
	}

	// Get current character to check for existing avatar
	queries := db.New(s.DB)
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return "", fmt.Errorf("failed to get character: %w", err)
	}

	// Delete old avatar if exists
	if character.AvatarUrl.Valid && character.AvatarUrl.String != "" {
		oldPath := extractPathFromURL(character.AvatarUrl.String)
		if err := s.Storage.Delete(ctx, oldPath); err != nil {
			// Log error but don't fail upload - old file might already be gone
			// In production, use proper logging here
		}
	}

	// Generate storage path: avatars/characters/{characterID}/{timestamp}_{filename}
	ext := filepath.Ext(filename)
	if ext == "" {
		// Derive extension from content type
		ext = mimeTypeToExtension(contentType)
	}
	timestamp := time.Now().Unix()
	storagePath := fmt.Sprintf("avatars/characters/%d/%d%s", characterID, timestamp, ext)

	// Upload to storage
	avatarURL, err := s.Storage.Upload(ctx, storagePath, fileData, contentType)
	if err != nil {
		return "", fmt.Errorf("failed to upload avatar: %w", err)
	}

	// Update database
	_, err = queries.UpdateCharacterAvatar(ctx, db.UpdateCharacterAvatarParams{
		ID:        characterID,
		AvatarUrl: pgtype.Text{String: avatarURL, Valid: true},
	})
	if err != nil {
		// Try to clean up uploaded file
		_ = s.Storage.Delete(ctx, storagePath)
		return "", fmt.Errorf("failed to update character avatar: %w", err)
	}

	return avatarURL, nil
}

// DeleteCharacterAvatar removes a character's avatar.
// Deletes the file from storage and updates the database.
func (s *AvatarService) DeleteCharacterAvatar(ctx context.Context, characterID int32) error {
	queries := db.New(s.DB)

	// Get current character
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("failed to get character: %w", err)
	}

	// If no avatar, nothing to delete
	if !character.AvatarUrl.Valid || character.AvatarUrl.String == "" {
		return nil
	}

	// Delete from storage
	oldPath := extractPathFromURL(character.AvatarUrl.String)
	if err := s.Storage.Delete(ctx, oldPath); err != nil {
		// Log error but continue - file might already be gone
	}

	// Update database
	if err := queries.DeleteCharacterAvatar(ctx, characterID); err != nil {
		return fmt.Errorf("failed to delete character avatar from database: %w", err)
	}

	return nil
}

// Helper functions

// readAndValidateSize reads the entire file into memory and validates size.
// Returns a new reader with the data and the size in bytes.
func readAndValidateSize(file io.Reader, maxSize int64) (io.Reader, int64, error) {
	// Use a LimitReader to prevent reading too much
	limitedReader := io.LimitReader(file, maxSize+1)

	// Read into memory
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to read file: %w", err)
	}

	size := int64(len(data))

	// Check if file exceeds max size
	if size > maxSize {
		return nil, 0, fmt.Errorf("image too large. Maximum size is %d bytes (%.1fMB)", maxSize, float64(maxSize)/(1024*1024))
	}

	// Return a new reader with the data
	return strings.NewReader(string(data)), size, nil
}

// extractPathFromURL extracts the storage path from a public URL.
// Example: "http://localhost:3000/uploads/avatars/characters/1/avatar.jpg" -> "avatars/characters/1/avatar.jpg"
func extractPathFromURL(url string) string {
	// Simple extraction: find the last occurrence of "avatars/" and take everything after
	// This works for both local and S3 URLs
	index := strings.LastIndex(url, "avatars/")
	if index == -1 {
		// Fallback: return everything after last slash
		lastSlash := strings.LastIndex(url, "/")
		if lastSlash != -1 {
			return url[lastSlash+1:]
		}
		return url
	}
	return url[index:]
}

// mimeTypeToExtension converts a MIME type to a file extension.
func mimeTypeToExtension(mimeType string) string {
	switch mimeType {
	case MimeTypeJPEG:
		return ".jpg"
	case MimeTypePNG:
		return ".png"
	case MimeTypeWebP:
		return ".webp"
	default:
		return ""
	}
}
