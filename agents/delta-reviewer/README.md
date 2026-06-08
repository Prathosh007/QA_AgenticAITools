# UEMS Agent Delta Reviewer

A standalone diff-review agent for the **UEMS Endpoint Central Agent** codebase. Given a source branch, target branch, and one or more repos, it fetches the diff and delegates a full engineering review to the **UEMS Agent Reviewer**.

**Platforms:** macOS (Swift 5 / Obj-C) · Linux (Go) · Windows (C/C++/C#)

**→ [Getting Started Guide](getting-started.md)** — Setup & usage instructions

---

## Why

Code reviews on large diffs are error-prone — reviewers miss security issues, skip checklist items, or lack context on referenced methods. This agent automates the process:

- Fetches the exact diff between branches (no manual copy-paste)
- Triages files — cosmetic-only changes (whitespace, comments, formatting) skip the reviewer entirely
- Traces call chains and references from changed code into their definitions
- Delegates to the UEMS Agent Reviewer which applies all engineering guidelines, OWASP security standards, and the A–M checklist — with inline self-review verification in a single pass
- Produces a fixed-format report (Markdown or HTML)

---

## How It Works

```
User provides: source branch, target branch, repos, platform
    │
    ▼
Steps 1–2: Collect inputs, setup & fetch repos + dependencies
    │
    ▼
Step 3: Load guidelines (mandatory gate — verifies all files present)
    │
    ▼
Step 4: Fetch diff, triage & batch
    │    ├─ Classify files: full-review (logic/security) vs light-review (cosmetic)
    │    ├─ Light-review files skip reviewer — noted as "No substantive changes"
    │    └─ Batch full-review files (max 5 files / 300 lines per batch)
    │
    ▼
Step 5: Impact check (dependency graph for shared repos)
    │
    ▼
Step 6: Delegate to UEMS Agent Reviewer (DELTA MODE + inline self-review)
    │    ├─ Reviews changed lines
    │    ├─ Traces referenced methods/types to their definitions
    │    ├─ Self-review: false-positive elimination + completeness re-scan
    │    └─ Pre-existing issues in traced code → Informational (don't block)
    │
    ▼
Steps 7–9: Compute scores → resolve NI items → ask format → generate report
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **Delegates to existing Reviewer** | Single source of truth for review rules — no duplicated guidelines |
| **DELTA MODE scope** | Changed files are primary; traces references for context but doesn't audit the entire codebase |
| **Pre-existing issues = Informational** | User is reviewing their diff, not the whole codebase — traced-reference bugs don't block the verdict |
| **Auto-batches large diffs** | Never passes truncated diffs — splits by file groups (max 5 files / 300 lines per batch) and invokes Reviewer per batch |
| **Risk-based triage** | Cosmetic-only files (whitespace, comments, formatting) skip the reviewer — saves sub-agent round-trips on large diffs |
| **Inline self-review** | Refinement checks (false-positive elimination, completeness re-scan, evidence verification) are embedded in the reviewer prompt — produces verified output in one pass instead of requiring a separate refinement round-trip |
| **Fixed report template** | Consistent structure across all reviews — not dependent on LLM output formatting |

---

## Report Sections

| # | Section | Content |
|---|---------|---------|
| 1 | Diff Summary | Per-repo file count, insertions, deletions |
| 2 | Verdict & Quality Score | 6 dimensions (1–10) + overall weighted score |
| 3 | What's Good | Specific strengths |
| 4 | Engineering Checklist | A–M items with Pass/Fail/NA + evidence (file:line) |
| 5 | Issues | Blocker → High → Medium → Low → Informational, each with location, diff snippet, traced reference |
| 6 | Needs Investigation | Suspected issues not fully verified |
| 7 | Improvements | Nice-to-have suggestions |
| 8 | Cross-Repo Impact | Dependency graph summary for shared repos |

---

## Tools Used

| Tool | Purpose |
|---|---|
| `uems_agent_setup_workspace` | Clone/fetch repos and verify workspace readiness |
| `uems_agent_load_guidelines` | Load common, platform, and review-standards guidelines |
| `uems_agent_load_skills` | Load skill procedures on demand (e.g., review-standards-reference, platform-confirmation-protocol) |
| `uems_agent_diff_branches` | Fetch diff between branches (supports file-scoped batching) |
| `uems_agent_dependency_graph` | Cross-repo impact analysis |

The **Reviewer sub-agent** additionally uses: `uems_agent_search_repos`, `uems_agent_list_components`, `uems_agent_find_wrapper` for reference tracing.
