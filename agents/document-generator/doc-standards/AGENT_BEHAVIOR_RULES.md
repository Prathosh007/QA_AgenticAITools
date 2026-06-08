# Agent Behavior Rules — Document Generator Edition

> **What this file is:** Document-generator-specific reading protocol, verification procedures, and task algorithms. Built on top of the shared grounding rules that apply to ALL agents.
>
> **Related files:**
> - [Grounding Rules](../../../guidelines/common/grounding-rules.md) — ⛔ **HARD RULE** — Anti-hallucination, grounding laws, pre/post-edit verification (shared across all agents)
> - [System Blueprint](SYSTEM_BLUEPRINT.md) — *what* to create, *where* to put it, *when*
> - [Format Standard](FORMAT_STANDARD.md) — *how* each doc should look (headers, templates, conventions)

---

## 1. Shared Grounding Rules (Mandatory)

⛔ **Read [`guidelines/common/grounding-rules.md`](../../../guidelines/common/grounding-rules.md) BEFORE doing any work.**

That file contains the Five Grounding Laws, Forbidden Assumptions, Source Citation Format, Forbidden Language Patterns, Handling Contradictions, and Pre/Post-Edit Verification checklists. They are non-negotiable for this agent.

### 1.1 Doc-Generator-Specific Additions

In addition to the shared rules, the Document Generator must also follow:

| Forbidden Pattern | Replace With |
|-------------------|-------------|
| "sub-project" / "the repo has one project with sub-projects" | Use "project" — read build configs to identify actual project boundaries. Each build target = one project. |
| "Repo = project" | Never assume. Check build configs for actual project inventory. |

### 1.2 Entry Point Grounding Block

Every entry point must include a condensed grounding rules block. See the full template in [Format Standard Appendix A](FORMAT_STANDARD.md).

### 1.3 Doc-Generator Pre-Edit Additions

In addition to the shared Pre-Edit Checklist (grounding-rules.md §6), the Document Generator must also verify:

- [ ] **I have read the project's ARCHITECTURE.md** in this session (not just the entry point)
- [ ] **I have checked CODEBASE_MAP.md** for the file paths relevant to this task

⛔ These two items are non-negotiable. The entry point is a summary — it does NOT replace reading the actual docs.

### 1.4 Doc-Generator Post-Edit Addition

In addition to the shared Post-Edit Protocol (grounding-rules.md §7):

6. **Verify documentation** — if change affects documented behavior, update docs

---

## 2. Agent Reading Protocol — Task-to-Action Algorithm

### 2.0 Workspace Dependency Discovery (Phase 0 — before any doc writing)

⛔ **MANDATORY before writing any documentation.** Skipping this causes hallucinated logging sections, wrong API references, and incorrect infrastructure docs.

```
WORKSPACE DEPENDENCY SCAN
    │
    ├─ Step 1: List all sibling repos in the workspace
    │   • ls the workspace root — every top-level directory is a potential dependency
    │
    ├─ Step 2: Identify confirmed dependencies
    │   • Grep the target repo for: import/include statements, linked
    │     libraries in build files (Makefile, CMakeLists.txt, build.gradle,
    │     .vcxproj, .xcodeproj, go.mod, Cargo.toml, package.json, etc.),
    │     #include, #import, @import, import, require, use statements
    │     referencing sibling repo names
    │   • Check build configs (ant.properties, .env, product.conf,
    │     .xcconfig, CMakePresets.json, conanfile.txt, vcpkg.json, etc.)
    │     for library/include search paths pointing to sibling repos
    │
    ├─ Step 3: Read the public API surface of each confirmed dependency
    │   • Focus on: logging frameworks, networking libraries, utility classes,
    │     crypto/security wrappers, IPC helpers, shared data types
    │   • Read header files (.h/.hpp), protocol/interface definitions,
    │     public module APIs, exported symbols, and type declarations
    │   • Do NOT read the full dependency repo — only the APIs the target repo uses
    │
    ├─ Step 4: Record findings in Phase 0 checkpoint
    │   • List each dependency repo, what it provides, and which target-repo
    │     projects consume it
    │   • Example: "shared-utils → LogEngine (logging), NetClient
    │     (networking), CommonTypes (shared data) — used by 12 projects"
    │
    └─ ⛔ GATE: Do NOT proceed to Phase 1 until dependency scan is complete.
          Docs about logging, error handling, networking, or any shared
          infrastructure WILL be wrong without this step.
```

