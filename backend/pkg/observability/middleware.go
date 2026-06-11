package observability

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"path"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/jwtauth/v5"
	semconv "go.opentelemetry.io/otel/semconv/v1.36.0"
	"go.opentelemetry.io/otel/trace"
)

// RequestTracingMiddleware adds correlation IDs and request tracing to HTTP requests.
// It generates unique correlation and request IDs for each request, adds them to
// the request context, and includes them in response headers for client tracking.
//
// The middleware also logs each HTTP request with timing and status information.
func RequestTracingMiddleware(logger *Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			// Extract or generate correlation ID
			correlationID := r.Header.Get("X-Correlation-ID")
			if correlationID == "" {
				correlationID = generateID("corr")
			}

			// Generate unique request ID
			requestID := generateID("req")

			// Add IDs to response headers for client tracking
			w.Header().Set("X-Correlation-ID", correlationID)
			w.Header().Set("X-Request-ID", requestID)

			// Create enriched context
			ctx := r.Context()
			ctx = WithCorrelationID(ctx, correlationID)
			ctx = WithRequestID(ctx, requestID)

			// Expose the OTEL trace ID so clients can link requests to Grafana Tempo traces.
			// This is set after otelhttp has already created the span (otelhttp runs before
			// our middleware in the handler chain, so the trace ID is available here).
			if traceID := TraceIDFromContext(ctx); traceID != "" {
				w.Header().Set("X-Trace-ID", traceID)
			}

			// Add user ID to context if available from JWT
			if userID := extractUserIDFromRequest(r); userID != "" {
				ctx = WithUserID(ctx, userID)
			}

			// Create request with enriched context
			r = r.WithContext(ctx)

			// Wrap response writer to capture status code
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			// Process request
			next.ServeHTTP(ww, r)

			// Only log requests that resulted in an error — successful requests
			// are already fully captured by metrics and traces.
			duration := time.Since(start)
			if ww.Status() >= 400 {
				logArgs := []any{
					"remote_addr", r.RemoteAddr,
					"user_agent", r.UserAgent(),
					"content_length", r.ContentLength,
				}
				if isScannerProbe(r.URL.Path) {
					// Downgrade internet scanner noise to DEBUG; still recorded in metrics.
					logger.LogHTTPRequestAtLevel(ctx, slog.LevelDebug, r.Method, routePattern(r), ww.Status(), duration, logArgs...)
				} else {
					logger.LogHTTPRequest(ctx, r.Method, routePattern(r), ww.Status(), duration, logArgs...)
				}
			}
		})
	}
}

// MetricsMiddleware collects HTTP metrics for monitoring and alerting.
// Records into both the legacy in-memory store and OTEL metrics (when non-nil).
func MetricsMiddleware(metrics *Metrics, otelMetrics *OTELMetrics) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)

			duration := time.Since(start)
			status := ww.Status()

			route := routePattern(r)
			metrics.RecordHTTPRequest(r.Method, route, status, duration)

			if otelMetrics != nil {
				otelMetrics.RecordRequest(r.Context(), r.Method, route, status, duration)
			}
		})
	}
}

// ErrorRecoveryMiddleware provides panic recovery with structured logging.
// It catches panics in request handlers, logs them with full context,
// and returns a proper HTTP error response to prevent server crashes.
func ErrorRecoveryMiddleware(logger *Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					// http.ErrAbortHandler is a sentinel used by net/http to abort a
					// connection cleanly — re-raise it so the runtime handles it correctly.
					if err == http.ErrAbortHandler {
						panic(err)
					}

					ctx := r.Context()

					// Capture stack trace
					stackTrace := string(debug.Stack())

					logger.Error(ctx, "Panic recovered in HTTP handler",
						"panic", err,
						"method", r.Method,
						"path", r.URL.Path,
						"remote_addr", r.RemoteAddr,
						"stack_trace", stackTrace,
					)

					// Return 500 error to client
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)
					w.Write([]byte(`{"error":"Internal server error","code":500}`))
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// generateID creates a unique identifier with the given prefix
func generateID(prefix string) string {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based ID if random fails
		return prefix + "_" + strconv.FormatInt(time.Now().UnixNano(), 10)
	}
	return prefix + "_" + hex.EncodeToString(bytes)
}

// extractUserIDFromRequest extracts the user ID from the JWT token placed in
// context by jwtauth.Verifier. Returns empty string for unauthenticated requests.
func extractUserIDFromRequest(r *http.Request) string {
	_, claims, err := jwtauth.FromContext(r.Context())
	if err != nil || claims == nil {
		return ""
	}
	sub, ok := claims["sub"].(string)
	if !ok {
		return ""
	}
	return sub
}

// HealthCheckMiddleware provides a simple health check endpoint that bypasses
// authentication and other middleware for monitoring systems.
func HealthCheckMiddleware(path string) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == path && r.Method == "GET" {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`{"status":"healthy","timestamp":"` + time.Now().UTC().Format(time.RFC3339) + `"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CORSMiddleware adds CORS headers for cross-origin requests.
// This is useful for frontend development and API consumption.
func CORSMiddleware() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Correlation-ID")
			w.Header().Set("Access-Control-Expose-Headers", "X-Correlation-ID, X-Request-ID, X-Trace-ID")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RouteTagMiddleware backfills the active OTEL span with the matched chi route
// pattern after routing completes. otelhttp creates spans at the router entry
// point before chi has matched the route, so without this the span name is the
// raw URL path (high-cardinality). This middleware runs inside chi, where the
// route pattern is already resolved.
func RouteTagMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		if span := trace.SpanFromContext(r.Context()); span.IsRecording() {
			if chiCtx := chi.RouteContext(r.Context()); chiCtx != nil && chiCtx.RoutePattern() != "" {
				pattern := chiCtx.RoutePattern()
				span.SetName(r.Method + " " + pattern)
				span.SetAttributes(semconv.HTTPRoute(pattern))
			}
		}
	})
}

// routePattern returns the chi route template (e.g. "/api/v1/games/{id}") for a
// request, falling back to r.URL.Path when no chi context is present.
// Using the template prevents high-cardinality metric labels from parameterized routes.
func routePattern(r *http.Request) string {
	if chiCtx := chi.RouteContext(r.Context()); chiCtx != nil && chiCtx.RoutePattern() != "" {
		return chiCtx.RoutePattern()
	}
	return r.URL.Path
}

// isScannerProbe reports whether the request path matches patterns commonly
// used by automated internet scanners hunting for exposed secrets or CVEs.
// These generate expected 404s that are not actionable and should not appear
// as WARN-level noise in production logs.
func isScannerProbe(reqPath string) bool {
	// Normalise to prevent traversal tricks like /foo/../.env
	cleaned := path.Clean(reqPath)
	base := path.Base(cleaned)

	// Files that should never exist on this server
	probeFiles := []string{
		".env", ".env.local", ".env.production", ".env.staging", ".env.development",
		".git", "config", "phpinfo.php", "info.php", "wp-login.php",
	}
	for _, f := range probeFiles {
		if base == f {
			return true
		}
	}

	// Path suffixes (catches /api/v2/.env, /backend/.env, etc.)
	probeSuffixes := []string{
		"/.env", "/.git/config", "/.git/HEAD", "/wp-admin", "/wordpress",
	}
	for _, suffix := range probeSuffixes {
		if strings.HasSuffix(cleaned, suffix) {
			return true
		}
	}

	// Any .php file — this server runs no PHP
	if strings.HasSuffix(base, ".php") {
		return true
	}

	return false
}
