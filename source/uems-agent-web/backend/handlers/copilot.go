// Package handlers implements HTTP handlers for GitHub Device Flow auth
// and Copilot API reverse proxy.
//
// Adapted from uems-webclient-chat but simplified — no database, no user
// management, just auth cookies + proxy.
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	// GitHub URLs
	GitHubDeviceCodeURL  = "https://github.com/login/device/code"
	GitHubAccessTokenURL = "https://github.com/login/oauth/access_token"
	GitHubUserURL        = "https://api.github.com/user"
)

// Configurable values — set from main via setter functions.
var (
	clientID             = "Iv1.b507a08c87ecfe98"
	copilotAPIBaseURL    = "https://api.business.githubcopilot.com"
	copilotEditorVersion = "vscode/1.155.0"
	copilotPluginVersion = "1.155.0"
	githubAPIVersion     = "2025-04-01"
	copilotTokenMaxAge   = 3600
	githubTokenMaxAge    = 86400
)

// SetGitHubClientID sets the GitHub OAuth client ID.
func SetGitHubClientID(id string) { clientID = id }

// SetCopilotAPIBaseURL sets the Copilot API base URL.
func SetCopilotAPIBaseURL(u string) { copilotAPIBaseURL = u }

// SetCopilotEditorVersion sets the editor-version header for Copilot API requests.
func SetCopilotEditorVersion(v string) { copilotEditorVersion = v }

// SetCopilotPluginVersion sets the editor-plugin-version header for Copilot API requests.
func SetCopilotPluginVersion(v string) { copilotPluginVersion = v }

// SetGitHubAPIVersion sets the x-github-api-version header value.
func SetGitHubAPIVersion(v string) { githubAPIVersion = v }

// SetCookieMaxAge sets the max-age (seconds) for auth cookies.
func SetCookieMaxAge(copilotMax, githubMax int) {
	copilotTokenMaxAge = copilotMax
	githubTokenMaxAge = githubMax
}

var systemPromptPath string
var promptsDir string
var skillsDir string
var guidelinesDir string
var llmProvider = "copilot" // "copilot" or "ollama"
var reasoningEffort = ""    // "low", "medium", "high" — empty means model default

// Cached per-agent prompts to avoid re-reading files on every request.
var promptCache sync.Map // map[string]string

// SetSystemPromptPath sets the path to the default agent .md file used as system prompt.
func SetSystemPromptPath(p string) { systemPromptPath = p }

// SetPromptsDir sets the directory containing all agent .agent.md files.
func SetPromptsDir(p string) { promptsDir = p }

// SetSkillsDir sets the path to the skills directory for pre-loading into prompts.
func SetSkillsDir(p string) { skillsDir = p }

// SetGuidelinesDir sets the path to the guidelines directory for pre-loading into prompts.
func SetGuidelinesDir(p string) { guidelinesDir = p }

// SetLLMProvider sets the LLM backend: "copilot" or "ollama".
func SetLLMProvider(p string) { llmProvider = p }

// GetLLMProvider returns the current LLM provider.
func GetLLMProvider() string { return llmProvider }

// SetReasoningEffort sets the reasoning effort level for thinking models ("low", "medium", "high").
func SetReasoningEffort(e string) { reasoningEffort = e }

// GetReasoningEffort returns the current reasoning effort setting.
func GetReasoningEffort() string { return reasoningEffort }

// ── Types ────────────────────────────────────────────────────────────

