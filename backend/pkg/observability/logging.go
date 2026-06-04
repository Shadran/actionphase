// Package observability provides structured logging, request tracing, and metrics
// collection for the ActionPhase backend.
//
// This package enhances the standard log/slog with context-aware logging,
// request correlation IDs, and performance metrics to improve system
// observability and debugging capabilities.
package observability

import (
	"context"
	"io"
	"log/slog"
	"os"
	"time"
)

// ContextKey represents keys used for storing values in context
type ContextKey string

const (
	// CorrelationIDKey is the context key for request correlation IDs
	CorrelationIDKey ContextKey = "correlation_id"

	// UserIDKey is the context key for authenticated user IDs
	UserIDKey ContextKey = "user_id"

	// RequestIDKey is the context key for unique request identifiers
	RequestIDKey ContextKey = "request_id"

	// OperationKey is the context key for operation names
	OperationKey ContextKey = "operation"
)

// Logger wraps slog.Logger with context-aware logging capabilities.
// It automatically includes contextual information such as correlation IDs,
// user IDs, and request metadata in log entries.
type Logger struct {
	logger *slog.Logger
}

// NewLogger creates a new context-aware logger with the specified configuration.
//
// Environment determines the log format:
// - "development": Human-readable text format with color
// - "production": JSON format optimized for log aggregation
// - "test": Minimal output for testing
func NewLogger(environment, level string) *Logger {
	logLevel := parseLogLevel(level)

	opts := &slog.HandlerOptions{
		Level:     logLevel,
		AddSource: environment == "development",
	}

	var output io.Writer = os.Stdout

	if logFile := os.Getenv("LOG_FILE"); logFile != "" {
		if f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
			output = io.MultiWriter(os.Stdout, f)
		}
	}

	var handler slog.Handler
	switch environment {
	case "production":
		handler = slog.NewJSONHandler(output, opts)
	case "test":
		handler = slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
			Level: slog.LevelError,
		})
	default:
		handler = slog.NewTextHandler(output, opts)
	}

	return &Logger{logger: slog.New(handler)}
}

// parseLogLevel converts string log level to slog.Level
func parseLogLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// WithContext returns a new Logger that includes context information in all log entries.
// Context information includes correlation IDs, user IDs, request IDs, and operation names.
func (l *Logger) WithContext(ctx context.Context) *Logger {
	attrs := l.extractContextAttributes(ctx)
	if len(attrs) == 0 {
		return l // No context info, return original logger
	}

	return &Logger{
		logger: l.logger.With(attrs...),
	}
}

// WithFields returns a new Logger with additional structured fields.
// This is useful for adding operation-specific context that persists
// across multiple log statements.
func (l *Logger) WithFields(fields ...any) *Logger {
	return &Logger{
		logger: l.logger.With(fields...),
	}
}

// extractContextAttributes extracts logging attributes from context
func (l *Logger) extractContextAttributes(ctx context.Context) []any {
	var attrs []any

	if correlationID := ctx.Value(CorrelationIDKey); correlationID != nil {
		attrs = append(attrs, "correlation_id", correlationID)
	}

	if userID := ctx.Value(UserIDKey); userID != nil {
		attrs = append(attrs, "user_id", userID)
	}

	if requestID := ctx.Value(RequestIDKey); requestID != nil {
		attrs = append(attrs, "request_id", requestID)
	}

	if operation := ctx.Value(OperationKey); operation != nil {
		attrs = append(attrs, "operation", operation)
	}

	// Include trace_id so Grafana can correlate logs to Tempo traces.
	if traceID := TraceIDFromContext(ctx); traceID != "" {
		attrs = append(attrs, "trace_id", traceID)
	}

	return attrs
}

// Debug logs a debug-level message with context
func (l *Logger) Debug(ctx context.Context, msg string, args ...any) {
	l.WithContext(ctx).logger.Debug(msg, args...)
}

// Info logs an info-level message with context
func (l *Logger) Info(ctx context.Context, msg string, args ...any) {
	l.WithContext(ctx).logger.Info(msg, args...)
}

