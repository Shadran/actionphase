package auth

import (
	"actionphase/pkg/core"
	"actionphase/pkg/email"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// V1VerifyEmail handles email verification with token
func (h *Handler) V1VerifyEmail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_verify_email")()

	// Parse request body
	var req VerifyEmailRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid verify email request", "error", err)
		return
	}

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create email service", "error", err)
		emailService = nil
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Verify email
	err = accountService.VerifyEmail(ctx, &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to verify email", "error", err)
		return
	}

	h.App.ObsLogger.Info(ctx, "Email verified successfully")

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Email verified successfully",
	})
}

// V1ResendVerificationEmail resends verification email for authenticated user
func (h *Handler) V1ResendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_resend_verification_email")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int(authUser.ID)

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to create email service", "error", err)
		return
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Resend verification email
	err = accountService.ResendVerificationEmail(ctx, userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to resend verification email", "error", err, "user_id", userID)
		return
	}

	h.App.ObsLogger.Info(ctx, "Verification email resent", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Verification email sent",
	})
}

// V1ChangeUsername handles username change requests for authenticated users
func (h *Handler) V1ChangeUsername(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_change_username")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int(authUser.ID)

	// Parse request body
	var req ChangeUsernameRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid v1 change username request", "error", err)
		return
	}

	// Create account service
	accountService := &AccountService{
		DB:     h.App.Pool,
		Logger: h.App.ObsLogger,
	}

	// Change username
	err := accountService.ChangeUsername(ctx, userID, &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to change username", "error", err, "user_id", userID)
		return
	}

	h.App.ObsLogger.Info(ctx, "Username changed successfully", "user_id", userID, "new_username", req.NewUsername)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Username changed successfully",
	})
}

// V1RequestEmailChange handles email change requests for authenticated users
func (h *Handler) V1RequestEmailChange(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_request_email_change")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int(authUser.ID)

	// Parse request body
	var req ChangeEmailRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid v1 request email change request", "error", err)
		return
	}

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to create email service", "error", err)
		return
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Request email change
	err = accountService.RequestEmailChange(ctx, userID, &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to request email change", "error", err, "user_id", userID)
		return
	}

	h.App.ObsLogger.Info(ctx, "Email change requested", "user_id", userID, "new_email", req.NewEmail)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Verification email sent to new address",
	})
}

// V1CompleteEmailChange completes the email change after verification
func (h *Handler) V1CompleteEmailChange(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_complete_email_change")()

	// Parse request body
	var req VerifyEmailRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(ctx, w, r, core.ErrInvalidRequest(err), "Invalid complete email change request", "error", err)
		return
	}

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create email service", "error", err)
		emailService = nil
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Complete email change
	err = accountService.CompleteEmailChange(ctx, &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to complete email change", "error", err)
		return
	}

	h.App.ObsLogger.Info(ctx, "Email change completed successfully")

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Email changed successfully",
	})
}

// V1DeleteAccount soft deletes the authenticated user's account
func (h *Handler) V1DeleteAccount(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_account")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int(authUser.ID)

	// Create account service
	accountService := &AccountService{
		DB:     h.App.Pool,
		Logger: h.App.ObsLogger,
	}

	// Soft delete account
	err := accountService.SoftDeleteAccount(ctx, userID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to delete account", "error", err, "user_id", userID)
		return
	}

	h.App.ObsLogger.Info(ctx, "Account deleted successfully", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Account deleted successfully. You have 30 days to restore your account.",
	})
}

// V1RevokeAllSessions revokes all sessions except the current one
func (h *Handler) V1RevokeAllSessions(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_revoke_all_sessions")()

	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(ctx)
	if authUser == nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("authentication required"), "No authenticated user in context")
		return
	}

	userID := int(authUser.ID)

	// Get current token to identify current session
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrUnauthorized("invalid token"), "Failed to get token from context", "error", err)
		return
	}

	// Get current session ID from token
	sessionIDFloat, ok := token.Get("session_id")
	if !ok {
		h.renderError(ctx, w, r, core.ErrUnauthorized("session_id not found in token"), "session_id not found in token")
		return
	}

	currentSessionID := int32(sessionIDFloat.(float64))

	// Create account service
	accountService := &AccountService{
		DB:     h.App.Pool,
		Logger: h.App.ObsLogger,
	}

	// Revoke all sessions except current
	err = accountService.RevokeAllSessions(ctx, userID, currentSessionID)
	if err != nil {
		h.renderError(ctx, w, r, core.ErrInternalError(err), "Failed to revoke all sessions", "error", err, "user_id", userID)
		return
	}

	h.App.ObsLogger.Info(ctx, "All sessions revoked except current", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "All other sessions revoked successfully",
	})
}