type DeviceCodeResponse struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type TokenResponse struct {
	AccessToken      string `json:"access_token"`
	TokenType        string `json:"token_type"`
	Scope            string `json:"scope"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type CopilotTokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
}

type authSession struct {
	Status    string
	ExpiresAt time.Time
}

var (
	authSessions  = map[string]authSession{}
	sessionMu     sync.Mutex
	secureCookies bool // set to true when TLS is active
)

// SetSecureCookies enables the Secure flag on auth cookies (call when TLS is active).
func SetSecureCookies(v bool) { secureCookies = v }

// ── Internal auth logic ──────────────────────────────────────────────

func copilotUserAgent() string {
	return "GithubCopilot/" + copilotPluginVersion
}

func copilotTokenURL() string {
	return "https://api.github.com/copilot_internal/v2/token"
}

func copilotModelsURL() string {
	return copilotAPIBaseURL + "/models"
}

// FetchCopilotModels fetches the live model list from the Copilot API
// using the user's auth cookies. Returns model IDs, or an error if
// the user is not authenticated or the API is unreachable.
func FetchCopilotModels(w http.ResponseWriter, r *http.Request) ([]string, error) {
	token := ""
	if cookie, err := r.Cookie("copilot_token"); err == nil {
		token, _ = url.QueryUnescape(cookie.Value)
	}
	if token == "" {
		var err error
		token, err = tryRefreshCopilotToken(w, r)
		if err != nil {
			return nil, fmt.Errorf("not authenticated")
		}
	}

	req, err := http.NewRequest("GET", copilotModelsURL(), nil)
	if err != nil {
		return nil, err
	}
	setCopilotHeaders(req, token)

	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("copilot models API returned %d", resp.StatusCode)
	}

	var data struct {
		Models []struct {
			ID string `json:"id"`
		} `json:"models"`
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&data); err != nil {
		return nil, err
	}

	raw := data.Models
	if len(raw) == 0 {
		raw = data.Data
	}
	ids := make([]string, 0, len(raw))
	for _, m := range raw {
		if m.ID != "" {
			ids = append(ids, m.ID)
		}
	}
	return ids, nil
}

func initiateDeviceLogin() (*DeviceCodeResponse, error) {
	payload, _ := json.Marshal(map[string]string{
		"client_id": clientID,
		"scope":     "read:user",
	})

	req, err := http.NewRequest("POST", GitHubDeviceCodeURL, bytes.NewBuffer(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", copilotUserAgent())

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("device code request failed (%d): %s", resp.StatusCode, body)
	}

	var dc DeviceCodeResponse
	if err := json.NewDecoder(resp.Body).Decode(&dc); err != nil {
		return nil, err
	}
	// Construct verification_uri_complete if GitHub didn't return it
	if dc.VerificationURIComplete == "" && dc.VerificationURI != "" && dc.UserCode != "" {
		dc.VerificationURIComplete = dc.VerificationURI + "?user_code=" + url.QueryEscape(dc.UserCode)
	}
	return &dc, nil
}

func pollForToken(deviceCode string) (*TokenResponse, error) {
	payload, _ := json.Marshal(map[string]string{
		"client_id":   clientID,
		"device_code": deviceCode,
		"grant_type":  "urn:ietf:params:oauth:grant-type:device_code",
	})

	req, err := http.NewRequest("POST", GitHubAccessTokenURL, bytes.NewBuffer(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", copilotUserAgent())

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var t TokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&t); err != nil {
		return nil, err
	}
	return &t, nil
}

func getCopilotToken(githubToken string) (*CopilotTokenResponse, error) {
	req, err := http.NewRequest("GET", copilotTokenURL(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+githubToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", copilotUserAgent())

	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		var ct CopilotTokenResponse
		if err := json.NewDecoder(resp.Body).Decode(&ct); err != nil {
			return nil, err
		}
		return &ct, nil
	}
	if resp.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("no GitHub Copilot subscription found for this account")
	}
	body, _ := io.ReadAll(resp.Body)
	return nil, fmt.Errorf("copilot token error (%d): %s", resp.StatusCode, body)
}

func setAuthCookies(w http.ResponseWriter, githubToken, copilotToken string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "copilot_token",
		Value:    url.QueryEscape(copilotToken),
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   copilotTokenMaxAge,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "github_token",
		Value:    githubToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   githubTokenMaxAge,
	})
}

func tryRefreshCopilotToken(w http.ResponseWriter, r *http.Request) (string, error) {
	cookie, err := r.Cookie("github_token")
	if err != nil {
		return "", fmt.Errorf("no github_token cookie")
	}
	ct, err := getCopilotToken(cookie.Value)
	if err != nil {
		return "", err
	}
	setAuthCookies(w, cookie.Value, ct.Token)
	return ct.Token, nil
}

// ── HTTP Handlers ────────────────────────────────────────────────────

// HandleInitiateAuth starts a GitHub Device Flow login.
func HandleInitiateAuth(w http.ResponseWriter, r *http.Request) {
	dc, err := initiateDeviceLogin()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	sessionMu.Lock()
	authSessions[dc.DeviceCode] = authSession{
		Status:    "pending",
		ExpiresAt: time.Now().Add(time.Duration(dc.ExpiresIn) * time.Second),
	}
	sessionMu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dc)
}

// HandlePollAuth polls for the user completing Device Flow in the browser.
func HandlePollAuth(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DeviceCode string `json:"device_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	sessionMu.Lock()
	sess, exists := authSessions[body.DeviceCode]
	sessionMu.Unlock()

	if !exists || time.Now().After(sess.ExpiresAt) {
		http.Error(w, "Invalid or expired session", http.StatusBadRequest)
		return
	}

	tData, err := pollForToken(body.DeviceCode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if tData.AccessToken != "" {
		ct, err := getCopilotToken(tData.AccessToken)
		if err != nil {
			http.Error(w, err.Error(), http.StatusForbidden)
			return
		}

		sessionMu.Lock()
		delete(authSessions, body.DeviceCode)
		sessionMu.Unlock()

		setAuthCookies(w, tData.AccessToken, ct.Token)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
		return
	}

	if tData.Error == "authorization_pending" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "pending"})
		return
	}

	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(map[string]string{"error": tData.ErrorDescription})
}

