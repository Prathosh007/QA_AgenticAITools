# UEMS Agent Document Generator

A documentation-only AI agent that creates, updates, and audits **AI-navigable documentation** for native application repositories — targeting **C, C++, Objective-C, Swift, and Go** codebases.

> The agent does NOT write, modify, or refactor source code. It produces and maintains structured documentation that enables other AI agents (and humans) to navigate, understand, and safely modify native codebases.

**→ [Getting Started Guide](getting-started.md)** — Setup & usage instructions

---

## Why This Exists

Native code has uniquely high costs for incorrect assumptions — a hallucinated function signature in C can cause silent memory corruption; a wrong thread assumption can cause a race condition. This agent builds a documentation ecosystem designed to **eliminate guesswork** by giving AI agents verified, structured, instantly navigable references for every aspect of a codebase.

---

## Knowledge Base

The agent is governed by four specification files that define **what** to create, **how** it should look, and **how** the agent behaves:

| # | File | Purpose |
|---|------|---------|
| 1 | [PLAN_INDEX.md](doc-standards/PLAN_INDEX.md) | Index & quick reference — maps every topic to its source file and section |
| 2 | [SYSTEM_BLUEPRINT.md](doc-standards/SYSTEM_BLUEPRINT.md) | **What** to create, **where** to put it, **when** — folder structure, document catalog, 8-phase rollout plan, verification checklist |
| 3 | [FORMAT_STANDARD.md](doc-standards/FORMAT_STANDARD.md) | **How** each doc should look — headers, templates, cross-referencing, naming, size limits, update protocol |
| 4 | [AGENT_BEHAVIOR_RULES.md](doc-standards/AGENT_BEHAVIOR_RULES.md) | **How** the agent reads, verifies, and avoids hallucination — grounding laws, reading protocol, verification procedures |

The agent reads all four files at the start of **every task** before producing any output.

---

## Core Capabilities

### 1. Create Documentation for a New Repo

Analyzes the target repository's source tree, build system, and architecture, then generates the full documentation ecosystem following an 8-phase rollout:

| Phase | Output |
|-------|--------|
| **0 — Discovery** | Verified project inventory (from build configs, not directory names) |
| **1 — Foundation** | Entry point (`.github/copilot-instructions.md`), index files |
| **2 — Navigation** | `CODEBASE_MAP.md`, `GLOSSARY.md` |
| **3 — Guides** | `BUILD_GUIDE.md`, `AGENT_GUIDE.md`, `CONVENTIONS.md` |
| **4 — Deep Reference** | `ARCHITECTURE.md` (root + per-project), `BUILD_SYSTEM.md`, `THREADING_MODEL.md`, `MEMORY_OWNERSHIP.md` |
| **5 — Platform** | `PLATFORM_APIS.md`, `DATA_SCHEMAS.md`, `LOG_FILES.md`, `DOC_UPDATE_PROTOCOL.md` |
| **6 — Features** | `WORKFLOWS.md` (per-project), feature architecture docs, decision records |
| **7 — Maturity** | Full audit, bidirectional cross-references, conformance verification |

### 2. Update Existing Documentation

Uses **diff-based change discovery** (`git diff`) to identify exactly what changed, maps changed files to affected docs, and updates only what's needed — no full repo scan on every update.

### 3. Audit Documentation

Runs the System Verification Checklist and Agent Smoke Test to validate completeness, cross-reference integrity, conformance, and freshness across the entire documentation system.

---

## Documentation Architecture

The agent produces a **layered documentation system** designed for progressive disclosure — agents read only as deep as needed:

```
Layer 0  →  Entry Point (auto-injected every session)
Layer 1  →  Navigation & Lookup (CODEBASE_MAP — "I want to X → look in Y")
Layer 2  →  Domain Knowledge (GLOSSARY — term definitions)
Layer 3  →  Task Guides (BUILD_GUIDE, AGENT_GUIDE, CONVENTIONS)
Layer 4  →  Deep Reference (ARCHITECTURE, THREADING_MODEL, MEMORY_OWNERSHIP, WORKFLOWS)
```

### Folder Structure Produced

```
.github/
  copilot-instructions.md           ← Layer 0: Auto-injected entry point
docs/
  README.md                         ← Top-level index
  ai-agents/                        ← Layers 1–3
    CODEBASE_MAP.md                 ← Task → file lookup tables
    GLOSSARY.md                     ← Domain + platform terms
    AGENT_GUIDE.md                  ← Common task walkthroughs
    BUILD_GUIDE.md                  ← Build & test instructions
    DOC_TEMPLATE.md                 ← Format standard reference
    DOC_UPDATE_PROTOCOL.md          ← Change-type → doc mapping
    LOG_FILES.md                    ← Log file locations & debugging
  architecture/                     ← Layer 4
    ARCHITECTURE.md                 ← Repo-level project inventory
    SHARED_ARCHITECTURE.md          ← Shared libraries across projects
    BUILD_SYSTEM.md                 ← Build targets, flags, deps
    THREADING_MODEL.md              ← Thread map, sync rules
    MEMORY_OWNERSHIP.md             ← Ownership per boundary
    PLATFORM_APIS.md                ← OS API inventory
    DATA_SCHEMAS.md                 ← Config file schemas
    {project}/                      ← Per-project subdirectory
      ARCHITECTURE.md               ← Full project architecture
      WORKFLOWS.md                  ← Runtime workflow documentation
      {subsystem}-workflow.md        ← Per-subsystem workflows (when split)
      {FEATURE}_ARCHITECTURE.md     ← Feature deep-dives
  development/                      ← Coding standards
    CONVENTIONS.md
    ERROR_HANDLING.md
    TESTING.md
```

