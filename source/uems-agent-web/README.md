# UEMS Agent Explorer

Standalone Go server that provides a browser-based AI chat interface for UEMS native agent development, powered by GitHub Copilot API. Runs independently of the VS Code extension — both share the same repo registry (`repos.json`) and guidelines but have their own tool implementations.

## Architecture

```
Browser → uems-agent-web (Go server)
            ├── /sse         → MCP server (streamable HTTP) with native agent tools
            ├── /copilot/*   → Reverse proxy to GitHub Copilot API (standalone/http modes)
            ├── /auth/*      → GitHub Device Flow OAuth (standalone/http modes)
            └── /*           → Static frontend files
```

### Relationship to UEMS Agent for VS Code

| | UEMS Agent for VS Code (`uems-agent-chat`) | UEMS Agent Explorer (`uems-agent-web`) |
|---|---|---|
| Runtime | VS Code extension (TypeScript) | Standalone HTTP server (Go) |
| Tools | 8 TS tool implementations | 8 Go tool implementations |
| Interface | Chat participant in VS Code | Browser chat UI |
| Shared data | `repos.json`, `guidelines/`, agent prompts | Same |

Both codebases implement the same 8 tools independently. Shared data (repo registry, guidelines, agent prompts) lives in the repo root.

## Prerequisites

