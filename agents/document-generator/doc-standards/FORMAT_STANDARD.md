# Documentation Format Standard — Native App Edition

> **What this file is:** How every doc should look — headers, templates, cross-referencing, naming, AI-navigation patterns, size limits, and update rules.
>
> **Related files:**
> - [System Blueprint](SYSTEM_BLUEPRINT.md) — *what* to create, *where* to put it, *when*
> - [Agent Behavior Rules](AGENT_BEHAVIOR_RULES.md) — *how* the AI agent reads, verifies, and avoids hallucination

---

## 1. Standard Header Block

**Every documentation file must open with this exact structure:**

```markdown
<!-- audience: {audience-tag} -->
<!-- doc-type: {doc-type-tag} -->
<!-- project: {project-name | repo-wide} -->
<!-- last-updated: YYYY-MM-DD -->

# {Title}

> 🎯 **Audience:** {Human-readable audience description}
> **Scope:** {Project name, or "All projects" / "Repo-wide"}
> **{Skip if | Read when}:** {Condition}

{One-sentence purpose statement — functional, not a welcome message.}
```

### 1.1 Tag Definitions

#### `audience` (required)

| Value | Meaning | Agent Behavior |
|-------|---------|----------------|
| `ai-agents` | Written for AI agents | Read normally |
| `both` | Useful to AI agents and humans | Read normally |
| `humans-only` | Process artifacts, archives | **Skip entirely** |

**`audience: both` optimization note:** Docs tagged `both` must still be agent-navigable — use lookup tables over prose, include machine-readable headers, and keep the same section skeleton. The difference is tone (may include human context), not structure. If a `both` doc becomes prose-heavy, either refactor it for agent readability or create an `ai-agents`-tagged companion with the lookup tables extracted.

#### `doc-type` (required)

| Value | How to Read | When to Use |
|-------|-------------|-------------|
| `reference` | Scan for your row; don't read linearly | Lookup tables, glossaries, schema listings |
| `guide` | Read top-to-bottom for that task | Step-by-step instructions |
| `decision` | Read when you need rationale | Architectural Decision Records |
| `log` | Skim headings; read entries on demand | Changelogs, refactoring logs |
| `workflow` | Read the section relevant to your subsystem | Runtime flow docs with step-by-step sequences |
| `template` | Read when creating or auditing docs | Format standards |

#### `project` (required in multi-project repos)

| Value | Meaning | Agent Behavior |
|-------|---------|----------------|
| `repo-wide` | Applies to all projects | Always relevant |
| `{project-name}` | Specific to one project | **Skip if working on a different project** |
| `shared` | Shared code used by multiple projects | Read when touching shared code |

#### `last-updated` (required)

ISO date `YYYY-MM-DD`. Updated when the file is meaningfully changed.

### 1.2 Read-Signal Line

**Form A — Skip-if** (reference/decision docs):
```markdown
> **Skip if:** {Condition under which agent should NOT read this}
```

**Form B — Read-when** (guides/logs):
```markdown
> **Read when:** {Situation that makes this doc necessary}
```

### 1.3 Purpose Statement

Immediately after the blockquote. Must be functional:

- ✅ `"Task-oriented lookup table mapping actions to file locations."`
- ❌ `"Welcome to the codebase documentation!"`

---

## 2. Section Skeletons by Doc Type

Define these in `DOC_TEMPLATE.md`.

| Doc Type | Skeleton |
|----------|----------|
| **Reference** | Header → Primary lookup table → Secondary sections → Related Docs → Footer date |
| **Guide** | Header → Prerequisites → Numbered steps → Verification checklist → Related Docs → Footer date |
| **Decision** | Header → Decision statement → Context → Reasoning → Consequences → Full record link → Related Docs → Footer date |
| **Log** | Header → Most recent entry → Older entries (reverse chronological) → Footer date |
| **Workflow** | Header → Table of Contents → Per-workflow sections (numbered, with ASCII flow diagrams) → Cross-cutting concerns → Related Docs → Footer date |

---

## 3. Cross-Referencing

### 3.1 Related Docs Table (REQUIRED at bottom of every doc)

```markdown
## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](path/to/CODEBASE_MAP.md) |
| Domain term definitions | [`GLOSSARY.md`](path/to/GLOSSARY.md) |
| Project-specific architecture | [`{project}/ARCHITECTURE.md`](path/to/{project}/ARCHITECTURE.md) |
```

**Rules:**
- Use relative paths from the current file.
- Phrase the left column as a need: "If you need X..."
- Keep tables under 10 rows — curate, don't enumerate.
- In multi-project repos, link to the **project-specific** doc when context is project-scoped.

