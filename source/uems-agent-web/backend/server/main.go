// UEMS Agent — unified MCP server for tools.
//
// Modes:
//
//	--mode stdio   — MCP over stdin/stdout (for VS Code extension)
//	--mode standalone — Standalone web server: Copilot API direct + local tools (default)
//	--mode bridge    — HTTP server that proxies chat/tools to VS Code HTTP bridge
package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/json"
	"encoding/pem"
	"flag"
	"fmt"
	"io"
	"log"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"uems-agent-web/handlers"
	"uems-agent-web/tools"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type ServerConfig struct {
	Mode          string // "stdio", "standalone", or "bridge"
	Host          string
	Port          int
	RepoDir       string // where native repos are cloned
	GuidelinesDir string // guidelines/ directory
	SkillsDir     string // skills/ directory
	PromptsDir    string // agent .md prompts
	RepoDataPath  string // repos.json
	PublicDir     string // frontend static files
	BridgeURL     string // VS Code HTTP bridge URL (for bridge mode)
	TLSCert       string // path to TLS certificate file
	TLSKey        string // path to TLS private key file
	TLSSelfSigned bool   // generate a self-signed cert on startup

	// Tunable limits
	SearchMaxResults  int // max ripgrep matches per search (default: 200)
	ToolOutputLimit   int // max chars in tool output returned to client (default: 8000)
	ToolTimeout       int // tool invocation timeout in seconds (default: 120)
	ContextTokenLimit int // client-side context compaction threshold (default: 120000)

	// Rate limiting
	RateLimitRPS       float64 // global requests per second per IP
	RateLimitBurst     int     // global burst size
	AuthRateLimitRPS   float64 // auth endpoint requests per second per IP
	AuthRateLimitBurst int     // auth endpoint burst size

	// Graceful shutdown
	ShutdownTimeout int // seconds to wait for in-flight requests

	// GitHub / Copilot identifiers (passed to handlers)
	GitHubClientID       string
	CopilotAPIBaseURL    string
	CopilotEditorVersion string
	CopilotPluginVersion string
	GitHubAPIVersion     string
	CopilotTokenMaxAge   int // cookie max-age in seconds
	GitHubTokenMaxAge    int // cookie max-age in seconds

	// LLM provider
	LLMProvider     string // "copilot" or "ollama"
	ReasoningEffort string // "low", "medium", "high" — empty means model default

	// Zoho OAuth (home-page access control)
	ZohoClientID      string
	ZohoClientSecret  string
	ZohoAllowedDomain string // only emails @this-domain are permitted
	ZohoAccountsURL   string // e.g. https://accounts.zoho.com or https://accounts.zoho.in

	// Frontend-facing model configuration (served via /api/config)
	ChatModel             string
	SuggestModel          string
	FrontendEditorVersion string
	FrontendPluginVersion string

	// Logging
	LogFile string // path to log file (writes to both stdout and file)
}

// Build-time version info, injected via ldflags.
var (
	version   = "dev"
	buildTime = "unknown"
	commitSHA = "unknown"
)

