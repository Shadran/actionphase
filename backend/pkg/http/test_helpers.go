package http

import (
	"actionphase/pkg/core"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// HandlerTestContext provides all necessary context for testing HTTP handlers
type HandlerTestContext struct {
	// App is the test application instance with all dependencies
	App *core.App

	// TestDB provides database utilities
	TestDB *core.TestDatabase

	// Router is the chi router for registering test routes
	Router *chi.Mux

	// T is the testing context
	T *testing.T
}

// NewHandlerTestContext creates a new test context for handler testing
// This sets up everything needed to test HTTP handlers: database, app, and router
//
// Example:
//
//	func TestMyHandler(t *testing.T) {
//	    ctx := NewHandlerTestContext(t)
//	    defer ctx.Cleanup()
//
//	    // Setup routes
//	    handler := &auth.Handler{App: ctx.App}
//	    ctx.Router.Post("/api/v1/auth/login", handler.V1Login)
//
//	    // Create and execute test request
//	    resp := ctx.POST("/api/v1/auth/login", map[string]string{
//	        "username": "testuser",
//	        "password": "testpass",
//	    })
//	    ctx.AssertStatus(resp, http.StatusOK)
//	}
func NewHandlerTestContext(t *testing.T) *HandlerTestContext {
	t.Helper()

	// Setup test database
	testDB := core.NewTestDatabase(t)
	if testDB == nil {
		t.Fatal("Failed to create test database")
	}

	// Create test app with all dependencies
	app := core.NewTestApp(testDB.Pool)

	// Create router with JWT middleware
	router := chi.NewRouter()

	// Setup JWT authentication middleware using the app's config
	tokenAuth := jwtauth.New(app.Config.JWT.Algorithm, []byte(app.Config.JWT.Secret), nil)
	router.Use(jwtauth.Verifier(tokenAuth))
	// Note: We don't use jwtauth.Authenticator() here because some endpoints
	// should be accessible without authentication (like login/register)
	// Individual tests can apply additional authentication requirements

	return &HandlerTestContext{
		App:    app,
		TestDB: testDB,
		Router: router,
		T:      t,
	}
}

// Cleanup closes database connections and cleans up test data
func (ctx *HandlerTestContext) Cleanup() {
	if ctx.TestDB != nil {
		ctx.TestDB.CleanupTables(ctx.T)
		ctx.TestDB.Close()
	}
}

// HTTPTestRequest represents an HTTP test request configuration
type HTTPTestRequest struct {
	Method      string
	Path        string
	Body        interface{}
	Headers     map[string]string
	QueryParams map[string]string
	User        *core.User // If set, adds JWT auth header
}

// ExecuteRequest executes an HTTP request against the test router
// This is the low-level method used by GET, POST, PUT, DELETE helpers
//
// Example:
//
//	resp := ctx.ExecuteRequest(HTTPTestRequest{
//	    Method: "POST",
//	    Path: "/api/v1/games",
//	    Body: map[string]string{"title": "Test Game"},
//	    User: testUser, // Adds JWT auth
//	})
func (ctx *HandlerTestContext) ExecuteRequest(req HTTPTestRequest) *httptest.ResponseRecorder {
	ctx.T.Helper()

	// Marshal body to JSON if provided
	var bodyReader io.Reader
	if req.Body != nil {
		bodyBytes, err := json.Marshal(req.Body)
		if err != nil {
			ctx.T.Fatalf("Failed to marshal request body: %v", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	// Create HTTP request
	path := req.Path
	if len(req.QueryParams) > 0 {
		path = path + "?" + encodeQueryParams(req.QueryParams)
	}

	httpReq := httptest.NewRequest(req.Method, path, bodyReader)

	// Set default headers
	httpReq.Header.Set("Content-Type", "application/json")

	// Add custom headers
	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	// Add JWT authentication if user provided
	if req.User != nil {
		token, err := core.CreateTestJWTTokenForUser(ctx.App, req.User)
		if err != nil {
			ctx.T.Fatalf("Failed to create JWT token: %v", err)
		}
		httpReq.Header.Set("Authorization", "Bearer "+token)
	}

	// Execute request
	recorder := httptest.NewRecorder()
	ctx.Router.ServeHTTP(recorder, httpReq)

	return recorder
}

// GET performs a GET request
func (ctx *HandlerTestContext) GET(path string) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "GET",
		Path:   path,
	})
}

// GETWithAuth performs an authenticated GET request
func (ctx *HandlerTestContext) GETWithAuth(path string, user *core.User) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "GET",
		Path:   path,
		User:   user,
	})
}

// POST performs a POST request with JSON body
func (ctx *HandlerTestContext) POST(path string, body interface{}) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "POST",
		Path:   path,
		Body:   body,
	})
}

// POSTWithAuth performs an authenticated POST request with JSON body
func (ctx *HandlerTestContext) POSTWithAuth(path string, body interface{}, user *core.User) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "POST",
		Path:   path,
		Body:   body,
		User:   user,
	})
}

// PUT performs a PUT request with JSON body
func (ctx *HandlerTestContext) PUT(path string, body interface{}) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "PUT",
		Path:   path,
		Body:   body,
	})
}

