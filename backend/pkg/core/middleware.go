package core

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// ContextKey is used for context keys to avoid collisions.
type ContextKey string

const (
	// UserContextKey is used to store user information in request context.
	UserContextKey ContextKey = "user"

	// UserIDContextKey is used to store user ID in request context.
	UserIDContextKey ContextKey = "user_id"

	// UsernameContextKey is used to store username in request context.
	UsernameContextKey ContextKey = "username"
)

// MiddlewareUserService interface for user lookups in middleware.
// This allows middleware to be testable with mocks.
type MiddlewareUserService interface {
	GetUserByID(userID int) (*User, error)
}

// MiddlewareSessionService interface for session validation in middleware.
type MiddlewareSessionService interface {
	SessionByToken(token string) (*Session, error)
	UpdateSessionLastSeen(ctx context.Context, sessionID int32) error
}

// ValidateSessionMiddleware checks that the JWT token corresponds to an active session
// in the database. This ensures that invalidated sessions (from bans, logouts, or
// explicit revocation) are rejected even when the JWT itself is cryptographically valid.
// It must be used after jwtauth.Verifier and jwtauth.Authenticator.
func ValidateSessionMiddleware(sessionService MiddlewareSessionService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := jwtauth.TokenFromCookie(r)
			if tokenString == "" {
				tokenString = jwtauth.TokenFromHeader(r)
			}
			if tokenString == "" {
				render.Render(w, r, ErrUnauthorized("no token provided"))
				return
			}

			session, err := sessionService.SessionByToken(tokenString)
			if err != nil || session == nil {
				render.Render(w, r, ErrUnauthorized("session not found or has been invalidated"))
				return
			}

			// Best-effort last-seen update; never block the request on failure.
			_ = sessionService.UpdateSessionLastSeen(r.Context(), int32(session.ID))

			next.ServeHTTP(w, r)
		})
	}
}

// AuthenticatedUser holds user information extracted from JWT token.
// This is stored in request context for use by handlers.
type AuthenticatedUser struct {
	ID       int32
	Username string
	Email    string
	IsAdmin  bool
}