func main() {
	// Parse --log-file early so we can set up the logger before anything else
	var logFile string
	flag.StringVar(&logFile, "log-file", envOr("UEMS_LOG_FILE", ""), "path to log file (logs to both stdout and file)")

	// Structured JSON logger for production; replaces log.Printf calls
	logWriter := io.Writer(os.Stdout)
	var logFileHandle *os.File
	// We'll finalize the writer after flag.Parse, but set up a default now
	logger := slog.New(slog.NewJSONHandler(logWriter, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := ServerConfig{}
	flag.StringVar(&cfg.Mode, "mode", envOr("UEMS_MODE", "standalone"), "server mode: stdio, standalone, or bridge")
	flag.StringVar(&cfg.Host, "host", envOr("UEMS_HOST", ""), "host to listen on (empty = all interfaces, IPv4+IPv6)")
	flag.IntVar(&cfg.Port, "port", envOrInt("UEMS_PORT", 443), "port to listen on")
	flag.StringVar(&cfg.RepoDir, "repos", envOr("UEMS_REPO_DIR", "data/repos"), "path to cloned native repos")
	flag.StringVar(&cfg.GuidelinesDir, "guidelines", envOr("UEMS_GUIDELINES_DIR", "../../guidelines"), "path to guidelines directory")
	flag.StringVar(&cfg.SkillsDir, "skills", envOr("UEMS_SKILLS_DIR", "../../skills"), "path to skills directory")
	flag.StringVar(&cfg.PromptsDir, "prompts", envOr("UEMS_PROMPTS_DIR", "../../agents/orchestrator/agents"), "path to agent .md prompts")
	flag.StringVar(&cfg.RepoDataPath, "repo-data", envOr("UEMS_REPO_DATA", "../common/repos.json"), "path to repos.json")
	flag.StringVar(&cfg.PublicDir, "public", envOr("UEMS_PUBLIC_DIR", "../frontend"), "path to frontend static files")
	flag.StringVar(&cfg.BridgeURL, "bridge-url", envOr("UEMS_BRIDGE_URL", ""), "VS Code HTTP bridge URL (for bridge mode)")
	flag.StringVar(&cfg.TLSCert, "tls-cert", envOr("UEMS_TLS_CERT", ""), "path to TLS certificate file")
	flag.StringVar(&cfg.TLSKey, "tls-key", envOr("UEMS_TLS_KEY", ""), "path to TLS private key file")
	flag.BoolVar(&cfg.TLSSelfSigned, "tls-self-signed", envOr("UEMS_TLS_SELF_SIGNED", "") == "true", "generate a self-signed TLS certificate")
	flag.IntVar(&cfg.SearchMaxResults, "search-max-results", envOrInt("UEMS_SEARCH_MAX_RESULTS", 200), "max ripgrep search results")
	flag.IntVar(&cfg.ToolOutputLimit, "tool-output-limit", envOrInt("UEMS_TOOL_OUTPUT_LIMIT", 8000), "max chars in tool output")
	flag.IntVar(&cfg.ToolTimeout, "tool-timeout", envOrInt("UEMS_TOOL_TIMEOUT", 120), "tool invocation timeout in seconds")
	flag.IntVar(&cfg.ContextTokenLimit, "context-token-limit", envOrInt("UEMS_CONTEXT_TOKEN_LIMIT", 120000), "client-side context compaction threshold")

	// Parse flags before setting up log file (logFile needs the parsed value)
	flag.Parse()

	// Finalize log file after flags are parsed
	cfg.LogFile = logFile
	if cfg.LogFile != "" {
		var err error
		logFileHandle, err = os.OpenFile(cfg.LogFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
		if err != nil {
			slog.Error("failed to open log file", "path", cfg.LogFile, "error", err)
			os.Exit(1)
		}
		defer logFileHandle.Close()
		logWriter = io.MultiWriter(os.Stdout, logFileHandle)
		logger = slog.New(slog.NewJSONHandler(logWriter, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		}))
		slog.SetDefault(logger)
		log.SetOutput(logWriter)
		// Redirect stderr to log file so panics and runtime errors are captured
		redirectStderr(logFileHandle)
		slog.Info("logging to file", "path", cfg.LogFile)
	}

	// Rate limiting
	cfg.RateLimitRPS = envOrFloat("UEMS_RATE_LIMIT_RPS", 10)
	cfg.RateLimitBurst = envOrInt("UEMS_RATE_LIMIT_BURST", 30)
	cfg.AuthRateLimitRPS = envOrFloat("UEMS_AUTH_RATE_LIMIT_RPS", 2)
	cfg.AuthRateLimitBurst = envOrInt("UEMS_AUTH_RATE_LIMIT_BURST", 5)

	// Graceful shutdown
	cfg.ShutdownTimeout = envOrInt("UEMS_SHUTDOWN_TIMEOUT", 15)

	// GitHub / Copilot
	cfg.GitHubClientID = envOr("UEMS_GITHUB_CLIENT_ID", "Iv1.b507a08c87ecfe98")
	cfg.CopilotAPIBaseURL = envOr("UEMS_COPILOT_API_BASE_URL", "https://api.business.githubcopilot.com")
	cfg.CopilotEditorVersion = envOr("UEMS_COPILOT_EDITOR_VERSION", "vscode/1.155.0")
	cfg.CopilotPluginVersion = envOr("UEMS_COPILOT_PLUGIN_VERSION", "1.155.0")
	cfg.GitHubAPIVersion = envOr("UEMS_GITHUB_API_VERSION", "2025-04-01")
	cfg.CopilotTokenMaxAge = envOrInt("UEMS_COPILOT_TOKEN_MAX_AGE", 3600)
	cfg.GitHubTokenMaxAge = envOrInt("UEMS_GITHUB_TOKEN_MAX_AGE", 86400)

	// LLM provider
	cfg.LLMProvider = envOr("UEMS_LLM_PROVIDER", "copilot")
	cfg.ReasoningEffort = envOr("UEMS_REASONING_EFFORT", "")

	// Zoho OAuth (home-page access control)
	cfg.ZohoClientID = envOr("ZOHO_CLIENT_ID", "")
	cfg.ZohoClientSecret = envOr("ZOHO_CLIENT_SECRET", "")
	cfg.ZohoAllowedDomain = envOr("ZOHO_ALLOWED_DOMAIN", "")
	cfg.ZohoAccountsURL = envOr("ZOHO_ACCOUNTS_URL", "")

	// Frontend model config — defaults depend on provider
	if cfg.LLMProvider == "ollama" {
		cfg.ChatModel = envOr("UEMS_CHAT_MODEL", "qwen3")
		cfg.SuggestModel = envOr("UEMS_SUGGEST_MODEL", "qwen3")
		if cfg.CopilotAPIBaseURL == "https://api.business.githubcopilot.com" {
			cfg.CopilotAPIBaseURL = envOr("UEMS_OLLAMA_URL", "http://localhost:11434")
		}
	} else {
		cfg.ChatModel = envOr("UEMS_CHAT_MODEL", "claude-sonnet-4.6")
		cfg.SuggestModel = envOr("UEMS_SUGGEST_MODEL", "gpt-4.1")
	}
	cfg.FrontendEditorVersion = envOr("UEMS_FRONTEND_EDITOR_VERSION", "vscode/1.96.0")
	cfg.FrontendPluginVersion = envOr("UEMS_FRONTEND_PLUGIN_VERSION", "copilot-chat/0.23.2")

	// Verify repos.json exists
	if _, err := os.Stat(cfg.RepoDataPath); err != nil {
		slog.Error("repos.json not found", "path", cfg.RepoDataPath, "error", err)
		os.Exit(1)
	}

	// Validate critical paths at startup (bridge only needs repos.json + bridge URL)
	if cfg.Mode != "bridge" {
		if problems := validateConfig(cfg); len(problems) > 0 {
			for _, p := range problems {
				slog.Warn("config validation", "issue", p)
			}
		}
	}

	// TLS is always enforced: if no cert/key provided, auto-generate a self-signed cert.
	if cfg.TLSCert == "" && !cfg.TLSSelfSigned {
		slog.Info("no TLS cert configured, auto-generating self-signed certificate")
		cfg.TLSSelfSigned = true
	}
	handlers.SetSecureCookies(true)

	// ── bridge mode ────────────────────────────────────────────────
	if cfg.Mode == "bridge" {
		if cfg.BridgeURL == "" {
			slog.Error("bridge mode requires --bridge-url (e.g. http://127.0.0.1:3111)")
			os.Exit(1)
		}
		bridgeTarget, err := url.Parse(cfg.BridgeURL)
		if err != nil {
			slog.Error("invalid bridge URL", "url", cfg.BridgeURL, "error", err)
			os.Exit(1)
		}
		runBridgeMode(cfg, bridgeTarget)
		return
	}

	// ── standalone mode (default): fully standalone ─────────────────
	if cfg.Mode == "standalone" || cfg.Mode == "hybrid" || cfg.Mode == "http" {
		// Load system prompt + pre-load skills + register local MCP tools
		promptPath := filepath.Join(cfg.PromptsDir, "uems-agent-testcase-generator.agent.md")
		if _, err := os.Stat(promptPath); err != nil {
			slog.Warn("testcase-generator prompt not found — Copilot proxy will work without system prompt", "path", promptPath)
		} else {
			fi, _ := os.Stat(promptPath)
			slog.Info("system prompt loaded", "path", promptPath, "bytes", fi.Size())
		}
		handlers.SetSystemPromptPath(promptPath)
		handlers.SetPromptsDir(cfg.PromptsDir)
		handlers.SetSkillsDir(cfg.SkillsDir)
		handlers.SetGuidelinesDir(cfg.GuidelinesDir)

		mcpServer := mcp.NewServer(&mcp.Implementation{
			Name:    "uems-agent-web",
			Version: "0.1.0",
		}, nil)
		if err := tools.RegisterAll(mcpServer, cfg.RepoDir, cfg.GuidelinesDir, cfg.SkillsDir, cfg.RepoDataPath); err != nil {
			slog.Warn("failed to register native agent tools", "error", err)
		}
		handlers.SetMCPServer(mcpServer)
		handlers.SetToolTimeout(time.Duration(cfg.ToolTimeout) * time.Second)
		handlers.SetToolOutputLimit(cfg.ToolOutputLimit)
		handlers.SetGitHubClientID(cfg.GitHubClientID)
		handlers.SetCopilotAPIBaseURL(cfg.CopilotAPIBaseURL)
		handlers.SetCopilotEditorVersion(cfg.CopilotEditorVersion)
		handlers.SetCopilotPluginVersion(cfg.CopilotPluginVersion)
		handlers.SetGitHubAPIVersion(cfg.GitHubAPIVersion)
		handlers.SetCookieMaxAge(cfg.CopilotTokenMaxAge, cfg.GitHubTokenMaxAge)
		handlers.SetLLMProvider(cfg.LLMProvider)
		handlers.SetReasoningEffort(cfg.ReasoningEffort)
		handlers.SetZohoConfig(cfg.ZohoClientID, cfg.ZohoClientSecret, cfg.ZohoAllowedDomain, cfg.ZohoAccountsURL)

		runStandaloneMode(cfg, mcpServer)
		return
	}

	// ── stdio mode: VS Code connects via stdin/stdout ────────────
	// Create MCP server for stdio
	mcpServer := mcp.NewServer(&mcp.Implementation{
		Name:    "uems-agent-web",
		Version: "0.1.0",
	}, nil)

	// Register native agent tools
	if err := tools.RegisterAll(mcpServer, cfg.RepoDir, cfg.GuidelinesDir, cfg.SkillsDir, cfg.RepoDataPath); err != nil {
		slog.Warn("failed to register native agent tools", "error", err)
	}

	if cfg.Mode == "stdio" {
		// Redirect structured logs to stderr (or stderr+file) to keep stdout clean for MCP
		stderrWriter := io.Writer(os.Stderr)
		if logFileHandle != nil {
			stderrWriter = io.MultiWriter(os.Stderr, logFileHandle)
		}
		slog.SetDefault(slog.New(slog.NewJSONHandler(stderrWriter, nil)))
		log.SetOutput(stderrWriter)
		slog.Info("running in stdio mode")
		if err := mcpServer.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
			slog.Error("stdio server failed", "error", err)
			os.Exit(1)
		}
		return
	}

	slog.Error("unknown mode", "mode", cfg.Mode)
	fmt.Fprintf(os.Stderr, "unknown mode %q; valid modes: stdio, standalone, bridge\n", cfg.Mode)
	os.Exit(1)
}

// hstsMiddleware adds HTTP Strict Transport Security headers to all responses.
func hstsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization, Mcp-Protocol-Version, Mcp-Session-Id")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// stripUpstreamCORS removes CORS headers from proxied responses so that
// the Go corsMiddleware is the single source of truth. Without this,
// duplicate Access-Control-Allow-Origin values (one from middleware, one
// from the upstream) cause browsers to reject the response.
func stripUpstreamCORS(resp *http.Response) error {
	resp.Header.Del("Access-Control-Allow-Origin")
	resp.Header.Del("Access-Control-Allow-Methods")
	resp.Header.Del("Access-Control-Allow-Headers")
	resp.Header.Del("Access-Control-Allow-Credentials")
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envOrInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := fmt.Sscanf(v, "%d", new(int)); n == 1 && err == nil {
			var val int
			fmt.Sscanf(v, "%d", &val)
			return val
		}
	}
	return fallback
}