### 3.2 Inline Contextual Links

Link to other docs when a concept is defined elsewhere, a file path is referenced, or a process is described in detail elsewhere:

```markdown
See [`AGENT_GUIDE.md § Adding a New Module`](path/AGENT_GUIDE.md#adding-a-new-module)
```

### 3.3 Reading Order Tables

The entry point and each directory's `README.md` must include a **numbered reading order table**:

```markdown
| # | File | Type | Read when |
|---|------|------|-----------|
| 1 | **CODEBASE_MAP.md** | reference | Every task |
| 2 | **GLOSSARY.md** | reference | Unfamiliar term |
| 3 | **BUILD_GUIDE.md** | guide | Need to build or test |
| 4 | **AGENT_GUIDE.md** | guide | Need full code examples |
```

### 3.4 Bidirectional Linking

When A links to B, check if B should link back. Key pairs:

- ARCHITECTURE.md ↔ CODEBASE_MAP.md
- ARCHITECTURE.md ↔ WORKFLOWS.md
- WORKFLOWS.md (hub) ↔ `{subsystem}-workflow.md` (sub-files)
- GLOSSARY.md ↔ CODEBASE_MAP.md
- BUILD_SYSTEM.md ↔ BUILD_GUIDE.md
- THREADING_MODEL.md ↔ CONVENTIONS.md
- MEMORY_OWNERSHIP.md ↔ CONVENTIONS.md

### 3.5 Quick Links by Topic

In `docs/README.md`, provide a flat lookup table for all docs:

| Topic | File |
|-------|------|
| File locations | `ai-agents/CODEBASE_MAP.md` |
| Domain terms | `ai-agents/GLOSSARY.md` |
| Detailed workflows | `architecture/{project}/WORKFLOWS.md` |
| Build system | `architecture/BUILD_SYSTEM.md` |
| How to build | `ai-agents/BUILD_GUIDE.md` |
| Threading | `architecture/THREADING_MODEL.md` |
| Memory ownership | `architecture/MEMORY_OWNERSHIP.md` |
| Platform APIs | `architecture/PLATFORM_APIS.md` |

---

## 4. Naming & Indexing Conventions

### 4.1 File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Core doc | `SCREAMING_SNAKE_CASE.md` | `CODEBASE_MAP.md` |
| Decision record | `{TOPIC}_DECISION_RECORD.md` | `CONCURRENCY_MODEL_DECISION_RECORD.md` |
| Workflow hub | `WORKFLOWS.md` | `WORKFLOWS.md` |
| Sub-workflow | `{subsystem}-workflow.md` | `httphandler-workflow.md` |
| Feature architecture | `{FEATURE}_ARCHITECTURE.md` | `NETWORKING_ARCHITECTURE.md` |
| Index | `README.md` | (one per directory) |

### 4.2 Section Headings

- Use `##` (H2) for major sections. `###` (H3) for subsections. Never skip levels.
- Use descriptive, action-oriented headings: `## Adding a New Build Target`, not `## Targets`.

### 4.3 Table Conventions

| Table Type | Columns |
|-----------|---------|
| Navigation | `\| Task \| File(s) \|` |
| Status | `\| Stage \| Description \| Status \|` |
| Definition | `\| Term \| Definition \|` |
| Mapping | `\| Change Type \| Update These Files \|` |
| Build | `\| Target \| Language \| Output \| Description \|` |

---

## 5. AI-Navigation Optimization Techniques

### 5.1 Three-Line Triage

Lines 1–3 of every file are machine-readable HTML comments (`audience`, `doc-type`, `last-updated`). An agent reads just these to decide: Should I read? How? Is it current?

### 5.2 Task-Oriented Lookup Tables

`CODEBASE_MAP.md` is structured as **"I want to do X → look in file Y"** tables, not file trees. Example sections:

- **Module & Component Operations** — add a module, add a source file, add a Swift file, add a Go package
- **Platform & OS Operations** — add an entitlement, register an IPC service, add a platform API, support a new OS version
- **Build Operations** — add a target, add a dependency, change compiler flags, add cross-compilation

### 5.3 Progressive Disclosure via Reading Order

The reading order table with "Read when" conditions lets agents stop early. Agents read Layer 0 always, Layer 1 next, then layers 2–5 only as needed.

### 5.4 Inline Condensation in Entry Point

The entry point should contain **inline condensed versions** of critical content — project inventory, build commands, key terms, memory/threading summaries, critical rules, common tasks, and file locations. See **Appendix A** for the full section list.

### 5.5 Search-Friendly Content

