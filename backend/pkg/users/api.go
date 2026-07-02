package users

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"actionphase/pkg/core"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// Handler holds dependencies for user profile API handlers
type Handler struct {
	App         *core.App
	UserService core.UserServiceInterface
}

// Request and Response Types

// UpdateUserProfileRequest is the API request for updating a user's profile
type UpdateUserProfileRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	Bio         *string `json:"bio,omitempty"`
}

// Bind validates the UpdateUserProfileRequest
func (req *UpdateUserProfileRequest) Bind(r *http.Request) error {
	// Both fields are optional, so just basic validation
	if req.DisplayName != nil && len(*req.DisplayName) > 255 {
		return fmt.Errorf("display name must be 255 characters or less")
	}
	if req.Bio != nil && len(*req.Bio) > 10000 {
		return fmt.Errorf("bio must be 10000 characters or less")
	}
	return nil
}

// UploadAvatarResponse is the response after uploading an avatar
type UploadAvatarResponse struct {
	AvatarURL string `json:"avatar_url"`
}

// API Handler Methods

// GetUserProfile handles GET /users/{id}/profile
// Returns a user's profile information and game history.
// This is a public endpoint (anyone authenticated can view any profile).
func (h *Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_user_profile")()

	defer h.App.ObsLogger.LogOperation(ctx, "GetUserProfile")()

	// Extract user ID from URL
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("invalid user ID")), "Invalid user ID", "error", err)
		return
	}

	// Authenticate request user (viewer must be authenticated)
	_, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Parse pagination parameters
	queryParams := r.URL.Query()
	page := 1
	pageSize := 12 // Default page size for user game history
	if pageParam := queryParams.Get("page"); pageParam != "" {
		if p, err := strconv.Atoi(pageParam); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeParam := queryParams.Get("page_size"); pageSizeParam != "" {
		if ps, err := strconv.Atoi(pageSizeParam); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	// Get user profile with pagination
	profileService := &UserProfileService{DB: h.App.Pool}
	profile, err := profileService.GetUserProfile(ctx, int32(userID), page, pageSize)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("user profile"), "Failed to get user profile", "error", err, "user_id", userID)
		return
	}

	render.JSON(w, r, profile)
}

// GetUserProfileByUsername handles GET /users/username/{username}/profile
// Returns a user's profile information and game history by username.
// This is a public endpoint (anyone authenticated can view any profile).
func (h *Handler) GetUserProfileByUsername(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_user_profile_by_username")()

	// Extract username from URL
	username := chi.URLParam(r, "username")
	if username == "" {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("username is required")), "Missing username parameter")
		return
	}

	// Authenticate request user (viewer must be authenticated)
	_, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Look up user by username
	user, err := h.UserService.UserByUsername(username)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("user"), "Failed to find user", "error", err, "username", username)
		return
	}

	// Parse pagination parameters
	queryParams := r.URL.Query()
	page := 1
	pageSize := 12 // Default page size for user game history
	if pageParam := queryParams.Get("page"); pageParam != "" {
		if p, err := strconv.Atoi(pageParam); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeParam := queryParams.Get("page_size"); pageSizeParam != "" {
		if ps, err := strconv.Atoi(pageSizeParam); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	// Get user profile with pagination
	profileService := &UserProfileService{DB: h.App.Pool}
	profile, err := profileService.GetUserProfile(ctx, int32(user.ID), page, pageSize)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrNotFound("user profile"), "Failed to get user profile", "error", err, "user_id", user.ID)
		return
	}

	render.JSON(w, r, profile)
}

// UpdateUserProfile handles PATCH /users/me/profile
// Updates the authenticated user's profile (display name and/or bio).
// Only the user can update their own profile.
func (h *Handler) UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_user_profile")()

	defer h.App.ObsLogger.LogOperation(ctx, "UpdateUserProfile")()

	// Authenticate user
	userID, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Parse request body
	data := &UpdateUserProfileRequest{}
	if err := render.Bind(r, data); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Failed to bind update profile request", "error", err)
		return
	}

	// Update profile
	profileService := &UserProfileService{DB: h.App.Pool}
	err := profileService.UpdateUserProfile(ctx, userID, data.DisplayName, data.Bio)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to update user profile", "error", err, "user_id", userID)
		return
	}

	// Return updated profile (first page with default page size)
	profile, err := profileService.GetUserProfile(ctx, userID, 1, 12)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to get updated profile", "error", err, "user_id", userID)
		return
	}

	render.JSON(w, r, profile)
}

// UploadUserAvatar handles POST /users/me/avatar
// Uploads an avatar image for the authenticated user.
func (h *Handler) UploadUserAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_upload_user_avatar")()

	defer h.App.ObsLogger.LogOperation(ctx, "UploadUserAvatar")()

	// Authenticate user
	userID, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Parse multipart form (max 10MB for total upload)
	err := r.ParseMultipartForm(10 << 20) // 10MB
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("failed to parse form data")), "Failed to parse multipart form", "error", err)
		return
	}

	// Get file from form
	file, header, err := r.FormFile("avatar")
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("avatar file is required")), "Failed to get avatar file from form", "error", err)
		return
	}
	defer file.Close()

	// Get content type from header
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream" // Fallback
	}

	// Upload avatar
	avatarService := &UserAvatarService{
		DB:      h.App.Pool,
		Storage: h.App.Storage,
	}

	// Read file into memory for upload service
	fileData, err := io.ReadAll(file)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(fmt.Errorf("failed to read file")), "Failed to read file data", "error", err)
		return
	}

	// Upload avatar
	avatarURL, err := avatarService.UploadUserAvatar(
		ctx,
		userID,
		bytes.NewReader(fileData),
		header.Filename,
		contentType,
	)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Failed to upload user avatar", "error", err, "user_id", userID)
		return
	}

	response := UploadAvatarResponse{
		AvatarURL: avatarURL,
	}
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, response)
}

// DeleteUserAvatar handles DELETE /users/me/avatar
// Deletes the authenticated user's avatar.
func (h *Handler) DeleteUserAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_user_avatar")()

	defer h.App.ObsLogger.LogOperation(ctx, "DeleteUserAvatar")()

	// Authenticate user
	userID, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		h.renderError(ctx, w, r, errResp, "Failed to authenticate user from JWT")
		return
	}

	// Delete avatar
	avatarService := &UserAvatarService{
		DB:      h.App.Pool,
		Storage: h.App.Storage,
	}

	err := avatarService.DeleteUserAvatar(ctx, userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete user avatar", "error", err, "user_id", userID)
		return
	}

	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{"message": "Avatar deleted successfully"})
}