func envOrFloat(key string, fallback float64) float64 {
	if v := os.Getenv(key); v != "" {
		var val float64
		if n, err := fmt.Sscanf(v, "%f", &val); n == 1 && err == nil {
			return val
		}
	}
	return fallback
}

func handleVersion(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"version":%q,"commit":%q,"buildTime":%q}`, version, commitSHA, buildTime)
}

// supportedModel describes one model option for the frontend selector.
type supportedModel struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Provider    string `json:"provider"`
	Description string `json:"description"`
	IsBest      bool   `json:"isBest"`
}

// copilotModels is the curated allowlist of Copilot-hosted models known to
// work with /chat/completions + tool calling. This is the single source of
// truth — the frontend no longer maintains its own copy.
var copilotModels = []supportedModel{
	{ID: "claude-sonnet-4.6", Name: "Claude Sonnet 4.6", Provider: "Anthropic", Description: "Best for complex reasoning and code generation"},
	{ID: "claude-opus-4.6", Name: "Claude Opus 4.6", Provider: "Anthropic", Description: "Most capable model for difficult tasks"},
	{ID: "claude-opus-4", Name: "Claude Opus 4", Provider: "Anthropic", Description: "Most powerful Claude model"},
	{ID: "claude-sonnet-4", Name: "Claude Sonnet 4", Provider: "Anthropic", Description: "Balanced speed and intelligence"},
	{ID: "claude-haiku-3.5", Name: "Claude Haiku 3.5", Provider: "Anthropic", Description: "Fastest and most compact Claude"},
	{ID: "gpt-5", Name: "GPT-5", Provider: "OpenAI", Description: "Most capable GPT model"},
	{ID: "gpt-5-mini", Name: "GPT-5 Mini", Provider: "OpenAI", Description: "Compact GPT-5 variant"},
	{ID: "gpt-4.1", Name: "GPT-4.1", Provider: "OpenAI", Description: "Strong general-purpose model"},
	{ID: "gpt-4.1-mini", Name: "GPT-4.1 Mini", Provider: "OpenAI", Description: "Fast and cost-efficient"},
	{ID: "gpt-4o", Name: "GPT-4o", Provider: "OpenAI", Description: "Multimodal flagship model"},
	{ID: "o4-mini", Name: "o4-mini", Provider: "OpenAI", Description: "Fast reasoning model"},
	{ID: "o3-mini", Name: "o3-mini", Provider: "OpenAI", Description: "Compact reasoning model"},
	{ID: "gemini-2.5-pro", Name: "Gemini 2.5 Pro", Provider: "Google", Description: "Advanced multimodal reasoning"},
}

// copilotModelAliases maps alternate Copilot API IDs to our canonical keys.
var copilotModelAliases = map[string]string{
	"claude-3.5-haiku": "claude-haiku-3.5",
	"claude-3-5-haiku": "claude-haiku-3.5",
	"claude-haiku":     "claude-haiku-3.5",
	"claude-opus":      "claude-opus-4",
	"claude-4-opus":    "claude-opus-4",
	"claude-sonnet":    "claude-sonnet-4",
	"claude-4-sonnet":  "claude-sonnet-4",
	"gpt5":             "gpt-5",
	"gpt5-mini":        "gpt-5-mini",
}

// ollamaModels is the curated list of locally-hosted Ollama models.
var ollamaModels = []supportedModel{
	{ID: "qwen3", Name: "Qwen 3", Provider: "Alibaba", Description: "Efficient local model with thinking support"},
	{ID: "llama3.1", Name: "Llama 3.1", Provider: "Meta", Description: "Strong open-source model"},
	{ID: "codellama", Name: "Code Llama", Provider: "Meta", Description: "Optimized for code tasks"},
	{ID: "deepseek-coder-v2", Name: "DeepSeek Coder V2", Provider: "DeepSeek", Description: "Code-focused model"},
}

// handleModels returns the list of supported models with the server default marked as "best".
// For Copilot mode, it fetches the live model list from the Copilot API, filters against
// the curated allowlist, and returns only models known to work with chat completions + tools.
// If the API is unreachable (or user not logged in), it falls back to the full static list.
func handleModels(cfg ServerConfig) http.HandlerFunc {
	// Build a lookup from the allowlist for fast intersection.
	allowlistIndex := make(map[string]supportedModel, len(copilotModels))
	for _, m := range copilotModels {
		allowlistIndex[m.ID] = m
	}

	return func(w http.ResponseWriter, r *http.Request) {
		var models []supportedModel

		if cfg.LLMProvider == "ollama" {
			models = make([]supportedModel, len(ollamaModels))
			copy(models, ollamaModels)
		} else {
			// Try live Copilot API fetch — intersect with allowlist
			if liveIDs, err := handlers.FetchCopilotModels(w, r); err == nil && len(liveIDs) > 0 {
				seen := make(map[string]bool, len(copilotModels))
				for _, rawID := range liveIDs {
					id := strings.ToLower(rawID)
					// Strip date suffixes like -20250412
					if idx := strings.LastIndex(id, "-"); idx > 0 {
						suffix := id[idx+1:]
						if len(suffix) >= 4 && len(suffix) <= 8 {
							allDigits := true
							for _, c := range suffix {
								if c < '0' || c > '9' {
									allDigits = false
									break
								}
							}
							if allDigits {
								id = id[:idx]
							}
						}
					}
					// Resolve alias
					if canonical, ok := copilotModelAliases[id]; ok {
						id = canonical
					}
					if m, ok := allowlistIndex[id]; ok && !seen[id] {
						seen[id] = true
						models = append(models, m)
					}
				}
			}
			// Fallback: if live fetch returned nothing usable, use the full static list
			if len(models) == 0 {
				models = make([]supportedModel, len(copilotModels))
				copy(models, copilotModels)
			}
		}

		// Mark the server-configured default as "best"
		for i := range models {
			if models[i].ID == cfg.ChatModel {
				models[i].IsBest = true
			}
		}

		w.Header().Set("Content-Type", "application/json")
		resp, _ := json.Marshal(map[string]interface{}{
			"models":       models,
			"defaultModel": cfg.ChatModel,
			"provider":     cfg.LLMProvider,
		})
		w.Write(resp)
	}
}

// startServer starts the server with TLS. TLS is always enforced;
// the main() function ensures cfg.TLSSelfSigned is true if no cert/key is provided.
func startServer(srv *http.Server, cfg ServerConfig) error {
	if cfg.TLSCert != "" && cfg.TLSKey != "" {
		slog.Info("TLS enabled (provided cert)", "addr", srv.Addr)
		return srv.ListenAndServeTLS(cfg.TLSCert, cfg.TLSKey)
	}
	// Self-signed fallback (always reached if no cert/key)
	tlsCfg, err := generateSelfSignedTLS(cfg.Host)
	if err != nil {
		return fmt.Errorf("self-signed cert: %w", err)
	}
	srv.TLSConfig = tlsCfg
	slog.Info("TLS enabled (self-signed)", "addr", srv.Addr)
	return srv.ListenAndServeTLS("", "") // certs from TLSConfig
}

// gracefulServe starts the HTTP server and handles SIGINT/SIGTERM for graceful shutdown.
func gracefulServe(addr string, handler http.Handler, cfg ServerConfig) {
	srv := &http.Server{Addr: addr, Handler: handler}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	errCh := make(chan error, 1)
	go func() {
		errCh <- startServer(srv, cfg)
	}()

	select {
	case sig := <-sigCh:
		slog.Info("shutdown signal received", "signal", sig.String())
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
		return
	}

	// Give in-flight requests time to finish
	shutdownDur := time.Duration(cfg.ShutdownTimeout) * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), shutdownDur)
	defer cancel()

	slog.Info("draining connections", "timeout", shutdownDur.String())
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("shutdown error", "error", err)
		os.Exit(1)
	}
	slog.Info("server stopped gracefully")
}

// generateSelfSignedTLS creates an in-memory self-signed TLS certificate.
func generateSelfSignedTLS(host string) (*tls.Config, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, err
	}

	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return nil, err
	}

	template := x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{Organization: []string{"UEMS Agent (self-signed)"}},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{host, "localhost"},
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
	if err != nil {
		return nil, err
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certDER})
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return nil, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})

	tlsCert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		Certificates: []tls.Certificate{tlsCert},
		MinVersion:   tls.VersionTLS12,
	}, nil
}

// validateConfig checks that all configured paths exist at startup.
// Returns warnings (not fatal) so the server can still start.
func validateConfig(cfg ServerConfig) []string {
	var problems []string
	checks := []struct {
		path string
		what string
	}{
		{cfg.GuidelinesDir, "guidelines directory"},
		{cfg.SkillsDir, "skills directory"},
		{cfg.PromptsDir, "prompts directory"},
		{cfg.RepoDir, "repo directory"},
		{cfg.PublicDir, "frontend public directory"},
	}
	for _, c := range checks {
		if _, err := os.Stat(c.path); err != nil {
			problems = append(problems, c.what+" not found: "+c.path)
		}
	}
	// Check ripgrep is available
	if _, err := exec.LookPath("rg"); err != nil {
		problems = append(problems, "ripgrep (rg) not found in PATH — code search will fail")
	}
	// Check git is available
	if _, err := exec.LookPath("git"); err != nil {
		problems = append(problems, "git not found in PATH — branch/tag tools will fail")
	}
	return problems
}

// checkReadiness verifies that critical file dependencies are available.
func checkReadiness(cfg ServerConfig) []string {
	var problems []string
	if _, err := os.Stat(cfg.RepoDataPath); err != nil {
		problems = append(problems, "repos.json not found: "+cfg.RepoDataPath)
	}
	if _, err := os.Stat(cfg.GuidelinesDir); err != nil {
		problems = append(problems, "guidelines dir not found: "+cfg.GuidelinesDir)
	}
	if _, err := os.Stat(cfg.RepoDir); err != nil {
		problems = append(problems, "repo dir not found: "+cfg.RepoDir)
	}
	return problems
}

// toJSONArray converts a string slice to a JSON array string.
func toJSONArray(items []string) string {
	buf := []byte{'['}
	for i, item := range items {
		if i > 0 {
			buf = append(buf, ',')
		}
		buf = append(buf, '"')
		for _, c := range item {
			switch c {
			case '"':
				buf = append(buf, '\\', '"')
			case '\\':
				buf = append(buf, '\\', '\\')
			case '\n':
				buf = append(buf, '\\', 'n')
			default:
				buf = append(buf, byte(c))
			}
		}
		buf = append(buf, '"')
	}
	buf = append(buf, ']')
	return string(buf)
}

// handleFeedback saves user feedback to a markdown file in the workspace.
func handleFeedback(cfg ServerConfig) http.HandlerFunc {
	wsRoot := filepath.Dir(cfg.GuidelinesDir)
	feedbackPath := filepath.Join(wsRoot, "feedback.md")

	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name     string `json:"name"`
			Category string `json:"category"`
			Feedback string `json:"feedback"`
			Page     string `json:"page"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.Feedback) == "" {
			http.Error(w, `{"error":"feedback is required"}`, http.StatusBadRequest)
			return
		}

		// Sanitize inputs — strip control characters
		sanitize := func(s string, maxLen int) string {
			s = strings.TrimSpace(s)
			if len(s) > maxLen {
				s = s[:maxLen]
			}
			return strings.Map(func(r rune) rune {
				if r == '\n' || r == '\r' || r == '\t' {
					return r
				}
				if r < 32 {
					return -1
				}
				return r
			}, s)
		}

		name := sanitize(req.Name, 100)
		if name == "" {
			name = "Anonymous"
		}
		category := sanitize(req.Category, 50)
		feedback := sanitize(req.Feedback, 4000)
		page := sanitize(req.Page, 200)

		timestamp := time.Now().Format("2006-01-02 15:04:05 MST")

		entry := fmt.Sprintf("\n---\n\n**%s** | %s | %s | `%s`\n\n%s\n",
			name, category, timestamp, page, feedback)

		// Create file with header if it doesn't exist
		if _, err := os.Stat(feedbackPath); os.IsNotExist(err) {
			header := "# Feedback\n\nUser feedback collected from UEMS Agent AI Toolkit.\n"
			if err := os.WriteFile(feedbackPath, []byte(header), 0644); err != nil {
				slog.Error("failed to create feedback file", "error", err)
				http.Error(w, `{"error":"server error"}`, http.StatusInternalServerError)
				return
			}
		}

		f, err := os.OpenFile(feedbackPath, os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			slog.Error("failed to open feedback file", "error", err)
			http.Error(w, `{"error":"server error"}`, http.StatusInternalServerError)
			return
		}
		defer f.Close()

		if _, err := f.WriteString(entry); err != nil {
			slog.Error("failed to write feedback", "error", err)
			http.Error(w, `{"error":"server error"}`, http.StatusInternalServerError)
			return
		}

		slog.Info("feedback saved", "name", name, "category", category)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}

