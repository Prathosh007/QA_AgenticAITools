# Documentation System Blueprint — Native App Edition

> **What this file is:** The structure, catalog, and rollout plan for your documentation system. Tells you *what* to create, *where* to put it, and *when* to create it.
>
> **Related files:**
> - [Format Standard](FORMAT_STANDARD.md) — *how* each doc should look (headers, templates, conventions)
> - [Agent Behavior Rules](AGENT_BEHAVIOR_RULES.md) — *how* the AI agent reads, verifies, and avoids hallucination

---

## 1. Core Principles

### Three Laws of Agent-Friendly Documentation

1. **Skippability** — Decide in ≤3 lines whether to read or skip. Every doc opens with machine-readable metadata.
2. **Recallability** — Re-orient in seconds using fixed header structure. Every doc uses the same format.
3. **Sufficiency** — A new agent with zero context can complete any task without reading source code first.

### Design Maxims

| Maxim | Meaning |
|-------|---------|
| **Link, don't duplicate** | Information defined once, linked from elsewhere. |
| **Lookup tables over prose** | `\| Task \| File \|` tables as primary navigation. |
| **Progressive disclosure** | Entry point → per-project deep docs → cross-cutting → navigation → guides. Stop early. |
| **Staleness is a bug** | Every doc carries a date. Updated with the code change, not after. |
| **Audience separation** | Tag docs so each audience skips irrelevant material. |
| **One source of truth** | Each concept defined in exactly one place. |
| **Build awareness** | Build targets, flags, linking, configuration as first-class concerns. |
| **Project isolation** | Each project gets its own architecture docs. Agent on Project A never reads Project B. |
| **Repo ≠ project** | The repository is a container. Projects are independently buildable units inside it. Never treat the repo name as a project name. |
| **Ground truth only** | Never state a fact unless verified from source code or docs. |
| **Verify before acting** | Read the actual file before modifying. Read the header before claiming a signature. |

---

## 2. Documentation Layers

```
Layer 0: Injected Entry Point (auto-loaded by AI tool)
Layer 1: Navigation & Lookup (where to find things)
Layer 2: Domain Knowledge (what things mean)
Layer 3: Task Guides (how to do things)
Layer 4: Deep Reference (full specs, decisions)
```

| Layer | Purpose | Examples | Read When |
|-------|---------|----------|-----------|
| **0** | Condensed essentials, auto-injected | `copilot-instructions.md` | Always |
| **1** | "I want to do X → look in file Y" | `CODEBASE_MAP.md`, `docs/README.md` | Every task |
| **2** | Term definitions | `GLOSSARY.md` | Unfamiliar term |
| **3** | Step-by-step task instructions | `AGENT_GUIDE.md`, `BUILD_GUIDE.md`, `CONVENTIONS.md` | Performing that task |
| **4** | Full architecture, threading, memory, APIs | `ARCHITECTURE.md`, `THREADING_MODEL.md`, `MEMORY_OWNERSHIP.md` | Deep understanding needed |

> **Stop as soon as you have enough context.** Layer 0 always. Layer 1 next. Then 2–4 only as needed.

---

## 3. Folder Structure

### Multi-Project Repo Layout