// HandleAuthStatus checks whether the user is currently authenticated.
func HandleAuthStatus(w http.ResponseWriter, r *http.Request) {
	// Ollama: no auth needed — always logged in
	if llmProvider == "ollama" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"isLoggedIn": true,
			"login":      "local",
		})
		return
	}

	token := ""
	if cookie, err := r.Cookie("copilot_token"); err == nil {
		token, _ = url.QueryUnescape(cookie.Value)
	}
	if token == "" {
		var err error
		token, err = tryRefreshCopilotToken(w, r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"isLoggedIn": false})
			return
		}
	}

	// Validate token against Copilot API
	req, _ := http.NewRequest("GET", copilotModelsURL(), nil)
	setCopilotHeaders(req, token)
	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		// Try refresh
		token, err = tryRefreshCopilotToken(w, r)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"isLoggedIn": false})
			return
		}
	}
	if resp != nil {
		resp.Body.Close()
	}

	// Get user info from GitHub
	ghCookie, err := r.Cookie("github_token")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"isLoggedIn": true})
		return
	}

	userReq, _ := http.NewRequest("GET", GitHubUserURL, nil)
	userReq.Header.Set("Authorization", "token "+ghCookie.Value)
	userReq.Header.Set("Accept", "application/json")
	userReq.Header.Set("User-Agent", copilotUserAgent())

	userResp, err := (&http.Client{Timeout: 5 * time.Second}).Do(userReq)
	if err != nil || userResp.StatusCode != http.StatusOK {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"isLoggedIn": true})
		return
	}
	defer userResp.Body.Close()

	var user map[string]interface{}
	if err := json.NewDecoder(userResp.Body).Decode(&user); err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"isLoggedIn": true})
		return
	}
	user["isLoggedIn"] = true
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// HandleLogout clears auth cookies.
func HandleLogout(w http.ResponseWriter, r *http.Request) {
	for _, name := range []string{"copilot_token", "github_token"} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			Expires:  time.Unix(0, 0),
			MaxAge:   -1,
		})
	}
	w.WriteHeader(http.StatusOK)
}