### 2.1 The Reading Algorithm

```
RECEIVE TASK
    │
    ├─ Step 0: Parse the task
    │   • What is being asked? (bug fix, feature, refactor, question, review)
    │   • What project/module does it involve?
    │   • What context do I need? (architecture, code, build, threading, memory)
    │
    ├─ Step 0.5: Check workspace dependencies (if not done this session)
    │   • Run §2.0 Workspace Dependency Discovery
    │   • If already done this session, skip
    │
    ├─ Step 1: Read grounding rules + entry point (Layer 0)
    │   • Read `guidelines/common/grounding-rules.md` if not already read this session
    │   • Identify project from Project Inventory table
    │   • Note language, build system, critical rules
    │   • Read Grounding Rules block
    │   ⛔ The entry point is a ROUTING GUIDE, not a complete reference.
    │   ⛔ Do NOT jump to source code from here. Read the docs it links to first.
    │   OUTPUT: Project name, language, build command, constraints
    │
    ├─ Step 2: Route to project (multi-project only)
    │   • Open architecture/{project}/ARCHITECTURE.md — MANDATORY
    │   • Read module table + data flow for the task
    │   • If complex subsystem → also read architecture/{project}/WORKFLOWS.md
    │   • If shared code involved → also read SHARED_ARCHITECTURE.md
    │   ⛔ Do NOT skip this step. Without it you don't know which modules exist.
    │   OUTPUT: Module(s) involved, relationships, runtime flow
    │
    ├─ Step 3: Look up files (Layer 1) — MANDATORY
    │   • Open CODEBASE_MAP.md
    │   • Find "I want to..." row matching task type
    │   ⛔ Do NOT guess file paths. Look them up here.
    │   OUTPUT: Specific file paths
    │
    ├─ Step 4: Check terminology (Layer 2, if needed)
    │   • Unfamiliar terms → GLOSSARY.md
    │   OUTPUT: Definitions
    │
    ├─ Step 5: Read task guide (Layer 3, if needed)
    │   • Common task → AGENT_GUIDE.md
    │   • Building → BUILD_GUIDE.md
    │   OUTPUT: Step sequence
    │
    ├─ Step 6: Read actual source files (MANDATORY)
    │   • Read EVERY file you will modify — full content
    │   • Read HEADERS of functions/types you will call
    │   • Read BUILD CONFIG for affected target(s)
    │   • Look for thread-safety comments, ownership annotations, availability guards
    │   OUTPUT: Ground truth
    │
    ├─ Step 7: Read deep reference (Layer 4, only if needed)
    │   • Touching threads → THREADING_MODEL.md
    │   • Touching memory → MEMORY_OWNERSHIP.md
    │   • Touching OS APIs → PLATFORM_APIS.md
    │   • Touching build → BUILD_SYSTEM.md
    │   • Debugging/extending a complex flow → WORKFLOWS.md
    │   OUTPUT: Safety rules, constraints, and runtime flow context
    │
    ├─ Step 8: Verify you have enough context
    │   • What file(s) will I change? (known)
    │   • What function signatures am I calling? (verified)
    │   • What thread does this run on? (verified)
    │   • Who owns the memory? (verified)
    │   • How do I build and test? (known)
    │   • If ANY is "I don't know" → go back and read more
    │
    └─ Step 9: ACT
        • Make changes (follow grounding-rules.md §6 + §1.3 above)
        • Follow Post-Edit Protocol (grounding-rules.md §7 + §1.4 above)
        • Update docs per update protocol
        DONE
```

### 2.2 Reading Budget by Task Type