// handleDownloadAPI serves non-markdown files (e.g. .vsix) from the workspace
// as direct file downloads. Only files present in the workspace are served;
// the same path-traversal protection as handleDocsAPI applies.
//
//	GET /api/download/source/uems-agent-chat/releases/uems-agent-chat.vsix
func handleDownloadAPI(cfg ServerConfig) http.HandlerFunc {
	wsRoot := filepath.Dir(cfg.GuidelinesDir)

	// Allowed download extensions (allowlist for safety)
	allowed := map[string]string{
		".vsix": "application/octet-stream",
		".zip":  "application/zip",
		".json": "application/json",
		".gz":   "application/gzip",
		".tar":  "application/x-tar",
	}

	return func(w http.ResponseWriter, r *http.Request) {
		filePath := strings.Trim(chi.URLParam(r, "*"), "/")
		if filePath == "" {
			http.Error(w, `{"error":"missing path"}`, http.StatusBadRequest)
			return
		}

		absPath, err := filepath.Abs(filepath.Join(wsRoot, filePath))
		if err != nil {
			http.Error(w, `{"error":"invalid path"}`, http.StatusBadRequest)
			return
		}
		absRoot, _ := filepath.Abs(wsRoot)
		if !strings.HasPrefix(absPath, absRoot+string(filepath.Separator)) {
			http.Error(w, `{"error":"access denied"}`, http.StatusForbidden)
			return
		}

		ext := strings.ToLower(filepath.Ext(absPath))
		contentType, ok := allowed[ext]
		if !ok {
			http.Error(w, `{"error":"file type not allowed"}`, http.StatusForbidden)
			return
		}

		info, err := os.Stat(absPath)
		if err != nil || info.IsDir() {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Content-Disposition", `attachment; filename="`+filepath.Base(absPath)+`"`)
		w.Header().Set("Content-Length", fmt.Sprintf("%d", info.Size()))
		http.ServeFile(w, r, absPath)
	}
}

// handleDocsAPI serves markdown files and directory listings from the workspace,
// mirroring the repo structure. A single catch-all route replaces per-section logic.
//
//	GET /api/docs/README.md                       → repo root README
//	GET /api/docs/agents/orchestrator              → list or README.md
//	GET /api/docs/guidelines/common/grounding-rules.md → file content
//	GET /api/docs/skills/symbol-tracing            → list or SKILL.md
func handleDocsAPI(cfg ServerConfig) http.HandlerFunc {
	wsRoot := filepath.Dir(cfg.GuidelinesDir)

	return func(w http.ResponseWriter, r *http.Request) {
		// Extract the full path after /api/docs/
		docPath := strings.Trim(chi.URLParam(r, "*"), "/")
		if docPath == "" {
			docPath = "README.md"
		}

		w.Header().Set("Content-Type", "application/json")

		targetPath := filepath.Join(wsRoot, docPath)

		// Security: ensure resolved path stays within workspace root
		absPath, err := filepath.Abs(targetPath)
		if err != nil {
			http.Error(w, `{"error":"invalid path"}`, http.StatusBadRequest)
			return
		}
		absRoot, _ := filepath.Abs(wsRoot)
		if !strings.HasPrefix(absPath, absRoot+string(filepath.Separator)) && absPath != absRoot {
			http.Error(w, `{"error":"access denied"}`, http.StatusForbidden)
			return
		}

		// Check what we have at this path
		info, statErr := os.Stat(absPath)

		// If it's a directory, try README.md / SKILL.md first, else list contents
		if statErr == nil && info.IsDir() {
			// Try conventional index files
			for _, idx := range []string{"README.md", "SKILL.md"} {
				idxPath := filepath.Join(absPath, idx)
				if content, err := os.ReadFile(idxPath); err == nil {
					resp, _ := json.Marshal(map[string]string{
						"path":    strings.TrimPrefix(idxPath, absRoot+string(filepath.Separator)),
						"content": string(content),
					})
					w.Write(resp)
					return
				}
			}
			// No index file — list directory
			listDocsDir(w, absPath)
			return
		}

		// If exact path doesn't exist, try appending .md
		if statErr != nil && !strings.HasSuffix(absPath, ".md") {
			absPath += ".md"
		}

		content, err := os.ReadFile(absPath)
		if err != nil {
			http.Error(w, `{"error":"file not found"}`, http.StatusNotFound)
			return
		}

		resp, _ := json.Marshal(map[string]string{
			"path":    strings.TrimPrefix(absPath, absRoot+string(filepath.Separator)),
			"content": string(content),
		})
		w.Write(resp)
	}
}

// listDocsDir lists subdirectories of a docs directory as JSON.
func listDocsDir(w http.ResponseWriter, dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		http.Error(w, `{"error":"directory not found"}`, http.StatusNotFound)
		return
	}
	var items []map[string]string
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		item := map[string]string{"name": e.Name()}
		if e.IsDir() {
			item["type"] = "directory"
			// Check for README.md
			if _, err := os.Stat(filepath.Join(dir, e.Name(), "README.md")); err == nil {
				item["hasReadme"] = "true"
			}
			if _, err := os.Stat(filepath.Join(dir, e.Name(), "SKILL.md")); err == nil {
				item["hasSkill"] = "true"
			}
		} else if strings.HasSuffix(e.Name(), ".md") {
			item["type"] = "file"
		} else {
			continue // skip non-md files
		}
		items = append(items, item)
	}
	resp, _ := json.Marshal(map[string]interface{}{"items": items})
	w.Write(resp)
}

