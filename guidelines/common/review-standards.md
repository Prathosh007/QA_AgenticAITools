# Review Standards — Severity, Scoring, Tracing & Evidence

Deterministic rules for severity assignment, quality scoring, symbol tracing, and evidence verification. These remove subjective judgment from the review process and ensure consistent results across sessions.

> **Applies to:** All review agents (Reviewer, Delta Reviewer, and any future review-producing agent).

---

## 1. Severity Classification

Every verified issue MUST be assigned a severity using **only** the criteria below. If an issue matches multiple severities, assign the **highest** match.

| Severity | Criteria (any single match qualifies) |
|---|---|
| **Blocker** | Security vulnerability exploitable at a privilege/trust boundary (OWASP violation in root/system/IPC context) · Data loss or corruption in production path · Crash or unrecoverable failure in production path · Breaking change to public API/IPC contract with no migration path |
| **High** | Security issue not at a privilege boundary · Missing input validation on external data (server, IPC, config, file) · Hardcoded secrets or credentials · Direct platform API usage bypassing existing Agent-Utils wrapper · Breaking change to internal interface affecting 2+ repos |
| **Medium** | Error handling gap (swallowed error, wrong error type, missing error propagation) · Resource leak in non-critical path · Concurrency issue (non-crash: stale data, race on non-critical state) · Naming/style violation in public API or protocol/interface definition |
| **Low** | Internal naming/style violation (private methods, local variables) · Missing comment on non-obvious logic · Minor code organization issue (file structure, import order) · Unnecessary code (dead code, redundant checks) |

### Severity rules

- **Informational** is reserved for pre-existing issues found in traced references — never for issues in the diff itself.
- If you cannot determine the severity with confidence, assign **Medium** as the default — never Blocker or High without concrete evidence.
- Security issues in code running as root/SYSTEM or handling IPC are **always** at least Blocker (privilege boundary = trust boundary).

---

## 2. Quality Scoring Formula

Each dimension starts at **10** and deducts points based on **Verified** issues in that dimension's area. Only Verified issues count — Needs Investigation issues do NOT affect scores.

### Deduction table

| Issue severity | Points deducted per occurrence |
|---|---|
| Blocker | −3 |
| High | −2 |
| Medium | −1 |
| Low | −0.5 |

### Dimension-to-area mapping

| Dimension | Counts issues in these areas |
|---|---|
| **Correctness** | Correctness, Performance |
| **Security** | Security |
| **Change Impact** | Change Impact |
| **Standards** | Style |
| **Architecture** | Architecture |
| **Maintainability** | All areas (each issue deducts **50%** of its normal value from Maintainability) |

### Calculation

1. For each dimension, sum the deductions from all Verified issues in its mapped areas.
2. Subtract from 10.
3. Floor at **1** (minimum score is 1, never 0).
4. **Overall** = weighted average: `(Correctness×2 + Security×2 + ChangeImpact×2 + Standards×1 + Architecture×1 + Maintainability×1) / 9`
5. Round all scores to nearest 0.5.

### Score interpretation (for reference only — does not override the formula)

| Score range | Meaning |
|---|---|
| 9–10 | Exceptional — could serve as a reference implementation |
| 7–8 | Good — production-ready with minor suggestions |
| 5–6 | Acceptable — works but has notable gaps |
| 3–4 | Below standard — significant issues must be fixed |
| 1–2 | Unacceptable — fundamental problems |

### Change Impact area — what counts

Issues are classified as **Change Impact** area (not Correctness or Security) when the problem is specifically about the *transition* from old behavior to new, not about the new code being wrong in isolation:

- Failure mode regression (default value change that flips fail-safe → fail-open)
- Removed capability without replacement path
- Storage/schema change without migration logic for existing installations
- Interface contract change without updating all callers
- Behavioral change that breaks existing operational workflows

If the issue would exist even in a greenfield implementation (not a diff), it belongs in Correctness or Security, not Change Impact.

### Behavioral Change Analysis Checklist

For every diff hunk, check each of these 4 items:

- [ ] **Default value changes**: If a default/fallback value changed (default constant, fallback return, error-case value), evaluate: does this change the failure mode? Does the old default fail-safe (deny/block/error) while the new one fails-open (allow/skip/silent)? A default value change in error/fallback paths is a behavioral regression until proven otherwise.
- [ ] **Removed code**: For every deleted function, method, code block, or entire component/module in the `-` lines, ask: what capability is lost? Is there a replacement in the `+` lines? If not, flag as a potential behavioral regression.
  - **Component-level removals**: If an entire component's processing logic, settings handler, or feature module is deleted, this is a **High**-severity finding unless an explicit replacement exists in the `+` lines.
  - **Settings processing**: If code that reads, writes, or processes component/feature settings is removed, verify the settings are still handled elsewhere. Silently dropped customer configurations = data loss.
  - Deleted "redundant" code often carries hidden business logic.
