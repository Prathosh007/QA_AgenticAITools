<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: uems-agent-web -->
<!-- last-updated: 2026-04-08 -->

# Architecture — uems-agent-web

> 🎯 **Audience:** AI agents
> **Scope:** uems-agent-web project
> **Skip if:** Working on uems-agent-chat — read its own ARCHITECTURE.md instead.

Full architecture for the UEMS Agent Explorer — a standalone Go web server providing a browser-based chat UI with GitHub Device Flow authentication, Copilot API proxy, MCP tool invocation, and Prometheus metrics.

---

## Project Overview

| Property | Value |
|----------|-------|
| **Purpose** | Standalone web-based chat UI for UEMS agent interactions without VS Code |
| **Directory** | `source/uems-agent-web/` |
| **Language** | Go |
| **Build** | `Makefile` → `go build` → `bin/uems-agent-web` |
| **Entry point** | `backend/server/main.go` → `main()` |
| **NOT responsible for** | VS Code integration (that's uems-agent-chat), extension packaging, agent file syncing |

## Module Table

| Directory/File | Language | Responsibility |
|----------------|----------|----------------|
| `backend/server/main.go` | Go | Entry point, flag parsing, config, routing, TLS, graceful shutdown |
| `backend/handlers/copilot.go` | Go | GitHub Device Flow auth, Copilot API reverse proxy, system prompt building |
| `backend/handlers/chat.go` | Go | REST endpoints for tool listing (`GET /api/tools`) and invocation (`POST /api/tool`) |
| `backend/handlers/metrics.go` | Go | Prometheus-compatible `/metrics` endpoint, request/tool counters |
| `backend/handlers/ratelimit.go` | Go | Per-IP rate limiting middleware (token bucket) |
| `backend/handlers/zoho_auth.go` | Go | Zoho OAuth 2.0 for home-page access control |
| `backend/tools/registry.go` | Go | MCP tool registration — `RegisterAll()` loads repos.json and registers all tools |
| `backend/tools/*.go` | Go | Individual MCP tool implementations (9 tools) |
| `frontend/index.html` | HTML | Home page / landing page |
| `frontend/explorer/` | HTML/JS | Chat explorer UI |
| `frontend/js/` | JavaScript | Client-side chat logic, tool loop, SSE handling |
| `frontend/css/` | CSS | Styling |
| `Makefile` | Make | Build targets: `build`, `run`, `tidy`, `clean` |
| `setup.sh` | Shell | One-command setup: install deps, clone repos, build, launch |
| `Dockerfile` | Docker | Container build for deployment |
| `openapi.yaml` | YAML | OpenAPI 3.0 specification for all REST endpoints |

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     Go Web Server                               │
│                                                                │
│  ┌──────────────┐                                              │
│  │ server/      │    ┌─────────────────────────────────────┐   │
│  │ main.go      │───→│          chi/v5 Router               │   │
│  │ Config+Flags │    │                                     │   │
│  └──────────────┘    │  /auth/*        → copilot.go        │   │
│                      │  /copilot/*     → reverse proxy     │   │
│                      │  /api/tools     → chat.go           │   │
│                      │  /api/tool      → chat.go → MCP     │   │
│                      │  /api/config    → main.go           │   │
│                      │  /metrics       → metrics.go        │   │
│                      │  /health        → main.go           │   │
│                      │  /*             → frontend/ static  │   │
│                      └────────┬───────────────────┬────────┘   │
│                               │                   │            │
│               ┌───────────────▼──┐    ┌──────────▼─────────┐  │
│               │  Rate Limiter    │    │   MCP Server        │  │
│               │  ratelimit.go    │    │   tools/registry.go │  │
│               └──────────────────┘    │   tools/*.go (9)    │  │
│                                       └────────────────────┘  │
│               ┌──────────────────┐                             │
│               │  Metrics         │                             │
│               │  metrics.go      │                             │
│               └──────────────────┘                             │
└────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
  GitHub API          Copilot API           Local repos
  (Device Flow)       (chat/completions)    (data/repos/)
```

## Data Flow — Standalone Chat Request

| Step | Component | Action |
|------|-----------|--------|
| 1 | Browser | User types message in chat UI |
| 2 | `frontend/js/` | Frontend sends `POST /copilot/chat/completions` with messages + tools |
| 3 | `copilot.go` | Reverse proxy forwards to Copilot API with auth headers |
| 4 | Copilot API | Returns SSE stream with text + tool_calls |
| 5 | `frontend/js/` | Frontend detects tool_call → sends `POST /api/tool` |
| 6 | `chat.go` | `HandleToolInvoke()` → MCP in-memory transport → tool handler |
| 7 | `tools/*.go` | Tool executes (search, list, etc.) → returns output |
| 8 | `frontend/js/` | Frontend appends tool result → sends next Copilot request |
| 9 | Repeat | Until no more tool_calls → display final response |

## Data Flow — Bridge Mode

| Step | Component | Action |
|------|-----------|--------|
| 1 | Browser | User types message |
| 2 | `main.go` | Reverse proxy forwards to VS Code HTTP bridge |
| 3 | `uems-agent-chat` | HTTP bridge runs tool loop via VS Code LM API |
| 4 | `uems-agent-chat` | Streams SSE response back |
| 5 | `main.go` | Proxy streams response to browser |

## Entry Points

| Entry Point | Function | When |
|-------------|----------|------|
| `main()` | `server/main.go` | Server starts |
| `HandleDeviceCode()` | `copilot.go` | `POST /auth/initiate` |
| `HandleToolInvoke()` | `chat.go` | `POST /api/tool` |
| `HandleListTools()` | `chat.go` | `GET /api/tools` |
| `HandleMetrics()` | `metrics.go` | `GET /metrics` |

## Component Descriptions

### Server Entry Point (`server/main.go`)
Parses CLI flags and environment variables into `ServerConfig`. Sets up structured JSON logging via `slog`. Configures chi router with middleware (rate limiting, metrics recording). Handles TLS (self-signed cert generation, custom cert, or plaintext). Starts server with graceful shutdown on SIGINT/SIGTERM. Supports three modes: standalone, bridge, stdio.

### Copilot Handler (`handlers/copilot.go`)
Implements GitHub Device Flow (initiate → poll → token exchange). Provides reverse proxy for Copilot API with injected headers (editor-version, plugin-version, API version). Builds system prompts from agent `.agent.md` files with pre-loaded skills and guidelines. Manages auth cookies for tokens.

### Chat Handler (`handlers/chat.go`)
REST endpoints for tool listing and invocation. `HandleListTools()` returns OpenAI-format tool definitions. `HandleToolInvoke()` creates an in-memory MCP transport, connects to the MCP server, calls the tool, and returns the result. Applies configurable timeout and output size limit.

### Metrics (`handlers/metrics.go`)
Prometheus text exposition format at `/metrics` without external dependencies. Tracks `http_requests_total` (by method, path, status), `http_request_duration_seconds`, `tool_invocations_total` (by tool name). Uses `sync.Map` + `atomic` for lock-free counters.

### Rate Limiter (`handlers/ratelimit.go`)
Per-IP token bucket rate limiting middleware. Configurable global and auth-endpoint limits (requests-per-second + burst). Returns `429 Too Many Requests` when exceeded.

### Zoho Auth (`handlers/zoho_auth.go`)
OAuth 2.0 via Zoho Accounts for home-page access control. Restricts access to users with emails in the configured allowed domain. Optional — disabled when Zoho credentials are not configured.

### MCP Tool Registry (`tools/registry.go`)
`RegisterAll()` loads `repos.json`, stores shared state (`repoDir`, `guidelinesDir`), and registers all 9 MCP tools on the server.

## Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `chi/v5` | v5.2.4 | HTTP router |
| `go-sdk/mcp` | v1.2.0 | MCP server + in-memory transport |
| `oauth2` | v0.30.0 | OAuth 2.0 (indirect, via MCP SDK) |
| ripgrep (`rg`) | Runtime | Fast code search in cloned repos |
| Git CLI | Runtime | Clone/fetch repos for tools |

## Configuration

All configuration via CLI flags or environment variables:

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `--mode` | `UEMS_MODE` | `standalone` | Server mode: standalone/bridge/stdio |
| `--port` | `UEMS_PORT` | `443` | Listen port |
| `--repos` | `UEMS_REPO_DIR` | `data/repos` | Cloned repo directory |
| `--guidelines` | `UEMS_GUIDELINES_DIR` | `../../guidelines` | Guidelines directory |
| `--skills` | `UEMS_SKILLS_DIR` | `../../skills` | Skills directory |
| `--prompts` | `UEMS_PROMPTS_DIR` | `../../agents/orchestrator/agents` | Agent prompts |
| `--bridge-url` | `UEMS_BRIDGE_URL` | — | VS Code bridge URL (bridge mode) |
| `--search-max-results` | `UEMS_SEARCH_MAX_RESULTS` | `200` | Max ripgrep results |
| `--tool-output-limit` | `UEMS_TOOL_OUTPUT_LIMIT` | `8000` | Max tool output chars |
| `--tool-timeout` | `UEMS_TOOL_TIMEOUT` | `120` | Tool timeout (seconds) |
| `--tls-cert` | `UEMS_TLS_CERT` | — | TLS certificate file path |
| `--tls-key` | `UEMS_TLS_KEY` | — | TLS private key file path |
| `--tls-self-signed` | `UEMS_TLS_SELF_SIGNED` | `true` (auto) | Generate self-signed TLS cert |

## Known Issues / Gotchas

- Self-signed TLS cert is generated at startup when `--tls-self-signed` is set — browsers will show a warning
- Rate limiter uses in-memory state — resets on server restart
- Metrics are in-memory — not persisted across restarts
- Bridge mode requires a running VS Code instance with the extension and HTTP bridge enabled
- Frontend tool loop runs entirely client-side — the server is stateless for chat (no session management in standalone mode)
- Old mode names (`http`, `hybrid`) are accepted as aliases for `standalone`

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Runtime workflows | [`WORKFLOWS.md`](WORKFLOWS.md) |
| Repo-level overview | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| File locations | [`CODEBASE_MAP.md`](../../ai-agents/CODEBASE_MAP.md) |
| Domain terms | [`GLOSSARY.md`](../../ai-agents/GLOSSARY.md) |
| Build instructions | [`BUILD_GUIDE.md`](../../ai-agents/BUILD_GUIDE.md) |

---

*Last Updated: 2026-04-08*