// ── Standalone mode (default) ────────────────────────────────────
// Fully standalone web server: Copilot API proxy, local MCP tools,
// GitHub Device Flow auth, static frontend. No VS Code dependency.

func runStandaloneMode(cfg ServerConfig, mcpServer *mcp.Server) {
	mcpHandler := mcp.NewStreamableHTTPHandler(func(req *http.Request) *mcp.Server {
		return mcpServer
	}, nil)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(handlers.MetricsMiddleware)
	r.Use(handlers.RateLimitMiddleware(cfg.RateLimitRPS, cfg.RateLimitBurst))
	r.Use(hstsMiddleware)
	r.Use(corsMiddleware)
	r.Use(handlers.ZohoGlobalAuthMiddleware) // Zoho login required site-wide (no-op if not configured)

	// MCP endpoint (streamable HTTP)
	r.Handle("/sse", mcpHandler)

	// Prometheus metrics
	r.Get("/metrics", handlers.HandleMetrics)

	// Auth routes (GitHub Device Flow + Zoho OAuth)
	r.Route("/auth", func(r chi.Router) {
		r.Use(handlers.StrictRateLimitMiddleware(cfg.AuthRateLimitRPS, cfg.AuthRateLimitBurst))
		r.Post("/initiate", handlers.HandleInitiateAuth)
		r.Post("/poll", handlers.HandlePollAuth)
		r.Get("/status", handlers.HandleAuthStatus)
		r.Post("/logout", handlers.HandleLogout)

		// Zoho OAuth — home-page access control
		r.Get("/zoho/login", handlers.HandleZohoLogin)
		r.Get("/zoho/callback", handlers.HandleZohoCallback)
		r.Get("/zoho/status", handlers.HandleZohoStatus)
		r.Post("/zoho/logout", handlers.HandleZohoLogout)
	})

	// Server mode indicator
	r.Get("/api/mode", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp, _ := json.Marshal(map[string]string{
			"mode":     "standalone",
			"provider": cfg.LLMProvider,
		})
		w.Write(resp)
	})

	// Version info
	r.Get("/api/version", handleVersion)

	// Tunable config (exposed to frontend)
	r.Get("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		cfgJSON, _ := json.Marshal(map[string]interface{}{
			"searchMaxResults":  cfg.SearchMaxResults,
			"toolOutputLimit":   cfg.ToolOutputLimit,
			"toolTimeout":       cfg.ToolTimeout,
			"contextTokenLimit": cfg.ContextTokenLimit,
			"chatModel":         cfg.ChatModel,
			"suggestModel":      cfg.SuggestModel,
			"editorVersion":     cfg.FrontendEditorVersion,
			"pluginVersion":     cfg.FrontendPluginVersion,
		})
		w.Write(cfgJSON)
	})

	// Supported models list (for frontend model selector)
	r.Get("/api/models", handleModels(cfg))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Readiness probe
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		problems := checkReadiness(cfg)
		w.Header().Set("Content-Type", "application/json")
		if len(problems) > 0 {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(w, `{"status":"not ready","problems":%s}`, toJSONArray(problems))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ready"}`))
	})

	// Copilot API proxy — LLM calls go directly to Copilot API
	r.Handle("/copilot/*", http.HandlerFunc(handlers.HandleCopilotProxy))

	// Tool API — local MCP tools
	r.Get("/api/tools", handlers.HandleListTools)
	r.Post("/api/tool", handlers.HandleToolInvoke)

	// API: list available repos — protected by Zoho auth
	// (registered inside the protected group below alongside /api/docs/*)

	// Feedback API
	r.Post("/api/feedback", handleFeedback(cfg))

	// Home-page docs + repos (Zoho auth enforced globally)
	r.Get("/api/docs/*", handleDocsAPI(cfg))
	r.Get("/api/download/*", handleDownloadAPI(cfg))
	r.Get("/api/repos", func(w http.ResponseWriter, r *http.Request) {
		data, err := os.ReadFile(cfg.RepoDataPath)
		if err != nil {
			http.Error(w, "Failed to read repo data", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	})

	// ── Testcase DB reverse proxy ─────────────────────────────────
	// Forwards /tc/* requests to the Node.js testcase DB server on prathosh-14802-t:3000.
	// This keeps viewer + API under the same origin as the Go HTTPS server.
	tcDBURL, _ := url.Parse("http://prathosh-14802-t:3000")
	tcProxy := httputil.NewSingleHostReverseProxy(tcDBURL)
	tcProxy.ModifyResponse = stripUpstreamCORS
	r.HandleFunc("/tc/*", func(w http.ResponseWriter, req *http.Request) {
		// Strip the /tc prefix before forwarding to the Node server
		req.URL.Path = strings.TrimPrefix(req.URL.Path, "/tc")
		if req.URL.Path == "" {
			req.URL.Path = "/"
		}
		req.URL.RawPath = ""
		req.Host = tcDBURL.Host
		tcProxy.ServeHTTP(w, req)
	})
	r.HandleFunc("/tc", func(w http.ResponseWriter, req *http.Request) {
		http.Redirect(w, req, "/tc/view", http.StatusMovedPermanently)
	})

	// Static files (frontend)
	if _, err := os.Stat(cfg.PublicDir); err == nil {
		// Explorer SPA — served from /explorer/ subdirectory
		explorerDir := filepath.Join(cfg.PublicDir, "explorer")
		if _, err := os.Stat(explorerDir); err == nil {
			explorerFS := http.StripPrefix("/explorer", http.FileServer(http.Dir(explorerDir)))
			r.Handle("/explorer/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				explorerFS.ServeHTTP(w, r)
			}))
			r.Get("/explorer", http.RedirectHandler("/explorer/", http.StatusMovedPermanently).ServeHTTP)
		}

		// Docs pages — serve the landing page (client-side routing)
		r.Get("/docs/*", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			http.ServeFile(w, r, filepath.Join(cfg.PublicDir, "index.html"))
		})

		// Landing page — root and other unmatched paths
		rootFS := http.FileServer(http.Dir(cfg.PublicDir))
		r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			rootFS.ServeHTTP(w, r)
		}))
	}

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	slog.Info("server starting",
		"mode", "standalone",
		"addr", addr,
		"repos", cfg.RepoDir,
		"guidelines", cfg.GuidelinesDir,
		"prompts", cfg.PromptsDir,
	)

	gracefulServe(addr, r, cfg)
}

