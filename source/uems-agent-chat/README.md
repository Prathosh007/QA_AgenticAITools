# UEMS Agent for VS Code

A VS Code extension that provides **AI-powered SDLC tooling** for UEMS native multi-repo development. Registers chat agents, skills, and language model tools into GitHub Copilot Chat, enabling automated codebase navigation, dependency analysis, branch management, diff reviews, test generation, and workspace setup across 38 repositories.

> **New here?** See the **[Getting Started](getting-started.md)** guide for installation and first steps.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code + GitHub Copilot Chat                              │
│                                                             │
│  ┌───────────────────┐   ┌────────────────────────────────┐ │
│  │  Chat Agents (9)  │   │  Language Model Tools (10)    │ │
│  │  orchestrator     │   │  search_repos, list_components │ │
│  │  planner          │   │  find_wrapper, dependency_graph│ │
│  │  architect        │   │  validate_tag, create_branch   │ │
│  │  developer        │   │  setup_workspace, diff_branches│ │
│  │  reviewer         │   │  load_guidelines, load_skills  │ │
│  │  explorer         │   │  ┌──────────────────────────┐  │ │
│  │  qa               │   │  │  Core Modules            │  │ │
│  │  delta-reviewer   │   │  │  repo-registry (JSON)    │  │ │
│  │  document-gen     │   │  │  search-engine (rg/grep) │  │ │
│  └───────────────────┘   │  │  git-ops (git CLI)       │  │ │
│                          │  └──────────────────────────┘  │ │
│                          └────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  HTTP Bridge (optional)                                  │ │
│  │  POST /chat, GET /health, POST /api/tool, POST /suggest │ │
│  │  Exposes chat + tools via HTTP/SSE for external UIs      │ │
│  │  Pre-loads skills + guidelines into system prompt         │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Chat Agents

| Display Name | Description |
|---|---|
| **UEMS Agent Orchestrator** | Top-level SDLC controller — delegates to sub-agents for features, bugs, refactors |
| **UEMS Agent Planner** | Requirements analysis, cross-repo dependency research, risk assessment |
| **UEMS Agent Architect** | Architecture design, implementation planning with checklist compliance |
| **UEMS Agent Developer** | Production-ready native code implementation (Swift, Go, C/C++) |
| **UEMS Agent Reviewer** | Code review, security audit, and engineering checklist verification |
| **UEMS Agent Explorer** | Read-only codebase exploration — architecture analysis, dependency tracing, code search |
| **UEMS Agent QA** | Manual test case generation — structured 17-column CSV test matrices |
| **UEMS Agent Delta Reviewer** | Standalone diff-based code review — fetches branch diffs and produces structured reports |
| **UEMS Agent Document Generator** | AI-navigable documentation creation, updating, and auditing |

Agent definitions are fetched from git on activation and synced periodically — nothing is bundled.

---

## Skills (8)

Reusable procedures loaded on demand by agents via the `uems_agent_load_skills` tool. Registered in `package.json` via `chatSkills`.

| Skill | Purpose |
|---|---|
| `symbol-tracing` | Search → narrow read → wrapper check → bidirectional tracing |
| `tool-preference-rules` | UEMS tools vs generic tools hierarchy, Agent-Utils rules |
| `behavioral-change-analysis` | Default values, removed code, schema migration, interface contracts |
| `checkpoint-management` | Session checkpoint create/update/resume/delete lifecycle |
| `environment-setup-protocol` | Repo cloning, tag validation, branch creation, dependency discovery |
| `guideline-loading-protocol` | Adaptive guideline loading by task type with verification |
| `review-standards-reference` | Quality scoring formula, severity classification, approval criteria |
| `platform-confirmation-protocol` | Platform selection (mac/linux/windows) with session locking |

---

## Language Model Tools

Tools are registered via the VS Code `languageModelTools` API. The LLM discovers them automatically and calls them when relevant.

### Codebase Navigation

| Tool | Usage | Description |
|---|---|---|
| `#uems_agent_search_repos` | `#uems_agent_search_repos query:"NSXPCConnection" repos:["agent-utils"]` | Search for code patterns (text or regex) across multiple repos simultaneously. Returns file paths, line numbers, and matching text. |
| `#uems_agent_list_components` | `#uems_agent_list_components repo:"agent-utils" platform:"mac"` | List classes, protocols, structs, enums, functions, XPC services, or Go interfaces in a repo. Supports Swift, Objective-C, C, Go, and C++. |
| `#uems_agent_find_wrapper` | `#uems_agent_find_wrapper capability:"networking"` | Find Agent-Utils wrappers for a given capability (networking, file ops, logging, crypto, etc.). Always search here before using platform APIs directly. |
| `#uems_agent_dependency_graph` | `#uems_agent_dependency_graph repo:"agent-utils"` | Get the dependency graph for a repo or full platform. Shows upstream dependencies and downstream dependents organized by layer (0–4). |

### Diff & Review