- [ ] **Storage/schema migration**: If the diff changes how or where data is stored (format, location, encryption, key names, schema), check: is there explicit migration logic for existing installations? If no migration code is present, flag it — existing data will be orphaned or misread on upgrade.
- [ ] **Interface contract changes**: If a public function signature, IPC contract, or protocol/interface definition changed, find all callers. Are all callers updated? An interface change without caller updates is a breaking change.

---

## 3. Symbol Tracing Procedure

When you need to understand a symbol (function, type, constant, protocol, API) referenced in the code under review, follow this exact procedure. **Never skip to reading a full file.**

**Step A — Search for the symbol definition:**
Search across all workspace repos for the symbol name. When multiple symbols need tracing, **batch them** — search for 2-3 related symbols in a single `uems_agent_search_repos` call using regex alternation (e.g., `symbolA|symbolB|symbolC`).

**Step B — Read only the definition (narrow range):**
From the search results, pick the definition hit (not a call site). Read **only** that line ± 10-15 lines.

**Step C — Check for a wrapper (if the symbol is a system/platform API):**
Check if an Agent-Utils wrapper exists for the capability. If a wrapper exists, STOP — treat as correct.

**Step D — Bidirectional data flow check (Priority 1-2 symbols only):**
For **security-sensitive** and **component boundary** symbols only: if you traced a read, also trace the corresponding write (and vice versa). Skip bidirectional checks for Priority 3 symbols.

### What NOT to do
- ❌ Read an entire file (hundreds of lines) to "find" a definition — search first
- ❌ Read files that are not referenced by the code under review
- ❌ Read the full implementation of a called function when only the signature matters
- ❌ Trace simple internal helpers with obvious names (e.g., `formatDate`, `buildPath`) — review the call site inline

### When to read more than ±15 lines
Only when the narrow range reveals the function delegates to another internal function and you need one more hop to understand a correctness or security concern.

### Trace depth rules
- **Priority 1 (security):** Max **2 hops** from the diff
- **Priority 2-3:** Max **1 hop** — signature + immediate logic only. If it delegates further, note "trace limit" and move on.
- **Stop at Agent-Utils wrappers** — do not trace into their implementation
- **Document skipped symbols.** If you hit the depth limit or stop rule, note the symbol name and reason in "Tracing Notes" at the end of your review.

### Symbol tracing cap
Scale to diff size: **`min(3 + files_changed × 2, 15)`**

| Files changed | Cap |
|---|---|
| 1 | 5 |
| 2-3 | 7-9 |
| 4-6 | 11-15 |
| 7+ | 15 |

When diffs are batched, each batch gets its own cap based on its file count.

### Symbol tracing priority
1. **Security-sensitive** (crypto, auth, input validation, privilege checks) — always trace, 2 hops, bidirectional
2. **Component boundaries** (IPC handlers, public APIs, protocol methods) — always trace, 1 hop, bidirectional
3. **Complex signatures** (3+ parameters, generics, callbacks/closures) — trace if under cap, 1 hop, no bidirectional

If more symbols need tracing than the cap allows, trace by priority and note the rest as "not traced — lower priority."

---

## 4. Evidence & Verification Rules

These rules prevent false positives. Every finding reported **must** survive these checks.

### 4.1 Exact Code Quotes — No Paraphrasing
- Every issue MUST include a verbatim code snippet from the diff or traced source.
- Do NOT paraphrase, approximate, or reconstruct code from memory. Copy it exactly.
- If you cannot quote the exact code, you cannot report the issue.

### 4.2 Verify Before Claiming
- Claims about external dependencies (database schema, API contracts, config formats) require **actual verification** — search or read to confirm.
- Never assert "function X does Y" without tracing to the actual definition.
- Never assert "parameter Z is missing" without verifying the actual function signature.
- If you cannot verify a claim with available tools, classify the issue as **Needs Investigation**.

### 4.3 Confidence Classification
Every issue must be classified:

| Classification | Meaning | Requirement |
|---|---|---|
| **Verified** | Traced the code, confirmed the behavior, and can quote exact evidence. | Default — every issue should aim for this. |
| **Needs Investigation** | Suspect a problem but cannot fully confirm with available context. | Clearly state what couldn't be verified and what evidence is needed. |

- **Only Verified issues** contribute to the verdict and quality scores.
- **Needs Investigation issues** are listed separately — they do NOT block approval or lower scores.
- When uncertain, **always** classify as Needs Investigation rather than asserting a false fact.

### 4.4 Per-Issue Verification Checklist
Before including any issue in a report, confirm:
- [ ] Code quote is copied verbatim from the diff or traced source
- [ ] Line numbers correspond to actual diff/file content
- [ ] External references (called functions, types, schemas) verified via tool trace
- [ ] Severity matches the actual demonstrated impact
- [ ] Issue is within review scope (changed code or directly referenced by changed code)

