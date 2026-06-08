# UEMS Agent Orchestrator — Roadmap & TODO

> Phased roadmap with actionable items. See [README.md](README.md) for architecture and usage.

---

## Key Design Decisions (v1)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Review is mandatory for all tasks | Security-critical agent code — no exceptions for any complexity tier |
| 2 | Self-contained agents | Not delegating to existing platform-specific agents — keeps control and consistency |
| 3 | Dedicated QA agent | Manual test case generation warrants a separate agent with its own skill and standards | 
| 4 | Max 3 revision loops | Prevents infinite loops; escalates to user after 3 failures |
| 5 | Guidelines separated from agent prompts | Keeps agents focused on workflow; guidelines are versioned independently |
| 6 | Planner does full impact analysis | Lists all affected repos, components, interfaces, workflows before any design starts |

---

## Phase 1: Move Standards to Versioned Repos ✅

Guidelines live in **`uems-ai-toolkit/guidelines/`**. The UEMS Agent Chat extension syncs them to VS Code global storage. Agents load them via the `uems_agent_load_guidelines` tool.

- [x] Migrate local guideline files to versioned repo
- [x] Update all agents to load via `uems_agent_load_guidelines` tool
- [x] Remove local guideline dependency
- [x] Extension syncs guidelines automatically

---

## Phase 2: Codebase Navigation Tools ✅

Built as VS Code `languageModelTools` (not MCP — integrated directly into the extension).

- [x] `uems_agent_search_repos` — search across multiple repos simultaneously
- [x] `uems_agent_list_components` — list classes, protocols, structs, interfaces
- [x] `uems_agent_find_wrapper` — find Agent-Utils wrappers and their usage
- [x] `uems_agent_dependency_graph` — navigate cross-repo dependencies
- [x] `uems_agent_load_guidelines` — load guidelines from synced store
- [x] `uems_agent_load_skills` — load reusable skill procedures on demand
- [x] `uems_agent_diff_branches` — diff between branches for delta code reviews
- [x] Integrated into all agents (frontmatter + usage instructions)

**Status:** ✅ Done — 10 tools

---

## Phase 3: Build, Test & Quality 🔧

### Build Automation
- [x] Xcode build command integration for Mac agent repos
- [x] `swiftlint` / `swiftformat` integration
- [x] Auto-read and execute commands from each repo's `docs/ai-agents/BUILD_GUIDE.md`
- [x] Activate placeholders in Developer and Reviewer agents

### Build Dependency Setup
- [x] Resolve dependencies in layer order (Layer 0 → 1 → 2 → 3 per repo-map.md)
- [x] For multi-repo tasks, build upstream repos (Agent-Utils, cmickey_utils) before downstream
- [ ] Future: automate via MCP or build script that reads repo-map dependency graph

### Manual Test Case Generation ✅
> Manual test cases for QA team execution. Agent generates structured CSV test cases from code changes — no unit test infrastructure required.

- [x] Create `guidelines/common/testing-standards.md` — output format (17-column CSV), naming conventions, coverage rules, platform module mappings
- [x] Create `skills/manual-test-generation/SKILL.md` — step-by-step test generation protocol
- [x] Create `UEMS Agent QA` (`uems-agent-qa.agent.md`) — QA sub-agent with two input modes (pipeline + standalone)
- [x] Update Orchestrator pipeline: Developer → Reviewer → **QA** → Commit & Deliver
- [x] Sync agent and skill to extension assets

### Automated Unit Testing — DEFERRED
> **Blocked:** Needs unit test infrastructure in repos first. No test targets, test schemes, or test runners configured yet.

- [ ] Set up test targets/schemes in Mac repos (XCTest)
- [ ] Create automated testing standards guideline
- [ ] Activate `<!-- TODO -->` placeholders in Developer (testing section) and Reviewer (Step 7: Test Review)

---

## Phase 4: Repo Setup & Branch Management ✅

Built as VS Code `languageModelTools`.