- Use exact file names, class names, function names in docs — agents may grep for them.
- Include realistic identifiers, not `Foo`/`Bar` placeholders.
- Put the most important information first in each section (inverted pyramid).
- Include typical compiler error messages in debugging sections.

### 5.6 "What NOT To Do" Sections

Include `### ⚠️ NEVER` and `### ✅ ALWAYS` lists with language-specific rules and reasons. E.g.:
- ❌ Call `malloc()` without documenting ownership in the header comment
- ❌ Dispatch to main thread from background queue without checking
- ✅ Use `__weak` captures in Obj-C blocks referencing `self`
- ✅ Document thread-safety guarantees in header comments

### 5.7 Connection Tables

Show component connections in table form:

```markdown
| Component A | Connects to | Via | Thread |
|-------------|-------------|-----|--------|
| AppDelegate | ServiceManager | Direct init | Main |
| ServiceManager | NetworkModule | Protocol | Background |
```

### 5.8 File Size & Complexity Warnings

Flag large/complex files agents should handle carefully:

```markdown
| File | Lines | Language | What to know |
|------|-------|----------|--------------|
| `ServiceManager.m` | ~1200 | Obj-C | Core state machine; modify carefully |
```

### 5.9 Language Boundary Documentation

Document where languages meet:

```markdown
| Boundary | Bridge Mechanism | Files | Gotchas |
|----------|-----------------|-------|---------|
| Swift ↔ Obj-C | Bridging header | `*-Bridging-Header.h` | Nullability annotations required |
| Go ↔ C | CGo | `// #cgo` directives | CGo calls not goroutine-safe by default |
```

### 5.10 Navigation Prevents Hallucination

Every question an agent might guess at should have a documented answer. If agents hallucinate about X, document X. The docs above (CODEBASE_MAP, THREADING_MODEL, MEMORY_OWNERSHIP, BUILD_GUIDE, WORKFLOWS) each eliminate a category of guesswork.

---

## 6. Entry Point Design

The entry point (`.github/copilot-instructions.md`) is the most important document. Auto-injected every session. Must be self-contained enough for most tasks.

### 6.1 Required Sections

See **Appendix A** for the full entry point template with all required sections. Key sections: Project Inventory, Build & Test, Reading Order, Key Concepts, Memory/Threading summaries, Critical Rules, Grounding Rules ([Agent Rules §1](AGENT_BEHAVIOR_RULES.md)), Reading Protocol ([Agent Rules §3](AGENT_BEHAVIOR_RULES.md)), Common Tasks, Debugging.

### 6.2 Design Principles

1. **Be concise but complete** — 200–500 lines. Not a book, not a stub.
2. **Project routing first** — Project inventory table must be the first useful section.
3. **Inline critical content** — Don't just link to THREADING_MODEL; include the thread map inline.
4. **Duplicate strategically** — Entry point is the ONE place controlled duplication is OK.
5. **Language context is paramount** — Always specify which language a rule applies to.
6. **Build context per project** — Build instructions per project near the top.

---

## 7. Content Patterns for Doc Types

### 7.1 Root ARCHITECTURE.md (Repo-Level)

Contains ONLY the project inventory and shared infrastructure. No per-project details.

> ⛔ **The root ARCHITECTURE.md is `architecture/ARCHITECTURE.md` — NOT `architecture/{repo-name}/ARCHITECTURE.md`.** The repo name is never a project name in multi-project repos. Each row in the Project Inventory table is a build target discovered from build configs (see [Blueprint §3 — Project Identification](SYSTEM_BLUEPRINT.md)).

**Required tables:**
- Project Inventory: `| Project | Directory | Language | Type | Purpose |`
- Inter-Project Dependencies: `| Consumer | Depends On | Via | Notes |`
- Shared Infrastructure: `| Component | Directory | Used By | See |`

### 7.2 Per-Project ARCHITECTURE.md

One per project in `architecture/{project}/`. Self-contained architecture for that project.

**Required sections:**

| # | Section | Content |
|---|---------|---------|
| 1 | Project Overview | Purpose, platforms, responsibilities, NOT responsible for |
| 2 | Module Table | `\| Directory \| Language \| Responsibility \|` |
| 3 | Architecture Diagram | ASCII or table showing component relationships |
| 4 | Data Flow | Step → component → language → action → thread (see §7.3) |
| 5 | Entry Points | Where execution begins (main, daemon start, etc.) |
| 6 | Component Descriptions | 2–3 sentence summary per major component |
| 7 | Dependencies | External + internal deps on other projects/shared libs |
| 8 | Configuration | Config files, env vars, feature flags |
| 9 | Known Issues / Gotchas | Quirks, workarounds |
| 10 | Outstanding Tasks | Planned improvements |

### 7.3 Data Flow Documentation

Use table-based flows reflecting native patterns:

```markdown
| Step | Component | Language | Action | Thread |
|------|-----------|----------|--------|--------|
| 1 | Platform Layer | Swift/Obj-C | Receives OS event | Main |
| 2 | Bridge Layer | Obj-C++/CGo | Translates to core types | Main |
| 3 | Core Logic | C/C++ | Processes business logic | Worker |
```

### 7.4 Feature Architecture Documents

For complex features, create `{FEATURE}_ARCHITECTURE.md`. Required sections:

1. Feature Overview — what it does, entry points
2. Module Ownership — which modules/languages own which parts
3. File Map — every relevant file with purpose and language
4. Threading Model — which threads this feature uses
5. Memory Ownership — ownership boundaries
6. Platform Dependencies — OS APIs, entitlements, version requirements
7. Extension Points — how consumers extend/customize
8. Known Gotchas — quirks, workarounds, platform differences

### 7.5 Per-Project WORKFLOWS.md

Mandatory companion to ARCHITECTURE.md for every project. Documents step-by-step runtime workflows — the dynamic behavior that static architecture docs cannot capture.

**Every project gets a WORKFLOWS.md.** Simple projects may have 1–2 workflows; complex projects will have many.

#### Hub vs Sub-Workflow Files

When a project has many complex subsystems, WORKFLOWS.md becomes a **hub/index** that links to per-subsystem sub-workflow files:

```
architecture/{project}/
  WORKFLOWS.md                      ← Hub: index + small workflows + cross-cutting concerns
  httphandler-workflow.md            ← Sub-workflow: HTTP lifecycle, server types, retry/fallback
  authprops-workflow.md              ← Sub-workflow: Auth flows, SSL/TLS trust, error recovery
  controlled-transfer-workflow.md    ← Sub-workflow: Chunked download/upload, resume, rate limiting
  proxy-workflow.md                  ← Sub-workflow: Proxy config, proxy verification
  security-totp-workflow.md          ← Sub-workflow: Security settings download, TOTP
