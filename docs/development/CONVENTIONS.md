<!-- audience: both -->
<!-- doc-type: reference -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Coding Conventions

> 🎯 **Audience:** AI agents and developers
> **Scope:** All projects
> **Skip if:** You already know the naming and style rules for the target language.

Per-language coding conventions for the uems-ai-toolkit repository.

---

## TypeScript (uems-agent-chat)

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Classes | `PascalCase` | `SearchReposTool`, `AgentSyncManager` |
| Interfaces | `PascalCase` | `SearchMatch`, `OrchestratorCallbacks` |
| Functions/methods | `camelCase` | `runToolLoop()`, `loadAgentPrompt()` |
| Variables | `camelCase` | `syncManager`, `outputChannel` |
| Constants | `SCREAMING_SNAKE_CASE` | `UEMS_TOOL_IDS`, `SESSION_TTL_MS` |
| File names | `kebab-case.ts` | `search-repos.ts`, `http-bridge.ts` |

### Exports & Modules

- Named exports only — no default exports
- Barrel files via `index.ts` for tool registration
- One class per file in `tools/`

### Async

- `async/await` throughout — no raw Promise chains
- `promisify` for Node.js callback APIs (e.g., `execFile`)
- Check `CancellationToken` in tool loops

### Error Handling

- `try/catch` with typed error extraction: `err instanceof Error ? err.message : String(err)`
- Log errors to `outputChannel` — never to console in production
- Return error info in tool results — don't throw from tool `invoke()`

### VS Code API Patterns

- Register disposables via `context.subscriptions.push()`
- Use `vscode.workspace.getConfiguration()` for settings
- Use `vscode.lm.registerTool()` for LM tool registration
- Use `vscode.chat.createChatParticipant()` for chat participants

---

## Go (uems-agent-web)

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Exported types/functions | `PascalCase` | `HandleToolInvoke`, `RegisterAll` |
| Unexported types/functions | `camelCase` | `invokeTool`, `getOrCreateHTTPMetric` |
| Package names | lowercase, single word | `handlers`, `tools`, `server` |
| File names | `kebab-case.go` | `search-repos.go`, `zoho_auth.go` |
| Constants | `PascalCase` (exported) / `camelCase` (unexported) | `GitHubDeviceCodeURL`, `toolTimeout` |

### Package Structure

```
backend/
├── server/      # Entry point, config, routing
├── handlers/    # HTTP handlers (auth, chat, metrics, rate limiting)
└── tools/       # MCP tool implementations + registry
```

One package per directory. No nested sub-packages.

### Errors

- Return `error` as the last return value
- Wrap with context: `fmt.Errorf("reading repos.json: %w", err)`
- Check errors immediately — no deferred error checks
- Use `slog.Error()` for error logging

### Logging

- Use `slog` structured JSON logging — not `log.Printf()`
- Include context fields: `slog.Info("tool completed", "tool", req.Name, "duration_ms", elapsed)`
- Log levels: `slog.Info` for operations, `slog.Error` for failures, `slog.Warn` for degraded behavior

### HTTP

- Router: `chi/v5` — `r.Post("/api/tool", handlers.HandleToolInvoke)`
- Middleware chain: rate limiting → metrics → handler
- Set `Content-Type` headers explicitly
- Use `json.NewEncoder(w).Encode()` for JSON responses
- Use `context.WithTimeout()` for tool invocation deadlines

### Configuration

- CLI flags via `flag.StringVar()` / `flag.IntVar()`
- Environment variable fallbacks via `envOr()` / `envOrInt()` / `envOrFloat()`
- All config in `ServerConfig` struct — no global flags

### MCP Tools

- Each tool in its own file: `tools/<name>.go`
- Register via `registerXxxTool(s *mcp.Server)` function
- Call from `RegisterAll()` in `registry.go`
- Use `mcp.Tool{}` struct for definition, function handler for implementation

---

## Markdown (Agents, Skills, Guidelines)

### Agent Files (`.agent.md`)

- YAML frontmatter: `name`, `description`, `tools` (list of tool IDs)
- System prompt in Markdown after the frontmatter fence
- One file per agent

### Skill Files (`SKILL.md`)

- YAML frontmatter: `name`, `description`, `user-invocable: false`
- Procedure in Markdown
- One file per skill in `skills/<name>/SKILL.md`

### Guideline Files

- Plain Markdown — no frontmatter
- Organized by platform: `guidelines/common/`, `guidelines/mac/`, etc.

---

## General Rules

| Rule | Details |
|------|---------|
| No hardcoded secrets | Use Device Flow, VS Code SecretStorage, or environment variables |
| No `console.log` in TS production | Use `outputChannel.appendLine()` |
| No `log.Printf` in Go | Use `slog.Info()`, `slog.Error()`, etc. |
| Tool parity | Every LM tool in TS must have a Go MCP equivalent and vice versa |
| Register everything | Tools in `tools/index.ts` (TS) and `tools/registry.go` (Go) |

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](../ai-agents/CODEBASE_MAP.md) |
| How to build and test | [`BUILD_GUIDE.md`](../ai-agents/BUILD_GUIDE.md) |
| Common task walkthroughs | [`AGENT_GUIDE.md`](../ai-agents/AGENT_GUIDE.md) |

---

*Last Updated: 2026-04-08*