- [x] `uems_agent_create_branch` — create branch from a given tag or base branch
- [x] `uems_agent_validate_tag` — tag format validation before branching
- [x] Branch naming convention enforcement (in `git-ops.ts`)
- [x] `uems_agent_setup_workspace` — clone/checkout helper for multi-repo tasks

---

## Phase 5: MCP — Remote Build & Release Workflow

- [ ] Remote build generation — trigger and track remote builds
- [ ] Task management tool integration — submit topics for review as part of release process
- [ ] Agent workflow documentation — auto-generate workflow docs based on tag version

---

## Phase 6: Linux & Windows Platform Support ✅

### Linux
- [x] `guidelines/linux/coding-standards.md` — Go coding standards
- [x] `guidelines/linux/platform-security.md` — D-Bus, Unix sockets, process trust
- [x] `guidelines/linux/repo-map.md` — Linux agent repo rules and cross-repo guidelines
- [x] `repos.json` — Linux repo metadata (dc_native monorepo)
- [x] Update Orchestrator, Developer, Reviewer for Go-specific rules

### Windows
- [x] `guidelines/windows/coding-standards.md` — C++/C# coding standards
- [x] `guidelines/windows/platform-security.md` — services, COM, registry, DPAPI
- [x] `guidelines/windows/repo-map.md` — Windows agent repo rules and cross-repo guidelines
- [x] `repos.json` — Windows repo metadata (18 repos)
- [x] Update Orchestrator, Developer, Reviewer for C/C++/C# rules

### Cross-Platform
- [ ] Orchestrator detects multi-platform impact
- [ ] Coordinates sub-agents across platforms
- [ ] Unified review for cross-platform changes

---

## Phase 7: VS Code Extension ✅

The **UEMS Agent Chat** extension (`source/uems-agent-chat/`) is built and deployed.

- [x] Automate agent file sync (sparse checkout from git → global storage → assets)
- [x] Guideline sync (loaded via `uems_agent_load_guidelines` tool)
- [x] 10 language model tools registered
- [x] 9 chat agents registered
- [x] Chat participant with `query:` prefix
- [x] Self-update mechanism (`releases/latest.json`)
- [ ] One-click onboarding wizard for new team members

---

## Phase 8: Web Interface ✅

The **UEMS Agent Web** server (`source/uems-agent-web/`) provides browser-based access.

- [x] Go web server with REST + SSE API
- [x] Bridge mode — connects to VS Code extension’s HTTP bridge
- [x] GitHub Device Flow OAuth authentication
- [x] Browser-based chat UI with streaming responses
- [x] One-command setup (`setup.sh`)
- [x] Docker deployment support
- [x] Prometheus metrics endpoint

---

## Backlog (Unprioritized)

- [x] **Session Recovery / Checkpoint System** — `.ai-docs/checkpoint.md` tracks pipeline progress, enables resume after interruptions. Checkpoints are **blocking gates** enforced via cross-platform file tools at every phase boundary. See Orchestrator agent §Checkpoint Protocol + §Checkpoint & Resume.
- [ ] **Rollback Protocol** — Branch rollback, stash management, partial failure handling in parallel batches
- [ ] **Plan/Review Document Generation** — Auto-save Planner and Reviewer output as Markdown + HTML
- [x] **Metrics & Telemetry** — `<workspace_root>/.orchestrator-metrics.md` accumulates per-task outcomes, review iteration counts, duration, token usage, sub-agent counts, and failure pattern tags. Recorded as a **blocking gate** at step 12. See Orchestrator agent §Metrics & Telemetry.
- [x] **Cross-Platform Agent Compatibility** — All checkpoint/metrics file operations use platform-agnostic tool calls (create_file, read_file, replace_string_in_file) instead of shell commands. Agent works on macOS, Linux, and Windows hosts.
- [ ] **Template Library** — Platform-specific boilerplate (XPC services, D-Bus interfaces, COM components), Agent-Utils integration patterns