// HandleCopilotProxy reverse-proxies requests to the LLM API (Copilot or Ollama),
// injecting the orchestrator system prompt into chat completions.
func HandleCopilotProxy(w http.ResponseWriter, r *http.Request) {
	if llmProvider == "ollama" {
		// Ollama: no auth needed, just proxy directly
		handleOllamaProxy(w, r)
		return
	}

	// Copilot: get token from cookie if not in header
	if r.Header.Get("Authorization") == "" {
		token := ""
		if cookie, err := r.Cookie("copilot_token"); err == nil {
			token, _ = url.QueryUnescape(cookie.Value)
		}
		if token == "" {
			token, _ = tryRefreshCopilotToken(w, r)
		}
		if token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		setCopilotHeaders(r, token)
	}

	target, _ := url.Parse(copilotAPIBaseURL)
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1 // flush SSE chunks immediately
	// Strip upstream CORS headers — Go CORS middleware handles them.
	proxy.ModifyResponse = func(resp *http.Response) error {
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Allow-Credentials")
		return nil
	}

	r.URL.Host = target.Host
	r.URL.Scheme = target.Scheme
	r.Header.Set("X-Forwarded-Host", r.Header.Get("Host"))
	r.Host = target.Host
	// Remove browser Origin — it's the web app's origin, not meaningful to Copilot API.
	r.Header.Del("Origin")

	// Strip /copilot prefix
	r.URL.Path = strings.TrimPrefix(r.URL.Path, "/copilot")
	if r.URL.Path == "" {
		r.URL.Path = "/"
	}

	// Inject system prompt for chat completions
	if r.Method == http.MethodPost && (r.URL.Path == "/v1/chat/completions" || r.URL.Path == "/chat/completions") {
		injectSystemPrompt(r)
	}

	proxy.ServeHTTP(w, r)
}

// handleOllamaProxy proxies requests to a local Ollama instance.
// Ollama exposes an OpenAI-compatible API at /v1/chat/completions.
// No auth headers, no Copilot-specific headers.
func handleOllamaProxy(w http.ResponseWriter, r *http.Request) {
	target, err := url.Parse(copilotAPIBaseURL) // reused — set to Ollama URL when provider=ollama
	if err != nil {
		http.Error(w, "Invalid Ollama URL", http.StatusInternalServerError)
		return
	}
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.FlushInterval = -1

	// Log and surface Ollama errors to the client
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		slog.Error("ollama proxy error", "url", target.String()+r.URL.Path, "error", err)
		http.Error(w, fmt.Sprintf(`{"error":"Ollama unreachable: %s"}`, err.Error()), http.StatusBadGateway)
	}

	r.URL.Host = target.Host
	r.URL.Scheme = target.Scheme
	r.Host = target.Host
	r.Header.Del("Origin")
	// Remove Copilot-specific headers that are meaningless to Ollama
	r.Header.Del("Editor-Version")
	r.Header.Del("Editor-Plugin-Version")

	// Strip /copilot prefix and ensure /v1 prefix for Ollama's OpenAI-compatible API
	r.URL.Path = strings.TrimPrefix(r.URL.Path, "/copilot")
	if r.URL.Path == "/chat/completions" {
		r.URL.Path = "/v1/chat/completions"
	}

	slog.Debug("ollama proxy", "method", r.Method, "path", r.URL.Path)

	// Inject system prompt for chat completions
	if r.Method == http.MethodPost && (r.URL.Path == "/v1/chat/completions" || r.URL.Path == "/chat/completions") {
		injectSystemPrompt(r)
	}

	proxy.ServeHTTP(w, r)
}

// ── Internal helpers ─────────────────────────────────────────────────

func setCopilotHeaders(req *http.Request, token string) {
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("copilot-integration-id", "vscode-chat")
	req.Header.Set("editor-version", copilotEditorVersion)
	req.Header.Set("editor-plugin-version", copilotPluginVersion)
	req.Header.Set("user-agent", copilotUserAgent())
	req.Header.Set("openai-intent", "conversation-panel")
	req.Header.Set("x-github-api-version", githubAPIVersion)
}

