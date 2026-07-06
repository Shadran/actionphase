package middleware

import (
	"net/http"
	"time"

	"github.com/didip/tollbooth/v7"
	"github.com/didip/tollbooth/v7/limiter"
)

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	RequestsPerSecond float64
	Burst             int
	TTL               time.Duration
	IPLookups         []string
}


// RateLimitMiddleware creates a rate limiting middleware with custom config
func RateLimitMiddleware(config RateLimitConfig) func(http.Handler) http.Handler {
	lmt := tollbooth.NewLimiter(config.RequestsPerSecond, &limiter.ExpirableOptions{
		DefaultExpirationTTL: config.TTL,
	})

	// Set burst size
	lmt.SetBurst(config.Burst)

	// Configure IP lookup methods
	lmt.SetIPLookups(config.IPLookups)

	// Custom error message
	lmt.SetMessage(`{"error": "Rate limit exceeded. Please try again later."}`)
	lmt.SetMessageContentType("application/json")

	return func(next http.Handler) http.Handler {
		return tollbooth.LimitHandler(lmt, next)
	}
}

// StrictRateLimit creates a strict rate limiter for sensitive endpoints
// (e.g., registration, password reset, login)
// In development mode, uses relaxed limits to allow E2E testing
func StrictRateLimit(isDevelopment bool) func(http.Handler) http.Handler {
	// In development mode, use relaxed limits for E2E testing
	if isDevelopment {
		return RateLimitMiddleware(RateLimitConfig{
			RequestsPerSecond: 10.0, // 10 requests per second (for E2E tests)
			Burst:             20,   // Allow burst of 20
			TTL:               1 * time.Minute,
			IPLookups:         []string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"},
		})
	}

	// Production: strict rate limiting
	return RateLimitMiddleware(RateLimitConfig{
		RequestsPerSecond: 0.1, // 1 request per 10 seconds
		Burst:             3,   // Allow small burst of 3
		TTL:               60 * time.Minute,
		IPLookups:         []string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"},
	})
}