| Tool | Usage | Description |
|---|---|---|
| `#uems_agent_diff_branches` | `#uems_agent_diff_branches repos:["agent-utils"] sourceBranch:"feature/my-feature" targetBranch:"master"` | Get the unified diff and per-file stats between two git branches across one or more repos. Returns changed file list, insertion/deletion counts, and the diff output. Used for delta code reviews. |

### Guidelines

| Tool | Usage | Description |
|---|---|---|
| `#uems_agent_load_guidelines` | `#uems_agent_load_guidelines platform:"mac" category:"common"` | Load engineering guidelines from synced storage. Supports categories: `common`, `platform`, `doc-standards`, `review-standards`, `all`. Returns file names and contents for the requested category. |

### Skills

| Tool | Usage | Description |
|---|---|---|
| `#uems_agent_load_skills` | `#uems_agent_load_skills files:["tool-preference-rules", "checkpoint-management"]` | Load reusable skill procedures (SKILL.md files) from the synced skills store. Pass specific skill names via `files` to load only what you need, or omit to load all skills. |

### Branch & Repo Management

| Tool | Usage | Description |
|---|---|---|
| `#uems_agent_validate_tag` | `#uems_agent_validate_tag repo:"agent-utils" tag:"AGENT_UTILS_26.05.01"` | Validate a git tag against the `PRODUCTNAME_YY.MM.BUILD` format and check if it exists. Returns suggestions for similar tags if not found. |
| `#uems_agent_create_branch` | `#uems_agent_create_branch repos:["agent-utils"] branchName:"feature/my-feature" fromRef:"AGENT_UTILS_26.05.01"` | Create a branch from a tag or base branch across one or more repos. Validates branch naming (`feature/`, `bugfix/`, `hotfix/`, `release/`) and tag format before creating. |
| `#uems_agent_setup_workspace` | `#uems_agent_setup_workspace platform:"mac"` | Clone or fetch multiple repos and verify workspace readiness. Reports clone/fetch status, current branch, and dirty state for each repo. |

### Tool Input/Output Flow

```
User asks question
    ↓
LLM reads modelDescription of all registered tools
    ↓
LLM decides which tool(s) to call
    ↓
LLM constructs JSON matching inputSchema
    ↓
VS Code calls tool's invoke() with that JSON
    ↓
Tool returns compact JSON (token-efficient)
    ↓
LLM reads the result and answers the user
```

### Platform Support

All tools work on **macOS, Linux, and Windows**:

| Component | macOS | Linux | Windows |
|---|---|---|---|
| Search engine | ripgrep → grep | ripgrep → grep | ripgrep → findstr |
| Component patterns | Swift, ObjC, C | Go, C, Python, Shell | C, C++, C# |
| Cross-platform | All of the above combined | | |
| Git operations | git CLI | git CLI | git CLI |
| Path handling | Forward slashes normalized | Forward slashes normalized | Backslashes → forward slashes |

---

## Core Modules

### `src/core/repo-registry.ts`

Repository metadata registry. Loads data from `src/data/repos.json` — the single source of truth for all repo URLs, dependency layers, and cross-repo impact.

**Key functions:**
- `getRepos(platform)` — all repos for a platform
- `getRepo(name, platform)` — lookup by name (case-insensitive, hyphen/underscore tolerant)
- `getUpstreamDeps(repo, platform)` — recursive upstream dependencies
- `getDownstreamDeps(repo, platform)` — repos that depend on this repo
- `getDependencyGraph(repo, platform)` — full graph with layers

### `src/core/search-engine.ts`

Multi-repo code search using ripgrep (preferred), grep, or findstr (Windows fallback).

**Key functions:**
- `searchRepos(options)` — search for patterns across multiple repo paths
- `listComponents(repoPath, types, platform)` — discover classes, structs, protocols, etc.

### `src/core/git-ops.ts`

Git operations via `child_process.execFile('git', ...)` — no shell spawning.

**Key functions:**
- `validateTag(repoPath, tag)` — format check + existence check + suggestions
- `validateBranchName(name)` — convention enforcement
- `createBranch(repoPath, branchName, fromRef)` — create and checkout
- `cloneOrFetch(gitUrl, targetDir)` — idempotent clone/fetch
- `getRepoStatus(repoPath)` — branch, clean/dirty, uncommitted files
- `listTags(repoPath, pattern?)` — list tags sorted by version
- `listBranches(repoPath, remote?)` — list local or remote branches

---

## Repo Data (`src/data/repos.json`)

The single source of truth for repository metadata. Edit this file to add, remove, or update repos — no TypeScript knowledge needed.

```json
{
  "mac": {
    "my-new-repo": {
      "gitUrl": "https://git.csez.zohocorpin.com/uems/native/mac/my-new-repo.git",
      "layer": 3,
      "platform": "mac",
      "dependencies": ["agent-utils"],
      "description": "What this repo does.",
      "isDeliverable": false
    }
  },
  "linux": {},
  "windows": {}
}
```

The `name` field is derived from the JSON key automatically.

