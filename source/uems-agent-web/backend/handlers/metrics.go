// Package handlers — Prometheus-compatible metrics endpoint.
//
// Exposes /metrics in text exposition format without external dependencies.
// Tracks: http_requests_total, http_request_duration_seconds, tool_invocations_total.
package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// ── Counters & histograms ────────────────────────────────────────

type requestMetric struct {
	count   atomic.Int64
	totalMs atomic.Int64 // cumulative duration in milliseconds
}

var (
	httpMetrics sync.Map // key: "METHOD /path STATUS" → *requestMetric
	toolMetrics sync.Map // key: tool name → *requestMetric
	startTime   = time.Now()
)

func getOrCreateHTTPMetric(key string) *requestMetric {
	val, _ := httpMetrics.LoadOrStore(key, &requestMetric{})
	return val.(*requestMetric)
}

func getOrCreateToolMetric(name string) *requestMetric {
	val, _ := toolMetrics.LoadOrStore(name, &requestMetric{})
	return val.(*requestMetric)
}

// RecordHTTPRequest records a completed HTTP request for metrics.
func RecordHTTPRequest(method, path string, status int, duration time.Duration) {
	// Normalize path to avoid cardinality explosion
	normalized := normalizePath(path)
	key := fmt.Sprintf("%s %s %d", method, normalized, status)
	m := getOrCreateHTTPMetric(key)
	m.count.Add(1)
	m.totalMs.Add(duration.Milliseconds())
}

// RecordToolInvocation records a tool invocation for metrics.
func RecordToolInvocation(name string, duration time.Duration) {
	m := getOrCreateToolMetric(name)
	m.count.Add(1)
	m.totalMs.Add(duration.Milliseconds())
}

func normalizePath(path string) string {
	// Collapse dynamic segments
	if strings.HasPrefix(path, "/copilot/") {
		return "/copilot/*"
	}
	if strings.HasPrefix(path, "/chat/") {
		return "/chat/*"
	}
	return path
}

// ── Metrics middleware ───────────────────────────────────────────

// MetricsMiddleware records request count and duration for all HTTP requests.
func MetricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(wrapped, r)
		RecordHTTPRequest(r.Method, r.URL.Path, wrapped.status, time.Since(start))
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// Flush implements http.Flusher so SSE streams through reverse proxy work.
func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// ── /metrics handler ─────────────────────────────────────────────

// HandleMetrics serves Prometheus text exposition format.
func HandleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	var b strings.Builder

	// Uptime
	b.WriteString("# HELP uems_uptime_seconds Server uptime in seconds.\n")
	b.WriteString("# TYPE uems_uptime_seconds gauge\n")
	fmt.Fprintf(&b, "uems_uptime_seconds %d\n\n", int(time.Since(startTime).Seconds()))

	// HTTP request counters
	b.WriteString("# HELP uems_http_requests_total Total HTTP requests by method, path, and status.\n")
	b.WriteString("# TYPE uems_http_requests_total counter\n")

	var httpKeys []string
	httpMetrics.Range(func(k, _ any) bool {
		httpKeys = append(httpKeys, k.(string))
		return true
	})
	sort.Strings(httpKeys)

	for _, key := range httpKeys {
		val, _ := httpMetrics.Load(key)
		m := val.(*requestMetric)
		parts := strings.SplitN(key, " ", 3)
		if len(parts) != 3 {
			continue
		}
		fmt.Fprintf(&b, "uems_http_requests_total{method=%q,path=%q,status=%q} %d\n",
			parts[0], parts[1], parts[2], m.count.Load())
	}

	// HTTP request duration
	b.WriteString("\n# HELP uems_http_request_duration_ms_total Cumulative HTTP request duration in milliseconds.\n")
	b.WriteString("# TYPE uems_http_request_duration_ms_total counter\n")
	for _, key := range httpKeys {
		val, _ := httpMetrics.Load(key)
		m := val.(*requestMetric)
		parts := strings.SplitN(key, " ", 3)
		if len(parts) != 3 {
			continue
		}
		fmt.Fprintf(&b, "uems_http_request_duration_ms_total{method=%q,path=%q,status=%q} %d\n",
			parts[0], parts[1], parts[2], m.totalMs.Load())
	}

	// Tool invocation counters
	b.WriteString("\n# HELP uems_tool_invocations_total Total tool invocations by tool name.\n")
	b.WriteString("# TYPE uems_tool_invocations_total counter\n")

	var toolKeys []string
	toolMetrics.Range(func(k, _ any) bool {
		toolKeys = append(toolKeys, k.(string))
		return true
	})
	sort.Strings(toolKeys)

	for _, key := range toolKeys {
		val, _ := toolMetrics.Load(key)
		m := val.(*requestMetric)
		fmt.Fprintf(&b, "uems_tool_invocations_total{tool=%q} %d\n", key, m.count.Load())
	}

	// Tool duration
	b.WriteString("\n# HELP uems_tool_duration_ms_total Cumulative tool invocation duration in milliseconds.\n")
	b.WriteString("# TYPE uems_tool_duration_ms_total counter\n")
	for _, key := range toolKeys {
		val, _ := toolMetrics.Load(key)
		m := val.(*requestMetric)
		fmt.Fprintf(&b, "uems_tool_duration_ms_total{tool=%q} %d\n", key, m.totalMs.Load())
	}

	w.Write([]byte(b.String()))
}