```

**Split trigger (MANDATORY — not a suggestion):**
- ⛔ **MUST split** when a project has **>2 independent subsystems** — do NOT wait for the 600-line limit. Count subsystems by distinct source-file groups with different responsibilities (e.g., HTTP, auth, download = 3 subsystems → must split).
- ⛔ **MUST split** when WORKFLOWS.md exceeds 600 lines — this is a hard fallback trigger.
- The sub-agent creating per-project workflows MUST evaluate this split decision **before** creating any file. If split is required, create the hub + sub-workflow files, not a single WORKFLOWS.md.

**Hub WORKFLOWS.md structure (when split):**

| # | Section | Content |
|---|---------|---------|
| 1 | Sub-Workflow Index | `\| # \| Sub-Workflow File \| Covers \| Read when \|` |
| 2 | Quick-Route Decision Tree | ASCII tree: "What are you debugging? → which sub-file" |
| 3 | Small Workflows (inline) | Workflows under ~40 lines stay in the hub |
| 4 | Cross-Cutting Concerns | Shared patterns spanning multiple sub-workflows |
| 5 | Related Docs | Links to ARCHITECTURE.md, CODEBASE_MAP, GLOSSARY |

**Sub-workflow files** use the same skeleton as single-file WORKFLOWS.md, plus a `Skip-if` line linking back to the hub. Named `{subsystem}-workflow.md` (lowercase, hyphen-separated), matching the primary source file or concept (e.g., `httphandler-workflow.md`, `authprops-workflow.md`).

**Required structure (single-file WORKFLOWS.md, when not split):**

1. **Table of Contents** — Numbered list of all workflows, linked to sections
2. **Per-Workflow Sections** (numbered `## 1. Workflow Name`) — Each containing:
   - **Files** — Source files involved
   - **ASCII Flow Diagram** — Step-by-step control flow (box-and-arrow)
   - **Decision Trees** — Conditional branches as tree diagrams
   - **Key Rules** — Retry, fallback, error recovery, idempotency
   - **Per-variant tables** — Behavior differences by mode/config
3. **Cross-Cutting Concerns** — Patterns across multiple workflows
4. **Related Docs** — Links to ARCHITECTURE.md, CODEBASE_MAP, GLOSSARY

**Content rules:** Prefer ASCII diagrams over prose. Use decision trees for conditional logic. Use tables for per-variant behavior. Cite source files in every workflow section. Link to ARCHITECTURE.md instead of repeating the file inventory.

