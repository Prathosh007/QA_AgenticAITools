<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: uems-agent-chat -->
<!-- last-updated: 2026-04-08 -->

# Architecture — uems-agent-chat

> 🎯 **Audience:** AI agents
> **Scope:** uems-agent-chat project
> **Skip if:** Working on uems-agent-web — read its own ARCHITECTURE.md instead.

Full architecture for the UEMS Agent Chat VS Code extension — an extension that registers AI agents, language model tools, and an HTTP bridge into GitHub Copilot Chat.

---

## Project Overview

| Property | Value |
|----------|-------|
| **Purpose** | Deliver 9 AI agents + 10 LM tools into VS Code Copilot Chat for UEMS native agent development |
| **Directory** | `source/uems-agent-chat/` |
| **Language** | TypeScript |
| **Build** | esbuild → `dist/extension.js` |
| **Entry point** | `src/extension.ts` → `activate()` |
| **NOT responsible for** | Direct Copilot API calls (that's uems-agent-web), native code compilation, repo hosting |

## Module Table

| Directory/File | Language | Responsibility |
|----------------|----------|----------------|
| `src/extension.ts` | TypeScript | Extension activation, chat participant registration, startup lifecycle |
| `src/orchestrator.ts` | TypeScript | Tool-calling loop, model selection, tool set constants |
| `src/http-bridge.ts` | TypeScript | HTTP/SSE server exposing orchestrator to external frontends |
| `src/sync.ts` | TypeScript | Git sparse-checkout agent sync from remote repo |
| `src/updater.ts` | TypeScript | Extension self-update via `latest.json` version manifest |
| `src/core/repo-registry.ts` | TypeScript | Load and cache `repos.json` metadata |
| `src/core/search-engine.ts` | TypeScript | Multi-repo search using ripgrep/grep/findstr |
| `src/core/git-ops.ts` | TypeScript | Git clone/fetch operations |
| `src/tools/index.ts` | TypeScript | Tool registration barrel — `registerUemsTools()` |
| `src/tools/*.ts` | TypeScript | Individual LM tool implementations (10 tools) |
| `assets/agents/*.agent.md` | Markdown | Agent definition files (synced from `agents/`) |
| `assets/skills/*/SKILL.md` | Markdown | Skill files (synced from `skills/`) |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │extension │───→│ orchestrator │───→│  LM Tools (10)   │  │
│  │  .ts     │    │    .ts       │    │  src/tools/*.ts   │  │
│  │          │    │ runToolLoop()│    └────────┬─────────┘  │
│  │activate()│    │ selectModel()│             │             │
│  └────┬─────┘    └──────┬───────┘    ┌───────▼──────────┐  │
│       │                 │            │  Core Utilities   │  │
│       │                 │            │  repo-registry.ts │  │
│       │                 │            │  search-engine.ts │  │
│       │                 │            │  git-ops.ts       │  │
│  ┌────▼─────┐    ┌──────▼───────┐   └──────────────────┘  │
│  │ sync.ts  │    │http-bridge.ts│                           │
│  │ Git sync │    │ HTTP/SSE     │←── uems-agent-web         │
│  └────┬─────┘    │ port 3111    │    (bridge mode)          │
│       │          └──────────────┘                           │
│       ▼                                                     │
│  ┌──────────┐                                               │
│  │updater.ts│                                               │
│  │Self-update│                                              │
│  └──────────┘                                               │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ Git sparse checkout
┌───────────────────┐
│ uems-ai-toolkit   │
│ (remote repo)     │
│ agents/           │
│ guidelines/       │
│ skills/           │
│ releases/         │
└───────────────────┘
```

## Data Flow — Chat Request

| Step | Component | Action |
|------|-----------|--------|
| 1 | Copilot Chat UI | User selects agent + types message |
| 2 | `extension.ts` | `orchestratorHandler` receives `ChatRequest` |
| 3 | `extension.ts` | Loads agent system prompt from `assets/agents/` |
| 4 | `extension.ts` | Builds message history from `ctx.history` |
| 5 | `orchestrator.ts` | `runToolLoop()` sends messages to LLM |
| 6 | `orchestrator.ts` | LLM returns tool calls → invoke tools → feed results back |
| 7 | `orchestrator.ts` | Repeats until no more tool calls (max rounds) |
| 8 | Copilot Chat UI | Streamed response displayed |

## Entry Points

| Entry Point | Function | When |
|-------------|----------|------|
| `activate()` | `extension.ts` | Extension loads in VS Code |
| `orchestratorHandler` | `extension.ts` | User sends message in Copilot Chat |
| `HttpBridge.handleRequest()` | `http-bridge.ts` | External frontend sends HTTP request |

## Component Descriptions

### Extension Activation (`extension.ts`)
Initializes the sync manager, ensures agent files exist (syncs on first install), registers the chat participant, registers all 10 LM tools, initializes the repo registry, starts the HTTP bridge if configured, sets up periodic sync and self-update checks.

### Orchestrator (`orchestrator.ts`)
Single source of truth for the tool-calling loop. `runToolLoop()` sends messages to the LLM, receives responses, detects tool calls, invokes them via `vscode.lm.invokeTool()`, appends results, and continues. Used by both the chat participant and the HTTP bridge. Defines tool ID sets (`UEMS_TOOL_IDS`, `EXPLORER_TOOL_IDS`, `BRIDGE_TOOL_IDS`) that control which tools each agent sees.

### HTTP Bridge (`http-bridge.ts`)
Standalone HTTP/SSE server (default port 3111) that exposes the orchestrator to external frontends. Endpoints: `POST /chat` (streamed orchestration), `GET /api/tools` (tool definitions), `POST /api/tool` (single tool invocation), `GET /health`, `DELETE /chat/:id` (session cleanup). Maintains server-side session state (message history, model reference). Sessions expire after 30 minutes.

### Sync Manager (`sync.ts`)
Git sparse-checkout that pulls agent definitions, skills, guidelines, and releases from the remote repo's `master` branch. Copies agent/skill files into `assets/` for `chatAgents`/`chatSkills` registration. Supports dev mode (uses local workspace instead of remote sync). Cooldown-based to avoid excessive sync operations.

### Extension Updater (`updater.ts`)
Reads `releases/latest.json` from the synced clone, compares semver with installed version, copies newer VSIX from the clone, installs via `code --install-extension`, and prompts to reload.

### Repo Registry (`core/repo-registry.ts`)
Loads `source/common/repos.json` at runtime. Provides `getRepos()` and `getReposForPlatform()` functions. Caches platform-indexed repo records. Supports the search, dependency graph, and workspace setup tools.

### Search Engine (`core/search-engine.ts`)
Multi-repo search using ripgrep (preferred), grep (fallback on macOS/Linux), or findstr (fallback on Windows). Returns structured `SearchMatch` records with repo, file, line, column, text, and context.

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| `vscode` | VS Code API | Extension host, LM API, Chat API |
| `esbuild` | Dev dependency | TypeScript bundling |
| `@vscode/vsce` | Dev dependency | VSIX packaging |
| Git CLI | Runtime | Sparse checkout, sync |
| ripgrep (`rg`) | Runtime (optional) | Fast multi-repo search |

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `syncIntervalHours` | number | 24 | Hours between auto-syncs |
| `autoSync` | boolean | true | Enable periodic sync |
| `autoUpdate` | boolean | true | Enable self-update |
| `devMode` | boolean | false | Use local workspace instead of remote sync |
| `devRepoPath` | string | "" | Path to local repo (auto-detected if empty) |
| `httpBridge.enabled` | boolean | false | Start HTTP bridge server |
| `httpBridge.port` | number | 3111 | HTTP bridge port |

## Known Issues / Gotchas

- Agent files must exist in `assets/agents/` before the chat participant registers — first-install triggers synchronous sync
- Dev mode requires the `uems-ai-toolkit` repo in the VS Code workspace
- HTTP bridge has no authentication — intended for local use only
- Tool invocation errors are caught and returned as text — they don't crash the tool loop

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
