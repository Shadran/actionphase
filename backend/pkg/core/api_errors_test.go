package core

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/render"
)

// TestErrResponse_Render tests the Render method sets the correct HTTP status
func TestErrResponse_Render(t *testing.T) {
	tests := []struct {
		name               string
		response           *ErrResponse
		expectedStatusCode int
	}{
		{
			name: "400 Bad Request",
			response: &ErrResponse{
				HTTPStatusCode: 400,
				StatusText:     "Bad request.",
				ErrorText:      "Invalid input",
			},
			expectedStatusCode: 400,
		},
		{
			name: "401 Unauthorized",
			response: &ErrResponse{
				HTTPStatusCode: 401,
				StatusText:     "Unauthorized.",
			},
			expectedStatusCode: 401,
		},
		{
			name: "500 Internal Server Error",
			response: &ErrResponse{
				HTTPStatusCode: 500,
				StatusText:     "Internal server error.",
			},
			expectedStatusCode: 500,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			rec := httptest.NewRecorder()

			// Render should set the status code
			err := tt.response.Render(rec, req)
			if err != nil {
				t.Errorf("Render() error = %v", err)
			}

			// render.Status was called, verify the recorder has the status
			// Note: We need to actually call render.Render to get the status set
			render.Render(rec, req, tt.response)

			if rec.Code != tt.expectedStatusCode {
				t.Errorf("Expected status %d, got %d", tt.expectedStatusCode, rec.Code)
			}
		})
	}
}

// TestErrResponse_JSONSerialization verifies that Err field is never exposed
func TestErrResponse_JSONSerialization(t *testing.T) {
	internalErr := errors.New("database connection failed")
	response := &ErrResponse{
		Err:            internalErr,
		HTTPStatusCode: 500,
		StatusText:     "Internal server error.",
		ErrorText:      "Something went wrong",
		AppCode:        1401,
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("Failed to marshal response: %v", err)
	}

	// Parse JSON to verify structure
	var parsed map[string]interface{}
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal JSON: %v", err)
	}

	// Verify Err field is NOT in JSON
	if _, exists := parsed["Err"]; exists {
		t.Error("Internal Err field should not be serialized")
	}

	// Verify HTTPStatusCode is NOT in JSON
	if _, exists := parsed["HTTPStatusCode"]; exists {
		t.Error("HTTPStatusCode field should not be serialized")
	}

	// Verify expected fields ARE in JSON
	if parsed["status"] != "Internal server error." {
		t.Errorf("status field incorrect: %v", parsed["status"])
	}
	if parsed["error"] != "Something went wrong" {
		t.Errorf("error field incorrect: %v", parsed["error"])
	}
	if parsed["code"] != float64(1401) {
		t.Errorf("code field incorrect: %v", parsed["code"])
	}
}