**What NOT to include:** File inventories (ARCHITECTURE.md), function signatures (source code), build instructions (BUILD_GUIDE.md), term definitions (GLOSSARY.md).

---

### 7.6 System Boundaries (Multi-Project)

Document both inter-project and intra-project boundaries:

**Inter-Project** (root `ARCHITECTURE.md`):
```markdown
| From Project | To Project | Mechanism | Data Format | Thread |
|-------------|-----------|-----------|-------------|--------|
| CLI | Agent Daemon | XPC | Protobuf | Dedicated I/O |
```

**Intra-Project** (per-project `ARCHITECTURE.md`):
```markdown
| Layer | Directory | Language | What lives here |
|-------|-----------|----------|-----------------|
| Entry | `src/agent/cmd/` | Go | CLI parsing, bootstrap |
```

### 7.7 Build Target Documentation

In `BUILD_SYSTEM.md`:
- Targets table: `| Target | Type | Language | Output | Description |`
- Dependency graph: `| Target | Depends On |`

### 7.8 Glossary Entry Structure

Each entry: definition paragraph → Code References (types, functions, packages) → Platform Notes → Related Terms. For pattern/concept entries, add usage examples per language.

### 7.9 Platform API Inventory

In `PLATFORM_APIS.md`:
- Usage table: `| API/Framework | Used In | Purpose | Min OS | Entitlement |`
- Deprecated APIs table: `| API | Deprecated Since | Replacement | Status | Tracked In |`

### 7.10 Data Schemas (Configuration & Payload Files)

Create `DATA_SCHEMAS.md` when the project uses structured config files (plists, XML, JSON) that an agent would need to understand to implement new config types or debug data issues.

**Required sections:**

1. **Schema Index** — `| Config File | Format | Project | Purpose | Read when |`
2. **Per-Schema Sections** — For each config file:
   - File path and format (plist, XML, JSON)
   - Sample structure (realistic, annotated)
   - Field inventory: `| Field / Key | Type | Required | Default | Description |`
   - Relationships to other config files (e.g., "loaded by X, feeds into Y")
   - Validation rules or constraints
3. **Data Object (DO) Patterns** — If the project uses typed configuration objects:
   - DO class → config file mapping: `| DO Class | Source File | Config File | Direction |`
   - Sample XML/plist showing how a DO serializes
4. **Related Docs** — Link to ARCHITECTURE.md, GLOSSARY (for config terms)

**Example schema section:**
```markdown
### agent-params.plist

**Path:** `{install_dir}/config/agent-params.plist`  
**Format:** Binary plist | **Loaded by:** `ConfigManager.swift` → `AgentParams`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| ServerURL | string | yes | — | Management server endpoint |
| CheckInInterval | integer | no | 3600 | Seconds between check-ins |
| LogLevel | string | no | INFO | DEBUG, INFO, WARN, ERROR |
```

### 7.11 Log Files

Create `LOG_FILES.md` when the project writes log files that are useful for debugging. This saves agents from grepping source code to find log paths.

**Required content:**

1. **Log File Index** — `| Log File | Path | Project | Format | Rotation | Read when |`
2. **Per-Log Details** (for important logs):
   - Log levels and what each level captures
   - Key log messages and what they indicate (error signatures)
   - How to enable verbose/debug logging
3. **Debugging Quick Reference** — `| Symptom | Check This Log | Grep For |`

**Example:**
```markdown
| Log File | Path | Project | Format | Rotation |
|----------|------|---------|--------|----------|
| Agent daemon log | `/var/log/agent/daemon.log` | AgentDaemon | text, timestamped | Daily, 7 files |
| Enrollment log | `/var/log/agent/enrollment.log` | AgentDaemon | text, timestamped | On enrollment |
| Helper tool log | `~/Library/Logs/helper.log` | HelperTool | os_log | System managed |
```

---

## 8. Documentation Update Protocol

### 8.0 Diff-Based Change Discovery

Do NOT scan the entire repo on every update. Use git to identify exactly what changed, then update only the affected docs.

#### Entry point metadata

The entry point must include a commit tracking field:

```markdown
<!-- last-documented-commit: abc123f -->
```

#### Discovery flow

```
1. Determine changed files:
   • PR/branch context (preferred): git diff --name-only origin/main...HEAD
   • Ad-hoc / periodic: read last-documented-commit from entry point → git diff --name-only {hash}..HEAD
   • Fallback (no hash): full repo scan (first time only)
2. Map each changed file to doc type using §8.1 table
3. Read ONLY changed source files + affected docs
4. Update affected docs
5. Update <!-- last-documented-commit --> to current HEAD
```

