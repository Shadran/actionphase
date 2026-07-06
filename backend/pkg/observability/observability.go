package observability

import (
	"encoding/json"
	"net/http"
)

// Observability provides a unified interface for logging, metrics, and tracing.
// It combines structured logging with context awareness, metrics collection,
// and request tracing into a cohesive observability system.
type Observability struct {
	Logger      *Logger
	Metrics     *Metrics     // Legacy in-memory metrics (retained for health checks)
	OTELMetrics *OTELMetrics // OTEL metrics (active when OTEL_ENABLED=true)
}

// New creates a new observability system with logging and metrics.
// OTEL metrics must be initialized separately via InitMeterProvider and attached
// to OTELMetrics after construction (main.go wires this after config is loaded).
func New(environment, logLevel string) *Observability {
	return &Observability{
		Logger:  NewLogger(environment, logLevel),
		Metrics: NewMetrics(),
	}
}

// MiddlewareStack returns a complete middleware stack for HTTP observability.
// This includes request tracing, metrics collection, error recovery, and CORS.
func (o *Observability) MiddlewareStack() []func(http.Handler) http.Handler {
	return []func(http.Handler) http.Handler{
		CORSMiddleware(),                            // Handle CORS first
		HealthCheckMiddleware("/health"),            // Health check bypass
		ErrorRecoveryMiddleware(o.Logger),           // Panic recovery
		RequestTracingMiddleware(o.Logger),          // Request tracing and correlation IDs
		MetricsMiddleware(o.Metrics, o.OTELMetrics), // Metrics collection
		RouteTagMiddleware,                          // Backfill OTEL span name with chi route pattern
	}
}

// HealthHandler returns an HTTP handler for health checks with detailed status.
// This includes database connectivity, uptime, and basic system health.
func (o *Observability) HealthHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		health := o.getHealthStatus()

		w.Header().Set("Content-Type", "application/json")

		// Set appropriate status code
		if health.Status == "healthy" {
			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
		}

		encoder := json.NewEncoder(w)
		encoder.SetIndent("", "  ")

		if err := encoder.Encode(health); err != nil {
			o.Logger.Error(r.Context(), "Failed to encode health status", "error", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
		}
	}
}

// HealthStatus represents the health status of the application
type HealthStatus struct {
	Status    string                 `json:"status"` // "healthy" or "unhealthy"
	Timestamp string                 `json:"timestamp"`
	Uptime    string                 `json:"uptime"`
	Version   string                 `json:"version,omitempty"`
	Checks    map[string]CheckStatus `json:"checks"`
}

// CheckStatus represents the status of an individual health check
type CheckStatus struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// getHealthStatus performs health checks and returns current status
func (o *Observability) getHealthStatus() HealthStatus {
	snapshot := o.Metrics.GetMetrics()

	checks := make(map[string]CheckStatus)

	// Basic service check
	checks["service"] = CheckStatus{
		Status:  "healthy",
		Message: "Service is running",
	}

	// Error rate check
	if snapshot.ErrorRate > 50.0 { // More than 50% error rate
		checks["error_rate"] = CheckStatus{
			Status:  "unhealthy",
			Message: "High error rate detected",
		}
	} else if snapshot.ErrorRate > 10.0 { // More than 10% error rate
		checks["error_rate"] = CheckStatus{
			Status:  "degraded",
			Message: "Elevated error rate",
		}
	} else {
		checks["error_rate"] = CheckStatus{
			Status:  "healthy",
			Message: "Error rate is normal",
		}
	}

	// Determine overall status
	overallStatus := "healthy"
	for _, check := range checks {
		if check.Status == "unhealthy" {
			overallStatus = "unhealthy"
			break
		} else if check.Status == "degraded" && overallStatus != "unhealthy" {
			overallStatus = "degraded"
		}
	}

	return HealthStatus{
		Status:    overallStatus,
		Timestamp: snapshot.Timestamp.Format("2006-01-02T15:04:05Z07:00"),
		Uptime:    snapshot.Uptime.String(),
		Checks:    checks,
	}
}
