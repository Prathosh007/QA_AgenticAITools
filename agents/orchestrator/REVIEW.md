# UEMS Agent Orchestrator — Design Review (Historical)

> **Type:** One-time design review performed during v1 development.
> **Date:** 5–6 March 2026
> **Status:** Archived — issues listed as "fixed" are resolved. Remaining gaps are tracked in [TODO.md](TODO.md).

## Overall Rating: 9 / 10 ↑ (was 8.5)

A well-structured orchestrator with strong security governance, user-in-the-loop design, and mature workflow controls. The process layer is comprehensive — hotfix paths, commit workflows, context management, build verification, docs-first navigation, blocking checkpoint gates, and metrics telemetry. 10 language model tools and 9 chat agents (including Delta Reviewer, Explorer, and QA) are integrated into a VS Code extension. Linux and Windows platform support is complete. A dedicated QA agent generates manual test cases via `testing-standards.md`. The remaining gaps are automated unit testing, build automation beyond BUILD_GUIDE.md, and cross-platform multi-repo orchestration.

---

## Category Ratings

| Category | Score | Δ | Notes |
|---|---|---|---|
| Architecture & Role Separation | 9/10 | — | Clean 4-agent delegation, 4-tier complexity routing (hotfix/simple/medium/complex) |
| Security Integration | 9/10 | — | OWASP-aligned, mandatory review, platform security, privilege-aware |
| Guidelines & Standards | 9/10 | ↑ | 16 guideline files (7 common + 3 per platform × 3 platforms) loaded via `uems_agent_load_guidelines` tool. Version-controlled in repo, synced by extension. |
| Workflow & Gates | 9/10 | ↑ | 3 gates, user checkpoints, hotfix path, disagreement protocol, commit & deliver step, build dependency check |
| Multi-Repo Awareness | 8.5/10 | — | Dependency graph, impact analysis, cross-repo branching, per-repo review scoping |
| Tooling & Automation | 8/10 | ↑ | 10 VS Code languageModelTools (search, components, wrappers, dependencies, diff, branches, tags, workspace, guidelines, skills). Build via BUILD_GUIDE.md. No automated linting yet. |
| Testing Strategy | 7/10 | ↑ | Dedicated QA agent generates manual test cases (17-column CSV) via `testing-standards.md` guideline and `manual-test-generation` skill. Automated unit testing still deferred (no test infrastructure in repos). |
| Error Recovery & Resilience | 9/10 | ↑ | Max 3 review iterations, artifact persistence, **checkpoint & resume as blocking gates** (enforced via file tools at every phase boundary), metrics telemetry. No rollback yet. |
| Scalability (large tasks) | 8/10 | ↑ | Parallel dispatch + context management (summarize between phases, scope per task, review per repo) |
| Documentation | 9/10 | ↑ | Crisp README with session flow example, merged TODO/roadmap, hotfix path documented |

---

## What's Strong

1. **Mandatory 3-gate system** — Platform → Guidelines → Environment before any work. Blocks on failure. Prevents context errors.

2. **User confirmation at every phase boundary** — The orchestrator is not a black box. User sees findings at each phase and controls progression. Hotfix path batches checkpoints (3 → 1) without removing user control.

3. **Disagreement protocol** — Asks for reasoning, evaluates validity, cites standards, proposes compromises, documents overrides. Prevents blind acceptance or pushback loops.

4. **Security is non-negotiable** — OWASP alignment in every agent. Checklist items J1–J4, platform-security.md, Reviewer's mandatory security step. Multi-layer coverage.

5. **4-tier complexity routing** — Hotfix (auto-classify, batched checkpoints), Simple (Developer → Reviewer), Medium (+ Architect), Complex (full Planner loop). Right-sized ceremony for every task type.

6. **Commit & Deliver workflow** — Post-review commit, push, multi-repo coordination, delivery summary checkpoint. The "last mile" is covered.

7. **Context management** — Summarize between phases, scope per task, review per repo, reference over repetition. Addresses real context window limits for multi-repo tasks.

8. **Docs-first navigation** — Agents read per-repo documentation (`docs/ai-agents/`) before searching code. Build verification uses repo's BUILD_GUIDE.md with user dependency confirmation.

9. **Parallel development dispatch** — Architect groups tasks into batches; independent tasks execute simultaneously.

10. **Cross-repo dependency awareness** — Planner's Step 3e (dependency chain + change order) and repo-map Layer 0–4 hierarchy prevent cross-repo breakage.

---

## Remaining Gaps

### ~~1. No Testing Standards~~ → RESOLVED — Priority: ~~HIGH~~ DONE

Manual testing standards are now complete:
- `guidelines/common/testing-standards.md` — 17-column CSV output format, naming conventions, coverage categories, platform module mappings
- `skills/manual-test-generation/SKILL.md` — 7-step test generation procedure
- `UEMS Agent QA` (`uems-agent-qa.agent.md`) — dedicated QA sub-agent with pipeline and standalone modes
- Orchestrator pipeline updated: Developer → Reviewer → **QA** → Commit & Deliver

Automated unit testing remains deferred (no test infrastructure in repos yet).

**Tracked in:** TODO.md → Phase 3 ✅

### 2. ~~No MCP Tool Integration~~ → RESOLVED — Priority: ~~HIGH~~ DONE