- Go 1.23+
- [ripgrep](https://github.com/BurntSushi/ripgrep) (`rg`) for code search
- Git CLI
- GitHub account with Copilot subscription

## Quick Start

### One-Command Setup (Bridge Mode)

```bash
./setup.sh
```

This provisions everything: checks prerequisites, installs the VS Code extension, clones repos, builds the server, and launches in bridge mode. See `./setup.sh --help` for options.

### Manual Setup

```bash
# Build
make build

# Run in HTTP mode (default — web server)
make run
# → https://localhost:443

# Run in stdio mode (MCP over stdin/stdout, for future use)
./bin/uems-agent-web --mode stdio
```

## Modes

| Mode | Flag | Description |
|------|------|-------------|
| Standalone | `--mode standalone` (default) | Fully standalone: Copilot API direct, local tools, GitHub Device Flow auth. No VS Code dependency |
| Stdio | `--mode stdio` | MCP over stdin/stdout (JSON-RPC 2.0, newline-delimited) |
| Bridge | `--mode bridge` | Proxies chat/tool calls to a VS Code HTTP bridge (requires `--bridge-url`) |

**Standalone mode** is the default and recommended mode. It authenticates users via GitHub Device Flow, proxies chat completions to the Copilot API, and executes tools locally — no VS Code or bridge needed. The system prompt is built dynamically with pre-loaded skills, guidelines, and response quality rules.

### Local Ollama Support

Standalone mode can use a locally hosted [Ollama](https://ollama.com) instance instead of the Copilot API. This requires no GitHub auth — just a running Ollama server with a model pulled.

```bash
# Start with Ollama (env vars)
UEMS_LLM_PROVIDER=ollama ./bin/uems-agent-web

# Or via setup script
./setup.sh --llm-provider ollama

# Custom Ollama URL and model
UEMS_LLM_PROVIDER=ollama UEMS_OLLAMA_URL=http://my-server:11434 UEMS_CHAT_MODEL=deepseek-r1 ./bin/uems-agent-web
```

## MCP Tools

The server exposes 8 tools via the MCP endpoint (`/sse` in HTTP mode):

| Tool | Description |
|------|-------------|
| `uems_agent_search_repos` | Search code patterns across native repos using ripgrep |
| `uems_agent_list_components` | List classes, protocols, structs in a repo |
| `uems_agent_find_wrapper` | Find Agent-Utils wrappers by capability keyword |
| `uems_agent_dependency_graph` | Get upstream/downstream repo dependency graph |
| `uems_agent_validate_tag` | Validate git tag format (UEMS convention) and existence |
| `uems_agent_create_branch` | Create git branches across multiple repos from a tag or branch |
| `uems_agent_setup_workspace` | Clone or fetch repos and verify workspace readiness |
| `uems_agent_load_guidelines` | Load engineering guidelines, security standards, coding conventions |
| `uems_agent_load_skills` | Load reusable skill procedures (SKILL.md files) from the skills directory |

## Configuration

| Flag | Env | Default | Description |
|------|-----|---------|-------------|
| `-mode` | — | `standalone` | Server mode: `standalone`, `stdio`, or `bridge` |
| — | `UEMS_LLM_PROVIDER` | `copilot` | LLM provider: `copilot` or `ollama` |
| — | `UEMS_OLLAMA_URL` | `http://localhost:11434` | Ollama server URL (when provider=ollama) |
| — | `UEMS_CHAT_MODEL` | `claude-sonnet-4.6` / `qwen3` | Chat model (default depends on provider) |
| — | `UEMS_SUGGEST_MODEL` | `gpt-4.1` / `qwen3` | Suggestion model (default depends on provider) |
| `-host` | — | `localhost` | Listen host (HTTP mode only) |
| `-port` | — | `443` | Listen port (HTTP mode only) |
| `-repos` | `UEMS_REPO_DIR` | `data/repos` | Path to cloned native repos |
| `-guidelines` | `UEMS_GUIDELINES_DIR` | `../../guidelines` | Guidelines directory |
| `-skills` | `UEMS_SKILLS_DIR` | `../../skills` | Skills directory |
| `-prompts` | `UEMS_PROMPTS_DIR` | `../../agents/orchestrator/agents` | Agent prompt files |
| `-repo-data` | `UEMS_REPO_DATA` | `../common/repos.json` | repos.json path |
| `-bridge-url` | `UEMS_BRIDGE_URL` | — | VS Code HTTP bridge URL (bridge mode) |
| `-search-max-results` | `UEMS_SEARCH_MAX_RESULTS` | `200` | Max ripgrep search results |
| `-tool-output-limit` | `UEMS_TOOL_OUTPUT_LIMIT` | `8000` | Max chars in tool output |
| `-tool-timeout` | `UEMS_TOOL_TIMEOUT` | `120` | Tool invocation timeout (seconds) |
| `-context-token-limit` | `UEMS_CONTEXT_TOKEN_LIMIT` | `120000` | Client-side context compaction threshold |
| `-tls-cert` | `UEMS_TLS_CERT` | — | TLS certificate file path |
| `-tls-key` | `UEMS_TLS_KEY` | — | TLS private key file path |
| `-tls-self-signed` | `UEMS_TLS_SELF_SIGNED` | `false` | Generate self-signed TLS cert |

## API Endpoints

Full OpenAPI spec: [`openapi.yaml`](openapi.yaml)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Liveness probe (`{"status":"ok"}`) |
| `/readyz` | GET | Readiness probe (checks deps + bridge reachability) |
| `/api/mode` | GET | Server mode (`standalone` or `bridge`) |
| `/api/version` | GET | Build version, commit SHA, build time |
| `/api/config` | GET | Tunable limits (for frontend) |
| `/api/tools` | GET | Tool definitions (OpenAI format) |
| `/api/tool` | POST | Invoke a single MCP tool |
| `/api/repos` | GET | List available repos from `repos.json` |
| `/metrics` | GET | Prometheus-compatible metrics |
| `/auth/initiate` | POST | Start GitHub Device Flow login |
| `/auth/poll` | POST | Poll for completed Device Flow auth |
| `/auth/status` | GET | Check current session auth status |
| `/auth/logout` | POST | Clear session |
| `/copilot/*` | * | Copilot API reverse proxy (SSE streaming) |
| `/sse` | * | MCP streamable HTTP endpoint |

## Docker

```bash
# Build from repo root
docker build -f source/uems-agent-web/Dockerfile -t uems-agent-web .

# Run
docker run -p 443:443 -v /path/to/cloned/repos:/app/data/repos uems-agent-web
```

## Features

### System Prompt Pre-loading (Standalone/HTTP modes)

In standalone and HTTP modes, `buildSystemPrompt()` constructs a rich system prompt that includes:

1. **Agent prompt** — loaded from the explorer agent definition (YAML frontmatter stripped)
2. **Pre-loaded skills** — 3 core skills embedded inline so the LLM doesn't waste tool calls:
   - `tool-preference-rules`
   - `platform-confirmation-protocol`
   - `guideline-loading-protocol`
3. **Pre-loaded guidelines** — 5 key guideline files embedded inline:
   - `guidelines/common/grounding-rules.md`
   - `guidelines/common/repo-documentation.md`
   - `guidelines/mac/repo-map.md`, `guidelines/linux/repo-map.md`, `guidelines/windows/repo-map.md`
4. **System rules** — response quality rules (grounding, citation, uncertainty, safety)
5. **Mode directives** — tells the LLM which tools are available and which are pre-loaded

The LLM can still call `uems_agent_load_guidelines` and `uems_agent_load_skills` for files not in the pre-loaded set (e.g., `coding-standards.md`, `platform-security.md`).

### Structured Logging

All server logs use Go's `slog` package with JSON output. In stdio mode, logs are redirected to stderr to keep stdout clean for MCP traffic.

### Graceful Shutdown

The server intercepts `SIGINT` and `SIGTERM`, drains in-flight requests for up to 15 seconds, then exits cleanly.

### Health Checks

- **`/health`** — Liveness probe. Returns `200 OK` if the process is running.
- **`/readyz`** — Readiness probe. Validates repos directory, `ripgrep`, and `git` availability. In bridge mode, also verifies the VS Code bridge is reachable.

### Config Validation

On startup (non-bridge modes), the server validates that critical paths exist (repos dir, guidelines dir, prompts dir) and that required binaries (`rg`, `git`) are on `$PATH`. Warnings are logged for any issues.

### Version Endpoint

`GET /api/version` returns build metadata injected at compile time via ldflags:

```json
{"version": "1.0.0", "commit": "abc1234", "buildTime": "2025-01-15T10:00:00Z"}
```

The `Makefile` and `Dockerfile` both inject `version`, `commitSHA`, and `buildTime` automatically.

### Prometheus Metrics

`GET /metrics` returns Prometheus-compatible metrics in text exposition format (no external dependencies). Tracked metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `uems_uptime_seconds` | Gauge | Server uptime |
| `uems_http_requests_total` | Counter | HTTP requests by method + status |
| `uems_http_request_duration_ms_total` | Counter | Cumulative request duration |
| `uems_tool_invocations_total` | Counter | Tool calls by tool name |
| `uems_tool_duration_ms_total` | Counter | Cumulative tool execution time |

### Rate Limiting

Per-IP token-bucket rate limiting is applied to all endpoints:

| Scope | Rate | Burst | Purpose |
|-------|------|-------|---------|
| Global | 10 req/s | 30 | General API protection |
| Auth (`/auth/*`) | 2 req/s | 5 | Brute-force prevention |

Excess requests receive `429 Too Many Requests` with a `Retry-After: 1` header. Stale IP entries are reaped every 5 minutes.

### Request Cancellation

Tool invocations respect a configurable timeout (`-tool-timeout`, default 120s). If the HTTP client disconnects, the tool's context is cancelled immediately.

### Tool Definitions (Dynamic)

Tool definitions are fetched from the MCP server at startup (not hardcoded). This ensures the REST API (`GET /api/tools`) always matches the registered MCP tools. Definitions are cached after first fetch.

### Token-Counting Context Compaction

The frontend estimates token usage (~1 token per 4 chars + overhead) and proactively trims oldest tool call/result pairs when context approaches the configurable limit (`-context-token-limit`, default 120K). Up to 5 compaction rounds are attempted before stopping.

### Bridge Mode Error Recovery

In bridge mode, the frontend automatically retries failed requests with exponential backoff (1s → 2s → 4s), up to 3 retries, for network errors and 502/503/504 responses.

### Conversation Export

Users can export the current conversation from the user menu:

- **Markdown** — Structured `.md` with tool call details in collapsible `<details>` blocks.
- **JSON** — Full conversation data including metadata and timestamps.

### Smart Suggestions (Empty State)

When starting a new chat, the greeting screen shows clickable suggestion chips with common read-only queries (search repos, dependency graph, list components, validate tag). Clicking a chip auto-sends the prompt.

### TLS Support

The server supports TLS in three ways:

| Option | Flag | Description |
|--------|------|-------------|
| Certificate files | `-tls-cert` + `-tls-key` | Use existing cert/key pair |
| Self-signed | `-tls-self-signed` | Auto-generate ECDSA cert on startup |
| Auto (default) | (no flags) | Falls back to self-signed cert |

When TLS is active, session cookies are set with the `Secure` flag.

**Using your own certificate with `setup.sh`:**

```bash
# Via CLI flags
./setup.sh --tls-cert /path/to/cert.pem --tls-key /path/to/key.pem

# Via environment variables
export UEMS_TLS_CERT=/path/to/cert.pem
export UEMS_TLS_KEY=/path/to/key.pem
./setup.sh
```

## Project Structure

```
backend/
  server/main.go         — Entry point, HTTP/stdio/bridge routing, graceful shutdown, health checks
  handlers/
    copilot.go           — GitHub Device Flow auth + Copilot API reverse proxy
    chat.go              — Tool listing (GET /api/tools) and invocation (POST /api/tool)
    metrics.go           — Prometheus-compatible metrics endpoint
    ratelimit.go         — Per-IP token-bucket rate limiter middleware
  tools/
    registry.go          — Shared types, helpers, RegisterAll()
    search-repos.go      — uems_agent_search_repos
    list-components.go   — uems_agent_list_components
    find-wrapper.go      — uems_agent_find_wrapper
    dependency-graph.go  — uems_agent_dependency_graph
    validate-tag.go      — uems_agent_validate_tag
    create-branch.go     — uems_agent_create_branch
    setup-workspace.go   — uems_agent_setup_workspace
    load-guidelines.go   — uems_agent_load_guidelines
frontend/
  index.html             — SPA shell (CDN deps: marked, highlight.js, DOMPurify)
  app.js                 — Chat UI, tool loop, auth flow, bridge mode, export
  style.css              — Dark/light theme, responsive layout
openapi.yaml             — OpenAPI 3.0.3 spec for all REST endpoints
BRIDGE_MODE.md           — Bridge mode deployment guide
Makefile                 — Build, run, version injection
Dockerfile               — Multi-stage container build
```
