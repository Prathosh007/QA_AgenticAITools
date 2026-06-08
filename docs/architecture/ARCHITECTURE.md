<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Architecture — Repo-Level Overview

> 🎯 **Audience:** AI agents
> **Scope:** All projects
> **Skip if:** You're working on a single project — read that project's ARCHITECTURE.md instead.

Repo-level project inventory, inter-project dependencies, and shared infrastructure for the uems-ai-toolkit monorepo.

---

## Project Inventory

| Project | Directory | Language | Type | Purpose |
|---------|-----------|----------|------|---------|
| uems-agent-chat | `source/uems-agent-chat/` | TypeScript | VS Code extension | Registers 9 AI agents + 10 LM tools into Copilot Chat; git-based sync, self-update, HTTP bridge |
| uems-agent-web | `source/uems-agent-web/` | Go | Web server | Standalone chat UI: GitHub Device Flow auth, Copilot API proxy, MCP tools, Prometheus metrics |

## Inter-Project Dependencies

| Consumer | Depends On | Via | Notes |
|----------|-----------|-----|-------|
| uems-agent-web (bridge mode) | uems-agent-chat | HTTP Bridge (port 3111) | Web server proxies chat/tool calls to VS Code extension's HTTP bridge |
| uems-agent-chat | Content directories | Git sparse checkout | Extension syncs agents/, guidelines/, skills/ from this repo |
| uems-agent-web | Content directories | File system paths | Server reads agents/, guidelines/, skills/ via `-guidelines`, `-prompts`, `-skills` flags |
| Both projects | `source/common/repos.json` | File read | Registry of 38 UEMS native agent repositories |

## Shared Infrastructure

| Component | Directory | Used By | See |
|-----------|-----------|---------|-----|
| Agent definitions | `agents/` | Both projects | Loaded as system prompts |
| Engineering guidelines | `guidelines/` | Both projects | Loaded by `uems_agent_load_guidelines` tool |
| Reusable skills | `skills/` | Both projects | Loaded by `uems_agent_load_skills` tool |
| Repo metadata | `source/common/repos.json` | Both projects | 38 repos with URL, platform, layer, dependencies |
| Doc-generation standards | `agents/document-generator/doc-standards/` | Document Generator agent | Blueprint, format, behavior rules |

## Content Flow

```
agents/             ─┐
guidelines/          ├── git sync ──→ uems-agent-chat (VS Code)
skills/              │                     │
source/common/       ┘                     │ HTTP Bridge
                                           ▼
agents/             ─┐               uems-agent-web (Go)
guidelines/          ├── file paths ─→     │
skills/              │                     │ serves
source/common/       ┘                     ▼
                                    Browser chat UI
```

## Tool Parity

Both projects implement the same 10 tools with equivalent behavior:

| Tool ID | TS File | Go File |
|---------|---------|---------|
| `uems_agent_search_repos` | `tools/search-repos.ts` | `tools/search-repos.go` |
| `uems_agent_list_components` | `tools/list-components.ts` | `tools/list-components.go` |
| `uems_agent_find_wrapper` | `tools/find-wrapper.ts` | `tools/find-wrapper.go` |
| `uems_agent_dependency_graph` | `tools/dependency-graph.ts` | `tools/dependency-graph.go` |
| `uems_agent_validate_tag` | `tools/validate-tag.ts` | `tools/validate-tag.go` |
| `uems_agent_create_branch` | `tools/create-branch.ts` | `tools/create-branch.go` |
| `uems_agent_setup_workspace` | `tools/setup-workspace.ts` | `tools/setup-workspace.go` |
| `uems_agent_load_guidelines` | `tools/load-guidelines.ts` | `tools/load-guidelines.go` |
| `uems_agent_load_skills` | `tools/load-skills.ts` | `tools/load-skills.go` |
| `uems_agent_diff_branches` | `tools/diff-branches.ts` | — (VS Code only) |

## Agent Inventory

9 agents registered in the VS Code extension:

| Agent | File | User-Invocable | Tool Set |
|-------|------|:-:|-----------|
| Orchestrator | `uems-agent-orchestrator.agent.md` | Yes | `UEMS_TOOL_IDS` (all 10) |
| Planner | `uems-agent-planner.agent.md` | No | Orchestrator delegates |
| Architect | `uems-agent-architect.agent.md` | No | Orchestrator delegates |
| Developer | `uems-agent-developer.agent.md` | No | Orchestrator delegates |
| Reviewer | `uems-agent-reviewer.agent.md` | No | Orchestrator delegates |
| QA | `uems-agent-qa.agent.md` | Yes | Orchestrator delegates |
| Explorer | `uems-agent-explorer.agent.md` | Yes | `EXPLORER_TOOL_IDS` (6 read-only) |
| Delta Reviewer | `uems-agent-delta-reviewer.agent.md` | Yes | `UEMS_TOOL_IDS` (all 10) |
| Document Generator | `uems-agent-document-generator.agent.md` | Yes | VS Code built-in tools |

---

## Per-Project Architecture

| Project | Architecture Doc | Workflows Doc |
|---------|-----------------|---------------|
| uems-agent-chat | [`uems-agent-chat/ARCHITECTURE.md`](uems-agent-chat/ARCHITECTURE.md) | [`uems-agent-chat/WORKFLOWS.md`](uems-agent-chat/WORKFLOWS.md) |
| uems-agent-web | [`uems-agent-web/ARCHITECTURE.md`](uems-agent-web/ARCHITECTURE.md) | [`uems-agent-web/WORKFLOWS.md`](uems-agent-web/WORKFLOWS.md) |

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](../ai-agents/CODEBASE_MAP.md) |
| Domain term definitions | [`GLOSSARY.md`](../ai-agents/GLOSSARY.md) |
| How to build and test | [`BUILD_GUIDE.md`](../ai-agents/BUILD_GUIDE.md) |
| uems-agent-chat deep-dive | [`uems-agent-chat/ARCHITECTURE.md`](uems-agent-chat/ARCHITECTURE.md) |
| uems-agent-web deep-dive | [`uems-agent-web/ARCHITECTURE.md`](uems-agent-web/ARCHITECTURE.md) |

---

*Last Updated: 2026-04-08*