9 VS Code `languageModelTools` now exist (not MCP — integrated directly into the extension):
`search_repos`, `list_components`, `find_wrapper`, `dependency_graph`, `diff_branches`, `validate_tag`, `create_branch`, `setup_workspace`, `load_guidelines`.
All agents reference these tools in their frontmatter and usage instructions.

**Tracked in:** TODO.md → Phase 2 ✅

### 3. No Build Automation — Priority: MEDIUM (downgraded from HIGH)

Build commands come from per-repo BUILD_GUIDE.md. Developer agent now reads BUILD_GUIDE.md and executes build steps. Still no automated:
- `swiftlint` / `swiftformat` execution as a gate
- Dependency-order resolution across repos (Layer 0 → 1 → 2 → 3)

**Tracked in:** TODO.md → Phase 3 → Build Automation

### 4. No Rollback Protocol — Priority: MEDIUM → MOSTLY RESOLVED

Recovery is mature; rollback is the remaining gap:
- **Session recovery: DONE** — checkpoint file (`.ai-docs/checkpoint.md`) tracks pipeline progress, sub-agent outputs, and resume instructions. Checkpoints are enforced as **blocking gates** with cross-platform tool commands (no bash dependency). See Orchestrator agent §Checkpoint Protocol + §Checkpoint & Resume.
- **Metrics telemetry: DONE** — per-task outcomes, review iterations, duration, token usage, and failure patterns accumulated in `.orchestrator-metrics.md`. See §Metrics & Telemetry.
- **Rollback: still pending** — no defined rollback steps (git reset, branch cleanup, stash management)

**Tracked in:** TODO.md → Backlog (rollback portion remaining)

### 5. ~~Guidelines Not Version-Controlled~~ → RESOLVED

Guidelines are now in `uems-ai-toolkit/guidelines/` (version-controlled, PR-reviewed). The UEMS Agent Chat extension syncs them to VS Code global storage. Agents load them via `uems_agent_load_guidelines` tool.

**Tracked in:** TODO.md → Phase 1 ✅

---

## What Was Fixed (This Session)

| # | Issue | Resolution |
|---|---|---|
| 1 | No build verification gate | Developer must run build from BUILD_GUIDE.md; Reviewer changed to "verification-only" (can run build/lint); orchestrator asks user about build dependencies before build |
| 2 | No commit/push/PR workflow | Added step 11 "Commit & Deliver" with push rules, multi-repo coordination, delivery checkpoint |
| 3 | Reviewer "read-only" contradiction | Changed to "verification-only" — may run build/lint commands but never modify code |
| 4 | No hotfix path | Added 4th tier: auto-classify, skip assessment checkpoint, batch Developer + Reviewer into one combined checkpoint |
| 5 | No context window strategy | Added `<context_management>` section: summarize between phases, scope per task, review per repo, reference over repetition |
| 6 | No usage examples | Added session flow walkthrough in README showing full gate → assess → plan → design → build → review → deliver |
| 7 | Docs-first navigation | Created `repo-documentation.md` guideline; all agents reference it. Build verification uses per-repo docs. |
| 8 | Testing was shallow/inline | Removed inline testing from agents. Added TODO placeholders. Full testing standards deferred to `testing-standards.md` guideline (Phase 3). |
| 9 | plan.md + TODO.md redundant | Merged into single TODO.md with phased roadmap structure |
| 10 | Build dependency gap | Orchestrator asks user to confirm dependencies before build; Developer workflow reads BUILD_GUIDE.md for requirements |

---

## Comparison with Webclient Orchestrator

| Dimension | Agent Orchestrator | Webclient Orchestrator |
|---|---|---|
| Gate system | 3 mandatory gates | None |
| User checkpoints | Every phase (hotfix: batched) | None |
| Security rigor | OWASP + platform security + mandatory review | Minimal |
| Codebase tools | 10 languageModelTools (Phase 2 ✅) | Fully integrated MCP |
| Testing | Dedicated QA agent (manual test cases, 17-column CSV) | Dedicated QA agent (389 lines) |
| Build verification | BUILD_GUIDE.md + user dependency check | Not visible |
| Complexity routing | 4 tiers (hotfix/simple/medium/complex) | 3 tiers, more relaxed |
| Commit workflow | Full (commit, push, multi-repo, delivery checkpoint) | None |
| Review mandate | Always mandatory | "Only if truly needed" |
| Disagreement handling | Full protocol (5-step) | None |
| Context management | 4 rules (summarize, scope, per-repo review, reference) | None |
| Guidelines | 7 files, 1000+ lines, docs-first navigation | Inline in agents |

**This orchestrator is significantly more rigorous** on security, governance, and workflow control. Both orchestrators now have dedicated QA agents. The tooling gap is closed with 10 language model tools. Remaining gap: automated unit testing and automated linting.

---

## Priority Action Items

| # | Action | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | ~~Create testing standards guideline~~ | ~~Testing maturity for security-critical code~~ | ~~Medium~~ | ✅ Phase 3 — testing-standards.md + QA agent |
| 2 | ~~Integrate MCP tools~~ | ~~2× faster codebase navigation~~ | ~~High~~ | ✅ Phase 2 — 10 languageModelTools |
| 3 | Build automation (swiftlint, linting gates) | Automated build verification | Medium | ⬜ Phase 3 |
| 4 | Rollback protocol (recovery done) | Resilience for failed pipelines | Low | ⬜ Backlog |
| 5 | ~~Version-control guidelines~~ | ~~Prevent guideline drift~~ | ~~Low~~ | ✅ Phase 1 — in repo + synced by extension |
