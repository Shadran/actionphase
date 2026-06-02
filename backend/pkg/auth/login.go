package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"net/http"
	"strings"

	"github.com/go-chi/render"
)

// ipBanCheck returns true and writes a 403 response if the client IP is banned.
func (h *Handler) ipBanCheck(w http.ResponseWriter, r *http.Request) bool {
	ctx := r.Context()
	clientIP := core.GetClientIP(r)
	svc := db.IPBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	banned, _ := svc.IsIPBanned(ctx, clientIP)
	if banned {
		h.App.ObsLogger.Warn(ctx, "Blocked request from banned IP", "ip", clientIP)
		render.Render(w, r, core.ErrForbidden("Access from this location is not allowed."))
		return true
	}
	return false
}

// fingerprintBanCheck returns true and writes a 403 response if the fingerprint is banned.
func (h *Handler) fingerprintBanCheck(w http.ResponseWriter, r *http.Request, fingerprint string) bool {
	if fingerprint == "" {
		return false
	}
	ctx := r.Context()
	svc := db.FingerprintBanService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	banned, _ := svc.IsFingerprintBanned(ctx, fingerprint)
	if banned {
		h.App.ObsLogger.Warn(ctx, "Blocked request from banned device fingerprint")
		render.Render(w, r, core.ErrForbidden("Access from this device is not allowed."))
		return true
	}
	return false
}

func (h *Handler) V1Login(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_login")()

	data := &Request{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.Warn(ctx, "Invalid login request", "error", err)
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Check IP ban before touching any user data
	if h.ipBanCheck(w, r) {
		return
	}

	// Check device fingerprint ban
	if h.fingerprintBanCheck(w, r, data.Fingerprint) {
		return
	}

	UserService := db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}

	// Support login with either username or email
	// The username field may contain either a username or an email address
	var user *core.User
	var err error

	// Check if username field contains an email (has @ symbol)
	usernameOrEmail := data.User.Username
	if data.User.Email != "" {
		usernameOrEmail = data.User.Email
	}

	if usernameOrEmail == "" {
		h.App.ObsLogger.Info(ctx, "Login attempt with no username or email provided")
		render.Render(w, r, core.ErrUnauthorized("Invalid username or password"))
		return
	}

	// If it looks like an email, try email lookup first
	if strings.Contains(usernameOrEmail, "@") {
		user, err = UserService.UserByEmail(usernameOrEmail)
	} else {
		user, err = UserService.UserByUsername(usernameOrEmail)
	}

	if err != nil {
		h.App.ObsLogger.Info(ctx, "Login attempt for non-existent user",
			"username", data.User.Username,
			"email", data.User.Email)
		render.Render(w, r, core.ErrUnauthorized("Invalid username or password"))
		return
	}

	// Check if user is banned
	if user.IsBanned {
		h.App.ObsLogger.Warn(ctx, "Login attempt by banned user",
			"username", user.Username,
			"user_id", user.ID,
			"banned_at", user.BannedAt)
		render.Render(w, r, core.ErrForbidden("Your account has been banned. Please contact support."))
		return
	}

	// Check if user is pending approval
	if user.PendingApproval {
		h.App.ObsLogger.Info(ctx, "Login attempt by pending-approval user",
			"username", user.Username,
			"user_id", user.ID)
		render.Render(w, r, core.ErrForbidden("Your account is pending admin approval."))
		return
	}

	if !user.CheckPasswordHash(data.User.Password) {
		h.App.ObsLogger.Info(ctx, "Login failed: invalid password", "username", user.Username)
		render.Render(w, r, core.ErrInvalidRequest(LoginError{"invalid username or password"}))
		return
	}
	h.App.ObsLogger.Info(ctx, "User logged in successfully", "username", user.Username, "user_id", user.ID)
	jwtHandler := JWTHandler{App: h.App}
	clientIP := core.GetClientIP(r)
	userAgent := r.UserAgent()
	token, err := jwtHandler.CreateToken(user, SessionMetadata{
		IPAddress: clientIP,
		UserAgent: userAgent,
		Fingerprint: fingerprintPtr(data.Fingerprint),
	})
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to create JWT token", "error", err, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	SetJWTCookie(w, token)
	render.Status(r, http.StatusOK)
	render.Render(w, r, NewLoginResponse(token))
}

func fingerprintPtr(fp string) *string {
	if fp == "" {
		return nil
	}
	return &fp
}

type LoginError struct {
	Message string `json:"message"`
}

func (e LoginError) Error() string {
	return e.Message
}

func NewLoginResponse(token string) *Response {
	resp := &Response{Token: token}
	return resp
}

// V1Logout handles user logout by clearing the JWT cookie
func (h *Handler) V1Logout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_logout")()

	// Clear the JWT cookie by setting it to expire in the past
	ClearJWTCookie(w)

	h.App.ObsLogger.Info(ctx, "User logged out successfully")

	// Return 200 OK with no body
	w.WriteHeader(http.StatusOK)
}