#### Mapping changed files to docs

| Changed File Pattern | Likely Doc Impact |
|---------------------|-------------------|
| `*.swift`, `*.m`, `*.c`, `*.go` (source) | ARCHITECTURE, CODEBASE_MAP, WORKFLOWS |
| `*.h` (header) | ARCHITECTURE (if public API), consumer docs |
| `CMakeLists.txt`, `*.xcodeproj`, `Makefile`, `go.mod` | BUILD_SYSTEM, BUILD_GUIDE |
| `*.plist`, `*.xml`, `*.json` (config) | DATA_SCHEMAS |
| Entitlements, provisioning profiles | PLATFORM_APIS |
| New directory created | CODEBASE_MAP, possibly new project ARCHITECTURE |

Then use the detailed **§8.1 Change-Type → Doc-File Mapping** table for precise doc targeting.

### 8.1 Change-Type → Doc-File Mapping

| Change Type | Update These Files |
|-------------|-------------------|
| Module/package restructuring | ARCHITECTURE.md, CODEBASE_MAP.md, BUILD_SYSTEM.md |
| New source file | CODEBASE_MAP.md, BUILD_SYSTEM.md (if new target) |
| New build target/scheme | BUILD_SYSTEM.md, BUILD_GUIDE.md, CODEBASE_MAP.md |
| Header file API change | ARCHITECTURE.md (if public), consumer docs |
| New platform API usage | PLATFORM_APIS.md, CODEBASE_MAP.md |
| New threading pattern | THREADING_MODEL.md, CONVENTIONS.md |
| Memory ownership change | MEMORY_OWNERSHIP.md |
| New language boundary | ARCHITECTURE.md (boundary table), CONVENTIONS.md |
| New domain concept | GLOSSARY.md |
| File moved/renamed | CODEBASE_MAP.md |
| New compiler flag | BUILD_SYSTEM.md, CONVENTIONS.md |
| New IPC mechanism | IPC_PROTOCOLS.md, ARCHITECTURE.md |
| Deprecated API migration | PLATFORM_APIS.md |
| New/changed complex runtime flow | WORKFLOWS.md |
| New error handling pattern | ERROR_HANDLING.md |
| New/changed config file or plist schema | DATA_SCHEMAS.md |
| New/changed log file or log location | LOG_FILES.md |


### 8.2 Per-Stage Doc Update Checklist

After every completed refactoring stage:

- [ ] ARCHITECTURE.md updated if structure changed
- [ ] CODEBASE_MAP.md updated if files moved/added/deleted
- [ ] BUILD_SYSTEM.md updated if targets/flags/deps changed
- [ ] GLOSSARY.md updated if new terms
- [ ] THREADING_MODEL.md updated if concurrency changed
- [ ] MEMORY_OWNERSHIP.md updated if ownership rules changed
- [ ] PLATFORM_APIS.md updated if new OS APIs used
- [ ] `<!-- last-updated -->` and footer dates refreshed on all touched docs

### 8.3 Shared Library/SDK Docs Timing

If your project produces a library consumed by others, update consumer-facing docs **only after** the coding task is complete and verified — never mid-task.

---

## 9. Maintainability & Scalability Rules

### 9.1 Document Size Limits

| Doc Type | Target | Hard Limit |
|----------|--------|------------|
| `guide` | <300 lines | 400 lines |
| `reference` | <400 lines | 500 lines (split if larger) |
| `decision` | <100 lines | 150 lines (link to full record) |
| `log` | No limit | Append-only |
| `template` | <350 lines | 400 lines |
| `workflow` | <500 lines | 600 lines (split into `{subsystem}-workflow.md` files if larger) |
| `workflow` (sub-file) | <300 lines | 400 lines (further split only if clearly separable) |
| Entry point | 200–500 lines | 600 lines |

### 9.2 When to Split

Split when:
- ARCHITECTURE.md covers multiple projects → extract each into `architecture/{project}/ARCHITECTURE.md` (where `{project}` = actual build target name, NOT the repository name)
- Per-project architecture exceeds 500 lines → extract features into `{FEATURE}_ARCHITECTURE.md`
- Per-project WORKFLOWS.md exceeds 600 lines OR the project has >2 independent subsystems → ⛔ **MUST split** by subsystem into `{subsystem}-workflow.md` files (lowercase, hyphen-separated). WORKFLOWS.md becomes an index/hub linking to sub-files. The subsystem count trigger takes priority — do NOT create a single file for complex projects just because initial content is short.
- A reference doc exceeds 500 lines → extract sub-topics
- A guide has multiple independent workflows → separate guide files
- CONVENTIONS.md exceeds 400 lines → per-language convention files
- BUILD_SYSTEM.md or PLATFORM_APIS.md exceeds 500 lines → split per-project

