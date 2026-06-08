# UEMS Agent Orchestrator

An AI-powered SDLC orchestrator for the **UEMS Endpoint Central Agent** codebase. Automates **Plan → Architect → Develop → Review → QA** using specialized sub-agents in VS Code, with mandatory code review and manual test case generation on every task.

**Platforms:** macOS (Swift 5 / Obj-C) · Linux (Go) · Windows (C/C++/C#)  
> Guidelines and agent-level platform-specific rules are complete for all three platforms.

**→ [Getting Started Guide](getting-started.md)** — Setup & usage instructions

---

## Why

- 14+ repositories with shared dependencies — consistency is hard to enforce manually
- This orchestrator automates coding standards, OWASP-aligned security reviews, and engineering checklist (A–M) compliance on every change

---

## How It Works

### Sub-Agents

| Agent | Role |
|---|---|
| **Orchestrator** | Entry point — assesses complexity, delegates, manages review loop |
| **Planner** | Requirements, affected repos, cross-repo dependencies, risks |
| **Architect** | Solution design, interfaces, implementation plan with parallel batching |
| **Developer** | Implements code, runs build/test, follows Architect's plan |
| **Reviewer** | Mandatory review — quality, security (OWASP), checklist (A–M) |
| **QA** | Generates structured manual test cases (CSV) from code changes for QA team execution |

### Pipeline

```
User Task
    │
    ▼
Orchestrator (assess complexity)
    │
    ├─ Hotfix ───────────────────→ Developer → Reviewer → QA  (1 checkpoint)
    ├─ Simple ───────────────────→ Developer → Reviewer → QA
    ├─ Medium ──→ Architect ─────→ Developer → Reviewer → QA
    └─ Complex → Planner → Architect → Developer → Reviewer → QA
                                          ▲            │
                                          │   NEEDS_REVISION
                                          └────────────┘
                                         (max 3 loops)
```

Review is **always mandatory**. After 3 failed revision loops, the orchestrator escalates to you.

**Hotfix path:** For production crashes or urgent fixes, say "hotfix" or "urgent" and the orchestrator auto-classifies, skips intermediate checkpoints, and presents one combined result (implementation + review) at the end. Gates and review still apply — reduced ceremony, not reduced rigor.

### What You Control

The orchestrator pauses after **every phase** for your approval — assessment, plan, design, implementation, and review. Nothing advances without your sign-off. You can adjust direction, ask questions, or override decisions at any checkpoint.

Before work begins, three gates run automatically: **platform selection** (mac/linux/windows, locked for the session), **guideline verification** (halts if any file is missing), and **environment setup** (clone repos, validate tags, create branches).

**Session recovery:** If a session is interrupted (internet, crash, timeout), the orchestrator saves progress to `.ai-docs/checkpoint.md`. Checkpoint updates are **blocking gates** — the orchestrator must persist state (using cross-platform file tools, not shell commands) before advancing to the next phase. On the next session, it detects the checkpoint and resumes from where it left off — no need to re-run completed phases or re-invoke sub-agents that already finished.

**Metrics:** Every completed task is logged to `.orchestrator-metrics.md` at the workspace root — tracking outcomes, review iterations, duration, token usage, and failure patterns across sessions.

### Session Flow

Here's what a typical complex task looks like end to end:

```
You:  @UEMS Agent Orchestrator Add remote shell support to dcagentservice
        │
Gate 0: "Which platform?" → You: "mac"
Gate 1: ✅ All guideline files loaded
Gate 2: ✅ Repos cloned, branches created from latest tags
        │
Assess: "Complex — 3 repos affected → Planner → Architect → Developer → Reviewer"
  ⏸ You confirm
        │
Plan:   Planner identifies affected repos, dependencies, risks, open questions
  ⏸ You approve (or answer questions / adjust scope)
        │
Design: Architect produces interfaces, task breakdown, batch plan
  ⏸ You approve (or request changes)
        │
Build:  "Are build dependencies configured?" → You confirm → Developer implements, runs build
  ⏸ You approve for review (or request changes)
        │
Review: Reviewer checks quality, security, checklist → APPROVED
  ⏸ You confirm
        │
QA:     QA generates manual test cases (CSV) from the implemented changes
  ⏸ You confirm
        │
Deliver: Commits pushed to feature branches across all affected repos
```

---

## File Structure

```
orchestrator/
├── README.md                   # This file — architecture and usage
├── getting-started.md          # Quick start guide
├── REVIEW.md                   # Initial design review (historical)
├── TODO.md                     # Roadmap, design decisions, future work
└── agents/
    ├── uems-agent-orchestrator.agent.md  # Orchestrator agent
    ├── uems-agent-planner.agent.md       # Planner agent
    ├── uems-agent-architect.agent.md     # Architect agent
    ├── uems-agent-developer.agent.md     # Developer agent
    ├── uems-agent-reviewer.agent.md      # Reviewer agent
    └── uems-agent-qa.agent.md            # QA agent
```

Guidelines live in `../guidelines/` (same repo) — see [docs/README.md](../README.md) for the full guideline index.

---

## Setup

### Prerequisites

- **VS Code** with GitHub Copilot (Chat agent mode)
- **UEMS Agent Chat** extension installed (see [`source/uems-agent-chat/`](../../source/uems-agent-chat/README.md))
- Access to the UEMS native agent Git repositories

### Installation

The **UEMS Agent Chat** extension handles everything automatically:
- Syncs agent files, skills, and guidelines from this repo to VS Code global storage
- Registers 10 language model tools, 7 chat agents, and 8 skills
- Self-updates via `releases/latest.json`

No manual file copying needed.

---

## Usage

Open **VS Code Copilot Chat**, select **UEMS Agent Orchestrator** from the agent dropdown, and describe your task.

**Example tasks:**
```
Add remote shell support to the Mac agent
Fix the XPC connection leak in Patch-Management
Refactor logging to use the new Agent-Utils wrapper
Explain the dependency chain between Agent-Utils and Inventory-Management
```

---

## Standards

All changes are automatically verified against:

- **[Engineering Checklist (A–M)](../guidelines/common/engineering-checklist.md)** — dependencies, style, build, compatibility, performance, testing, and more
- **[Security Standards](../guidelines/common/security-standards.md)** — OWASP-aligned: input validation, auth, secrets, crypto, transport, command execution, file ops
- **[Review Standards](../guidelines/common/review-standards.md)** — Deterministic severity classification and quality scoring formula
- **[Testing Standards](../guidelines/common/testing-standards.md)** — Manual test case output format (17-column CSV), naming conventions, coverage rules
- **[Git Conventions](../guidelines/common/git-conventions.md)** — branch naming, tag format, commit message format
- **[Coding Standards (Mac)](../guidelines/mac/coding-standards.md)** — Swift 5 / Obj-C rules
- **[Platform Security (Mac)](../guidelines/mac/platform-security.md)** — XPC, code signing, entitlements
- **[Coding Standards (Linux)](../guidelines/linux/coding-standards.md)** — Go, GOPATH model, naming conventions
- **[Platform Security (Linux)](../guidelines/linux/platform-security.md)** — D-Bus, Unix sockets, process trust
- **[Coding Standards (Windows)](../guidelines/windows/coding-standards.md)** — C++ 17 / C# (.NET 4.0)
- **[Platform Security (Windows)](../guidelines/windows/platform-security.md)** — services, COM, registry, DPAPI

---

## Roadmap

| Phase | Description | Status |
|---|---|---|
| **v1** | Mac orchestrator (5 agents + guidelines) | ✅ Done |
| **Phase 1** | Move standards to versioned repos | ✅ Done |
| **Phase 2** | Codebase navigation tools (10 languageModelTools) | ✅ Done |
| **Phase 3** | Build automation & dependency resolution (testing deferred — needs infra) | 🔧 Partial |
| **Phase 4** | Repo setup & branch management tools | ✅ Done |
| **Phase 5** | Remote build & release workflow | Planned |
| **Phase 6** | Linux & Windows platform support | ✅ Done |
| **Phase 7** | VS Code extension (UEMS Agent Chat) | ✅ Done |

See [TODO.md](TODO.md) for detailed items, design decisions, and backlog.