// ── Bridge mode ─────────────────────────────────────────────────
// Proxies all chat, tool, and suggestion calls to a VS Code HTTP bridge.
// The Go server provides auth, static files, and health checks only.

func runBridgeMode(cfg ServerConfig, bridgeTarget *url.URL) {
	// Configure handlers with config values
	handlers.SetGitHubClientID(cfg.GitHubClientID)
	handlers.SetCopilotAPIBaseURL(cfg.CopilotAPIBaseURL)
	handlers.SetCopilotEditorVersion(cfg.CopilotEditorVersion)
	handlers.SetCopilotPluginVersion(cfg.CopilotPluginVersion)
	handlers.SetGitHubAPIVersion(cfg.GitHubAPIVersion)
	handlers.SetCookieMaxAge(cfg.CopilotTokenMaxAge, cfg.GitHubTokenMaxAge)
	handlers.SetZohoConfig(cfg.ZohoClientID, cfg.ZohoClientSecret, cfg.ZohoAllowedDomain, cfg.ZohoAccountsURL)

	proxy := httputil.NewSingleHostReverseProxy(bridgeTarget)
	// Flush SSE chunks immediately so the browser gets streaming updates.
	proxy.FlushInterval = -1 // flush every write
	// Strip upstream CORS headers — our middleware handles CORS uniformly.
	proxy.ModifyResponse = stripUpstreamCORS

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(handlers.MetricsMiddleware)
	r.Use(handlers.RateLimitMiddleware(cfg.RateLimitRPS, cfg.RateLimitBurst))
	r.Use(hstsMiddleware)
	r.Use(corsMiddleware)
	r.Use(handlers.ZohoGlobalAuthMiddleware) // Zoho login required site-wide (no-op if not configured)

	// Prometheus metrics
	r.Get("/metrics", handlers.HandleMetrics)

	// Auth routes (GitHub Device Flow + Zoho OAuth)
	r.Route("/auth", func(r chi.Router) {
		r.Use(handlers.StrictRateLimitMiddleware(cfg.AuthRateLimitRPS, cfg.AuthRateLimitBurst))
		r.Post("/initiate", handlers.HandleInitiateAuth)
		r.Post("/poll", handlers.HandlePollAuth)
		r.Get("/status", handlers.HandleAuthStatus)
		r.Post("/logout", handlers.HandleLogout)

		// Zoho OAuth — home-page access control
		r.Get("/zoho/login", handlers.HandleZohoLogin)
		r.Get("/zoho/callback", handlers.HandleZohoCallback)
		r.Get("/zoho/status", handlers.HandleZohoStatus)
		r.Post("/zoho/logout", handlers.HandleZohoLogout)
	})

	// Server mode indicator
	r.Get("/api/mode", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"mode":"bridge"}`))
	})

	// Version info
	r.Get("/api/version", handleVersion)

	// Tunable config (exposed to frontend)
	r.Get("/api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		cfgJSON, _ := json.Marshal(map[string]interface{}{
			"searchMaxResults":  cfg.SearchMaxResults,
			"toolOutputLimit":   cfg.ToolOutputLimit,
			"toolTimeout":       cfg.ToolTimeout,
			"contextTokenLimit": cfg.ContextTokenLimit,
			"chatModel":         cfg.ChatModel,
			"suggestModel":      cfg.SuggestModel,
			"editorVersion":     cfg.FrontendEditorVersion,
			"pluginVersion":     cfg.FrontendPluginVersion,
		})
		w.Write(cfgJSON)
	})

	// Supported models list (for frontend model selector)
	r.Get("/api/models", handleModels(cfg))

	// Health check: liveness probe
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Readiness probe: checks local deps + bridge reachability
	r.Get("/readyz", func(w http.ResponseWriter, r *http.Request) {
		problems := checkReadiness(cfg)
		client := &http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get(bridgeTarget.String() + "/health")
		if err != nil {
			problems = append(problems, "bridge unreachable: "+err.Error())
		} else {
			resp.Body.Close()
		}
		w.Header().Set("Content-Type", "application/json")
		if len(problems) > 0 {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(w, `{"status":"not ready","problems":%s}`, toJSONArray(problems))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ready"}`))
	})

	// Bridge mode: proxy chat + tools + suggestions to VS Code HTTP bridge
	r.Post("/chat", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
	r.Get("/api/tools", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
	r.Post("/api/tool", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
	r.Post("/api/suggest", func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})

	// API: list available repos
	r.Get("/api/repos", func(w http.ResponseWriter, r *http.Request) {
		data, err := os.ReadFile(cfg.RepoDataPath)
		if err != nil {
			http.Error(w, "Failed to read repo data", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	})

	// Feedback API
	r.Post("/api/feedback", handleFeedback(cfg))

	// Home-page docs + repos (Zoho auth enforced globally)
	r.Get("/api/docs/*", handleDocsAPI(cfg))
	r.Get("/api/download/*", handleDownloadAPI(cfg))
	r.Get("/api/repos", func(w http.ResponseWriter, r *http.Request) {
		data, err := os.ReadFile(cfg.RepoDataPath)
		if err != nil {
			http.Error(w, "Failed to read repo data", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write(data)
	})

	// Static files (frontend) with no-cache for dev
	if _, err := os.Stat(cfg.PublicDir); err == nil {
		explorerDir := filepath.Join(cfg.PublicDir, "explorer")
		if _, err := os.Stat(explorerDir); err == nil {
			explorerFS := http.StripPrefix("/explorer", http.FileServer(http.Dir(explorerDir)))
			r.Handle("/explorer/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				explorerFS.ServeHTTP(w, r)
			}))
			r.Get("/explorer", http.RedirectHandler("/explorer/", http.StatusMovedPermanently).ServeHTTP)
		}

		r.Get("/docs/*", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			http.ServeFile(w, r, filepath.Join(cfg.PublicDir, "index.html"))
		})

		rootFS := http.FileServer(http.Dir(cfg.PublicDir))
		r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			rootFS.ServeHTTP(w, r)
		}))
	}

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	slog.Info("server starting",
		"mode", "bridge",
		"addr", addr,
		"bridge_target", bridgeTarget.String(),
	)

	gracefulServe(addr, r, cfg)
}
