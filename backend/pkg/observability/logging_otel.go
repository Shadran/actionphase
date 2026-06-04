package observability

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	otelslog "go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.36.0"
)

// LogConfig holds the subset of config needed to initialize log shipping.
// Auth: set OTEL_EXPORTER_OTLP_LOGS_HEADERS env var — the SDK reads it automatically.
type LogConfig struct {
	Enabled      bool
	OTELEndpoint string
	Environment  string
	ServiceName  string
}

// InitLogProvider initializes OpenTelemetry log shipping and wires it into obsLogger.
// When cfg.Enabled is false this is a no-op.
// When enabled, it fans slog records out to both the existing console handler and
// an OTLP exporter that ships logs to Grafana Cloud Loki.
//
// Returns a shutdown function that must be deferred by the caller.
func InitLogProvider(cfg LogConfig, obsLogger *Logger) (shutdown func(), err error) {
	if !cfg.Enabled {
		return func() {}, nil
	}

	if cfg.OTELEndpoint == "" {
		return nil, fmt.Errorf("OTEL_ENABLED=true but OTEL_EXPORTER_OTLP_ENDPOINT is not set for log shipping")
	}

	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.DeploymentEnvironmentName(cfg.Environment),
		),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTEL resource for logs: %w", err)
	}

	exporter, err := otlploghttp.New(context.Background(),
		otlploghttp.WithEndpointURL(cfg.OTELEndpoint),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP log exporter: %w", err)
	}

	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(exporter)),
		sdklog.WithResource(res),
	)

	// otelslog.NewHandler bridges slog to the OTEL log provider.
	// Fan out to both the existing handler (console/file) and the OTEL handler.
	otelHandler := otelslog.NewHandler(cfg.ServiceName, otelslog.WithLoggerProvider(lp))
	fanOut := &fanOutHandler{
		handlers: []slog.Handler{obsLogger.Underlying().Handler(), otelHandler},
	}
	obsLogger.ReplaceHandler(fanOut)

	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = lp.Shutdown(ctx)
	}, nil
}

// fanOutHandler fans slog records out to multiple handlers.
type fanOutHandler struct {
	handlers []slog.Handler
}

func (f *fanOutHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range f.handlers {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (f *fanOutHandler) Handle(ctx context.Context, r slog.Record) error {
	var lastErr error
	for _, h := range f.handlers {
		if h.Enabled(ctx, r.Level) {
			if err := h.Handle(ctx, r); err != nil {
				lastErr = err
			}
		}
	}
	return lastErr
}

func (f *fanOutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(f.handlers))
	for i, h := range f.handlers {
		handlers[i] = h.WithAttrs(attrs)
	}
	return &fanOutHandler{handlers: handlers}
}

func (f *fanOutHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(f.handlers))
	for i, h := range f.handlers {
		handlers[i] = h.WithGroup(name)
	}
	return &fanOutHandler{handlers: handlers}
}