// RequireAuthenticationMiddleware creates middleware that extracts user information from JWT tokens.
// It looks up the user from the database and adds user information to the request context.
//
// Usage Example:
//
//	r.Group(func(r chi.Router) {
//	    r.Use(jwtauth.Verifier(tokenAuth))
//	    r.Use(RequireAuthenticationMiddleware(userService))
//	    r.Get("/protected", protectedHandler)
//	})
//
// The middleware adds the following to request context:
//   - UserContextKey: *AuthenticatedUser with full user details
//   - UserIDContextKey: int32 user ID for quick access
//   - UsernameContextKey: string username for logging/debugging
func RequireAuthenticationMiddleware(userService MiddlewareUserService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract JWT token from context (set by jwtauth.Verifier)
			token, claims, err := jwtauth.FromContext(r.Context())
			if err != nil {
				render.Render(w, r, ErrUnauthorized("no valid token found"))
				return
			}

			// Verify token is valid (not expired, properly signed)
			if token == nil {
				render.Render(w, r, ErrUnauthorized("invalid or expired token"))
				return
			}

			// jwtauth.FromContext returns a jwt.Token, which may not have a Valid field
			// Instead, rely on jwtauth.Verifier to have already validated the token
			// If we reach this point, the token has been verified by the Verifier middleware

			// Extract user ID from token claims (sub = subject, standard JWT claim)
			// Using immutable user_id instead of username enables username changes
			// without invalidating existing tokens
			subStr, ok := claims["sub"].(string)
			if !ok || subStr == "" {
				render.Render(w, r, ErrUnauthorized("user ID not found in token"))
				return
			}

			// Convert sub (user ID) from string to int
			userID, err := strconv.Atoi(subStr)
			if err != nil {
				render.Render(w, r, ErrUnauthorized("invalid user ID in token"))
				return
			}

			// Look up user in database to get current information
			// This ensures user still exists and gets current profile data
			user, err := userService.GetUserByID(userID)
			if err != nil {
				// Log error for debugging but don't expose internal details
				render.Render(w, r, ErrUnauthorized("user not found"))
				return
			}

			// Create authenticated user context
			authUser := &AuthenticatedUser{
				ID:       int32(user.ID),
				Username: user.Username,
				Email:    user.Email,
				IsAdmin:  user.IsAdmin,
			}

			// Add user information to request context
			ctx := context.WithValue(r.Context(), UserContextKey, authUser)
			ctx = context.WithValue(ctx, UserIDContextKey, authUser.ID)
			ctx = context.WithValue(ctx, UsernameContextKey, authUser.Username)

			// Continue with the authenticated request
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetAuthenticatedUser extracts the authenticated user from request context.
// Returns nil if no user is found (request is not authenticated).
//
// Usage Example:
//
//	func MyHandler(w http.ResponseWriter, r *http.Request) {
//	    user := GetAuthenticatedUser(r.Context())
//	    if user == nil {
//	        // This shouldn't happen if RequireAuthenticationMiddleware is used
//	        http.Error(w, "Unauthorized", http.StatusUnauthorized)
//	        return
//	    }
//
//	    // Use user.ID, user.Username, user.Email
//	    fmt.Printf("Request from user: %s (ID: %d)", user.Username, user.ID)
//	}
func GetAuthenticatedUser(ctx context.Context) *AuthenticatedUser {
	if user, ok := ctx.Value(UserContextKey).(*AuthenticatedUser); ok {
		return user
	}
	return nil
}

// GetAuthenticatedUserID is a convenience function to get just the user ID from context.
// Returns 0 if no authenticated user is found.
func GetAuthenticatedUserID(ctx context.Context) int32 {
	if userID, ok := ctx.Value(UserIDContextKey).(int32); ok {
		return userID
	}
	return 0
}

// GetAuthenticatedUsername is a convenience function to get just the username from context.
// Returns empty string if no authenticated user is found.
func GetAuthenticatedUsername(ctx context.Context) string {
	if username, ok := ctx.Value(UsernameContextKey).(string); ok {
		return username
	}
	return ""
}

// GM Authorization Pattern
//
// GM authorization is implemented at the HANDLER level, not via middleware.
// This is intentional - handler-level checks provide better flexibility for
// different authorization scenarios (GM, co-GM, admin mode).
//
// All GM-only endpoints use the core.IsUserGameMaster() helper function:
//
//	func HandlerExample(w http.ResponseWriter, r *http.Request) {
//	    user := core.GetAuthenticatedUser(r.Context())
//	    game, err := gameService.GetGame(ctx, gameID)
//
//	    if !core.IsUserGameMaster(r, user.ID, user.IsAdmin, *game, h.App.Pool) {
//	        render.Render(w, r, core.ErrForbidden("only the GM can perform this action"))
//	        return
//	    }
//	    // ... handler logic
//	}
//
// The IsUserGameMaster function checks:
// - Primary GM (game.GmUserID == userID)
// - Co-GM status
// - Admin mode override
//
// See pkg/core/permissions.go for implementation details.

// LoggingMiddleware creates middleware for request logging.
// It logs request method, path, duration, and response status.
//
// Usage Example:
//
//	r.Use(LoggingMiddleware(logger))
func LoggingMiddleware(logger Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Create a response writer that captures the status code
			wrapped := &responseWriter{ResponseWriter: w, statusCode: 200}

			// Log request start
			logger.Info("HTTP request started",
				"method", r.Method,
				"path", r.URL.Path,
				"remote_addr", r.RemoteAddr,
				"user_agent", r.Header.Get("User-Agent"))

			// Process request
			next.ServeHTTP(wrapped, r)

			// Log request completion
			logger.Info("HTTP request completed",
				"method", r.Method,
				"path", r.URL.Path,
				"status", wrapped.statusCode,
				"remote_addr", r.RemoteAddr)
		})
	}
}

// responseWriter wraps http.ResponseWriter to capture status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// CORSMiddleware creates middleware for Cross-Origin Resource Sharing.
// It handles preflight requests and adds CORS headers based on configuration.
//
// Usage Example:
//
//	config := &Config{...}
//	r.Use(CORSMiddleware(config))
func CORSMiddleware(config *Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !config.App.CORSEnabled {
				next.ServeHTTP(w, r)
				return
			}

			// Set CORS headers
			origin := r.Header.Get("Origin")
			if isAllowedOrigin(origin, config.App.CORSOrigins) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")

			// Handle preflight requests
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// isAllowedOrigin checks if the origin is in the allowed list.
func isAllowedOrigin(origin string, allowedOrigins []string) bool {
	for _, allowed := range allowedOrigins {
		if allowed == "*" || allowed == origin {
			return true
		}
		// Support wildcard subdomains (e.g., "*.example.com")
		if strings.HasPrefix(allowed, "*.") {
			domain := allowed[2:] // Remove "*."
			if strings.HasSuffix(origin, domain) {
				return true
			}
		}
	}
	return false
}

// ContentTypeMiddleware ensures requests have the correct Content-Type header.
// This is useful for API endpoints that only accept JSON.
func ContentTypeMiddleware(requiredType string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip content type check for GET requests and OPTIONS
			if r.Method == "GET" || r.Method == "OPTIONS" {
				next.ServeHTTP(w, r)
				return
			}

			contentType := r.Header.Get("Content-Type")
			if !strings.Contains(contentType, requiredType) {
				render.Render(w, r, ErrInvalidRequest(
					fmt.Errorf("invalid content type: expected %s, got %s", requiredType, contentType)))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