// PUTWithAuth performs an authenticated PUT request with JSON body
func (ctx *HandlerTestContext) PUTWithAuth(path string, body interface{}, user *core.User) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "PUT",
		Path:   path,
		Body:   body,
		User:   user,
	})
}

// DELETE performs a DELETE request
func (ctx *HandlerTestContext) DELETE(path string) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "DELETE",
		Path:   path,
	})
}

// DELETEWithAuth performs an authenticated DELETE request
func (ctx *HandlerTestContext) DELETEWithAuth(path string, user *core.User) *httptest.ResponseRecorder {
	return ctx.ExecuteRequest(HTTPTestRequest{
		Method: "DELETE",
		Path:   path,
		User:   user,
	})
}

// AssertStatus asserts the HTTP status code
func (ctx *HandlerTestContext) AssertStatus(resp *httptest.ResponseRecorder, expectedStatus int) {
	ctx.T.Helper()
	if resp.Code != expectedStatus {
		ctx.T.Errorf("Expected status %d, got %d. Response body: %s",
			expectedStatus, resp.Code, resp.Body.String())
	}
}

// AssertStatusOK asserts 200 OK status
func (ctx *HandlerTestContext) AssertStatusOK(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusOK)
}

// AssertStatusCreated asserts 201 Created status
func (ctx *HandlerTestContext) AssertStatusCreated(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusCreated)
}

// AssertStatusBadRequest asserts 400 Bad Request status
func (ctx *HandlerTestContext) AssertStatusBadRequest(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusBadRequest)
}

// AssertStatusUnauthorized asserts 401 Unauthorized status
func (ctx *HandlerTestContext) AssertStatusUnauthorized(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusUnauthorized)
}

// AssertStatusForbidden asserts 403 Forbidden status
func (ctx *HandlerTestContext) AssertStatusForbidden(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusForbidden)
}

// AssertStatusNotFound asserts 404 Not Found status
func (ctx *HandlerTestContext) AssertStatusNotFound(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusNotFound)
}

// AssertStatusInternalError asserts 500 Internal Server Error status
func (ctx *HandlerTestContext) AssertStatusInternalError(resp *httptest.ResponseRecorder) {
	ctx.AssertStatus(resp, http.StatusInternalServerError)
}

// ParseJSONResponse parses the response body into the provided struct
func (ctx *HandlerTestContext) ParseJSONResponse(resp *httptest.ResponseRecorder, target interface{}) {
	ctx.T.Helper()
	if err := json.Unmarshal(resp.Body.Bytes(), target); err != nil {
		ctx.T.Fatalf("Failed to parse JSON response: %v. Body: %s", err, resp.Body.String())
	}
}

// AssertJSONContains checks if the response JSON contains expected fields and values
func (ctx *HandlerTestContext) AssertJSONContains(resp *httptest.ResponseRecorder, expectedFields map[string]interface{}) {
	ctx.T.Helper()

	var actual map[string]interface{}
	if err := json.Unmarshal(resp.Body.Bytes(), &actual); err != nil {
		ctx.T.Fatalf("Failed to parse response as JSON: %v", err)
	}

	for key, expectedValue := range expectedFields {
		actualValue, exists := actual[key]
		if !exists {
			ctx.T.Errorf("Expected field '%s' not found in response. Response: %s", key, resp.Body.String())
			continue
		}

		if actualValue != expectedValue {
			ctx.T.Errorf("Field '%s': expected %v, got %v", key, expectedValue, actualValue)
		}
	}
}

// AssertErrorResponse checks if the response contains an error with specific code and message substring
func (ctx *HandlerTestContext) AssertErrorResponse(resp *httptest.ResponseRecorder, expectedCode string, messageSubstring string) {
	ctx.T.Helper()

	var errorResp struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(resp.Body.Bytes(), &errorResp); err != nil {
		ctx.T.Fatalf("Failed to parse error response: %v. Body: %s", err, resp.Body.String())
	}

	if errorResp.Error.Code != expectedCode {
		ctx.T.Errorf("Expected error code '%s', got '%s'", expectedCode, errorResp.Error.Code)
	}

	if !strings.Contains(errorResp.Error.Message, messageSubstring) {
		ctx.T.Errorf("Expected error message to contain '%s', got '%s'",
			messageSubstring, errorResp.Error.Message)
	}
}

// CreateTestUser creates a test user and returns it
// This is a convenience wrapper around TestDatabase.CreateTestUser
func (ctx *HandlerTestContext) CreateTestUser(username, email string) *core.User {
	ctx.T.Helper()
	return ctx.TestDB.CreateTestUser(ctx.T, username, email)
}

// CreateTestUserWithPassword creates a test user with a known password
// Returns the user and the plain password for use in login tests
func (ctx *HandlerTestContext) CreateTestUserWithPassword(username, email, password string) (*core.User, string) {
	ctx.T.Helper()
	return ctx.TestDB.CreateTestUserWithCredentials(ctx.T, username, email, password)
}

// Helper function to encode query parameters
func encodeQueryParams(params map[string]string) string {
	var parts []string
	for key, value := range params {
		parts = append(parts, key+"="+value)
	}
	return strings.Join(parts, "&")
}
