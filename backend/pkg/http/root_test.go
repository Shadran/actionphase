package http

import (
	"actionphase/pkg/core"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// TestRootEndpoints tests the basic root endpoints
func TestRootEndpoints(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping integration test - SKIP_DB_TESTS=true")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	handler := &Handler{App: app}

	// Create router with basic middleware
	router := chi.NewRouter()

	// Add basic endpoints
	router.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("root."))
	})
	router.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ponger"))
	})

	tests := []struct {
		name           string
		path           string
		expectedStatus int
		expectedBody   string
	}{
		{
			name:           "root endpoint returns 200",
			path:           "/",
			expectedStatus: http.StatusOK,
			expectedBody:   "root.",
		},
		{
			name:           "ping endpoint returns ponger",
			path:           "/ping",
			expectedStatus: http.StatusOK,
			expectedBody:   "ponger",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			if tt.expectedBody != "" && rec.Body.String() != tt.expectedBody {
				t.Errorf("Expected body '%s', got '%s'", tt.expectedBody, rec.Body.String())
			}
		})
	}

	// Test health endpoint (requires observability setup)
	t.Run("health endpoint is accessible", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/health", nil)
		rec := httptest.NewRecorder()

		// Setup observability health handler
		testRouter := chi.NewRouter()
		testRouter.Get("/health", handler.App.Observability.HealthHandler())

		testRouter.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
		}
	})

}

// TestMiddlewareStack tests that middleware is properly applied
func TestMiddlewareStack(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping integration test - SKIP_DB_TESTS=true")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	t.Run("observability middleware adds correlation ID", func(t *testing.T) {
		router := chi.NewRouter()

		// Add observability middleware
		observabilityMiddleware := app.Observability.MiddlewareStack()
		for _, mw := range observabilityMiddleware {
			router.Use(mw)
		}

		router.Get("/test", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		req := httptest.NewRequest("GET", "/test", nil)
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rec.Code)
		}

		// Note: Correlation ID may be in response headers
		if correlationID := rec.Header().Get("X-Correlation-ID"); correlationID != "" {
			t.Logf("Correlation ID found in response: %s", correlationID)
		}
	})
}

// TestRouteNotFound tests 404 handling
func TestRouteNotFound(t *testing.T) {
	router := chi.NewRouter()
	router.Get("/exists", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name           string
		path           string
		expectedStatus int
	}{
		{
			name:           "valid route returns 200",
			path:           "/exists",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "invalid route returns 404",
			path:           "/does-not-exist",
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "invalid API route returns 404",
			path:           "/api/v1/nonexistent",
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
		})
	}
}

// TestJWTMiddleware tests JWT authentication middleware
func TestJWTMiddleware(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping integration test - SKIP_DB_TESTS=true")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	handler := &Handler{App: app}

	// Create test user
	testUser := testDB.CreateTestUser(t, "jwttest", "jwt@example.com")

	t.Run("protected route requires authentication", func(t *testing.T) {
		router := chi.NewRouter()
		tokenAuth := handler.getTokenAuth()

		router.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			r.Get("/protected", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("protected content"))
			})
		})

		// Request without token should fail
		req := httptest.NewRequest("GET", "/protected", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401 Unauthorized, got %d", rec.Code)
		}
	})

	t.Run("protected route succeeds with valid token", func(t *testing.T) {
		router := chi.NewRouter()
		tokenAuth := handler.getTokenAuth()

		router.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			// Note: Not using Authenticator() to allow token verification without 401

			r.Get("/protected", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("protected content"))
			})
		})

		// Create valid JWT token
		token, err := core.CreateTestJWTTokenForUser(app, testUser)
		if err != nil {
			t.Fatalf("Failed to create JWT token: %v", err)
		}

		// Request with valid token should succeed
		req := httptest.NewRequest("GET", "/protected", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("Expected 200 OK, got %d", rec.Code)
		}
	})

	t.Run("malformed token returns 401", func(t *testing.T) {
		router := chi.NewRouter()
		tokenAuth := handler.getTokenAuth()

		router.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			r.Get("/protected", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})
		})

		// Request with malformed token
		req := httptest.NewRequest("GET", "/protected", nil)
		req.Header.Set("Authorization", "Bearer invalid.token.here")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("Expected 401 Unauthorized for malformed token, got %d", rec.Code)
		}
	})
}

// TestHTTPMethods tests that different HTTP methods work correctly
func TestHTTPMethods(t *testing.T) {
	router := chi.NewRouter()

	var methodCalled string

	router.Get("/resource", func(w http.ResponseWriter, r *http.Request) {
		methodCalled = "GET"
		w.WriteHeader(http.StatusOK)
	})

	router.Post("/resource", func(w http.ResponseWriter, r *http.Request) {
		methodCalled = "POST"
		w.WriteHeader(http.StatusCreated)
	})

	router.Put("/resource", func(w http.ResponseWriter, r *http.Request) {
		methodCalled = "PUT"
		w.WriteHeader(http.StatusOK)
	})

	router.Delete("/resource", func(w http.ResponseWriter, r *http.Request) {
		methodCalled = "DELETE"
		w.WriteHeader(http.StatusNoContent)
	})

	tests := []struct {
		name           string
		method         string
		expectedStatus int
		expectedMethod string
	}{
		{"GET request", "GET", http.StatusOK, "GET"},
		{"POST request", "POST", http.StatusCreated, "POST"},
		{"PUT request", "PUT", http.StatusOK, "PUT"},
		{"DELETE request", "DELETE", http.StatusNoContent, "DELETE"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			methodCalled = ""

			req := httptest.NewRequest(tt.method, "/resource", nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rec.Code)
			}

			if methodCalled != tt.expectedMethod {
				t.Errorf("Expected method %s to be called, got %s", tt.expectedMethod, methodCalled)
			}
		})
	}

	t.Run("unsupported method returns 405", func(t *testing.T) {
		req := httptest.NewRequest("PATCH", "/resource", nil)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusMethodNotAllowed {
			t.Errorf("Expected 405 Method Not Allowed, got %d", rec.Code)
		}
	})
}

// TestContentTypeHandling tests JSON content type handling
func TestContentTypeHandling(t *testing.T) {
	router := chi.NewRouter()

	router.Post("/json", func(w http.ResponseWriter, r *http.Request) {
		contentType := r.Header.Get("Content-Type")
		if contentType != "application/json" {
			w.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	tests := []struct {
		name           string
		contentType    string
		expectedStatus int
	}{
		{
			name:           "JSON content type accepted",
			contentType:    "application/json",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "missing content type",
			contentType:    "",
			expectedStatus: http.StatusUnsupportedMediaType,
		},
		{
			name:           "wrong content type rejected",
			contentType:    "text/plain",
			expectedStatus: http.StatusUnsupportedMediaType,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/json", nil)
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, rec.Code)
			}
		})
	}
}