---

## Conventions

### Tag Format

```
PRODUCTNAME_YY.MM.BUILD
```

Examples: `AGENT_UTILS_26.05.01`, `UEMS_GO_COMPONENTS_26.03.01`

### Branch Naming

```
feature/<topic>     bugfix/<topic>     hotfix/<topic>     release/<version>
```

Lowercase with hyphens. Example: `feature/network-retry-logic`

---

## Configuration

Open **Settings** (`Cmd+,`) and search for `uems-agent-chat`:

| Setting | Default | Description |
|---|---|---|
| `syncIntervalHours` | `24` | Sync interval in hours (min: 0.5, max: 168) |
| `autoSync` | `true` | Automatically sync on activation and periodically |
| `autoUpdate` | `true` | Automatically check for and install extension updates |
| `httpBridge.enabled` | `false` | Enable the HTTP bridge server for external frontends |
| `httpBridge.port` | `3111` | HTTP bridge listen port |

### HTTP Bridge

When `httpBridge.enabled` is `true`, the extension starts a local HTTP server on `httpBridge.port` that external UIs (like UEMS Agent Explorer in bridge mode) can call. The bridge:

- Proxies chat requests to VS Code's Copilot model
- Executes tools via the extension's tool implementations
- Builds a system prompt with pre-loaded skills and guidelines (same 3 skills + 5 guidelines as the Go backend)
- Injects `<bridge-mode-rules>` directing the LLM to use pre-loaded content

## Commands

| Command | Description |
|---|---|
| `UEMS Agent Chat: Sync Agent Files` | Manually trigger a sync from the remote repo |
| `UEMS Agent Chat: Open Chat` | Open Copilot Chat with @UEMS Agent Orchestrator |

---

## Sync & Self-Update

### Agent Sync

1. On activation, checks if local agent files exist
2. **First run**: Syncs immediately with visible progress notification
3. **Subsequent runs**: Agents load from cache; background check runs if interval elapsed
4. Git repo is **sparse-cloned** (only agent + releases directories) into global storage
5. Changed files are written; removed files are cleaned; `package.json` agents are reconciled
6. Prompts to reload if agents changed

### Self-Update

1. Reads `releases/latest.json` from the sparse clone
2. Compares version against installed extension
3. Prompts to install if newer version available
4. Installs via `code --install-extension`

### Storage

- `agent-repo/` — sparse clone of the git repo (in global storage)
- `sync-meta.json` — last sync timestamp
- `<extensionPath>/assets/agents/` — synced agent `.md` files
- `<extensionPath>/assets/skills/` — synced skill directories (each with `SKILL.md`)

---

## Development

```bash
# Install dependencies
npm install

# Compile (type-check + lint + build)
npm run compile

# Watch mode (auto-rebuild on changes)
npm run watch

# Package as VSIX
npm run build:vsix

# Install the VSIX
code --install-extension releases/uems-agent-chat.vsix
```

### Debug (F5)

Ensure `.vscode/launch.json` exists at the workspace root (`uems-ai-toolkit/.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}/source/uems-agent-chat"],
      "outFiles": ["${workspaceFolder}/source/uems-agent-chat/dist/**/*.js"]
    }
  ]
}
```

Press `Cmd+Shift+D` → select **"Run Extension"** → click ▶.

### Releasing

1. Bump `version` in `package.json`
2. Run `npm run build:vsix`
3. Update `releases/latest.json` with new version and changelog
4. Commit and push — users auto-update on next sync

---

## Project Structure

```
src/
├── extension.ts          # Activation, agent + tool registration
├── http-bridge.ts        # HTTP bridge server (optional, for external UIs)
├── orchestrator.ts       # Chat participant handler + tool loop
├── sync.ts               # Git-based agent sync manager
├── updater.ts            # Self-update checker
├── core/
│   ├── repo-registry.ts  # Repo metadata (loads from JSON)
│   ├── search-engine.ts  # Multi-repo search (rg/grep/findstr)
│   └── git-ops.ts        # Git operations (tag, branch, clone)
├── data/
│   └── repos.json        # Repository definitions (single source of truth)
└── tools/
    ├── index.ts           # Tool registration barrel
    ├── helpers.ts         # resolveRepoPaths, jsonResult, truncate
    ├── search-repos.ts    # uems_agent_search_repos
    ├── list-components.ts # uems_agent_list_components
    ├── find-wrapper.ts    # uems_agent_find_wrapper
    ├── dependency-graph.ts# uems_agent_dependency_graph
    ├── validate-tag.ts    # uems_agent_validate_tag
    ├── create-branch.ts   # uems_agent_create_branch
    ├── setup-workspace.ts # uems_agent_setup_workspace
    ├── load-guidelines.ts # uems_agent_load_guidelines
    ├── load-skills.ts     # uems_agent_load_skills
    └── diff-branches.ts   # uems_agent_diff_branches
```

## Requirements

- VS Code ≥ 1.108.0
- [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat) extension
- `git` available in PATH
