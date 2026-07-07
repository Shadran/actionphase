package observability

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Logger context helpers
// ============================================================================

func TestContextHelpers_RoundTrip(t *testing.T) {
	ctx := context.Background()
	ctx = WithCorrelationID(ctx, "corr-123")
	ctx = WithRequestID(ctx, "req-456")
	ctx = WithUserID(ctx, "42")

	assert.Equal(t, "corr-123", GetCorrelationID(ctx))
}

func TestGetCorrelationID_Missing(t *testing.T) {
	id := GetCorrelationID(context.Background())
	assert.Equal(t, "", id, "missing correlation ID should return empty string")
}

func TestGetCorrelationID_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), CorrelationIDKey, 999)
	id := GetCorrelationID(ctx)
	assert.Equal(t, "", id, "non-string correlation ID should return empty string")
}

// ============================================================================
// Logger.LogError nil guard
// ============================================================================

func TestLogger_LogError_NilDoesNotPanic(t *testing.T) {
	logger := NewLogger("test", "error")
	// Must not panic when err is nil
	assert.NotPanics(t, func() {
		logger.LogError(context.Background(), nil, "should be silent")
	})
}

// ============================================================================
// Logger.LogHTTPRequest level selection
// ============================================================================

// TestLogger_LogHTTPRequest_Levels ensures status codes produce the correct
// log levels. Wrong level means 500s are missed by alerting or 404s trigger pages.
func TestLogger_LogHTTPRequest_NoPanic(t *testing.T) {
	logger := NewLogger("test", "debug")
	ctx := context.Background()

	cases := []struct{ code int }{
		{200}, {201}, {301},
		{400}, {401}, {403}, {404},
		{500}, {503},
	}

	for _, tc := range cases {
		assert.NotPanics(t, func() {
			logger.LogHTTPRequest(ctx, "GET", "/test", tc.code, 10*time.Millisecond)
		}, "LogHTTPRequest should not panic for status %d", tc.code)
	}
}

// ============================================================================
// Metrics
// ============================================================================

func TestMetrics_RecordHTTPRequest_CountsAndErrors(t *testing.T) {
	m := NewMetrics()

	m.RecordHTTPRequest("GET", "/api/users", 200, 10*time.Millisecond)
	m.RecordHTTPRequest("GET", "/api/users", 200, 20*time.Millisecond)
	m.RecordHTTPRequest("POST", "/api/games", 500, 50*time.Millisecond)
	m.RecordHTTPRequest("GET", "/api/users", 404, 5*time.Millisecond)

	snap := m.GetMetrics()
	assert.Equal(t, int64(4), snap.TotalRequests)
	assert.Equal(t, int64(2), snap.TotalErrors, "404 and 500 should both count as errors")
	assert.InDelta(t, 50.0, snap.ErrorRate, 0.1, "2/4 = 50% error rate")
}

func TestMetrics_ErrorRate_ZeroRequests(t *testing.T) {
	m := NewMetrics()
	snap := m.GetMetrics()
	assert.Equal(t, 0.0, snap.ErrorRate, "zero requests should produce 0% error rate, not divide-by-zero")
}

// ============================================================================
// normalizeRoute
// ============================================================================

func TestNormalizeRoute(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"/api/users/42", "/api/users/{id}"},
		{"/api/games/123/phases", "/api/games/{id}/phases"},
		{"/api/users", "/api/users"},
		{"/health", "/health"},
	}

	for _, tc := range cases {
		got := normalizeRoute(tc.input)
		assert.Equal(t, tc.expected, got, "normalizeRoute(%q)", tc.input)
	}
}

func TestNormalizeRoute_TruncatesLongPaths(t *testing.T) {
	long := "/api/" + string(make([]byte, 60))
	got := normalizeRoute(long)
	assert.LessOrEqual(t, len(got), 50, "long paths should be truncated to 50 chars")
	assert.Contains(t, got, "...", "truncated path should end with ...")
}

// ============================================================================
// ErrorRecoveryMiddleware
// ============================================================================

// TestErrorRecoveryMiddleware_PanicReturns500 verifies that a panicking handler
// is recovered and the client receives a 500. Without this, a panic crashes the
// whole server process.
func TestErrorRecoveryMiddleware_PanicReturns500(t *testing.T) {
	logger := NewLogger("test", "error")
	mw := ErrorRecoveryMiddleware(logger)

	panicHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("something went wrong")
	})

	req := httptest.NewRequest("GET", "/boom", nil)
	rec := httptest.NewRecorder()
	mw(panicHandler).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "Internal server error")
}

