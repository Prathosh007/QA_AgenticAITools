# QA Agentic AI Tools

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-Extension-blue?style=for-the-badge&logo=visualstudiocode" alt="VS Code Extension"/>
  <img src="https://img.shields.io/badge/GitHub%20Copilot-Powered-black?style=for-the-badge&logo=github" alt="GitHub Copilot"/>
  <img src="https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux-green?style=for-the-badge" alt="Platforms"/>
</p>

**AI-powered development and QA toolkit** that automates code review, test case generation, documentation, and SDLC workflows for multi-platform native codebases (C, C++, C#, Swift, Objective-C, Go).

---

## ✨ Features

- 🤖 **9 Specialized AI Agents** — Orchestrator, Planner, Architect, Developer, Reviewer, Explorer, QA, Delta Reviewer, Document Generator
- 🔍 **Intelligent Code Review** — OWASP-aligned security audits with automated severity scoring
- 📝 **Test Case Generation** — Structured 17-column CSV test matrices from code diffs
- 📚 **Documentation Automation** — AI-generated architecture docs and API references
- 🔄 **Full SDLC Pipeline** — Plan → Architect → Develop → Review → QA workflow
- 🛠️ **VS Code + GitHub Copilot Integration** — Native chat experience with custom tools

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  VS Code + GitHub Copilot Chat                              │
│                                                             │
│  ┌───────────────────┐   ┌────────────────────────────────┐ │
│  │  Chat Agents (9)  │   │  Language Model Tools (10)     │ │
│  │  orchestrator     │   │  search_repos, list_components │ │
│  │  planner          │   │  find_wrapper, dependency_graph│ │
│  │  architect        │   │  validate_tag, create_branch   │ │
│  │  developer        │   │  setup_workspace, diff_branches│ │
│  │  reviewer         │   │  load_guidelines, load_skills  │ │
│  │  explorer         │   └────────────────────────────────┘ │
│  │  qa               │                                      │
│  │  delta-reviewer   │                                      │
│  │  document-gen     │                                      │
│  └───────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
QA_AgenticAITools/
├── agents/                    # AI Agent Definitions
│   ├── orchestrator/          #   Full SDLC controller
│   ├── delta-reviewer/        #   Diff-based code reviewer
│   ├── document-generator/    #   Documentation generator
│   └── testcase-generator/    #   QA test case generator
│
├── skills/                    # Reusable AI Skills
│   ├── behavioral-change-analysis/
│   ├── checkpoint-management/
│   ├── symbol-tracing/
│   ├── testcase-generation/
│   └── ...
│
├── guidelines/                # Engineering Standards
│   ├── common/                #   Cross-platform rules
│   ├── mac/                   #   macOS-specific
│   ├── linux/                 #   Linux-specific
│   └── windows/               #   Windows-specific
│
├── source/
│   ├── uems-agent-chat/       # VS Code Extension
│   ├── uems-agent-web/        # Web UI Server
│   └── testcase-db/           # Test Case Database
│
├── testcases/                 # Generated Test Cases
└── docs/                      # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

- [VS Code](https://code.visualstudio.com/) 1.90+
- [GitHub Copilot](https://github.com/features/copilot) subscription
- [Node.js](https://nodejs.org/) 18+ (for extension development)
- [Go](https://golang.org/) 1.21+ (for web server)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Prathosh007/QA_AgenticAITools.git
   cd QA_AgenticAITools
   ```

2. **Install the VS Code Extension**
   ```bash
   cd source/uems-agent-chat
   npm install
   npm run compile
   ```

3. **Start the Web Server (optional)**
   ```bash
   ./start-servers.ps1  # Windows
   ```

4. **Open in VS Code**
   - Open the workspace in VS Code
   - The UEMS Agent extension activates automatically
   - Use `@orchestrator`, `@reviewer`, `@qa` in Copilot Chat

---

## 🤖 AI Agents Overview

| Agent | Purpose | Invocation |
|-------|---------|------------|
| **Orchestrator** | Full SDLC pipeline controller | `@orchestrator` |
| **Planner** | Requirements analysis & impact assessment | Internal |
| **Architect** | Solution design & implementation planning | Internal |
| **Developer** | Production code implementation | Internal |
| **Reviewer** | Code review & security audit | `@reviewer` |
| **Explorer** | Codebase exploration & search | `@explorer` |
| **QA** | Test case generation | `@qa` |
| **Delta Reviewer** | Diff-based code review | `@delta-reviewer` |
| **Document Generator** | Documentation automation | `@document-gen` |

### Pipeline Flow

```
User Task
    │
    ├─ Hotfix  ─────────────→ Developer → Reviewer → QA
    ├─ Simple  ─────────────→ Developer → Reviewer → QA
    ├─ Medium  → Architect ─→ Developer → Reviewer → QA
    └─ Complex → Planner → Architect → Developer → Reviewer → QA
```

---

## 📋 Key Skills

| Skill | Description |
|-------|-------------|
| `testcase-generation` | Generate structured test cases from code changes |
| `behavioral-change-analysis` | Analyze behavioral impact of code changes |
| `symbol-tracing` | Trace symbol definitions and call chains |
| `checkpoint-management` | Session persistence for long-running tasks |
| `review-standards-reference` | Quality scoring and severity classification |

---

## 📖 Documentation

- [Orchestrator Guide](agents/orchestrator/README.md)
- [Delta Reviewer Guide](agents/delta-reviewer/README.md)
- [Document Generator Guide](agents/document-generator/README.md)
- [Test Case Generator Guide](docs/uems-testcase-generator-guide.html)

---

## 🛠️ Development

### Build Extension
```bash
cd source/uems-agent-chat
npm run watch  # Development mode
npm run compile  # Production build
```

### Run Tests
```bash
npm test
```

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🤝 Contributing

This is an internal tool. For questions or contributions, contact the development team.

---

<p align="center">
  <b>Built with ❤️ for QA Automation</b>
</p>
|------|---------|
| [coding-standards.md](guidelines/linux/coding-standards.md) | Go coding standards, GOPATH build model, naming conventions |
| [platform-security.md](guidelines/linux/platform-security.md) | D-Bus / Unix socket IPC, process trust, credential management |
| [repo-map.md](guidelines/linux/repo-map.md) | Repository rules and cross-repo change guidelines for Linux repos |

### Windows-Specific (`guidelines/windows/`)

| File | Purpose |
|------|---------|
| [coding-standards.md](guidelines/windows/coding-standards.md) | C++ 17 / C# (.NET 4.0) coding standards, naming conventions |
| [platform-security.md](guidelines/windows/platform-security.md) | Services, COM, registry, DPAPI, driver signing |
| [repo-map.md](guidelines/windows/repo-map.md) | Repository rules and cross-repo change guidelines for Windows repos |

---

## Skills

Reusable procedures extracted from agent definitions and shared across multiple agents. Skills are registered in the VS Code extension via `chatSkills` in `package.json` and loaded on demand by agents using the `uems_agent_load_skills` tool.

| Skill | Purpose | Used By |
|-------|---------|---------|
| **[symbol-tracing](skills/symbol-tracing/)** | Deterministic search → narrow read → wrapper check → bidirectional tracing procedure | Reviewer, Delta Reviewer |
| **[tool-preference-rules](skills/tool-preference-rules/)** | UEMS tools vs generic tools hierarchy, Agent-Utils mandatory usage rules | All agents |
| **[behavioral-change-analysis](skills/behavioral-change-analysis/)** | 4-item checklist: default values, removed code, storage/schema migration, interface contracts | Reviewer, Delta Reviewer |
| **[checkpoint-management](skills/checkpoint-management/)** | Checkpoint create → update → resume → delete lifecycle for long-running sessions | Orchestrator, Document Generator |
| **[environment-setup-protocol](skills/environment-setup-protocol/)** | Workspace setup: repo cloning, tag validation, branch creation, dependency discovery | Orchestrator, Delta Reviewer |
| **[guideline-loading-protocol](skills/guideline-loading-protocol/)** | Adaptive guideline loading by task type with verification and escalation | All agents |
| **[review-standards-reference](skills/review-standards-reference/)** | Quality scoring formula, severity classification, approval criteria for reviews | Reviewer, Delta Reviewer |
| **[platform-confirmation-protocol](skills/platform-confirmation-protocol/)** | Platform selection (mac/linux/windows) at session start with session locking | Orchestrator, Delta Reviewer |
| **[manual-test-generation](skills/manual-test-generation/)** | 7-step procedure for generating structured manual test cases (17-column CSV) | QA |

All skills are `user-invocable: false` — they are agent-only and loaded on demand via `uems_agent_load_skills({ files: ["<skill-name>"] })`.

### Distribution Pipeline

```
skills/<name>/SKILL.md  →  git sync  →  assets/skills/<name>/SKILL.md  →  chatSkills (package.json)  →  agents call uems_agent_load_skills
```

---

## UEMS Agent for VS Code

**[UEMS Agent for VS Code](source/uems-agent-chat/)** — a VS Code extension that registers all UEMS agents into GitHub Copilot Chat.

- **Git-based delivery** — agent definitions are fetched from this repo via sparse checkout; nothing is bundled
- **Auto-sync** — checks for agent updates every 24 hours (configurable)
- **Self-update** — checks for new extension versions from `releases/latest.json`
- **9 chat agents** — orchestrator, planner, architect, developer, reviewer, explorer, QA, delta-reviewer, document-generator
- **10 language model tools** — codebase search, component listing, wrapper lookup, dependency graph, branch diff, tag validation, branch creation, workspace setup, guideline loading, skill loading
- **HTTP bridge** — exposes chat and tools via HTTP/SSE for external frontends (used by uems-agent-web)
- **Zero maintenance** — install once, agents stay current automatically

### Quick Start

1. Install the VSIX: `code --install-extension uems-agent-chat.vsix`
2. Reload VS Code
3. Open Copilot Chat → select an agent from the dropdown → describe your task

See [Extension Getting Started](source/uems-agent-chat/getting-started.md) for detailed setup.

---

## UEMS Agent Explorer

**[UEMS Agent Explorer](source/uems-agent-web/)** — a standalone Go web server with a browser-based chat UI for teams without VS Code.

- **Standalone mode** (default) — fully standalone: Copilot API direct, local tools, GitHub Device Flow auth. No VS Code dependency
- **Bridge mode** — connects to a VS Code instance running the UEMS Agent Chat extension
- **Stdio mode** — MCP over stdin/stdout for programmatic access
- **GitHub Device Flow auth** — OAuth-based authentication for team access
- **One-command setup** — `./setup.sh` installs prerequisites, clones repos, builds, and launches in standalone mode
- **Docker support** — containerized deployment with `docker compose up`
- **REST + SSE API** — streaming chat responses, tool invocation, session management
- **Prometheus metrics** — request counts, latencies, error rates at `/metrics`

### Quick Start (Bridge Mode)

```bash
cd source/uems-agent-web
./setup.sh    # Sets up everything and starts the server
# Web UI at https://localhost:443
```

See [Web Server README](source/uems-agent-web/README.md) and [Bridge Mode Guide](source/uems-agent-web/BRIDGE_MODE.md) for detailed setup.

---

## Getting Started

### For Developers (using the agents)

1. **Install the extension** — follow the [Extension Getting Started](source/uems-agent-chat/getting-started.md) guide
2. **Use the Orchestrator** — open Copilot Chat, select **UEMS Agent Orchestrator**, describe your task (feature, bug fix, refactor). See the [Orchestrator Getting Started](agents/orchestrator/getting-started.md) guide.
3. **Review diffs** — select **UEMS Agent Delta Reviewer**, provide source/target branches and repos. See the [Delta Reviewer Getting Started](agents/delta-reviewer/getting-started.md) guide.
4. **Generate docs** — select **UEMS Agent Document Generator**, ask it to document your repo. See the [Document Generator Getting Started](agents/document-generator/getting-started.md) guide.
5. **Use the web UI** — no VS Code? Open the [UEMS Agent Explorer](source/uems-agent-web/) in your browser instead.

### For Contributors (improving this toolkit)

| Component | How to Contribute |
|-----------|------------------|
| Agent definitions | Edit `*.agent.md` files in `agents/` — changes auto-sync to all users |
| Guidelines | Edit files in `guidelines/` — agents pull the latest on each session |
| VS Code extension | See [Extension Development](source/uems-agent-chat/README.md#development) for build/test/release instructions |
| Doc standards | Edit files in `agents/document-generator/doc-standards/` |

---

## Roadmap

| Phase | Description | Status |
|-------|-------------|--------|
| **v1** | Mac orchestrator (5 agents + guidelines) | ✅ Done |
| **Phase 1** | Move standards to versioned repos | ✅ Done |
| **Phase 2** | Codebase navigation tools (10 languageModelTools) | ✅ Done |
| **Phase 3** | Build, test & quality automation (QA agent + testing standards) | ✅ Done |
| **Phase 4** | Repo setup & branch management tools | ✅ Done |
| **Phase 5** | Remote build & release workflow | Planned |
| **Phase 6** | Linux & Windows platform support | ✅ Done |
| **Phase 7** | UEMS Agent for VS Code | ✅ Done |
| **Phase 8** | UEMS Agent Explorer (web interface) | ✅ Done |

See [Orchestrator TODO](agents/orchestrator/TODO.md) for detailed items and design decisions.

---

## Requirements

- **VS Code** ≥ 1.108.0 with [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
- **Git CLI** available in PATH
- **Zoho Corp network / VPN** for internal repo access

## Supported Platforms

| Platform | Languages | Status |
|----------|-----------|--------|
| **macOS** | Swift 5, Objective-C | ✅ Active |
| **Linux** | Go | ✅ Active |
| **Windows** | C, C++, C# | ✅ Active |

---

*Last Updated: 2026-03-27*