| Task Type | Typical Reading | Max Files |
|-----------|----------------|-----------|
| Simple bug fix (one file, known location) | Entry point → source → build | 3–5 |
| New feature (new file/module) | Entry point → CODEBASE_MAP → AGENT_GUIDE → source → deep ref | 8–15 |
| Refactoring (multiple files) | Entry point → ARCHITECTURE → CODEBASE_MAP → all source → deep ref | 10–20 |
| Cross-project change | Entry point → root ARCHITECTURE → both project archs → source → deep ref | 15–25 |
| Build system change | Entry point → CODEBASE_MAP → BUILD_GUIDE → build configs | 5–8 |
| Code review | Entry point → ARCHITECTURE → changed files + callers | 5–15 |
| Question / investigation | Entry point → CODEBASE_MAP → GLOSSARY → ARCHITECTURE | 3–8 |

**Budget overflow:** >25 files and still not enough context → task is too large. Break into sub-tasks.

### 2.3 When to Stop Reading

Stop and start acting when ALL true:

- [ ] You know which files to modify (exact paths, verified to exist)
- [ ] You've read the current content of every file you'll modify
- [ ] You know function signatures you'll call (verified from headers, not guessed)
- [ ] You know thread-safety requirements (or confirmed there are none)
- [ ] You know memory ownership rules (or confirmed standard rules apply)
- [ ] You know how to build the affected target(s)
- [ ] You know how to test your change

If ANY is missing → not done reading. If all checked but uncertain → proceed, build and test immediately.

### 2.4 Reading Patterns by Native Task

| Task | What to Read Before Acting |
|------|---------------------------|
| Add a new source file | CODEBASE_MAP, BUILD_SYSTEM, CONVENTIONS, existing file in same module |
| Fix a crash | Crash log → CODEBASE_MAP → source → THREADING_MODEL (if concurrent) → MEMORY_OWNERSHIP (if UAF) |
| Add platform API usage | PLATFORM_APIS → source → CONVENTIONS (error handling) |
| Modify shared library API | Header → all callers (grep) → ARCHITECTURE (dependents) → ABI impact |
| Add a build target | BUILD_SYSTEM → BUILD_GUIDE → existing target (pattern) → CODEBASE_MAP |
| Fix a threading bug | THREADING_MODEL → source → all call sites → lock/queue docs |
| Fix a memory leak | MEMORY_OWNERSHIP → source → allocation site → deallocation paths |
| Migrate deprecated API | PLATFORM_APIS → all usage sites (grep) → CONVENTIONS (migration pattern) |
| Add IPC between projects | Root ARCHITECTURE → IPC_PROTOCOLS → both project archs → source |
| Debug a complex workflow (HTTP, auth, transfer) | WORKFLOWS.md → relevant section → source files listed → ARCHITECTURE (if file inventory needed) |
| Extend a retry/fallback/recovery flow | WORKFLOWS.md → full flow diagram → source → identify extension point |

### 2.5 Context Window Recovery

```
CONTEXT OVERFLOW DETECTED
    │
    ├─ 1. STOP — finish only the current atomic step
    ├─ 2. UPDATE CHECKPOINT — if doc-generation is in progress,
    │     update docs/ai-agents/.doc-generation-checkpoint.md:
    │     • Mark completed phases ✅
    │     • Add all docs created to Document Inventory
    │     • Set Resume Instructions → exactly what to do next
    │     ⛔ This is MANDATORY — the next session depends on it
    ├─ 3. SAVE — write a scratch file:
    │     • Files read + findings
    │     • Changes made so far
    │     • What remains
    │     • Files still needed
    ├─ 4. BUILD — verify everything compiles
    ├─ 5. YIELD — end the turn
    │
    └─ ON RESUME:
          • Check for checkpoint file FIRST
          • Read scratch file
          • Re-read files you will modify
          • Verify last change (re-read, build, test)
          • Continue
```

### 2.6 Multi-Session Continuity

| Session Phase | Read | Write |
|--------------|------|-------|
| Session 1 start | Entry point → route → docs → source | Scratch file with findings + progress |
| Session 1 end | — | Update scratch file: done, next, key files |
| Session 2 start | Scratch file → re-read modified files → rebuild | — |
| Session 2 mid | Incremental source for remaining work | Update scratch file as work completes |
| Final session | Re-read all modified files for review | Update docs |

**Critical:** Never trust what a previous session "said" it did. Always re-read files and rebuild. Previous session may have made partial edits, edited wrong files, or hallucinated changes.