```
.github/
  copilot-instructions.md        ← Layer 0: Entry point
docs/
  README.md                      ← Top-level index
  ai-agents/                     ← Layers 1–3
    README.md                    ← Reading order + project routing
    CODEBASE_MAP.md              ← "I want to X → look in Y"
    GLOSSARY.md                  ← Domain + platform terms
    AGENT_GUIDE.md               ← Task walkthroughs
    BUILD_GUIDE.md               ← Build all projects
    DOC_TEMPLATE.md              ← Format standard
    DOC_UPDATE_PROTOCOL.md       ← When/what to update
  architecture/                  ← Layer 4
    ARCHITECTURE.md              ← Repo-level: project inventory only
    SHARED_ARCHITECTURE.md       ← Shared libs across projects
    BUILD_SYSTEM.md              ← Build targets, flags, deps
    THREADING_MODEL.md           ← Thread map, sync rules
    MEMORY_OWNERSHIP.md          ← Ownership per boundary
    PLATFORM_APIS.md             ← OS APIs, entitlements
    IPC_PROTOCOLS.md             ← XPC, sockets, etc.
    {project_a}/                 ← Per-project subdirectory
      README.md
      ARCHITECTURE.md            ← Full architecture for this project
      WORKFLOWS.md               ← Workflow index (hub) — links to sub-workflow files
      {subsystem}-workflow.md    ← Per-subsystem workflow (when WORKFLOWS.md is split)
      BUILD_SYSTEM.md            ← If differs from repo-wide
      THREADING_MODEL.md         ← If differs from repo-wide
      {FEATURE}_ARCHITECTURE.md  ← Feature deep-dives
    {project_b}/                 ← Same pattern
      ...
  development/                   ← Coding standards
    CONVENTIONS.md
    ERROR_HANDLING.md
    TESTING.md
```

### Structural Rules

1. `docs/` is the single home for all documentation — no scattered docs in source directories.
2. Each directory has a `README.md` index.

### ⛔ Project Identification (MANDATORY before creating any docs)

> **Critical:** The repository name is NOT a project. Projects are the independently buildable units INSIDE the repository. Getting this wrong produces a monolithic doc structure that must be completely redone.

**How to identify actual projects:**

1. **Examine the source tree.** Look for directories that each contain their own build target, entry point, or module boundary.
2. **Read build configuration files** — Xcode workspace/project files, CMakeLists.txt, Makefiles, go.mod, Package.swift — to confirm which directories are independent build targets.
3. **Each build target = one project.** An Xcode scheme, a Go binary/module, a CMake target, or a Makefile target is a project.
4. **The repository is the container, not a project.** `architecture/{repo-name}/ARCHITECTURE.md` is WRONG. `architecture/{actual-project}/ARCHITECTURE.md` is correct.

**Common patterns:**

| Repo Structure | Where Projects Live | Example |
|---------------|--------------------|---------|
| Xcode workspace | `native/Projects/{ProjectName}/` | 23 Xcode targets = 23 projects |
| Go monorepo | `cmd/{binary}/` or `pkg/{module}/` | Each `cmd/` entry = one project |
| CMake multi-target | `src/{target}/` | Each target in `CMakeLists.txt` = one project |
| Makefile multi-target | Per-directory Makefiles | Each Makefile target = one project |

**Verification checklist:**

- [ ] I have read the build configuration files (not guessed from directory names)
- [ ] Each "project" I identified has its own build target
- [ ] The repository name does NOT appear as a project name (unless it truly is a single-project repo)
- [ ] What I'm calling "projects" are NOT merely subdirectories or modules within a single project

⛔ **NEVER** create `architecture/{repo-name}/ARCHITECTURE.md`. The repo-level doc is `architecture/ARCHITECTURE.md` (the thin orchestrator). Per-project docs go in `architecture/{actual-project-name}/`.

### Multi-Project Splitting

| Scope | Location | Contains |
|-------|----------|----------|
| **Repo-level** | `architecture/ARCHITECTURE.md` | Project inventory, shared infra, inter-project deps. No project-specific details. |
| **Per-project** | `architecture/{project}/ARCHITECTURE.md` | Full self-contained architecture for one project. |
| **Shared code** | `architecture/SHARED_ARCHITECTURE.md` | Libs used by 2+ projects: API surface, ownership, versioning. |
| **Cross-cutting** | `architecture/THREADING_MODEL.md`, etc. | Repo-wide rules. Project gets its own copy only if it differs. |

**Split decision:** Does Project A's version differ from repo-wide? YES → create `architecture/{project_a}/{doc}`. NO → use repo-wide, add "Applies to: all projects".

---