If any checkbox fails → either fix the finding or downgrade to **Needs Investigation**.

### 4.5 Blocker/High Re-Verification
Before finalizing any **Blocker** or **High** severity issue:
- Re-read the exact diff lines cited
- Re-trace the referenced symbol to confirm the behavior
- Confirm the issue is not a misreading of the code
- If any doubt remains, downgrade severity or reclassify as Needs Investigation

### 4.6 Definitive Language Only
- **Verified** issues MUST use definitive language: "does", "does not", "fails to", "is missing".
- NEVER use speculative language ("could", "might", "may", "possibly", "potentially") in Verified issues.
- If you cannot make a definitive statement, the issue is **Needs Investigation**, not Verified.

---

## 5. Approval Criteria

### APPROVED when:
- All applicable checklist items are **Pass** or **NA** (with valid justification)
- No **Blocker** or **High** severity issues remain
- Security review passes (no OWASP violations)
- Agent-Utils wrappers used exclusively; platform standards followed
- Overall quality score ≥ 7 (a score below 7 with no Blocker/High is a soft signal — may still APPROVE with a note recommending improvements)

### NEEDS_REVISION when:
- Any checklist item is **Fail**
- Any **Blocker** or **High** severity issue exists
- Security vulnerability, missing input validation, or hardcoded secrets found
- Direct platform API usage where Agent-Utils wrappers exist

---

## 6. Mandatory Issue Scan Checklist

After completing all review steps, run this completeness checklist against the diff. For each item, check and note pass/fail:

- [ ] **Input validation** (`C-INPUT-*`) — Is any external data (server, IPC, config, file, CLI) used without validation?
- [ ] **Auth at boundaries** (`C-AUTH-*`) — Are IPC/privilege boundary callers verified?
- [ ] **Error handling** — Are there catch/error paths that swallow errors, lose state, or fail to propagate?
- [ ] **Resource lifecycle** — Are there new allocations, handles, or observers without corresponding cleanup?
- [ ] **Concurrency** — Are there new shared-state accesses without synchronization?
- [ ] **Secrets handling** — Is any sensitive data logged, stored in plaintext, or left in memory after use?
- [ ] **Agent-Utils compliance** — Is any system/platform API used directly where a wrapper exists?
- [ ] **Component/method removals** — Are any complete methods, settings handlers, or component processing blocks deleted without a replacement in the `+` lines?
- [ ] **Behavioral Change Analysis** — Re-confirm all 4 items from §1 (default values, removed code, storage/schema, interface contracts) were checked.

This is a **completeness check** — if earlier review steps already caught an item, mark it as already covered. Only report new findings.

---

## 7. Change Classification Categories

When summarizing what changed in a diff, classify each logical change (a function, a constant, a build setting — not each file) into exactly one of these categories:

| Category | What Belongs |
|---|---|
| **Logic Changes** | New functionality, behavior changes, control-flow modifications, new code paths |
| **Refactoring** | Same behavior, different structure — renames, extractions, reorganizations, code moves |
| **Bug Fixes** | Explicit fixes to known issues. Cite commit message or issue ID when available |
| **Config / Constant Changes** | New constants, build settings, project file changes, feature flags, preprocessor defines |
| **Dependency Changes** | New or removed binaries, libraries, frameworks, build targets, package references |

**Rules:**
- Each logical change belongs to exactly one category — do not double-list
- If a category has no changes, omit it entirely
- Group by category, not by file — a single file may contribute changes to multiple categories
- Use bullet lists within each category row

---

## 8. Risk Assessment Format

After analyzing issues, produce a consolidated risk view that rolls up per-issue findings into risk areas. This gives readers a quick "where are the dangers" view without scanning every issue.

### Risk Table

One row per risk area (not per issue):

| Risk Area | Level | Details |
|---|---|---|
| *descriptive area name* | HIGH / MEDIUM / LOW | Summary — reference issue numbers |

**Level assignment:**

| Level | Criteria |
|---|---|
| **HIGH** | Risk area contains at least one Blocker or High severity issue |
| **MEDIUM** | Risk area contains only Medium severity issues |
| **LOW** | Risk area contains only Low severity issues |

**Rules:**
- Risk areas are functional groupings (e.g., "Process termination", "Memory management", "Input validation"), not severity labels
- Each risk area should reference the specific issue numbers that contribute to it
- If changes are purely additive with no risk findings, state "No risk areas identified — all changes are additive"

### Breaking Changes & Backward Compatibility

After the risk table, state:
- Whether the changes are **additive**, **breaking**, or **mixed**
- If breaking: what breaks and whether a migration path exists
- If additive: confirm no behavioral regressions (reference Change Impact score if available)