### 9.3 Multi-Project Split Decision Matrix

| Document | Split when... | Keep unified when... |
|----------|--------------|---------------------|
| ARCHITECTURE.md | **Always** in multi-project repos | N/A — root = thin orchestrator |
| BUILD_SYSTEM.md | Different build systems or complex targets | All share one simple build |
| THREADING_MODEL.md | Different concurrency models | Same threading rules |
| MEMORY_OWNERSHIP.md | Different languages or strategies | Same language and rules |
| PLATFORM_APIS.md | Different platforms | Same platform |
| CONVENTIONS.md | Per-language >400 lines | Fits in one file |
| WORKFLOWS.md | >600 lines or 3+ distinct workflow domains | Fits in one file; <3 workflow domains |
| CODEBASE_MAP.md | Rarely split; use project sections | Almost always keep unified |

### 9.4 Freshness Enforcement

- Every doc has `<!-- last-updated: YYYY-MM-DD -->` tag and `*Last Updated: YYYY-MM-DD*` footer.
- Both must match and be updated on meaningful changes.

### 9.5 No Orphan Documents

Every document must be: listed in its directory's `README.md`, reachable from `docs/README.md`, and cross-referenced in at least one Related Docs table.

### 9.6 Conformance Checklist (Per Document)

- [ ] Lines 1–3: `<!-- audience -->`, `<!-- doc-type -->`, `<!-- last-updated -->`
- [ ] Blank line before `#` heading
- [ ] `> 🎯 **Audience:**` line present
- [ ] Read-signal line present
- [ ] Purpose statement present (functional, not greeting)
- [ ] `## Related Docs` section at bottom
- [ ] Footer date matches `<!-- last-updated -->` tag
- [ ] No duplicated content (linked instead)
- [ ] Under the line limit
- [ ] Language specified for all code fences

---

## 10. Adapting to Native Architecture Patterns

### 10.1 CODEBASE_MAP Adaptation

| Architecture | Example Task | Example Location |
|-------------|-------------|-----------------|
| Layered (Core + Platform) | Add core logic | `src/core/` |
| MVC (Apple) | Add a controller | `Sources/Controllers/` |
| Agent (daemon/service) | Add a command handler | `pkg/handlers/` |
| Plugin Architecture | Add a plugin | `plugins/{name}/` |
| Library + Demo | Add a public API | `include/` + `src/` |
| Go Service | Add a package | `pkg/{package}/` |

### 10.2 GLOSSARY Adaptation

For native repos, also define: platform terms (entitlement, code signing identity), build terms (target, scheme, toolchain, module map), memory terms (ownership transfer, borrowed reference, autoreleasepool), threading terms (dispatch queue, goroutine, mutex, atomic property).

### 10.3 ARCHITECTURE Adaptation

| Pattern | Focus |
|---------|-------|
| Multi-platform app | Per-platform modules and shared core |
| Daemon/agent | Lifecycle (install, start, run, stop, uninstall) |
| Framework/library | Public API surface, ABI stability, versioning |
| Go service | Package/internal structure, goroutine topology |
| C/C++ project | Header organization, linking, symbol visibility |

### 10.4 CONVENTIONS Adaptation

Cover per-language sections: C (snake_case, header guards, ownership comments), Objective-C (Apple naming, `nonatomic`, nullability), Swift (API Design Guidelines, access control, `throws`), Go (exported=uppercase, `error` returns, `pkg/`+`internal/`), C++ (project-specific naming, RAII, exception policy).

---

## Appendix A: Entry Point Template (Multi-Project Native Repo)

