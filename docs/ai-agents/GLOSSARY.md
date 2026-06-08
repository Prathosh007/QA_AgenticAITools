<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Glossary

> 🎯 **Audience:** AI agents
> **Scope:** All projects
> **Skip if:** You already know all terms used in the entry point and architecture docs.

Term definitions for the uems-ai-toolkit repository — domain concepts, tools, protocols, and platform terms.

---

## Core Concepts

| Term | Definition |
|------|-----------|
| **Agent** | An AI persona defined in a `.agent.md` file with YAML frontmatter (name, description, tools) and a Markdown system prompt. Loaded by the VS Code extension via `chatAgents` in `package.json`. |
| **Skill** | A reusable procedure stored as `skills/<name>/SKILL.md` with YAML frontmatter. Loaded on-demand by agents via the `uems_agent_load_skills` LM tool. Not user-invocable — agent-only. |
| **Guideline** | An engineering standard document (coding standards, security rules, repo maps, grounding rules) stored in `guidelines/<platform>/`. Loaded by agents via the `uems_agent_load_guidelines` LM tool. |
| **Orchestrator** | The top-level SDLC agent (`uems-agent-orchestrator.agent.md`) that assesses task complexity and delegates to sub-agents in a pipeline: Planner → Architect → Developer → Reviewer → QA. |
| **Sub-Agent** | An agent called internally by the Orchestrator — not directly user-invocable. Includes Planner, Architect, Developer, and Reviewer. |
| **Explorer** | A read-only chat participant for codebase exploration — architecture analysis, dependency tracing, code search. User-invocable. |
| **Delta Reviewer** | A standalone agent that fetches branch diffs and produces structured code review reports. User-invocable. |
| **Document Generator** | An agent that creates, updates, and audits AI-navigable documentation for native repos. User-invocable. |

## Tool Concepts

| Term | Definition |
|------|-----------|
| **LM Tool** | A VS Code Language Model tool registered via `vscode.lm.registerTool()`. Agents invoke these during the tool-calling loop. Each tool has a TypeScript implementation in `src/tools/` and a Go equivalent in `backend/tools/`. |
| **MCP** | Model Context Protocol — the standard used by uems-agent-web for tool registration and invocation. Tools are registered on an `mcp.Server` and invoked via in-memory MCP transports. |
| **MCP Tool** | A Go implementation of a tool registered with the MCP server in `tools/registry.go`. Equivalent to an LM tool but runs server-side. |
| **Tool Loop** | The `runToolLoop()` function in `orchestrator.ts` that sends messages to the LLM, receives tool calls, invokes tools, feeds results back, and repeats until the model has no more tool calls. |
| **Tool Filter** | A `Set<string>` of tool IDs that controls which tools are available to a given agent. Different agents get different subsets: `UEMS_TOOL_IDS`, `EXPLORER_TOOL_IDS`, `BRIDGE_TOOL_IDS`. |

## Infrastructure Concepts

| Term | Definition |
|------|-----------|
| **HTTP Bridge** | An HTTP/SSE server started within the VS Code extension (`http-bridge.ts`) on port 3111 (configurable). Exposes the orchestrator's tool loop to external frontends so the web server can proxy through VS Code's LM API. |
| **SSE** | Server-Sent Events — the streaming mechanism used by both the HTTP bridge and the Go web server to deliver incremental chat responses to frontends. |
| **Sync** | Git sparse-checkout mechanism in `sync.ts` that pulls agent definitions, skills, and guidelines from the remote `uems-ai-toolkit` repo's `master` branch into VS Code extension assets. Runs on activation and periodically (default: every 24 hours). |
| **Dev Mode** | Extension setting (`devMode: true`) that uses the local uems-ai-toolkit workspace folder for agents/guidelines instead of syncing from remote. Enables feature-branch development. |
| **Self-Update** | Mechanism in `updater.ts` that checks `releases/latest.json` in the synced repo clone, compares semver with the installed version, and auto-installs newer VSIX files. |
| **repos.json** | Registry file at `source/common/repos.json` containing metadata for all 38 UEMS native agent repositories — git URL, platform, dependency layer, description, and deliverable status. |
| **Repo Registry** | TypeScript module (`core/repo-registry.ts`) that loads `repos.json` at runtime and provides `getRepos()` / `getReposForPlatform()` for LM tools. |