func TestErrorRecoveryMiddleware_NoPanicPassesThrough(t *testing.T) {
	logger := NewLogger("test", "error")
	mw := ErrorRecoveryMiddleware(logger)

	normalHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/fine", nil)
	rec := httptest.NewRecorder()
	mw(normalHandler).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
}

// ============================================================================
// RequestTracingMiddleware
// ============================================================================

// TestRequestTracingMiddleware_SetsHeaders verifies correlation and request IDs
// are added to the response. If these are absent, frontend and monitoring cannot
// correlate requests to log entries.
func TestRequestTracingMiddleware_SetsHeaders(t *testing.T) {
	logger := NewLogger("test", "error")
	mw := RequestTracingMiddleware(logger)

	called := false
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		// Correlation ID must be in context
		assert.NotEmpty(t, GetCorrelationID(r.Context()))
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	rec := httptest.NewRecorder()
	mw(handler).ServeHTTP(rec, req)

	assert.True(t, called)
	assert.NotEmpty(t, rec.Header().Get("X-Correlation-ID"))
	assert.NotEmpty(t, rec.Header().Get("X-Request-ID"))
}

func TestRequestTracingMiddleware_PropagatesExistingCorrelationID(t *testing.T) {
	logger := NewLogger("test", "error")
	mw := RequestTracingMiddleware(logger)

	const existingID = "client-provided-corr-id"
	var capturedID string

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedID = GetCorrelationID(r.Context())
		w.WriteHeader(http.StatusOK)
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("X-Correlation-ID", existingID)
	rec := httptest.NewRecorder()
	mw(handler).ServeHTTP(rec, req)

	assert.Equal(t, existingID, capturedID, "existing correlation ID from client should be preserved")
	assert.Equal(t, existingID, rec.Header().Get("X-Correlation-ID"))
}

// ============================================================================
// HealthHandler / getHealthStatus
// ============================================================================

// TestHealthHandler_HealthyReturns200 verifies the health endpoint returns 200
// and valid JSON under normal conditions. Monitoring systems depend on this.
func TestHealthHandler_HealthyReturns200(t *testing.T) {
	obs := New("test", "error")

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	obs.HealthHandler()(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))

	var health HealthStatus
	err := json.Unmarshal(rec.Body.Bytes(), &health)
	require.NoError(t, err, "response should be valid JSON")
	assert.Equal(t, "healthy", health.Status)
}

// TestHealthHandler_HighErrorRate_Unhealthy verifies the >50% error rate threshold
// produces "unhealthy". Wrong threshold means monitoring misses a degraded service.
func TestHealthHandler_HighErrorRate_Unhealthy(t *testing.T) {
	obs := New("test", "error")

	// Produce >50% error rate: 6 errors out of 10 requests
	for i := 0; i < 6; i++ {
		obs.Metrics.RecordHTTPRequest("GET", "/api/test", 500, 1*time.Millisecond)
	}
	for i := 0; i < 4; i++ {
		obs.Metrics.RecordHTTPRequest("GET", "/api/test", 200, 1*time.Millisecond)
	}

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	obs.HealthHandler()(rec, req)

	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)

	var health HealthStatus
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &health))
	assert.Equal(t, "unhealthy", health.Status)
}

// TestHealthHandler_ElevatedErrorRate_Degraded verifies the 10-50% error rate
// produces "degraded" status, not "unhealthy".
func TestHealthHandler_ElevatedErrorRate_Degraded(t *testing.T) {
	obs := New("test", "error")

	// 2 errors out of 10 = 20% error rate → degraded
	for i := 0; i < 2; i++ {
		obs.Metrics.RecordHTTPRequest("GET", "/api/test", 500, 1*time.Millisecond)
	}
	for i := 0; i < 8; i++ {
		obs.Metrics.RecordHTTPRequest("GET", "/api/test", 200, 1*time.Millisecond)
	}

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	obs.HealthHandler()(rec, req)

	// degraded → still returns 503 since status != "healthy"
	assert.Equal(t, http.StatusServiceUnavailable, rec.Code)

	var health HealthStatus
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &health))
	assert.Equal(t, "degraded", health.Status)
}

// ============================================================================
// ============================================================================
// isScannerProbe
// ============================================================================

