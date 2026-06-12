package auth

import (
	"actionphase/pkg/core"
	"actionphase/pkg/email"
	"fmt"
	"net/http"

	"github.com/go-chi/render"
)

// ChangePasswordHandler handles password change requests for authenticated users
func (h *Handler) V1ChangePassword(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		h.renderError(r.Context(), w, r, core.ErrUnauthorized("authentication required"), "Unauthorized")
		return
	}

	userID := int(authUser.ID)

	// Parse request body
	var req ChangePasswordRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(r.Context(), w, r, core.ErrInvalidRequest(err), "Invalid v1 change password request", "error", err)
		return
	}

	// Create password service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		// Continue without email service - password change will still work
		emailService = nil
	}

	passwordService := &PasswordService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Change password
	err = passwordService.ChangePassword(r.Context(), userID, &req)
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
		h.App.Logger.Error("Failed to change password", "error", err, "user_id", userID)
		h.renderError(r.Context(), w, r, core.ErrInternalError(err), "Failed to v1 change password", "error", err)
		return
	}

	h.App.Logger.Info("Password changed successfully", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Password changed successfully",
	})
}

// RequestPasswordResetHandler handles password reset requests (forgot password)
func (h *Handler) V1RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req RequestPasswordResetRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(r.Context(), w, r, core.ErrInvalidRequest(err), "Invalid v1 request password reset request", "error", err)
		return
	}

	// Create password service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		// Return success anyway to avoid revealing if email exists
		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]string{
			"message": "If an account exists with this email, a password reset link will be sent",
		})
		return
	}

	passwordService := &PasswordService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Request password reset
	err = passwordService.RequestPasswordReset(r.Context(), &req)
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
		h.App.Logger.Error("Failed to request password reset", "error", err)
		// Don't reveal internal errors - return success anyway
	}

	h.App.Logger.Info("Password reset requested", "email", req.Email)

	// Always return success to prevent email enumeration
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "If an account exists with this email, a password reset link will be sent",
	})
}

// ResetPasswordHandler handles password reset with token
func (h *Handler) V1ResetPassword(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req ResetPasswordRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		h.renderError(r.Context(), w, r, core.ErrInvalidRequest(err), "Invalid v1 reset password request", "error", err)
		return
	}

	// Create password service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		// Continue without email service - password reset will still work
		emailService = nil
	}

	passwordService := &PasswordService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       h.App.ObsLogger,
	}

	// Reset password
	err = passwordService.ResetPassword(r.Context(), &req)
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
		h.App.Logger.Error("Failed to reset password", "error", err)
		h.renderError(r.Context(), w, r, core.ErrInternalError(err), "Failed to v1 reset password", "error", err)
		return
	}

	h.App.Logger.Info("Password reset successfully")

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Password reset successfully",
	})
}

// ValidateResetTokenHandler validates a password reset token without using it
func (h *Handler) V1ValidateResetToken(w http.ResponseWriter, r *http.Request) {
	// Get token from query parameter
	token := r.URL.Query().Get("token")
	if token == "" {
		render.Render(w, r, &core.ErrResponse{
			Err:            fmt.Errorf("token is required"),
			HTTPStatusCode: http.StatusBadRequest,
			StatusText:     "Bad Request",
			ErrorText:      "token query parameter is required",
		})
		return
	}

	// Create password service
	passwordService := &PasswordService{
		DB: h.App.Pool,
	}

	// Check if token exists and is valid
	queries := passwordService.DB
	resetToken, err := queries.Query(r.Context(), "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()", token)
	if err != nil || !resetToken.Next() {
		render.Render(w, r, &core.ErrResponse{
			Err:            fmt.Errorf("invalid or expired token"),
			HTTPStatusCode: http.StatusBadRequest,
			StatusText:     "Invalid Token",
			ErrorText:      "This password reset link is invalid or has expired",
		})
		return
	}
	resetToken.Close()

	// Token is valid
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]bool{
		"valid": true,
	})
}
