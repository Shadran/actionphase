package observability

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	promexporter "go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	semconv "go.opentelemetry.io/otel/semconv/v1.36.0"
)

// MeterConfig holds the subset of config needed to initialize metrics.
// Auth: set OTEL_EXPORTER_OTLP_METRICS_HEADERS env var — the SDK reads it automatically.
type MeterConfig struct {
	Enabled      bool
	OTELEndpoint string
	Environment  string
	ServiceName  string
}

// OTELMetrics wraps the OTEL meter with pre-created instruments for common HTTP metrics.
type OTELMetrics struct {
	meter                 metric.Meter
	requestCounter        metric.Int64Counter
	requestLatency        metric.Float64Histogram
	backgroundJobFailures metric.Int64Counter
	commentsCreated       metric.Int64Counter
	postsCreated          metric.Int64Counter
	// PrometheusHandler serves /metrics in Prometheus text format for local scraping.
	PrometheusHandler http.Handler
}

// InitMeterProvider initializes the global OpenTelemetry meter provider.
// When cfg.Enabled is false, a no-op provider is installed (zero cost).
// Returns the OTELMetrics helper and a shutdown function that must be deferred.
func InitMeterProvider(cfg MeterConfig) (om *OTELMetrics, shutdown func(), err error) {
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.DeploymentEnvironmentName(cfg.Environment),
		),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create OTEL resource for metrics: %w", err)
	}

	var readers []sdkmetric.Reader

	// Prometheus exporter: always enabled so /metrics serves Prometheus format locally.
	// Use a fresh per-call registry instead of the global default to prevent
	// duplicate-registration panics if InitMeterProvider is called more than once
	// (e.g., in tests).
	promReg := prometheus.NewRegistry()
	promExp, err := promexporter.New(promexporter.WithRegisterer(promReg))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create Prometheus exporter: %w", err)
	}
	readers = append(readers, promExp)

	// OTLP push exporter: ships metrics to Grafana Cloud Prometheus when enabled.
	if cfg.Enabled && cfg.OTELEndpoint != "" {
		otlpExp, err := otlpmetrichttp.New(context.Background(),
			otlpmetrichttp.WithEndpointURL(strings.TrimRight(cfg.OTELEndpoint, "/")+"/v1/metrics"),
		)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create OTLP metrics exporter: %w", err)
		}
		readers = append(readers, sdkmetric.NewPeriodicReader(otlpExp,
			sdkmetric.WithInterval(30*time.Second),
		))
	}

	opts := []sdkmetric.Option{sdkmetric.WithResource(res)}
	for _, r := range readers {
		opts = append(opts, sdkmetric.WithReader(r))
	}
	mp := sdkmetric.NewMeterProvider(opts...)

	meter := mp.Meter("actionphase")

	reqCounter, err := meter.Int64Counter("http.server.request.count",
		metric.WithDescription("Total number of HTTP requests"),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create request counter: %w", err)
	}

	reqLatency, err := meter.Float64Histogram("http.server.request.duration",
		metric.WithDescription("HTTP request duration in milliseconds"),
		metric.WithUnit("ms"),
		metric.WithExplicitBucketBoundaries(5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create request latency histogram: %w", err)
	}

	bgJobFailures, err := meter.Int64Counter("app.background_job.failures",
		metric.WithDescription("Number of background goroutine job failures"),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create background job failure counter: %w", err)
	}

	commentsCreated, err := meter.Int64Counter("app.comments.created",
		metric.WithDescription("Number of comments created"),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create comments counter: %w", err)
	}

	postsCreated, err := meter.Int64Counter("app.posts.created",
		metric.WithDescription("Number of posts created"),
	)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create posts counter: %w", err)
	}

	return &OTELMetrics{
			meter:                 meter,
			requestCounter:        reqCounter,
			requestLatency:        reqLatency,
			backgroundJobFailures: bgJobFailures,
			commentsCreated:       commentsCreated,
			postsCreated:          postsCreated,
			PrometheusHandler:     promhttp.HandlerFor(promReg, promhttp.HandlerOpts{}),
		}, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = mp.Shutdown(ctx)
		}, nil
}

// RecordRequest records an HTTP request metric with method, route, and status labels.
func (om *OTELMetrics) RecordRequest(ctx context.Context, method, route string, statusCode int, duration time.Duration) {
	if om.requestCounter == nil {
		return
	}

	attrs := httpMetricAttrs(method, route, statusCode)
	om.requestCounter.Add(ctx, 1, attrs)
	om.requestLatency.Record(ctx, float64(duration.Milliseconds()), attrs)
}

func httpMetricAttrs(method, route string, statusCode int) metric.MeasurementOption {
	return metric.WithAttributes(
		attribute.String("http.request.method", method),
		attribute.String("http.route", route),
		attribute.String("http.response.status_class", statusClass(statusCode)),
	)
}

// RecordBackgroundJobFailure increments the failure counter for fire-and-forget goroutines.
// jobType examples: "mention_notification", "reply_notification", "post_notification"
func (om *OTELMetrics) RecordBackgroundJobFailure(ctx context.Context, jobType string) {
	if om == nil || om.backgroundJobFailures == nil {
		return
	}
	om.backgroundJobFailures.Add(ctx, 1, metric.WithAttributes(
		attribute.String("job.type", jobType),
	))
}

// RecordCommentCreated increments the comment created counter.
func (om *OTELMetrics) RecordCommentCreated(ctx context.Context) {
	if om == nil || om.commentsCreated == nil {
		return
	}
	om.commentsCreated.Add(ctx, 1)
}

// RecordPostCreated increments the post created counter.
func (om *OTELMetrics) RecordPostCreated(ctx context.Context) {
	if om == nil || om.postsCreated == nil {
		return
	}
	om.postsCreated.Add(ctx, 1)
}

// statusClass converts a status code to a class string (2xx, 3xx, 4xx, 5xx).
// This reduces label cardinality vs recording the exact status code.
func statusClass(code int) string {
	switch {
	case code < 300:
		return "2xx"
	case code < 400:
		return "3xx"
	case code < 500:
		return "4xx"
	default:
		return "5xx"
	}
}