// yamlFrontmatterRe matches YAML frontmatter blocks (---\n...\n---\n).
var yamlFrontmatterRe = regexp.MustCompile(`(?s)\A---\n.*?\n---\n`)

// buildSystemPrompt constructs the full system prompt with:
//  1. Agent prompt (stripped of YAML frontmatter)
//  2. Pre-loaded skills inline (so the LLM doesn't waste a round calling load_skills) — Copilot only
//  3. Pre-loaded guidelines — Copilot only
//  4. Mode-specific directives
//
// For Ollama, the prompt is kept minimal (~1–2KB) to fit within smaller context windows.
// resolveAgentPromptPath returns the filesystem path for the given agent name.
// Falls back to the default systemPromptPath if the agent file doesn't exist.
func resolveAgentPromptPath(agentName string) string {
	if agentName != "" && promptsDir != "" {
		p := filepath.Join(promptsDir, agentName+".agent.md")
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return systemPromptPath
}

func buildSystemPromptForAgent(agentName string) string {
	promptPath := resolveAgentPromptPath(agentName)
	if promptPath == "" {
		return ""
	}

	// Check cache first
	if cached, ok := promptCache.Load(promptPath); ok {
		return cached.(string)
	}

	promptBytes, err := os.ReadFile(promptPath)
	if err != nil {
		return ""
	}

	// Strip YAML frontmatter
	agentPrompt := strings.TrimSpace(yamlFrontmatterRe.ReplaceAllString(string(promptBytes), ""))

	// 	// Ollama: use a compact prompt — skip pre-loaded skills/guidelines to save context
	// 	if llmProvider == "ollama" {
	// 		return agentPrompt + `

	// <system-rules>
	// You are a UEMS codebase assistant running locally via Ollama.
	// - Ground every claim in tool output. Never invent file paths or code.
	// - Cite repo name and file path from tool output.
	// - Admit uncertainty if a search returns no results.
	// - After calling a tool, summarize the results clearly for the user.
	// - Prioritize the user's actual query. Call the relevant tool immediately.
	// - Keep answers concise (2-4 sentences) and offer to expand.
	// </system-rules>`
	// 	}

	// 	// Copilot: full prompt with pre-loaded skills and guidelines

	// Pre-load the skills the explorer prompt references
	skillNames := []string{"tool-preference-rules", "platform-confirmation-protocol", "guideline-loading-protocol"}
	var skillSections []string

	if skillsDir != "" {
		for _, name := range skillNames {
			skillPath := filepath.Join(skillsDir, name, "SKILL.md")
			content, err := os.ReadFile(skillPath)
			if err != nil {
				continue
			}
			body := strings.TrimSpace(yamlFrontmatterRe.ReplaceAllString(string(content), ""))
			skillSections = append(skillSections, fmt.Sprintf("<skill name=%q>\n%s\n</skill>", name, body))
		}
	}

	skillBlock := ""
	if len(skillSections) > 0 {
		skillBlock = "\n\n<pre-loaded-skills>\nThe following skills are already loaded. Do NOT call uems_agent_load_skills for these — use them directly.\n\n" +
			strings.Join(skillSections, "\n\n") + "\n</pre-loaded-skills>"
	}

	// Pre-load key guidelines so the LLM doesn't waste a tool round
	var guidelineSections []string
	if guidelinesDir != "" {
		// Common guidelines
		commonFiles := []string{"grounding-rules.md", "repo-documentation.md"}
		for _, name := range commonFiles {
			content, err := os.ReadFile(filepath.Join(guidelinesDir, "common", name))
			if err != nil {
				continue
			}
			guidelineSections = append(guidelineSections, fmt.Sprintf("<guideline name=%q source=\"guidelines/common/%s\">\n%s\n</guideline>", name, name, strings.TrimSpace(string(content))))
		}
		// Platform repo-maps (all three — LLM picks based on context)
		for _, platform := range []string{"mac", "linux", "windows"} {
			content, err := os.ReadFile(filepath.Join(guidelinesDir, platform, "repo-map.md"))
			if err != nil {
				continue
			}
			guidelineSections = append(guidelineSections, fmt.Sprintf("<guideline name=\"repo-map.md\" platform=%q source=\"guidelines/%s/repo-map.md\">\n%s\n</guideline>", platform, platform, strings.TrimSpace(string(content))))
		}
	}

	guidelineBlock := ""
	if len(guidelineSections) > 0 {
		guidelineBlock = "\n\n<pre-loaded-guidelines>\nThe following guidelines are already loaded. Do NOT call uems_agent_load_guidelines for these — follow them directly.\n\n" +
			strings.Join(guidelineSections, "\n\n") + "\n</pre-loaded-guidelines>"
	}

	standaloneDirective := `

<system-rules>
## Response Quality Rules
1. **Ground every claim in tool output.** Never invent file paths, function names, or code that wasn't returned by a tool. If no tool result confirms a fact, say "I didn't find evidence of that."
2. **Cite sources.** When referencing code, include the repo name and file path from the tool output.
3. **Admit uncertainty.** If a search returns no results or partial results, say so. Do not fill gaps with assumptions.
4. **No harmful content.** Do not generate malicious code, exploit payloads, or bypass security controls.
5. **Respect tool errors.** If a tool returns an error, report it and suggest an alternative approach.
6. **Stay in scope.** You are a UEMS codebase assistant. Decline requests unrelated to the UEMS project.
</system-rules>

<standalone-mode-rules>
You are running in standalone mode (web chat). Important differences from VS Code:
- Do NOT call uems_agent_load_skills for skills listed in <pre-loaded-skills> — they are already loaded above. You CAN call it to load other skills not listed above.
- Do NOT call uems_agent_load_guidelines for guidelines listed in <pre-loaded-guidelines> — they are already loaded above. You CAN call it to load other guidelines not listed above (e.g., coding-standards.md, platform-security.md).
- Do NOT call vscode_askQuestions — it is not available. Infer the platform from context (Swift/XPC → mac, Go → linux, C#/C++/COM → windows). If the platform cannot be inferred, do NOT default to a single platform — instead, consider all platforms (mac, linux, windows) and call tools for each relevant platform to give a comprehensive answer.
- Prioritize the user's actual query. Call the relevant tool (search_repos, dependency_graph, list_components, find_wrapper) immediately.
- Keep answers concise (2-4 sentences) and offer to expand.
</standalone-mode-rules>`

	result := agentPrompt + skillBlock + guidelineBlock + standaloneDirective
	promptCache.Store(promptPath, result)
	return result
}

// buildSystemPrompt constructs the prompt using the default agent.
func buildSystemPrompt() string {
	return buildSystemPromptForAgent("")
}

func injectSystemPrompt(r *http.Request) {
	agentName := r.Header.Get("X-Agent-Name")
	prompt := buildSystemPromptForAgent(agentName)
	if prompt == "" && reasoningEffort == "" {
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		r.Body = io.NopCloser(bytes.NewBuffer(body))
		return
	}

	if prompt != "" {
		messages, ok := data["messages"].([]interface{})
		if !ok {
			r.Body = io.NopCloser(bytes.NewBuffer(body))
			return
		}

		systemMsg := map[string]string{
			"role":    "system",
			"content": prompt,
		}
		data["messages"] = append([]interface{}{systemMsg}, messages...)
	}

	// Inject reasoning_effort for Ollama thinking models (e.g. Qwen3)
	if llmProvider == "ollama" && reasoningEffort != "" {
		data["reasoning_effort"] = reasoningEffort
	}

	newBody, err := json.Marshal(data)
	if err != nil {
		r.Body = io.NopCloser(bytes.NewBuffer(body))
		return
	}
	r.Body = io.NopCloser(bytes.NewBuffer(newBody))
	r.ContentLength = int64(len(newBody))
	r.Header.Set("Content-Length", fmt.Sprint(len(newBody)))
}
