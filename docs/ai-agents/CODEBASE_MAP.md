<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Codebase Map

> 🎯 **Audience:** AI agents
> **Scope:** All projects
> **Skip if:** You already know the exact file paths for your task.

Task-oriented lookup table mapping actions to file locations across the uems-ai-toolkit repo.

---

## Agent & Skill Operations

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Add a new AI agent | `agents/<category>/agents/uems-agent-<name>.agent.md` | Content |
| Modify the orchestrator agent | `agents/orchestrator/agents/uems-agent-orchestrator.agent.md` | Content |
| Modify a sub-agent (planner, architect, developer, reviewer) | `agents/orchestrator/agents/uems-agent-<name>.agent.md` | Content |
| Modify the explorer agent | `agents/orchestrator/agents/uems-agent-explorer.agent.md` | Content |
| Modify the QA agent | `agents/orchestrator/agents/uems-agent-qa.agent.md` | Content |
| Modify the delta reviewer agent | `agents/delta-reviewer/uems-agent-delta-reviewer.agent.md` | Content |
| Modify the document generator agent | `agents/document-generator/uems-agent-document-generator.agent.md` | Content |
| Add a new skill | `skills/<name>/SKILL.md` + register in `source/uems-agent-chat/package.json` (`chatSkills`) | Content |
| Modify an existing skill | `skills/<name>/SKILL.md` | Content |
| Add/modify doc-generation standards | `agents/document-generator/doc-standards/*.md` | Content |

## Guideline Operations

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Add/modify cross-platform guidelines | `guidelines/common/<file>.md` | Content |
| Add/modify macOS coding standards | `guidelines/mac/coding-standards.md` | Content |
| Add/modify Linux coding standards | `guidelines/linux/coding-standards.md` | Content |
| Add/modify Windows coding standards | `guidelines/windows/coding-standards.md` | Content |
| Add/modify platform security rules | `guidelines/<platform>/platform-security.md` | Content |
| Add/modify repo maps | `guidelines/<platform>/repo-map.md` | Content |
| Modify grounding rules | `guidelines/common/grounding-rules.md` | Content |
| Modify engineering checklist | `guidelines/common/engineering-checklist.md` | Content |

## VS Code Extension — Agent Registration & Chat

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Register a new chat participant | `source/uems-agent-chat/src/extension.ts` | uems-agent-chat |
| Change agent prompt loading | `source/uems-agent-chat/src/extension.ts` → `loadAgentPrompt()` | uems-agent-chat |
| Register a new chat agent in package.json | `source/uems-agent-chat/package.json` → `chatAgents` | uems-agent-chat |
| Register a new chat skill in package.json | `source/uems-agent-chat/package.json` → `chatSkills` | uems-agent-chat |
| Modify tool-calling loop | `source/uems-agent-chat/src/orchestrator.ts` → `runToolLoop()` | uems-agent-chat |
| Change which tools are available to agents | `source/uems-agent-chat/src/orchestrator.ts` → `UEMS_TOOL_IDS`, `EXPLORER_TOOL_IDS`, `BRIDGE_TOOL_IDS` | uems-agent-chat |
| Modify model selection | `source/uems-agent-chat/src/orchestrator.ts` → `selectModel()` | uems-agent-chat |

## VS Code Extension — LM Tools

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Add a new LM tool | `source/uems-agent-chat/src/tools/<name>.ts` + register in `tools/index.ts` | uems-agent-chat |
| Modify search across repos | `source/uems-agent-chat/src/tools/search-repos.ts` | uems-agent-chat |
| Modify component listing | `source/uems-agent-chat/src/tools/list-components.ts` | uems-agent-chat |
| Modify wrapper lookup | `source/uems-agent-chat/src/tools/find-wrapper.ts` | uems-agent-chat |
| Modify dependency graph | `source/uems-agent-chat/src/tools/dependency-graph.ts` | uems-agent-chat |
| Modify branch validation/creation | `source/uems-agent-chat/src/tools/validate-tag.ts`, `create-branch.ts` | uems-agent-chat |
| Modify diff tool | `source/uems-agent-chat/src/tools/diff-branches.ts` | uems-agent-chat |
| Modify guideline loading | `source/uems-agent-chat/src/tools/load-guidelines.ts` | uems-agent-chat |
| Modify skill loading | `source/uems-agent-chat/src/tools/load-skills.ts` | uems-agent-chat |
| Modify workspace setup tool | `source/uems-agent-chat/src/tools/setup-workspace.ts` | uems-agent-chat |
| Modify tool helper utilities | `source/uems-agent-chat/src/tools/helpers.ts` | uems-agent-chat |

