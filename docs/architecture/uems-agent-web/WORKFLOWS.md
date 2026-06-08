<!-- audience: ai-agents -->
<!-- doc-type: workflow -->
<!-- project: uems-agent-web -->
<!-- last-updated: 2026-04-08 -->

# Workflows — uems-agent-web

> 🎯 **Audience:** AI agents
> **Scope:** uems-agent-web project
> **Skip if:** Working on uems-agent-chat — read its own WORKFLOWS.md instead.

Runtime workflows for the Go web server — server startup, standalone chat flow, bridge mode, Device Flow authentication, tool invocation, and setup.

---

## Table of Contents

1. [Server Startup](#1-server-startup)
2. [Standalone Chat Flow](#2-standalone-chat-flow)
3. [Bridge Mode Flow](#3-bridge-mode-flow)
4. [GitHub Device Flow Authentication](#4-github-device-flow-authentication)
5. [Tool Invocation](#5-tool-invocation)
6. [Setup Script](#6-setup-script)

---

## 1. Server Startup

**Files:** `server/main.go`

```
main()
    │
    ├─ Parse CLI flags + env vars → ServerConfig
    ├─ Set up slog JSON logger (+ log file if configured)
    │
    ├─ Verify repos.json exists → exit if missing
    ├─ Validate config paths (standalone/stdio only)
    │
    ├─ Auto-enable TLS self-signed cert if no cert configured
    │
    ├─ Determine mode:
    │   ├─ "bridge"     → runBridgeMode()
    │   ├─ "standalone" → runStandaloneMode()
    │   ├─ "stdio"      → mcpServer.Run(StdioTransport)
    │   └─ unknown      → exit with error
    │
    ├─ [standalone] Configure handlers:
    │   ├─ Load system prompt path
    │   ├─ Set skills + guidelines dirs
    │   ├─ Create MCP server → RegisterAll() (9 tools)
    │   ├─ Wire config to handler setters
    │   └─ Set up chi router + middleware
    │
    ├─ Start HTTPS server with TLS
    │
    └─ Wait for SIGINT/SIGTERM → graceful shutdown
        └─ srv.Shutdown(ctx) with configurable timeout
```

**Key Rules:**
- TLS is always enforced — self-signed cert auto-generated if no cert provided
- Old mode names (`http`, `hybrid`) are accepted as aliases for `standalone`
- stdio mode redirects logs to stderr to keep stdout clean for MCP
- Graceful shutdown waits for in-flight requests (default 15s)

---

## 2. Standalone Chat Flow

**Files:** `frontend/js/*` → `handlers/copilot.go` → `handlers/chat.go` → `tools/*.go`

```
Browser: User types message
    │
    ├─ Frontend builds messages array + tool definitions
    │
    ├─ POST /copilot/chat/completions
    │   ├─ copilot.go: Reverse proxy to Copilot API
    │   │   ├─ Read Copilot token from cookie
    │   │   ├─ Inject headers:
    │   │   │   ├─ Authorization: Bearer {copilot_token}
    │   │   │   ├─ editor-version, editor-plugin-version
    │   │   │   ├─ x-github-api-version
    │   │   │   └─ copilot-integration-id: vscode-chat
    │   │   ├─ Build system prompt (if first request):
    │   │   │   ├─ Read agent .md file (strip YAML frontmatter)
    │   │   │   ├─ Pre-load 3 skills into <pre-loaded-skills> block
    │   │   │   └─ Pre-load 5 guidelines into <pre-loaded-guidelines> block
    │   │   └─ Forward to Copilot API → stream SSE back
    │   │
    │   └─ Copilot API returns SSE stream:
    │       ├─ Text chunks → display to user
    │       └─ tool_calls → frontend detects tool call
    │
    ├─ Frontend detects tool_call in SSE stream
    │   └─ POST /api/tool { name, arguments }
    │       ├─ chat.go: HandleToolInvoke()
    │       ├─ Create MCP in-memory transport
    │       ├─ Connect to MCP server
    │       ├─ Call tool with timeout
    │       ├─ Truncate output to toolOutputLimit
    │       └─ Return { output }
    │
    ├─ Frontend appends tool result to messages
    ├─ Frontend sends next POST /copilot/chat/completions
    │
    └─ Repeat until no tool_calls → display final response
```

**Key Rules:**
- Tool loop runs entirely client-side — server is stateless for chat
- Each Copilot API round is a separate HTTP request
- System prompt is built once per conversation (cached)
- Pre-loaded skills: `tool-preference-rules`, `platform-confirmation-protocol`, `guideline-loading-protocol`
- Pre-loaded guidelines: `grounding-rules.md`, `repo-documentation.md`, 3 platform `repo-map.md` files

---

## 3. Bridge Mode Flow

**Files:** `server/main.go` → reverse proxy → `uems-agent-chat` HTTP bridge

```
Browser: User types message
    │
    ├─ POST /chat (or any request)
    │   └─ main.go: httputil.ReverseProxy → BridgeURL
    │       ├─ Forward request to VS Code HTTP bridge
    │       └─ Stream response back to browser
    │
    ├─ VS Code HTTP bridge (uems-agent-chat):
    │   ├─ Runs orchestrator tool loop via VS Code LM API
    │   ├─ Uses VS Code's model and tools (richer than standalone)
    │   └─ Returns SSE stream
    │
    └─ Browser receives SSE stream → display response
```

**Key Rules:**
- Bridge mode requires a running VS Code instance with HTTP bridge enabled
- Server acts as a pure reverse proxy — no local tools or MCP server
- TLS still enforced on the Go server side
- Requires `--bridge-url` flag (typically `http://127.0.0.1:3111`)

---

## 4. GitHub Device Flow Authentication

**Files:** `handlers/copilot.go`

```
Browser clicks "Login with GitHub"
    │
    ├─ POST /auth/initiate
    │   ├─ copilot.go → POST github.com/login/device/code
    │   │   └─ Body: client_id, scope=read:user
    │   └─ Return: { device_code, user_code, verification_uri }
    │
    ├─ Browser displays: "Go to github.com/login/device, enter code"
    │
    ├─ POST /auth/poll (client polls periodically)
    │   ├─ copilot.go → POST github.com/login/oauth/access_token
    │   │   └─ Body: client_id, device_code, grant_type
    │   │
    │   ├─ Response cases:
    │   │   ├─ "authorization_pending" → return { status: "pending" }
    │   │   ├─ "slow_down" → return { status: "pending" }
    │   │   ├─ "expired_token" → return { error }
    │   │   └─ access_token → Continue
    │   │
    │   ├─ Verify user identity: GET api.github.com/user
    │   │
    │   ├─ Exchange for Copilot token:
    │   │   ├─ GET api.github.com/copilot_internal/v2/token
    │   │   └─ Returns: { token, expires_at, endpoints }
    │   │
    │   ├─ Set cookies:
    │   │   ├─ github_token (HttpOnly, Secure, SameSite=Lax)
    │   │   └─ copilot_token (HttpOnly, Secure, SameSite=Lax)
    │   │
    │   └─ Return: { status: "complete", user }
    │
    └─ Browser redirects to chat UI
```

**Key Rules:**
- Tokens stored in HttpOnly cookies — not accessible to JavaScript
- Copilot token has limited TTL (1 hour default) — refreshed as needed
- GitHub token stored for longer (24 hours default)
- Device Flow is standard OAuth — used because server has no redirect URI

---

## 5. Tool Invocation

**Files:** `handlers/chat.go` → `tools/registry.go` → `tools/*.go`

```
POST /api/tool { name: "uems_agent_search_repos", arguments: {...} }
    │
    ├─ chat.go: HandleToolInvoke()
    │   ├─ Parse request body
    │   ├─ Validate: name required
    │   │
    │   ├─ Create context with timeout (default: 2 minutes)
    │   ├─ invokeTool(ctx, name, argsJSON):
    │   │   ├─ Create in-memory MCP transports (client + server)
    │   │   ├─ chatMCPServer.Connect(ctx, serverTransport)
    │   │   ├─ client.CallTool(ctx, name, args)
    │   │   │   └─ Dispatches to registered tool handler
    │   │   └─ Extract text output from result
    │   │
    │   ├─ Truncate output to toolOutputLimit (default: 8000 chars)
    │   ├─ Record metrics (duration, count)
    │   │
    │   └─ Return: { output }
    │
    └─ Frontend receives tool output
```

**Key Rules:**
- Each tool invocation creates a fresh MCP in-memory transport
- Context timeout prevents tools from blocking indefinitely
- Output is truncated — not all tool results fit in LLM context
- Metrics recorded for every invocation (tool name + duration)

---

## 6. Setup Script

**Files:** `setup.sh`, `sync-repos.sh`

```
./setup.sh [--tls-cert <path> --tls-key <path>]
    │
    ├─ Check/install prerequisites:
    │   ├─ Go (via brew, apt, or error)
    │   ├─ ripgrep (via brew, apt, or error)
    │   └─ Git
    │
    ├─ Source .env if exists
    │
    ├─ Clone UEMS repos (via sync-repos.sh or internal logic)
    │   └─ For each repo in repos.json matching platform:
    │       ├─ git clone --depth 1 (if not exists)
    │       └─ git fetch --depth 1 (if exists)
    │
    ├─ Build: make build
    │
    └─ Launch: ./bin/uems-agent-web with configured flags
        └─ Passes --tls-cert / --tls-key if provided (otherwise self-signed)
```

---

## Cross-Cutting Concerns

### Rate Limiting
- Per-IP token bucket middleware (`ratelimit.go`)
- Separate limits for global (10 RPS, burst 30) and auth endpoints (2 RPS, burst 5)
- Returns `429 Too Many Requests` when exceeded

### Metrics
- Custom Prometheus text exposition at `/metrics`
- No external dependencies — uses `sync.Map` + `atomic.Int64`
- Tracks: `http_requests_total`, `http_request_duration_seconds`, `tool_invocations_total`

### TLS
- Always enforced — self-signed cert auto-generated if none provided
- HSTS headers set on all responses
- Secure cookie flags always set

### CORS
- Middleware sets `Access-Control-Allow-Origin` from request `Origin` header
- Upstream CORS headers stripped to prevent duplicates

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Static architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Repo-level overview | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| File locations | [`CODEBASE_MAP.md`](../../ai-agents/CODEBASE_MAP.md) |
| Domain terms | [`GLOSSARY.md`](../../ai-agents/GLOSSARY.md) |

---

*Last Updated: 2026-04-08*