## 4. Document Catalog

### Core Documents (Create First)

| Document | Layer | Purpose |
|----------|-------|---------|
| **Entry Point** (`.github/copilot-instructions.md`) | 0 | Project inventory, build targets, critical rules, reading order. Auto-loaded. |
| **`CODEBASE_MAP.md`** | 1 | "I want to do X → look in file Y" tables, organized by project. |
| **`GLOSSARY.md`** | 2 | Domain + platform + build term definitions. |
| **`AGENT_GUIDE.md`** | 3 | Common task walkthroughs with code examples. |
| **`BUILD_GUIDE.md`** | 3 | How to build each project, run tests, manage deps. |
| **`ARCHITECTURE.md`** (root) | 4 | **Repo-level only:** project inventory + inter-project deps. |
| **`{project}/ARCHITECTURE.md`** | 4 | **Per-project:** full architecture, modules, data flow. |
| **`SHARED_ARCHITECTURE.md`** | 4 | Shared libraries: API surface, ownership, versioning. |
| **`CONVENTIONS.md`** | 3 | Naming, file organization, code style per language. |

### Native-Specific Documents (Evaluate Each — Create or Explicitly Skip)

> ⛔ **Every document below must be evaluated during its rollout phase.** Either create it (trigger met) or record an explicit skip reason in the checkpoint.

| Document | Layer | Purpose | Creation Trigger |
|----------|-------|---------|------------------|
| **`BUILD_SYSTEM.md`** | 4 | CMake/Xcode/Makefile structure, targets, flags, linking. | **Always create** — every native repo has a build system. |
| **`THREADING_MODEL.md`** | 4 | Which threads exist, what runs where, sync primitives. | Create if any project uses threads, dispatch queues, GCD, goroutines, or async patterns. |
| **`MEMORY_OWNERSHIP.md`** | 4 | ARC boundaries, manual zones, RAII, malloc/free ownership. | Create if any project uses manual memory management, ARC bridging, `malloc`/`free`, or mixed ownership. |
| **`PLATFORM_APIS.md`** | 4 | OS API inventory, entitlements, version constraints, deprecations. | **Always create** — every native repo uses OS APIs. |
| **`IPC_PROTOCOLS.md`** | 4 | XPC, Unix sockets, pipes, shared memory. | Create if any project communicates with other processes (XPC, sockets, pipes, shared memory, named pipes). |
| **`ERROR_HANDLING.md`** | 3 | NSError, Swift throws, C error codes, Go error returns. | Create if repo uses 2+ error handling patterns (e.g., `@try`/`@catch` + `NSError`, `errno` + Go `error`, SEH + HRESULT). |
| **`DATA_SCHEMAS.md`** | 4 | Configuration file schemas — XML DOs, plists, JSON payloads. Field inventory + sample structures. | Create if any project reads/writes plist, XML, JSON, or INI config files. |
| **`LOG_FILES.md`** | 3 | Log file names, locations, format, rotation — per project. Debugging lookup table. | Create if any project has logging setup (`startLoggingTo:`, `os_log`, `syslog`, `NSLog`, `slog`, file-based logging). |

### Supporting Documents

| Document | Layer | Purpose |
|----------|-------|---------|
| **`DOC_UPDATE_PROTOCOL.md`** | 3 | Change-type → doc-file mapping table. |
| **`DOC_TEMPLATE.md`** | — | Format standard, header block, section skeletons, conformance checklist. |
| **`{project}/WORKFLOWS.md`** | 4 | Workflow index (hub) — links to sub-workflow files. Contains small workflows inline + cross-cutting concerns. |
| **`{project}/{subsystem}-workflow.md`** | 4 | Per-subsystem workflow file (split from WORKFLOWS.md when >600 lines). E.g., `httphandler-workflow.md`, `authprops-workflow.md`. |
| **`{FEATURE}_ARCHITECTURE.md`** | 4 | Feature-specific deep-dive. |
| **`{DECISION}_RECORD.md`** | 4 | Architectural Decision Record. |
| **`TESTING.md`** | 3 | Testing strategy, patterns per language. |

