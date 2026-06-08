// Package handlers — per-IP token-bucket rate limiter middleware.
//
// Provides two chi middleware constructors:
//   - RateLimitMiddleware: general-purpose rate limiter (configurable RPS + burst)
//   - StrictRateLimitMiddleware: tighter limit for auth endpoints
//
// Stale entries are reaped every 5 minutes to prevent memory leaks.
package handlers

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// bucket implements a simple token-bucket algorithm.
type bucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

func newBucket(rate float64, burst int) *bucket {
	return &bucket{
		tokens:     float64(burst),
		maxTokens:  float64(burst),
		refillRate: rate,
		lastRefill: time.Now(),
	}
}

// allow consumes one token, returning true if request is allowed.
func (b *bucket) allow() bool {
	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens += elapsed * b.refillRate
	if b.tokens > b.maxTokens {
		b.tokens = b.maxTokens
	}
	b.lastRefill = now

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// rateLimiter holds per-IP buckets with automatic cleanup.
type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64
	burst   int
}

func newRateLimiter(rate float64, burst int) *rateLimiter {
	rl := &rateLimiter{
		buckets: make(map[string]*bucket),
		rate:    rate,
		burst:   burst,
	}
	go rl.reapLoop()
	return rl
}

// allow checks whether the given IP is within the rate limit.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, ok := rl.buckets[ip]
	if !ok {
		b = newBucket(rl.rate, rl.burst)
		rl.buckets[ip] = b
	}
	return b.allow()
}

// reapLoop removes stale entries every 5 minutes.
func (rl *rateLimiter) reapLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		cutoff := time.Now().Add(-10 * time.Minute)
		for ip, b := range rl.buckets {
			if b.lastRefill.Before(cutoff) {
				delete(rl.buckets, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// clientIP extracts the remote IP, preferring X-Forwarded-For when present.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Use the first (client) IP in the chain
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// RateLimitMiddleware returns chi middleware that enforces a per-IP token-bucket
// rate limit. rate is requests per second, burst is the maximum burst size.
//
// Example: RateLimitMiddleware(10, 20) allows 10 req/s with bursts up to 20.
func RateLimitMiddleware(rate float64, burst int) func(http.Handler) http.Handler {
	rl := newRateLimiter(rate, burst)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Skip rate limiting for static assets — browsers load many
			// JS modules, CSS, images, and fonts in parallel on page load.
			if isStaticAsset(r.URL.Path) {
				next.ServeHTTP(w, r)
				return
			}
			if !rl.allow(clientIP(r)) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "1")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate limit exceeded"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// StrictRateLimitMiddleware returns a tighter rate limiter suitable for
// auth endpoints (prevents brute-force polling).
//
// Example: StrictRateLimitMiddleware(2, 5) allows 2 req/s with bursts up to 5.
func StrictRateLimitMiddleware(rate float64, burst int) func(http.Handler) http.Handler {
	return RateLimitMiddleware(rate, burst)
}

// isStaticAsset returns true for paths that serve static files (JS, CSS,
// images, fonts). These are exempt from rate limiting because browsers
// fetch many assets in parallel during page load.
func isStaticAsset(path string) bool {
	for _, ext := range []string{".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".map", ".webmanifest"} {
		if strings.HasSuffix(path, ext) {
			return true
		}
	}
	return false
}
