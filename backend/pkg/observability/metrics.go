package observability

import (
	"fmt"
	"sync"
	"time"
)

// Metrics provides basic metrics collection for HTTP requests and business operations.
// It tracks counters, histograms, and gauges that can be exported to monitoring systems.
//
// This is a simple in-memory implementation suitable for small to medium applications.
// For production systems at scale, consider integrating with Prometheus or similar systems.
type Metrics struct {
	mu sync.RWMutex

	// HTTP request metrics
	httpRequests  map[string]int64     // Total requests by method_path_status
	httpDurations map[string][]float64 // Request durations by method_path
	httpErrors    map[string]int64     // Error count by method_path

	// Business metrics
	counters   map[string]int64     // Custom counters
	gauges     map[string]float64   // Current values
	histograms map[string][]float64 // Duration measurements

	// System metrics
	startTime     time.Time
	totalRequests int64
	totalErrors   int64
}

// NewMetrics creates a new metrics collector
func NewMetrics() *Metrics {
	return &Metrics{
		httpRequests:  make(map[string]int64),
		httpDurations: make(map[string][]float64),
		httpErrors:    make(map[string]int64),
		counters:      make(map[string]int64),
		gauges:        make(map[string]float64),
		histograms:    make(map[string][]float64),
		startTime:     time.Now(),
	}
}

// RecordHTTPRequest records metrics for an HTTP request
func (m *Metrics) RecordHTTPRequest(method, path string, statusCode int, duration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Create metric keys
	routeKey := fmt.Sprintf("%s_%s", method, normalizeRoute(path))
	requestKey := fmt.Sprintf("%s_%d", routeKey, statusCode)

	// Increment request counter
	m.httpRequests[requestKey]++
	m.totalRequests++

	// Record duration
	durationMs := float64(duration.Nanoseconds()) / 1e6
	m.httpDurations[routeKey] = append(m.httpDurations[routeKey], durationMs)

	// Track errors (4xx and 5xx)
	if statusCode >= 400 {
		m.httpErrors[routeKey]++
		m.totalErrors++
	}

	// Keep duration history bounded (last 1000 requests)
	if len(m.httpDurations[routeKey]) > 1000 {
		m.httpDurations[routeKey] = m.httpDurations[routeKey][100:]
	}
}

// IncrementCounter increments a named counter
func (m *Metrics) IncrementCounter(name string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.counters[name]++
}

// GetMetrics returns a snapshot of current metrics for reporting
func (m *Metrics) GetMetrics() MetricsSnapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return MetricsSnapshot{
		Timestamp:     time.Now(),
		Uptime:        time.Since(m.startTime),
		TotalRequests: m.totalRequests,
		TotalErrors:   m.totalErrors,
		ErrorRate:     m.calculateErrorRate(),

		HTTPRequests:  m.copyInt64Map(m.httpRequests),
		HTTPErrors:    m.copyInt64Map(m.httpErrors),
		HTTPLatencies: m.calculateLatencies(),

		Counters:   m.copyInt64Map(m.counters),
		Gauges:     m.copyFloat64Map(m.gauges),
		Histograms: m.calculateHistogramStats(),
	}
}

// MetricsSnapshot represents a point-in-time view of metrics
type MetricsSnapshot struct {
	Timestamp     time.Time     `json:"timestamp"`
	Uptime        time.Duration `json:"uptime"`
	TotalRequests int64         `json:"total_requests"`
	TotalErrors   int64         `json:"total_errors"`
	ErrorRate     float64       `json:"error_rate"`

	HTTPRequests  map[string]int64        `json:"http_requests"`
	HTTPErrors    map[string]int64        `json:"http_errors"`
	HTTPLatencies map[string]LatencyStats `json:"http_latencies"`

	Counters   map[string]int64        `json:"counters"`
	Gauges     map[string]float64      `json:"gauges"`
	Histograms map[string]LatencyStats `json:"histograms"`
}

// LatencyStats provides percentile and statistical information for durations
type LatencyStats struct {
	Count int     `json:"count"`
	Min   float64 `json:"min_ms"`
	Max   float64 `json:"max_ms"`
	Avg   float64 `json:"avg_ms"`
	P50   float64 `json:"p50_ms"`
	P95   float64 `json:"p95_ms"`
	P99   float64 `json:"p99_ms"`
}

// Helper functions

func (m *Metrics) calculateErrorRate() float64 {
	if m.totalRequests == 0 {
		return 0.0
	}
	return float64(m.totalErrors) / float64(m.totalRequests) * 100.0
}

func (m *Metrics) calculateLatencies() map[string]LatencyStats {
	latencies := make(map[string]LatencyStats)

	for route, durations := range m.httpDurations {
		if len(durations) > 0 {
			latencies[route] = calculateLatencyStats(durations)
		}
	}

	return latencies
}

func (m *Metrics) calculateHistogramStats() map[string]LatencyStats {
	histStats := make(map[string]LatencyStats)

	for name, durations := range m.histograms {
		if len(durations) > 0 {
			histStats[name] = calculateLatencyStats(durations)
		}
	}

	return histStats
}

func calculateLatencyStats(durations []float64) LatencyStats {
	if len(durations) == 0 {
		return LatencyStats{}
	}

	// Sort for percentile calculations
	sorted := make([]float64, len(durations))
	copy(sorted, durations)

	// Simple bubble sort (fine for our bounded arrays)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	// Calculate statistics
	count := len(sorted)
	min := sorted[0]
	max := sorted[count-1]

	// Calculate average
	var sum float64
	for _, d := range sorted {
		sum += d
	}
	avg := sum / float64(count)

	// Calculate percentiles
	p50 := sorted[count*50/100]
	p95 := sorted[count*95/100]
	p99 := sorted[count*99/100]

	return LatencyStats{
		Count: count,
		Min:   min,
		Max:   max,
		Avg:   avg,
		P50:   p50,
		P95:   p95,
		P99:   p99,
	}
}

func (m *Metrics) copyInt64Map(source map[string]int64) map[string]int64 {
	dest := make(map[string]int64, len(source))
	for k, v := range source {
		dest[k] = v
	}
	return dest
}

func (m *Metrics) copyFloat64Map(source map[string]float64) map[string]float64 {
	dest := make(map[string]float64, len(source))
	for k, v := range source {
		dest[k] = v
	}
	return dest
}

// normalizeRoute removes dynamic segments from route paths for metrics grouping
func normalizeRoute(path string) string {
	// This is a simple implementation - could be enhanced with regex
	// to handle more complex route patterns

	// Replace common dynamic segments
	normalized := path

	// Replace numeric IDs
	for i := 0; i < len(normalized); i++ {
		if i+1 < len(normalized) && normalized[i] == '/' {
			start := i + 1
			end := start

			// Find end of segment
			for end < len(normalized) && normalized[end] != '/' {
				end++
			}

			// Check if segment is numeric
			segment := normalized[start:end]
			if isNumeric(segment) {
				normalized = normalized[:start] + "{id}" + normalized[end:]
				break
			}
		}
	}

	// Limit path length for metric labels
	if len(normalized) > 50 {
		normalized = normalized[:47] + "..."
	}

	return normalized
}

func isNumeric(s string) bool {
	if len(s) == 0 {
		return false
	}

	for _, char := range s {
		if char < '0' || char > '9' {
			return false
		}
	}

	return true
}