---

## 5. Rollout Plan

> **Design principle: Specific → General.** Per-project docs are created from source code (ground truth). Repo-wide docs are aggregated from per-project docs (derived truth). Navigation docs are populated from all docs (index of truth). This hybrid approach produces the richest, most accurate documentation.

> ⛔ **GATE 7 applies after EVERY phase below.** After completing each phase: update `docs/ai-agents/.doc-generation-checkpoint.md` — mark the phase ✅, record docs created, set "Next action" to the following phase. Do NOT start the next phase until the checkpoint is saved. See the agent file's **Checkpoint Update Algorithm** for the full procedure.

### Phase 0: Project Discovery & Dependency Scan (MANDATORY)

⛔ **Do this BEFORE creating any documentation.**

**Step A — Project Identification:** Follow the full [Project Identification protocol in §3](#-project-identification-mandatory-before-creating-any-docs) — read build configs, enumerate build targets, confirm repo ≠ project.

**Step B — Workspace Dependency Discovery:** Run the [Workspace Dependency Discovery protocol in Agent Rules §2.0](AGENT_BEHAVIOR_RULES.md) — scan sibling repos in the workspace, identify confirmed dependencies (logging, networking, utilities, etc.), and read their public API surfaces.

Output:
- A verified project list (name, directory, language, build target) that becomes the Project Inventory table in the entry point.
- A workspace dependency map (sibling repo → what it provides → which target-repo projects consume it).

⛔ **If you cannot distinguish the repo from its projects, STOP.** Ask for clarification. Do not proceed with documentation.

### Phase 1: Skeleton Foundation

Create a **minimal entry point** — just enough routing for agents to identify projects and build them. Navigation docs and reading order are backfilled later once content exists.

Create:
1. `.github/copilot-instructions.md` — **Skeleton** entry point with: project inventory (from Phase 0), build commands, critical rules, grounding rules, reading protocol. Reading order table uses **placeholder** rows for docs not yet created (marked `⬜ pending`).
2. `docs/README.md` — Top-level index (skeleton — directories listed, content TBD)
3. `docs/ai-agents/README.md` — Agent directory index (skeleton)

**Validate:** Agent can identify projects, languages, and build commands from the skeleton entry point. Full reading order is NOT required yet — that comes in Phase 7.

### Phase 2: Per-Project Deep Docs

> **This is the core phase.** Each project's architecture and workflows are documented directly from source code reading — the richest, most accurate pass. Sub-agent delegated per project.

⛔ **Pass GATE 4 (Delegation)** — delegate per-project docs to sub-agents now (see §Sub-Agent Delegation).

For **each project** identified in Phase 0, create:
4. `docs/architecture/{project}/ARCHITECTURE.md` — Full static architecture from source (modules, data flow, dependencies, API surface)
5. `docs/architecture/{project}/WORKFLOWS.md` — Runtime behavior, decision trees, flows. Sub-workflow files if WORKFLOWS.md would exceed 600 lines.
6. `docs/architecture/{project}/{FEATURE}_ARCHITECTURE.md` — For features meeting the trigger checklist (see below)

**Sub-agent delegation:** Each project is delegated to a sub-agent (see §Sub-Agent Delegation). Sub-agents receive the 5 knowledge base files + project directory path + skeleton entry point. No dependency on `CODEBASE_MAP` or `GLOSSARY` — cross-references to those are added in Phase 7 backfill.

#### When to Create a Feature Architecture Doc

Create `{FEATURE}_ARCHITECTURE.md` in `docs/architecture/{project}/` when:
- A feature spans 3+ source files or 2+ modules
- The feature has its own threading, memory, or IPC concerns
- A new developer (or agent) can't understand the feature from the module table alone
- A bug fix or review repeatedly needs explaining the same feature context

**Trigger checklist (run for each project during Phase 2):**
- [ ] Does this feature touch >3 files? → Consider a feature doc
- [ ] Does this feature have its own concurrency model? → Yes → Create doc
- [ ] Has this feature been explained verbally more than twice? → Write it down
- [ ] Would a new agent need to read >5 source files to understand this? → Create doc

#### Workflow Docs (Mandatory Per Project)

Create `WORKFLOWS.md` in `docs/architecture/{project}/` for **every project**. This is a mandatory companion to ARCHITECTURE.md — it documents the dynamic runtime behavior that the static architecture doc cannot capture.

Every project has runtime flows worth documenting, even if simple. A minimal WORKFLOWS.md for a straightforward project might have just 1–2 workflows. Complex projects will have many.

**Content guidance per project complexity:**
- **Simple project** (utility, CLI) — Main execution flow end-to-end
- **Moderate project** (daemon, service) — Startup, main loop, shutdown, error recovery
- **Complex project** (multi-subsystem) — Each subsystem's runtime flow with decision trees, retry, fallback

**Trigger checklist (use to identify which workflows to document):**
- [ ] Does this subsystem have a retry/fallback/recovery loop? → Document the full flow
- [ ] Are there 3+ files collaborating on a single operation? → Document how they chain
- [ ] Does the flow have conditional branches (server types, auth modes)? → Document the decision tree
- [ ] Would an agent need >500 lines of source to understand the runtime behavior? → Create workflow doc

**WORKFLOWS.md documents dynamic runtime behavior; ARCHITECTURE.md documents static structure.** Both are Layer 4. They cross-link to each other.

**Format, split rules, and sub-workflow structure:** See [Format Standard §7.5](FORMAT_STANDARD.md) and [Format Standard §9.2](FORMAT_STANDARD.md).

**Validate:** Each per-project doc is self-contained. An agent assigned to that project can understand its architecture and workflows without any other doc.

### Phase 3: Cross-Cutting Architecture

Aggregated from Phase 2 per-project docs — not created from raw source scanning.

Create:
7. `docs/architecture/ARCHITECTURE.md` — Repo-level project inventory + inter-project dependencies (extracted from Phase 2 per-project docs)
8. `docs/architecture/SHARED_ARCHITECTURE.md` — Shared libraries identified when multiple projects reference the same code
9. `docs/architecture/BUILD_SYSTEM.md` — Build targets, deps, flags (consolidated from per-project build knowledge)
10. `docs/architecture/THREADING_MODEL.md` — Repo-wide thread map, sync rules (synthesized from per-project thread models)
11. `docs/architecture/MEMORY_OWNERSHIP.md` — Ownership per boundary (synthesized from per-project memory models)

**Validate:** Agent can understand how projects relate to each other, what's shared, and repo-wide patterns.

### Phase 4: Navigation & Lookup (Aggregated)

> **Key difference from a top-down approach:** These docs are populated *from* Phase 2–3 content, not from raw source scanning. Every "I want to X → look in Y" row is backed by a doc that already exists. Every glossary term is extracted from per-project docs that have already been verified against source.

Create:
12. `docs/ai-agents/CODEBASE_MAP.md` — "I want to X" lookup tables, populated from Phase 2 per-project module tables + Phase 3 cross-cutting docs
13. `docs/ai-agents/GLOSSARY.md` — Domain + platform + build terms, extracted from all Phase 2–3 docs + domain terms from source

**Validate:** Agent can find the file location for any task using CODEBASE_MAP. Every glossary term has a definition.

### Phase 5: Task Guides

Written **after** deep docs exist — guides can reference real architecture and workflow docs with accurate examples.

Create:
14. `docs/ai-agents/BUILD_GUIDE.md` — Per-project build/test instructions (references `{project}/ARCHITECTURE.md` for context)
15. `docs/ai-agents/AGENT_GUIDE.md` — Common task walkthroughs (cites actual workflow docs)
16. `docs/development/CONVENTIONS.md` — Per-language naming/style (patterns observed during Phase 2 source reading)
17. `docs/ai-agents/DOC_TEMPLATE.md` — Format standard reference

**Validate:** Agent can build any project and complete common tasks using only docs.

### Phase 6: Platform & Process

Evaluate each doc against its creation trigger in [§4 Native-Specific Documents](#native-specific-documents-evaluate-each--create-or-explicitly-skip). Create if trigger met; skip with documented reason if not.

Create:
18. `docs/architecture/PLATFORM_APIS.md` — API inventory, entitlements, deprecations
19. `docs/ai-agents/DOC_UPDATE_PROTOCOL.md` — Change-type → doc mapping
20. `docs/development/ERROR_HANDLING.md` — Per-language error handling
21. `docs/architecture/DATA_SCHEMAS.md` — Config file schemas per [Format Standard §7.10](FORMAT_STANDARD.md)
22. `docs/ai-agents/LOG_FILES.md` — Log file names, paths, formats per [Format Standard §7.11](FORMAT_STANDARD.md)

⛔ **Phase 6 Completeness Checklist** — run before marking Phase 6 ✅:
- [ ] `PLATFORM_APIS.md` — created ✅ or skipped with reason: ___
- [ ] `DOC_UPDATE_PROTOCOL.md` — created ✅ or skipped with reason: ___
- [ ] `ERROR_HANDLING.md` — created ✅ or skipped with reason: ___
- [ ] `DATA_SCHEMAS.md` — created ✅ or skipped with reason: ___
- [ ] `LOG_FILES.md` — created ✅ or skipped with reason: ___

**Validate:** Agent can determine which docs to update after any change type using DOC_UPDATE_PROTOCOL. Agent can find config schemas and log file paths without reading source.

### Phase 7: Backfill & Maturity

> **Purpose:** Complete the skeleton entry point, add cross-references that couldn't exist during earlier phases, and verify the full system.

1. **Backfill entry point** — replace skeleton reading order with final version referencing all existing docs. Remove `⬜ pending` markers.
2. **Cross-reference fixup** — per-project docs from Phase 2 couldn't link to `CODEBASE_MAP` or `GLOSSARY`; add those links now.
3. **Bidirectional link audit** — every doc referenced is reachable; every doc references its parents.
4. **Conformance audit** — run conformance checklist on all docs.
5. **System Verification** — run full checklist (§6).
6. Review `PLATFORM_APIS.md` each OS release cycle.

#### When to Create a Decision Record

Create `{DECISION}_RECORD.md` in `docs/architecture/` when:
- Multiple approaches were evaluated and one was chosen
- A design decision affects ABI, public API, or cross-project boundaries
- A technology/library was adopted (or deliberately rejected)
- Reversing the decision later would be expensive

**Required fields:** Decision statement, Context, Options considered, Chosen option + reasoning, Consequences, Date.

#### Other Docs Created as Needed (Any Phase)

- `IPC_PROTOCOLS.md` — when inter-process communication is discovered during source reading
- `TESTING.md` — when testing strategy needs documentation

**Validate:** All cross-references resolve. Entry point reading order is complete. System Verification Checklist passes clean.

---

## 6. System Verification Checklist

Run when the doc system is first set up and periodically thereafter:

- [ ] Entry point exists and is auto-injected
- [ ] Every `docs/` subdirectory has a `README.md`
- [ ] Reading order table in entry point AND `ai-agents/README.md`
- [ ] CODEBASE_MAP covers all major tasks
- [ ] GLOSSARY defines all project-specific terms
- [ ] BUILD_GUIDE allows building all targets and running tests
- [ ] Every doc has the standard header block
- [ ] Every doc has a Related Docs table
- [ ] No orphan documents — all reachable from `docs/README.md`
- [ ] No duplicated content
- [ ] All cross-references resolve
- [ ] All `last-updated` dates current
- [ ] Project inventory verified from build configuration files (not guessed from directory names)
- [ ] Workspace dependencies scanned and documented (sibling repos checked per [Agent Rules §2.0](AGENT_BEHAVIOR_RULES.md))
- [ ] Project inventory table in root ARCHITECTURE.md
- [ ] Per-project ARCHITECTURE.md exists for each project
- [ ] Per-project WORKFLOWS.md exists for every project
- [ ] SHARED_ARCHITECTURE.md exists if shared code
- [ ] Threading + memory ownership documented
- [ ] Grounding rules block in entry point
- [ ] Reading protocol block in entry point
- [ ] `<!-- last-documented-commit -->` hash in entry point matches recent HEAD
- [ ] Every "Native-Specific" doc in §4 evaluated (created or explicitly skipped with documented reason)
- [ ] `LOG_FILES.md` exists if any project writes log files
- [ ] `DATA_SCHEMAS.md` exists if any project reads/writes config files
- [ ] `ERROR_HANDLING.md` exists if repo uses 2+ error handling patterns
- [ ] `IPC_PROTOCOLS.md` exists if any project communicates with other processes
- [ ] Document Inventory in checkpoint matches Document Catalog §4 (no undocumented gaps)

---

## 7. Quick Start Checklist

- [ ] Read all three plan files (Blueprint, Format Standard, Agent Rules)
- [ ] Run Phase 0: Project Discovery — identify all projects from build configs (§5 Phase 0)
- [ ] Create `.github/copilot-instructions.md` **skeleton** with project inventory, grounding rules, reading protocol
- [ ] Create `docs/` directory structure per §3
- [ ] Create `docs/README.md` (skeleton)
- [ ] Create `docs/architecture/{project}/ARCHITECTURE.md` for each project
- [ ] Create `docs/architecture/{project}/WORKFLOWS.md` for each project
- [ ] Create `docs/architecture/ARCHITECTURE.md` (thin repo-level orchestrator, aggregated from per-project docs)
- [ ] Create `docs/architecture/SHARED_ARCHITECTURE.md` (if applicable)
- [ ] Create `docs/architecture/BUILD_SYSTEM.md`
- [ ] Create `docs/architecture/THREADING_MODEL.md`
- [ ] Create `docs/architecture/MEMORY_OWNERSHIP.md`
- [ ] Create `docs/ai-agents/CODEBASE_MAP.md` (populated from per-project docs)
- [ ] Create `docs/ai-agents/GLOSSARY.md` (terms extracted from per-project docs)
- [ ] Create `docs/ai-agents/BUILD_GUIDE.md`
- [ ] Create `docs/ai-agents/AGENT_GUIDE.md`
- [ ] Create `docs/development/CONVENTIONS.md`
- [ ] Create `docs/ai-agents/DOC_TEMPLATE.md`
- [ ] Create `docs/architecture/PLATFORM_APIS.md`
- [ ] Create `docs/ai-agents/DOC_UPDATE_PROTOCOL.md`
- [ ] Create `docs/architecture/DATA_SCHEMAS.md`
- [ ] Create `docs/ai-agents/LOG_FILES.md`
- [ ] Backfill entry point — replace skeleton reading order with final version
- [ ] Cross-reference fixup — add links from per-project docs to CODEBASE_MAP/GLOSSARY
- [ ] Run system verification checklist (§6)
- [ ] Run agent smoke test (see [Agent Behavior Rules](AGENT_BEHAVIOR_RULES.md))

---

## Related Files

| Need... | Read... |
|---------|---------|
| How docs should look (headers, templates, conventions) | [FORMAT_STANDARD.md](FORMAT_STANDARD.md) |
| How the agent reads, verifies, avoids hallucination | [AGENT_BEHAVIOR_RULES.md](AGENT_BEHAVIOR_RULES.md) |

---

*Last Updated: 2026-04-10*