---

## Key Design Principles

| Principle | Description |
|-----------|-------------|
| **Skippability** | Decide in ≤3 lines whether to read or skip — every doc opens with machine-readable metadata |
| **Lookup tables over prose** | `| Task | File |` tables as primary navigation, not paragraphs |
| **Progressive disclosure** | Entry point → navigation → glossary → guides → deep reference. Stop early. |
| **Repo ≠ Project** | The repository is a container; projects are independently buildable units inside it |
| **Source code is ground truth** | Every claim traced to a specific file and line — never documented from memory |
| **Staleness is a bug** | Every doc carries a date; updated with the code change, not after |
| **Link, don't duplicate** | Information defined once, linked from elsewhere |

---

## Safety & Anti-Hallucination

The agent enforces **5 Grounding Laws** to prevent hallucination — critical for native code where wrong assumptions cause memory corruption, race conditions, and silent bugs:

1. **Read before you claim** — Never state a file/function/struct exists unless read in this session
2. **Read before you modify** — Never edit a file not read in this session
3. **Cite your source** — Every factual claim traceable to `file:line`
4. **Say "I don't know"** — If uncertain, read the source; never fill gaps with guesses
5. **Verify after you act** — Re-read what was written; build to confirm

### Mandatory Gates

The agent enforces **6 blocking gates** — it cannot proceed past a gate until it passes:

| Gate | Name | Pass Condition |
|------|------|----------------|
| 1 | Knowledge Base Read | All 4 spec files read end-to-end |
| 2 | Source Read | All relevant source files read before writing any doc |
| 3 | Per-Doc Conformance | Each doc passes the conformance checklist |
| 4 | Delegation | Per-project docs delegated to sub-agents |
| 5 | Iteration | 2–3 refinement iterations planned and executed |
| 6 | Completion | System Verification + Smoke Test both pass clean |

---

## Sub-Agent Delegation

For large repositories, the agent delegates independent work to sub-agents to prevent context overflow:

| Delegated to Sub-Agent | Kept by Main Agent |
|------------------------|--------------------|
| Per-project `ARCHITECTURE.md` | Entry point (`.github/copilot-instructions.md`) |
| Per-project `WORKFLOWS.md` | `CODEBASE_MAP.md` (spans all projects) |
| `{FEATURE}_ARCHITECTURE.md` | `GLOSSARY.md` (spans all projects) |
| `{subsystem}-workflow.md` | Root `ARCHITECTURE.md` |
| | Cross-reference audit |

Each sub-agent reads all 4 knowledge base files and passes its own conformance gates.

---

## Iterative Refinement

The agent automatically chains **2–3 refinement iterations** without user intervention:

| Iteration | Focus |
|-----------|-------|
| **1st pass** | Create/update all docs — structure, content, cross-references |
| **2nd pass** (auto) | Cross-references, consistency, link validation, date verification |
| **3rd pass** (auto) | Completeness, accuracy, System Verification, Smoke Test |

Continuity between iterations is maintained via a transient scratch file (`docs/ai-agents/.doc-iteration-status.md`) that is deleted after Gate 6 passes.

---

## Supported Languages & Platforms

| Language | Native Patterns Covered |
|----------|------------------------|
| **C** | Header guards, manual memory, `malloc`/`free` ownership, symbol visibility |
| **C++** | RAII, exception policy, namespace conventions, ABI stability |
| **Objective-C** | ARC boundaries, `nonatomic` vs `atomic`, nullability, bridging headers |
| **Swift** | Access control, `throws`, API Design Guidelines, Swift/Obj-C interop |
| **Go** | Package structure, goroutine topology, `error` returns, `internal/` conventions |

Build systems: **Xcode**, **CMake**, **Makefiles**, **Go modules**, **Swift Package Manager**

---

## Usage
Open **VS Code Copilot Chat**, select **UEMS Agent Document Generator** from the agent dropdown, and describe your task.

### Example Prompts

| Task | Prompt |
|------|--------|
| New repo setup | `Create documentation for this repository` |
| Update after changes | `Update documentation to reflect recent changes` |
| Audit | `Audit the documentation system for completeness and correctness` |
| Specific doc | `Create WORKFLOWS.md for the AgentDaemon project` |

### What to Expect

1. The agent reads all 4 knowledge base files and confirms
2. Analyzes the target repo (source, build system, projects)
3. Follows the phased rollout or targeted update protocol
4. Delegates per-project work to sub-agents for large repos
5. Runs 2–3 automatic refinement iterations
6. Declares done only after System Verification + Smoke Test pass

---

## Document Format at a Glance

Every generated document follows a strict format:

```markdown
<!-- audience: ai-agents -->
<!-- doc-type: reference -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-03-06 -->

# Document Title

> 🎯 **Audience:** AI coding agents
> **Scope:** All projects
> **Skip if:** Not working on [topic]

{Functional purpose statement.}

## Main Content
{Lookup tables, step-by-step guides, or reference material}

## Related Docs
| If you need... | Read... |
|----------------|---------|
| File locations  | CODEBASE_MAP.md |

*Last Updated: 2026-03-06*
```

---

## Verification

After documentation is generated, validate with:

- **System Verification Checklist** — [Blueprint §6](SYSTEM_BLUEPRINT.md) — checks structural completeness
- **Agent Smoke Test** — [Agent Rules §4.2](AGENT_BEHAVIOR_RULES.md) — simulates an agent workflow end-to-end
- **Conformance Checklist** — [Format Standard §9.6](FORMAT_STANDARD.md) — per-document format validation

---

*Last Updated: 2026-03-06*