// TestErrInvalidRequest tests the 400 Bad Request constructor
func TestErrInvalidRequest(t *testing.T) {
	err := errors.New("missing required field: email")
	result := ErrInvalidRequest(err).(*ErrResponse)

	if result.HTTPStatusCode != 400 {
		t.Errorf("Expected status 400, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Invalid request." {
		t.Errorf("Expected 'Invalid request.', got '%s'", result.StatusText)
	}
	if result.ErrorText != "missing required field: email" {
		t.Errorf("Expected error text to match, got '%s'", result.ErrorText)
	}
	if result.Err != err {
		t.Error("Expected internal error to be preserved")
	}
}

// TestErrInternalError tests the 500 Internal Server Error constructor
func TestErrInternalError(t *testing.T) {
	err := errors.New("database query failed")
	result := ErrInternalError(err).(*ErrResponse)

	if result.HTTPStatusCode != 500 {
		t.Errorf("Expected status 500, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Internal server error." {
		t.Errorf("Expected 'Internal server error.', got '%s'", result.StatusText)
	}
	if result.ErrorText != "An unexpected error occurred. Please try again later." {
		t.Errorf("Expected generic error text, got '%s'", result.ErrorText)
	}
	if result.Err == nil || result.Err.Error() != "database query failed" {
		t.Errorf("Expected internal error to be preserved on Err field, got '%v'", result.Err)
	}
}

// TestErrUnauthorized tests the 401 Unauthorized constructor
func TestErrUnauthorized(t *testing.T) {
	tests := []struct {
		name    string
		message string
	}{
		{"invalid token", "Invalid or expired token"},
		{"missing credentials", "Missing authentication credentials"},
		{"invalid password", "Invalid username or password"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ErrUnauthorized(tt.message).(*ErrResponse)

			if result.HTTPStatusCode != 401 {
				t.Errorf("Expected status 401, got %d", result.HTTPStatusCode)
			}
			if result.StatusText != "Unauthorized." {
				t.Errorf("Expected 'Unauthorized.', got '%s'", result.StatusText)
			}
			if result.ErrorText != tt.message {
				t.Errorf("Expected message '%s', got '%s'", tt.message, result.ErrorText)
			}
		})
	}
}

// TestErrForbidden tests the 403 Forbidden constructor
func TestErrForbidden(t *testing.T) {
	message := "Admin access required"
	result := ErrForbidden(message).(*ErrResponse)

	if result.HTTPStatusCode != 403 {
		t.Errorf("Expected status 403, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Forbidden." {
		t.Errorf("Expected 'Forbidden.', got '%s'", result.StatusText)
	}
	if result.ErrorText != message {
		t.Errorf("Expected message '%s', got '%s'", message, result.ErrorText)
	}
}

// TestErrBadRequest tests the 400 Bad Request constructor
func TestErrBadRequest(t *testing.T) {
	err := errors.New("Cannot join completed game")
	result := ErrBadRequest(err).(*ErrResponse)

	if result.HTTPStatusCode != 400 {
		t.Errorf("Expected status 400, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Bad request." {
		t.Errorf("Expected 'Bad request.', got '%s'", result.StatusText)
	}
	if result.ErrorText != "Cannot join completed game" {
		t.Errorf("Expected error text to match, got '%s'", result.ErrorText)
	}
}

// TestErrNotFound tests the 404 Not Found constructor
func TestErrNotFound(t *testing.T) {
	message := "Game not found"
	result := ErrNotFound(message).(*ErrResponse)

	if result.HTTPStatusCode != 404 {
		t.Errorf("Expected status 404, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Not found." {
		t.Errorf("Expected 'Not found.', got '%s'", result.StatusText)
	}
	if result.ErrorText != message {
		t.Errorf("Expected message '%s', got '%s'", message, result.ErrorText)
	}
	if result.AppCode != ErrCodeGameNotFound {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeGameNotFound, result.AppCode)
	}
}

// TestErrValidationFailed tests the 422 Validation Failed constructor
func TestErrValidationFailed(t *testing.T) {
	message := "Must be at least 13 years old"
	result := ErrValidationFailed(message).(*ErrResponse)

	if result.HTTPStatusCode != 422 {
		t.Errorf("Expected status 422, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Validation failed." {
		t.Errorf("Expected 'Validation failed.', got '%s'", result.StatusText)
	}
	if result.ErrorText != message {
		t.Errorf("Expected message '%s', got '%s'", message, result.ErrorText)
	}
	if result.AppCode != ErrCodeValidation {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeValidation, result.AppCode)
	}
}

// TestErrConflict tests the 409 Conflict constructor
func TestErrConflict(t *testing.T) {
	message := "Username already exists"
	result := ErrConflict(message).(*ErrResponse)

	if result.HTTPStatusCode != 409 {
		t.Errorf("Expected status 409, got %d", result.HTTPStatusCode)
	}
	if result.StatusText != "Conflict." {
		t.Errorf("Expected 'Conflict.', got '%s'", result.StatusText)
	}
	if result.ErrorText != message {
		t.Errorf("Expected message '%s', got '%s'", message, result.ErrorText)
	}
	if result.AppCode != ErrCodeDuplicateValue {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeDuplicateValue, result.AppCode)
	}
}

// TestErrWithCode tests custom error responses with specific codes
func TestErrWithCode(t *testing.T) {
	tests := []struct {
		name           string
		httpStatus     int
		appCode        int64
		message        string
		expectedStatus string
	}{
		{
			name:           "game not recruiting",
			httpStatus:     400,
			appCode:        ErrCodeGameNotRecruiting,
			message:        "Game is not accepting new players",
			expectedStatus: "Bad request.",
		},
		{
			name:           "game full",
			httpStatus:     400,
			appCode:        ErrCodeGameFull,
			message:        "Game has reached maximum capacity",
			expectedStatus: "Bad request.",
		},
		{
			name:           "unauthorized with custom code",
			httpStatus:     401,
			appCode:        ErrCodeInvalidToken,
			message:        "Token is invalid",
			expectedStatus: "Unauthorized.",
		},
		{
			name:           "unknown status code",
			httpStatus:     418, // I'm a teapot
			appCode:        9999,
			message:        "Test error",
			expectedStatus: "Unknown error.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ErrWithCode(tt.httpStatus, tt.appCode, tt.message).(*ErrResponse)

			if result.HTTPStatusCode != tt.httpStatus {
				t.Errorf("Expected status %d, got %d", tt.httpStatus, result.HTTPStatusCode)
			}
			if result.StatusText != tt.expectedStatus {
				t.Errorf("Expected status text '%s', got '%s'", tt.expectedStatus, result.StatusText)
			}
			if result.ErrorText != tt.message {
				t.Errorf("Expected message '%s', got '%s'", tt.message, result.ErrorText)
			}
			if result.AppCode != tt.appCode {
				t.Errorf("Expected AppCode %d, got %d", tt.appCode, result.AppCode)
			}
		})
	}
}

// TestGetStatusText tests the status text mapping helper
func TestGetStatusText(t *testing.T) {
	tests := []struct {
		httpStatus   int
		expectedText string
	}{
		{400, "Bad request."},
		{401, "Unauthorized."},
		{403, "Forbidden."},
		{404, "Not found."},
		{409, "Conflict."},
		{422, "Validation failed."},
		{500, "Internal server error."},
		{418, "Unknown error."}, // Unknown status code
		{999, "Unknown error."},
	}

	for _, tt := range tests {
		t.Run(string(rune(tt.httpStatus)), func(t *testing.T) {
			result := getStatusText(tt.httpStatus)
			if result != tt.expectedText {
				t.Errorf("Expected '%s', got '%s'", tt.expectedText, result)
			}
		})
	}
}

// TestErrGameNotRecruiting tests the specific game error
func TestErrGameNotRecruiting(t *testing.T) {
	result := ErrGameNotRecruiting().(*ErrResponse)

	if result.HTTPStatusCode != 400 {
		t.Errorf("Expected status 400, got %d", result.HTTPStatusCode)
	}
	if result.AppCode != ErrCodeGameNotRecruiting {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeGameNotRecruiting, result.AppCode)
	}
	if result.ErrorText != "Game is not currently accepting new players" {
		t.Errorf("Unexpected error text: %s", result.ErrorText)
	}
}

// TestErrGameFull tests the game full error
func TestErrGameFull(t *testing.T) {
	result := ErrGameFull().(*ErrResponse)

	if result.HTTPStatusCode != 400 {
		t.Errorf("Expected status 400, got %d", result.HTTPStatusCode)
	}
	if result.AppCode != ErrCodeGameFull {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeGameFull, result.AppCode)
	}
	if result.ErrorText != "Game has reached maximum player capacity" {
		t.Errorf("Unexpected error text: %s", result.ErrorText)
	}
}

// TestErrAlreadyParticipant tests the already participant error
func TestErrAlreadyParticipant(t *testing.T) {
	result := ErrAlreadyParticipant().(*ErrResponse)

	if result.HTTPStatusCode != 400 {
		t.Errorf("Expected status 400, got %d", result.HTTPStatusCode)
	}
	if result.AppCode != ErrCodeAlreadyParticipant {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeAlreadyParticipant, result.AppCode)
	}
	if result.ErrorText != "You are already a participant in this game" {
		t.Errorf("Unexpected error text: %s", result.ErrorText)
	}
}

// TestErrNotGameMaster tests the not game master error
func TestErrNotGameMaster(t *testing.T) {
	result := ErrNotGameMaster().(*ErrResponse)

	if result.HTTPStatusCode != 403 {
		t.Errorf("Expected status 403, got %d", result.HTTPStatusCode)
	}
	if result.AppCode != ErrCodeNotGameMaster {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeNotGameMaster, result.AppCode)
	}
	if result.ErrorText != "Only the game master can perform this action" {
		t.Errorf("Unexpected error text: %s", result.ErrorText)
	}
}

// TestErrGameArchived tests the game archived error
func TestErrGameArchived(t *testing.T) {
	result := ErrGameArchived().(*ErrResponse)

	if result.HTTPStatusCode != 403 {
		t.Errorf("Expected status 403, got %d", result.HTTPStatusCode)
	}
	if result.AppCode != ErrCodeGameArchived {
		t.Errorf("Expected AppCode %d, got %d", ErrCodeGameArchived, result.AppCode)
	}
	if result.ErrorText != "This game is archived and read-only. No new content can be created." {
		t.Errorf("Unexpected error text: %s", result.ErrorText)
	}
}

// TestIsArchivedGameError tests the archived game error detection
func TestIsArchivedGameError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "archived game error",
			err:  errors.New("game is archived"),
			want: true,
		},
		{
			name: "archived in message",
			err:  errors.New("cannot modify archived game"),
			want: true,
		},
		{
			name: "uppercase archived",
			err:  errors.New("Game is ARCHIVED"),
			want: false, // Case-sensitive check
		},
		{
			name: "different error",
			err:  errors.New("game not found"),
			want: false,
		},
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsArchivedGameError(tt.err)
			if got != tt.want {
				t.Errorf("IsArchivedGameError() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestErrorResponseIntegration tests full error response rendering
func TestErrorResponseIntegration(t *testing.T) {
	tests := []struct {
		name         string
		renderer     render.Renderer
		expectedCode int
		checkJSON    func(*testing.T, map[string]interface{})
	}{
		{
			name:         "invalid request renders correctly",
			renderer:     ErrInvalidRequest(errors.New("bad input")),
			expectedCode: 400,
			checkJSON: func(t *testing.T, data map[string]interface{}) {
				if data["status"] != "Invalid request." {
					t.Errorf("Unexpected status: %v", data["status"])
				}
				if data["error"] != "bad input" {
					t.Errorf("Unexpected error: %v", data["error"])
				}
			},
		},
		{
			name:         "unauthorized renders correctly",
			renderer:     ErrUnauthorized("invalid token"),
			expectedCode: 401,
			checkJSON: func(t *testing.T, data map[string]interface{}) {
				if data["status"] != "Unauthorized." {
					t.Errorf("Unexpected status: %v", data["status"])
				}
			},
		},
		{
			name:         "game archived renders with code",
			renderer:     ErrGameArchived(),
			expectedCode: 403,
			checkJSON: func(t *testing.T, data map[string]interface{}) {
				if data["code"] != float64(ErrCodeGameArchived) {
					t.Errorf("Expected code %d, got %v", ErrCodeGameArchived, data["code"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			rec := httptest.NewRecorder()

			// Render the error
			render.Render(rec, req, tt.renderer)

			// Check status code
			if rec.Code != tt.expectedCode {
				t.Errorf("Expected status %d, got %d", tt.expectedCode, rec.Code)
			}

			// Parse JSON response
			var data map[string]interface{}
			if err := json.Unmarshal(rec.Body.Bytes(), &data); err != nil {
				t.Fatalf("Failed to parse JSON: %v", err)
			}

			// Run custom JSON checks
			if tt.checkJSON != nil {
				tt.checkJSON(t, data)
			}
		})
	}
}