## VS Code Extension — Sync, Update & Bridge

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Modify git sync (how agents are fetched) | `source/uems-agent-chat/src/sync.ts` | uems-agent-chat |
| Modify extension self-update | `source/uems-agent-chat/src/updater.ts` | uems-agent-chat |
| Modify HTTP bridge endpoints | `source/uems-agent-chat/src/http-bridge.ts` | uems-agent-chat |
| Change bridge session management | `source/uems-agent-chat/src/http-bridge.ts` → `Session` interface | uems-agent-chat |

## VS Code Extension — Core Utilities

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Modify repo registry / metadata | `source/uems-agent-chat/src/core/repo-registry.ts` | uems-agent-chat |
| Modify search engine (rg/grep) | `source/uems-agent-chat/src/core/search-engine.ts` | uems-agent-chat |
| Modify git operations | `source/uems-agent-chat/src/core/git-ops.ts` | uems-agent-chat |

## Go Web Server — Handlers

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Modify Copilot API proxy | `source/uems-agent-web/backend/handlers/copilot.go` | uems-agent-web |
| Modify tool/chat REST endpoints | `source/uems-agent-web/backend/handlers/chat.go` | uems-agent-web |
| Modify Prometheus metrics | `source/uems-agent-web/backend/handlers/metrics.go` | uems-agent-web |
| Modify rate limiting | `source/uems-agent-web/backend/handlers/ratelimit.go` | uems-agent-web |
| Modify Zoho OAuth auth | `source/uems-agent-web/backend/handlers/zoho_auth.go` | uems-agent-web |
| Modify system prompt building | `source/uems-agent-web/backend/handlers/copilot.go` → `buildSystemPrompt()` | uems-agent-web |

## Go Web Server — MCP Tools

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Add a new MCP tool | `source/uems-agent-web/backend/tools/<name>.go` + register in `registry.go` | uems-agent-web |
| Modify tool registry | `source/uems-agent-web/backend/tools/registry.go` | uems-agent-web |
| Modify search repos tool | `source/uems-agent-web/backend/tools/search-repos.go` | uems-agent-web |
| Modify list components tool | `source/uems-agent-web/backend/tools/list-components.go` | uems-agent-web |
| Modify dependency graph tool | `source/uems-agent-web/backend/tools/dependency-graph.go` | uems-agent-web |

## Go Web Server — Config & Startup

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Modify server startup / routing | `source/uems-agent-web/backend/server/main.go` | uems-agent-web |
| Change server configuration flags | `source/uems-agent-web/backend/server/main.go` → `ServerConfig` struct | uems-agent-web |
| Modify Makefile / build | `source/uems-agent-web/Makefile` | uems-agent-web |
| Modify setup script | `source/uems-agent-web/setup.sh` | uems-agent-web |
| Modify Docker deployment | `source/uems-agent-web/Dockerfile` | uems-agent-web |
| Modify OpenAPI spec | `source/uems-agent-web/openapi.yaml` | uems-agent-web |

## Go Web Server — Frontend

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Modify web UI | `source/uems-agent-web/frontend/` | uems-agent-web |
| Modify home page | `source/uems-agent-web/frontend/index.html` | uems-agent-web |
| Modify chat explorer UI | `source/uems-agent-web/frontend/explorer/` | uems-agent-web |
| Modify frontend JavaScript | `source/uems-agent-web/frontend/js/` | uems-agent-web |

## Shared Data

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Add a repo to the registry | `source/common/repos.json` | Shared |
| Check repo metadata (URL, platform, deps) | `source/common/repos.json` | Shared |

## Build & Release

| I want to... | Look in... | Project |
|--------------|-----------|---------|
| Build the VS Code extension | `source/uems-agent-chat/package.json` → `scripts` | uems-agent-chat |
| Configure esbuild | `source/uems-agent-chat/esbuild.js` | uems-agent-chat |
| Configure ESLint | `source/uems-agent-chat/eslint.config.mjs` | uems-agent-chat |
| Configure TypeScript | `source/uems-agent-chat/tsconfig.json` | uems-agent-chat |
| Release the extension | `source/uems-agent-chat/releases/latest.json` | uems-agent-chat |
| Build the Go server | `source/uems-agent-web/Makefile` | uems-agent-web |

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Domain term definitions | [`GLOSSARY.md`](GLOSSARY.md) |
| How to build and test | [`BUILD_GUIDE.md`](BUILD_GUIDE.md) |
| Common task walkthroughs | [`AGENT_GUIDE.md`](AGENT_GUIDE.md) |
| uems-agent-chat architecture | [`uems-agent-chat/ARCHITECTURE.md`](../architecture/uems-agent-chat/ARCHITECTURE.md) |
| uems-agent-web architecture | [`uems-agent-web/ARCHITECTURE.md`](../architecture/uems-agent-web/ARCHITECTURE.md) |

---

*Last Updated: 2026-04-08*