### 2.7 Large Codebase Scaling Rules (100K+ lines)

1. **Never read the entire codebase.** Use doc layers to navigate. Read only what your task requires.
2. **CODEBASE_MAP is your GPS.** Don't explore randomly.
3. **Read dependency chain, not breadth.** Modifying A → read A's callers and callees, not unrelated B.
4. **Verify file existence before reading.** Large repos move files frequently.
5. **Use grep to confirm, not discover.** Search for a specific function name, don't search broadly.
6. **Limit blast radius.** >10 files → break into sub-tasks.
7. **Track what you've read.** Note files read and findings. Prevents re-reading and fabricating memories.
8. **When in doubt, re-read.** Seconds to re-read vs hours debugging a wrong assumption.

### 2.8 Entry Point Reading Protocol Block

Every entry point must include a condensed reading protocol (steps 1–9 from §2.1). See the full template in [Format Standard Appendix A](FORMAT_STANDARD.md).

---

## 3. Verification & Quality

### 3.1 Per-Document Verification

Run the **Conformance Checklist** in [Format Standard §9.6](FORMAT_STANDARD.md) after creating or editing any document. Also verify thread-safety implications are noted where applicable.

### 3.2 Agent Smoke Test

After setting up the doc system, simulate an agent workflow:

1. **Read entry point only.** Can you identify all projects, languages, and build commands?
2. **Route to project.** Given "fix a bug in the agent daemon", route to correct architecture doc?
3. **Use CODEBASE_MAP.** Find the right file for "add a new module" in a specific project?
4. **Use BUILD_GUIDE.** Build a specific project and run its tests?
5. **Check GLOSSARY.** Understand every term in the entry point?
6. **Follow AGENT_GUIDE.** Complete a common task end-to-end?
7. **Per-project ARCHITECTURE.** Trace a data flow from platform event to core logic within one project?
8. **Per-project WORKFLOWS.** Trace a complex runtime workflow (e.g., HTTP request with retry/fallback) step-by-step without reading source?
9. **Root ARCHITECTURE.** Trace an inter-project dependency (CLI → Agent → Core Library)?
10. **THREADING_MODEL.** Determine which thread a given function runs on?
11. **MEMORY_OWNERSHIP.** Determine who owns an allocation returned by a function?
12. **Grounding test.** Ask about a function you haven't read. Do you say "I need to verify" or fabricate? If fabricate → grounding rules aren't working.
13. **Contradiction test.** Point to a doc that contradicts source code. Do you trust the code? If not → strengthen grounding rules.

If any step fails → documentation gap.

---

## Appendix C: Comparison — Generic vs Native Edition

| Area | Generic Plan | Native Edition (Multi-Project) |
|------|-------------|-------------------------------|
| Layer 4 docs | `DATABASE_SCHEMA.md` | `BUILD_SYSTEM.md`, `THREADING_MODEL.md`, `MEMORY_OWNERSHIP.md`, `PLATFORM_APIS.md`, `IPC_PROTOCOLS.md`, `WORKFLOWS.md` |
| Architecture | Single `ARCHITECTURE.md` | Root orchestrator + per-project + `SHARED_ARCHITECTURE.md` + per-project `WORKFLOWS.md` |
| Entry point | Generic | Project Inventory, Language, Build per Project, Memory, Threading, Boundaries |
| Build checks | "Project builds" | ALL targets build, ABI check, thread-safety, memory, platform divergence |
| Anti-hallucination | None | [grounding-rules.md](../../../guidelines/common/grounding-rules.md) — shared across all agents |
| Reading protocol | None | Step-by-step algorithm, reading budgets, when-to-stop criteria, context recovery |

---

## Related Files

| Need... | Read... |
|---------|---------|
| Anti-hallucination, grounding laws, verification | [grounding-rules.md](../../../guidelines/common/grounding-rules.md) |
| What to create, folder structure, rollout plan | [SYSTEM_BLUEPRINT.md](SYSTEM_BLUEPRINT.md) |
| How docs should look (headers, templates, conventions) | [FORMAT_STANDARD.md](FORMAT_STANDARD.md) |

---

*Last Updated: 2026-03-12*