// Warn logs a warn-level message with context
func (l *Logger) Warn(ctx context.Context, msg string, args ...any) {
	l.WithContext(ctx).logger.Warn(msg, args...)
}

// Error logs an error-level message with context
func (l *Logger) Error(ctx context.Context, msg string, args ...any) {
	l.WithContext(ctx).logger.Error(msg, args...)
}

// LogOperation logs the start and completion of an operation with timing information.
// It returns a function that should be called when the operation completes.
//
// Usage:
//
//	defer logger.LogOperation(ctx, "database_query", "table", "users")()
//
// This will log both the start and completion of the operation with timing.
func (l *Logger) LogOperation(ctx context.Context, operation string, args ...any) func() {
	start := time.Now()

	// Create operation context
	opCtx := context.WithValue(ctx, OperationKey, operation)

	// Log operation start
	allArgs := append([]any{"operation", operation, "status", "started"}, args...)
	l.WithContext(opCtx).logger.Debug("Operation started", allArgs...)

	return func() {
		duration := time.Since(start)

		// Log operation completion
		completeArgs := append([]any{
			"operation", operation,
			"status", "completed",
			"duration_ms", duration.Milliseconds(),
		}, args...)

		l.WithContext(opCtx).logger.Info("Operation completed", completeArgs...)
	}
}

// LogError logs an error with additional context and error details.
// This is a specialized method for error logging that includes
// stack traces in development and structured error information.
func (l *Logger) LogError(ctx context.Context, err error, msg string, args ...any) {
	if err == nil {
		return
	}

	// Add error information to args
	errorArgs := append([]any{"error", err.Error()}, args...)

	l.Error(ctx, msg, errorArgs...)
}

// LogHTTPRequest logs HTTP request details with timing and response information.
// This should be called from HTTP middleware to provide consistent request logging.
func (l *Logger) LogHTTPRequest(ctx context.Context, method, path string, statusCode int, duration time.Duration, args ...any) {
	level := slog.LevelInfo

	// Use different log levels based on status code
	if statusCode >= 500 {
		level = slog.LevelError
	} else if statusCode >= 400 {
		level = slog.LevelWarn
	}

	httpArgs := append([]any{
		"http_method", method,
		"http_path", path,
		"http_status", statusCode,
		"duration_ms", duration.Milliseconds(),
	}, args...)

	l.WithContext(ctx).logger.Log(ctx, level, "HTTP request", httpArgs...)
}

// Underlying returns the underlying slog.Logger for compatibility
// with existing code that expects slog.Logger directly.
func (l *Logger) Underlying() *slog.Logger {
	return l.logger
}

// ReplaceHandler replaces the underlying slog handler.
// Used to bridge to the OTEL log provider after initialization.
func (l *Logger) ReplaceHandler(h slog.Handler) {
	l.logger = slog.New(h)
}

// ContextHelpers provides utility functions for working with context values

// WithCorrelationID adds a correlation ID to the context
func WithCorrelationID(ctx context.Context, correlationID string) context.Context {
	return context.WithValue(ctx, CorrelationIDKey, correlationID)
}

// WithUserID adds a user ID to the context
func WithUserID(ctx context.Context, userID interface{}) context.Context {
	return context.WithValue(ctx, UserIDKey, userID)
}

// WithRequestID adds a request ID to the context
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// WithOperation adds an operation name to the context
func WithOperation(ctx context.Context, operation string) context.Context {
	return context.WithValue(ctx, OperationKey, operation)
}

// GetCorrelationID retrieves the correlation ID from context
func GetCorrelationID(ctx context.Context) string {
	if id := ctx.Value(CorrelationIDKey); id != nil {
		if str, ok := id.(string); ok {
			return str
		}
	}
	return ""
}

// GetUserID retrieves the user ID from context
func GetUserID(ctx context.Context) interface{} {
	return ctx.Value(UserIDKey)
}

// GetRequestID retrieves the request ID from context
func GetRequestID(ctx context.Context) string {
	if id := ctx.Value(RequestIDKey); id != nil {
		if str, ok := id.(string); ok {
			return str
		}
	}
	return ""
}