## Authentication & Authorization

| Term | Definition |
|------|-----------|
| **Device Flow** | GitHub OAuth Device Flow used by `uems-agent-web` for browser-based authentication. User visits a URL and enters a code; server polls GitHub for an access token. Implemented in `handlers/copilot.go`. |
| **Copilot Proxy** | Reverse proxy in `handlers/copilot.go` that forwards chat completion requests to the GitHub Copilot API, injecting required authentication headers (editor-version, plugin-version, API version). |
| **Zoho OAuth** | OAuth 2.0 flow via Zoho Accounts used for home-page access control. Restricts access to users with emails in the allowed domain. Implemented in `handlers/zoho_auth.go`. |

## Server Modes

| Term | Definition |
|------|-----------|
| **Standalone Mode** | Default mode of `uems-agent-web`. Fully standalone web server: GitHub Device Flow auth, Copilot API proxy, MCP tools, frontend serving. No VS Code dependency. |
| **Bridge Mode** | Server mode that proxies all chat and tool requests to a VS Code HTTP bridge instance. Requires `--bridge-url` flag. Uses VS Code's LLM APIs instead of direct Copilot API. |
| **Stdio Mode** | MCP over stdin/stdout mode for programmatic tool access. No HTTP server started. |

## Build & Release Terms

| Term | Definition |
|------|-----------|
| **esbuild** | JavaScript/TypeScript bundler used to compile the VS Code extension into `dist/extension.js`. Configured in `esbuild.js`. |
| **VSIX** | VS Code extension package format. Built via `npx @vscode/vsce package`. Distribution file placed in `releases/`. |
| **latest.json** | Version manifest in `source/uems-agent-chat/releases/` that contains the current version, VSIX filename, and changelog. Checked by the self-updater. |
| **ldflags** | Go linker flags used in the Makefile to inject `version`, `commitSHA`, and `buildTime` into the Go binary at build time. |

## Platform Terms

| Term | Definition |
|------|-----------|
| **UEMS** | Unified Endpoint Management & Security — the product suite this toolkit supports. |
| **Native Agent** | A native application (C, C++, C#, Objective-C, Swift, Go) that runs on a managed endpoint. This toolkit provides AI development tooling for 38 such agents across macOS, Linux, and Windows. |
| **Repo Map** | A guideline file (`guidelines/<platform>/repo-map.md`) that lists platform-specific repositories and their cross-repo change rules. |
| **Grounding Rules** | Mandatory anti-hallucination rules (in `guidelines/common/grounding-rules.md`) that all agents must follow. Five laws: read before claim, read before modify, cite source, say "I don't know", verify after act. |

## Metrics & Observability

| Term | Definition |
|------|-----------|
| **Prometheus Metrics** | Text exposition format metrics served at `/metrics` by `uems-agent-web`. Tracks `http_requests_total`, `http_request_duration_seconds`, and `tool_invocations_total`. Implemented in `handlers/metrics.go`. |
| **Rate Limiting** | Per-IP rate limiting middleware in `handlers/ratelimit.go`. Configurable global and auth-endpoint limits (RPS + burst). |

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](CODEBASE_MAP.md) |
| How to build and test | [`BUILD_GUIDE.md`](BUILD_GUIDE.md) |
| Common task walkthroughs | [`AGENT_GUIDE.md`](AGENT_GUIDE.md) |
| Repo-level architecture | [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) |

---

*Last Updated: 2026-04-08*
