package core

import (
	"net/http"
	"strings"

	"github.com/go-chi/render"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// ErrResponse represents a structured API error response that follows ActionPhase error handling conventions.
// It separates internal errors from user-facing messages and provides consistent JSON structure.
//
// Error Response Format:
//
//	{
//	  "status": "user-friendly status message",
//	  "code": 1001,  // optional application-specific error code
//	  "error": "detailed error for debugging"
//	}
//
// Design Principles:
//   - Internal errors (Err field) are never exposed to clients
//   - HTTP status codes follow REST conventions
//   - StatusText provides user-friendly messages
//   - ErrorText gives debugging information (safe for clients)
//   - AppCode enables application-specific error categorization
type ErrResponse struct {
	Err            error `json:"-"` // Internal runtime error (never serialized)
	HTTPStatusCode int   `json:"-"` // HTTP response status code (never serialized)

	StatusText string `json:"status"`          // User-friendly status message
	AppCode    int64  `json:"code,omitempty"`  // Application-specific error code
	ErrorText  string `json:"error,omitempty"` // Debugging error message (client-safe)
}

// Render implements the chi/render.Renderer interface for HTTP response rendering.
// It sets the HTTP status code and allows the JSON marshaling to handle the response body.
func (e *ErrResponse) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, e.HTTPStatusCode)

	// Mark the active span as an error for 5xx responses so Tempo shows them
	// as failed spans. 4xx errors are client mistakes, not service errors.
	if e.HTTPStatusCode >= 500 {
		span := trace.SpanFromContext(r.Context())
		span.SetStatus(codes.Error, e.ErrorText)
		if e.Err != nil {
			span.RecordError(e.Err)
		}
	}

	return nil
}

// ErrInvalidRequest creates a 400 Bad Request error for invalid request data.
// Use this for validation failures, malformed JSON, missing required fields, etc.
//
// Example Usage:
//
//	if validationErr := validateUser(user); validationErr != nil {
//	    render.Render(w, r, ErrInvalidRequest(validationErr))
//	    return
//	}
func ErrInvalidRequest(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 400,
		StatusText:     "Invalid request.",
		ErrorText:      err.Error(),
	}
}

// ErrInternalError creates a 500 Internal Server Error for unexpected system errors.
// Use this for database connection failures, external service errors, etc.
// The internal error details are logged but not exposed to clients.
//
// Example Usage:
//
//	if dbErr := db.SaveUser(user); dbErr != nil {
//	    log.Error("Database save failed", "error", dbErr)
//	    render.Render(w, r, ErrInternalError(dbErr))
//	    return
//	}
func ErrInternalError(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 500,
		StatusText:     "Internal server error.",
		ErrorText:      "An unexpected error occurred. Please try again later.",
	}
}

// ErrUnauthorized creates a 401 Unauthorized error for authentication failures.
// Use this when user credentials are invalid or missing.
//
// Example Usage:
//
//	if !isValidToken(token) {
//	    render.Render(w, r, ErrUnauthorized("Invalid or expired token"))
//	    return
//	}
func ErrUnauthorized(message string) render.Renderer {
	return &ErrResponse{
		HTTPStatusCode: 401,
		StatusText:     "Unauthorized.",
		ErrorText:      message,
	}
}

// ErrForbidden creates a 403 Forbidden error for authorization failures.
// Use this when user is authenticated but lacks permission for the action.
//
// Example Usage:
//
//	if userRole != "admin" {
//	    render.Render(w, r, ErrForbidden("Admin access required"))
//	    return
//	}
func ErrForbidden(message string) render.Renderer {
	return &ErrResponse{
		HTTPStatusCode: 403,
		StatusText:     "Forbidden.",
		ErrorText:      message,
	}
}

// ErrBadRequest creates a 400 Bad Request error for client request errors.
// Similar to ErrInvalidRequest but for more general request processing failures.
//
// Example Usage:
//
//	if gameState == "completed" {
//	    render.Render(w, r, ErrBadRequest(errors.New("Cannot join completed game")))
//	    return
//	}
func ErrBadRequest(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 400,
		StatusText:     "Bad request.",
		ErrorText:      err.Error(),
	}
}

// ErrNotFound creates a 404 Not Found error for missing resources.
// Use this when a specific resource (user, game, etc.) cannot be found.
//
// Example Usage:
//
//	game, err := gameService.GetGame(ctx, gameID)
//	if err != nil {
//	    render.Render(w, r, ErrNotFound("Game not found"))
//	    return
//	}
func ErrNotFound(message string) render.Renderer {
	return &ErrResponse{
		HTTPStatusCode: 404,
		StatusText:     "Not found.",
		ErrorText:      message,
		AppCode:        ErrCodeGameNotFound, // Default, can be overridden
	}
}

// ErrConflict creates a 409 Conflict error for resource conflicts.
// Use this when the request conflicts with the current state of the system.
//
// Example Usage:
//
//	if user.IsAlreadyRegistered {
//	    render.Render(w, r, ErrConflict("Username already exists"))
//	    return
//	}
func ErrConflict(message string) render.Renderer {
	return &ErrResponse{
		HTTPStatusCode: 409,
		StatusText:     "Conflict.",
		ErrorText:      message,
		AppCode:        ErrCodeDuplicateValue,
	}
}

// ErrWithCode creates a custom error response with a specific application error code.
// This allows for more specific error categorization for client handling.
//
// Example Usage:
//
//	if game.State != "recruitment" {
//	    render.Render(w, r, ErrWithCode(400, ErrCodeGameNotRecruiting,
//	        "Game is not accepting new players"))
//	    return
//	}
func ErrWithCode(httpStatus int, appCode int64, message string) render.Renderer {
	statusText := getStatusText(httpStatus)
	return &ErrResponse{
		HTTPStatusCode: httpStatus,
		StatusText:     statusText,
		ErrorText:      message,
		AppCode:        appCode,
	}
}

// getStatusText returns a default status text for HTTP status codes.
func getStatusText(httpStatus int) string {
	statusTexts := map[int]string{
		400: "Bad request.",
		401: "Unauthorized.",
		403: "Forbidden.",
		404: "Not found.",
		409: "Conflict.",
		422: "Validation failed.",
		500: "Internal server error.",
	}

	if text, exists := statusTexts[httpStatus]; exists {
		return text
	}
	return "Unknown error."
}

// ErrGameArchived creates a specific error for write operations on completed/cancelled games.
// Completed games are read-only archives and no new content can be created.
func ErrGameArchived() render.Renderer {
	return ErrWithCode(403, ErrCodeGameArchived,
		"This game is archived and read-only. No new content can be created.")
}

// IsArchivedGameError checks if an error is from an archived game validation failure.
// Returns true if the error message contains "archived", indicating a write operation
// was attempted on a completed or cancelled game.
//
// Example Usage:
//
//	phase, err := phaseService.CreatePhase(ctx, req)
//	if err != nil {
//	    if core.IsArchivedGameError(err) {
//	        render.Render(w, r, core.ErrGameArchived())
//	        return
//	    }
//	    render.Render(w, r, core.ErrInternalError(err))
//	    return
//	}
func IsArchivedGameError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "archived")
}