```markdown
<!-- last-documented-commit: {commit-hash} -->
# {AI Tool} Instructions for {Repo Name}

## Repo Overview
{2–3 sentences: what it ships, target platforms}

## Project Inventory
| Project | Directory | Language | Type | Purpose | Architecture Doc | Workflows |
|---------|-----------|----------|------|---------|------------------|-----------|
| {Project A} | `src/a/` | {lang} | {exe/lib} | {purpose} | [`a/ARCHITECTURE.md`](docs/architecture/a/ARCHITECTURE.md) | [`a/WORKFLOWS.md`](docs/architecture/a/WORKFLOWS.md) |
| {Shared Lib} | `src/core/` | {lang} | Static lib | {purpose} | [`SHARED_ARCHITECTURE.md`](docs/architecture/SHARED_ARCHITECTURE.md) | — |

> 🚦 **Working on a specific project?** Read its architecture doc first.

## Language & Platform
| Property | Value |
|----------|-------|
| **Languages** | {e.g., C, Obj-C, Swift, Go} |
| **Platforms** | {e.g., macOS 12+, Linux} |
| **Build System** | {e.g., CMake, Xcode, Go} |

## Build & Test
### {Project A}
{build + test commands}
### All Projects
{build-all command}

## 📚 Documentation Reading Order
| # | File | Type | Read when |
|---|------|------|-----------|
| 1 | CODEBASE_MAP | reference | Every task |
| 2 | GLOSSARY | reference | Unfamiliar term |
| 3 | BUILD_GUIDE | guide | Need to build/test |
| 4 | AGENT_GUIDE | guide | Need code examples |
| 5 | {project}/ARCHITECTURE | reference | Deep-dive into a project |
| 5a| {project}/WORKFLOWS | workflow | Debugging/extending complex flows |

> ⛔ **Steps 1–5 are NOT optional.** Read CODEBASE_MAP (step 1) and the project's ARCHITECTURE.md (step 5) before touching any source file. This entry point is a routing guide, not a substitute for the docs it links to. Skipping to code = hallucination risk.

## Key Concepts
{Top 5–10 terms with one-line definitions}

## Language Boundaries
| Boundary | Mechanism | Key Files |
|----------|-----------|-----------|

## Memory Ownership Rules (Summary)
{Top 5 rules — link to MEMORY_OWNERSHIP.md}

## Threading Rules (Summary)
{Thread map + top 5 rules — link to THREADING_MODEL.md}

## Code Conventions (per language)
{Abbreviated naming tables}

## File Locations (Quick Reference)
{Top 15 CODEBASE_MAP entries with project column}

## Critical Rules
### ⚠️ NEVER
{5–10 anti-patterns, language-specific}
### ✅ ALWAYS
{5–10 required practices, language-specific}

## ⚠️ Grounding Rules — READ EVERY SESSION
1. Never guess. If you haven't read the file, don't claim to know what's in it.
2. Read before you edit. Always read current content before modifying.
3. Cite your sources. Reference file and location.
4. Say "I don't know" when you don't know. Then go find out.
5. Verify after you act. Re-read. Build. Test.
6. Source code is ground truth. When docs and code disagree, trust code.
7. No forbidden words without evidence. "Probably" → "let me verify."
8. Re-read if in doubt. Re-reading is cheap.

## 📖 Reading Protocol — Follow For Every Task

1. Parse the task — what's being asked? Which project?
2. Route to project — Project Inventory → open its ARCHITECTURE.md
3. Look up files — CODEBASE_MAP → "I want to..." row → note paths
4. Check terms — unfamiliar? → GLOSSARY
5. Read the guide — common task? → AGENT_GUIDE or BUILD_GUIDE
6. Read the source — MANDATORY: every file you will modify + headers you will call
7. **Check safety** — threads? → THREADING_MODEL. Memory? → MEMORY_OWNERSHIP. APIs? → PLATFORM_APIS. Complex flow? → WORKFLOWS
8. Verify readiness — exact files, signatures, threads, ownership, build command? If not → read more
9. Act — changes → build → test → update docs

⛔ NEVER skip Steps 1–5 — this entry point is a summary, the linked docs have the details you need.
⛔ NEVER skip Step 6 — docs may be stale; source code is truth.
⛔ NEVER edit a file you haven't read in THIS session.
⛔ NEVER guess a function signature — read the header.

## Common Tasks
### {Task 1}
{Checklist}
### {Task 2}
{Checklist}

## Debugging
### Common Compiler Errors
{Error → Cause → Fix}
### Common Runtime Crashes
{Crash → Cause → Fix}

## Log Files (Quick Reference)
| Log File | Path | Project | Read when |
|----------|------|---------|----------|
| {daemon log} | `/var/log/{project}/daemon.log` | {Project} | Service failures |
> Full details: [`LOG_FILES.md`](docs/architecture/LOG_FILES.md)

## Large Files to Be Aware Of
| File | Lines | Project | Language | Warning |
|------|-------|---------|----------|---------|

## Resources
{Links to all docs, organized by project}
```

---

## Related Files

| Need... | Read... |
|---------|---------|
| What to create, folder structure, rollout plan | [SYSTEM_BLUEPRINT.md](SYSTEM_BLUEPRINT.md) |
| How the agent reads, verifies, avoids hallucination | [AGENT_BEHAVIOR_RULES.md](AGENT_BEHAVIOR_RULES.md) |

---

*Last Updated: 2026-03-05*
