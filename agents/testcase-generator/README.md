# UEMS Agent Testcase Generator

A standalone QA agent for the **UEMS Endpoint Central Agent**. Given a functionality name or a code diff between two branches, it generates structured manual test cases, converts them to GOAT JSON payloads, and produces a full summary report — in a single automated workflow.

**→ [Getting Started Guide](getting-started.md)** — Setup & usage instructions

---

## Why

Writing QA test cases manually is slow and incomplete — testers miss edge cases, duplicate existing coverage, and produce steps that don't match the real product behavior. Converting them to GOAT JSON manually is error-prone. This agent automates both:

- Gathers context from the **actual codebase** first (not just product docs)
- Discovers real config keys, log file names, registry paths, and process names from source files
- Maintains a **persistent testcase DB** — never regenerates what already exists
- Converts every test case to a GOAT JSON payload using only operations defined in `GOAT_Operations_Context.md`
- Reports unmappable steps in a named gap report — never silently skips
- Produces a summary report in both Markdown and HTML

---

## How It Works

```
User provides: functionality name (or source→target branch for diff mode)
    │
    ▼
Phase 0: DB health check — verify testcase DB is online
    │
    ▼
Phase 1: Collect inputs (mode, functionality name, branches if diff mode)
    │
    ▼
Phase 2: Generate test cases
    │    ├─ Layer 1: Codebase search — read source files, discover real artifacts
    │    ├─ Layer 2: KNOWLEDGE.md + existing CSV — enrich and avoid duplication
    │    ├─ Classify: Functionality → Sub-Functionality → Test Cases
    │    ├─ Categories: Happy Path → Bug Scenario → Failure → Edge → Negative → Integration → E2E
    │    └─ Merge into persistent DB — update, deprecate, or add
    │
    ▼
Phase 3: Convert to GOAT JSON (automatic after Phase 2)
    │    ├─ Map every step to a GOAT operation_type from GOAT_Operations_Context.md
    │    ├─ Fully mappable → save payload to goat-payloads/<TC-ID>.js
    │    └─ Any unmappable step → named gap report entry
    │
    ▼
Phase 4: Summary report (Markdown + HTML) + DB post
```

---

## Two Modes

| Mode | When to use | Input |
|------|------------|-------|
| **Functionality-level** | Create or expand test coverage for a feature | Functionality name (e.g., `Computer Rename`) |
| **Diff comparison** | Update test coverage after a code change | Source branch + target branch + repo |

---

## Output Files

| File | Location |
|------|----------|
| Test case CSV | `<FunctionalityName>_testcases.csv` (workspace root) |
| GOAT JSON payloads | `testcases/<FunctionalityName>/goat-payloads/<TC-ID>.js` |
| GOAT gap report | `testcases/<FunctionalityName>/goat-payloads/gap-report.md` |
| Markdown report | `testcases/<FunctionalityName>/reports/summary.md` |
| HTML report | `testcases/<FunctionalityName>/reports/summary.html` |
| Testcase registry | `testcases/<FunctionalityName>/testcase-registry.json` |

---

## Agent Definition

[`uems-agent-testcase-generator.agent.md`](uems-agent-testcase-generator.agent.md)

**Skills used:**
- [`testcase-generation`](../../skills/testcase-generation/SKILL.md) — context gathering, DB management, test case generation
- [`testcase-json-converter`](../../skills/testcase-json-converter/SKILL.md) — GOAT JSON conversion and gap reporting
