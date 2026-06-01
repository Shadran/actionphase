package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"strconv"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"net/http"
)

func (h *Handler) V1Refresh(w http.ResponseWriter, r *http.Request) {
	token, claims, _ := jwtauth.FromContext(r.Context())
	if token == nil || jwt.Validate(token) != nil {
		render.Render(w, r, core.ErrUnauthorized("Invalid token"))
		return
	}

	// Extract user ID from token (standard JWT "sub" claim)
	sub, ok := claims["sub"]
	if !ok {
		h.App.Logger.Warn("Refresh token: sub (user_id) not found in token")
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	// Convert sub (string) to user ID (int)
	userID, err := strconv.Atoi(sub.(string))
	if err != nil {
		h.App.Logger.Error("Refresh token: invalid user_id in token",
			"error", err,
			"sub", sub)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	// Look up user from database by ID
	UserService := db.UserService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	user, err := UserService.GetUserByID(userID)
	if err != nil {
		h.App.Logger.Error("Error getting user", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Creating token for user", "user_id", user.ID, "username", user.Username)
	jwtHandler := JWTHandler{App: h.App}
	tokenString, err := jwtHandler.CreateToken(user, SessionMetadata{
		IPAddress: core.GetClientIP(r),
		UserAgent: r.UserAgent(),
	})
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	SetJWTCookie(w, tokenString)
	render.Status(r, http.StatusOK)
	render.Render(w, r, NewRefreshResponse(tokenString))
}

func NewRefreshResponse(token string) *Response {
	resp := &Response{Token: token}
	return resp
}