func TestIsScannerProbe(t *testing.T) {
	probes := []string{
		"/.env",
		"/.env.local",
		"/.env.production",
		"/api/v2/.env",
		"/api/backend/.env",
		"/.git/config",
		"/.git/HEAD",
		"/wp-login.php",
		"/phpinfo.php",
		"/info.php",
		"/something/random.php",
		"/wp-admin",
		"/wordpress",
		// credential endpoint probes
		"/api/secrets",
		"/api/keys",
		"/api/credentials",
		"/api/tokens",
		"/api/credentials.json_development",
		// api-keys file variants
		"/api-keys.json",
		"/api_keys.txt.inactive",
		"/api_keys.txt_old",
		"/api_keys.txt-backup",
		"/api_keys.txt2",
		// dotenv variants under /api/
		"/api/.env.prod",
		"/api/.env.dev",
		"/api/.env.local_staging",
		"/api/.environment",
		"/api/shared/config.env",
		// backup/temp suffixes
		"/api/wp-config.old.bak",
		"/api/database.yml.dev",
		"/api/next.config.js._",
		"/api/config.xml_development",
		// source file probes
		"/api/config.js",
		"/api/node/constants.js",
		"/api/settings.py",
		"/api/env.js",
		// API discovery probes
		"/api/graphql",
		"/api/version",
		"/api/env",
		"/api/environment",
		"/api/swagger.json",
		"/api/swagger.yaml",
		"/api/openapi.json",
		"/api/v2/swagger.json",
		"/api-docs",
		"/api-docs/swagger.json",
		// well-known config files
		"/api/config/tsconfig.json",
		"/api/gcp_credentials.json.prod",
		// wildcard enumeration
		"/api/v1/*",
		"/api/serverless/something",
	}
	for _, p := range probes {
		assert.True(t, isScannerProbe(p), "expected probe: %s", p)
	}

	legit := []string{
		"/api/v1/games",
		"/api/v1/games/42",
		"/api/v1/auth/login",
		"/health",
		"/api/v1/nonexistent",
		"/static/app.js",
	}
	for _, p := range legit {
		assert.False(t, isScannerProbe(p), "expected NOT probe: %s", p)
	}
}

// ============================================================================
// metricRoute / routePattern — http.route label cardinality
// ============================================================================

// reqWithRoutePattern builds a request carrying a chi route context whose matched
// pattern is patterns (empty patterns => no match, i.e. a 404).
func reqWithRoutePattern(path string, patterns ...string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	rctx := chi.NewRouteContext()
	rctx.RoutePatterns = patterns
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

// TestMetricRoute_CollapsesUnmatchedPaths is the regression guard for the cardinality
// leak: a request that matched no chi route must produce the single "unmatched" sentinel
// label, never its raw URL path. Otherwise every 404 / scanner probe mints new series.
func TestMetricRoute_CollapsesUnmatchedPaths(t *testing.T) {
	tests := []struct {
		name string
		req  *http.Request
		want string
	}{
		{
			name: "matched route uses the chi template",
			req:  reqWithRoutePattern("/api/v1/games/42", "/api/v1/games/{id}"),
			want: "/api/v1/games/{id}",
		},
		{
			name: "unmatched path collapses to sentinel",
			req:  reqWithRoutePattern("/api/v1/nonexistent"),
			want: unmatchedRoute,
		},
		{
			name: "scanner probe collapses to sentinel (no raw path leak)",
			req:  reqWithRoutePattern("/.env"),
			want: unmatchedRoute,
		},
		{
			name: "no chi context at all collapses to sentinel",
			req:  httptest.NewRequest(http.MethodGet, "/anything", nil),
			want: unmatchedRoute,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, metricRoute(tt.req))
		})
	}
}

// TestRoutePattern_KeepsRawPathForLogging documents the deliberate split: unlike
// metricRoute, routePattern still returns the raw path on a miss so error logs show what
// a client or scanner actually hit. High log cardinality is fine; log lines aren't series.
func TestRoutePattern_KeepsRawPathForLogging(t *testing.T) {
	assert.Equal(t,
		"/api/v1/games/{id}",
		routePattern(reqWithRoutePattern("/api/v1/games/42", "/api/v1/games/{id}")),
		"matched request should use the chi template",
	)
	assert.Equal(t,
		"/.env",
		routePattern(reqWithRoutePattern("/.env")),
		"unmatched request should keep the raw path for logging",
	)
}
