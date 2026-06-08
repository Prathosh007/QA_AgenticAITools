# Delta Review Report Template

> Standard report format for all delta/diff review outputs. Used by the Delta Reviewer and any future review workflow that produces a report file.

---

## Report Structure

Every section is mandatory — use "None" if empty.

```
# Delta Review Report

**Source:** `<sourceBranch>`
**Target:** `<targetBranch>`
**Platform:** <platform>
**Date:** <YYYY-MM-DD>
**Verdict:** APPROVED | NEEDS_REVISION

---

## 1. Diff Summary

| Repo | Files | Insertions | Deletions |
|------|-------|------------|----------|
| <repo> | <n> | +<n> | -<n> |
| **Total** | **<n>** | **+<n>** | **-<n>** |

---

## 2. Verdict & Quality Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Correctness | <1-10> | <notes> |
| Security | <1-10> | <notes> |
| Change Impact | <1-10> | <notes> |
| Standards | <1-10> | <notes> |
| Architecture | <1-10> | <notes> |
| Maintainability | <1-10> | <notes> |
| **Overall** | **<1-10>** | Weighted average per review-standards.md §2 |

**Verdict: <APPROVED|NEEDS_REVISION>**

---

## 3. What's Good

- <strength 1>
- <strength 2>

---

## 4. Engineering Checklist

| Item | Status | Evidence | Notes |
|------|--------|----------|-------|
| A1 — Shared utilities | Pass/Fail/NA | `<file>:<line>` — <detail> | |
| A2 — No duplicates | ... | ... | |
| ... | ... | ... | |

---

## 5. Issues

### Blockers

> **Issue #1** — <short title>
> - **Severity:** Blocker
> - **Area:** <Security / Correctness / Performance / Style / Architecture / Change Impact>
> - **Location:** `<repo>/<file>` L<line>–L<line>
> - **Traced to:** `<symbol>` at `<file>:<line>` *(only if issue found by tracing a reference)*
> - **Description:** <what is wrong>
> - **Impact:** <why it matters>
> - **Recommendation:** <conceptual fix direction — no replacement code>
> - **OWASP:** <tag or —>
> - **Guideline:** <rule ID (e.g., C-INPUT-01, M-XPC-03, G-AUTH-01) or —>
> ```diff
> <exact diff lines — verbatim, not paraphrased>
> ```

### High

> (same format per issue)

### Medium

> (same format per issue)

### Low

> (same format per issue)

### Informational (Pre-existing — in traced references, not in the diff)

> (same format per issue, but these do NOT affect the verdict)

---

## 6. Needs Investigation

Issues suspected but not fully verified. These do NOT affect the verdict or quality scores.

> **NI #1** — <short title>
> - **Location:** `<repo>/<file>` L<line>–L<line>
> - **Concern:** <what might be wrong>
> - **Missing evidence:** <what could not be verified and what is needed>

---

## 7. Improvements (Nice to Have)

- <suggestion 1>
- <suggestion 2>

---

## 8. Cross-Repo Impact

<dependency impact summary, or "No cross-repo impact detected.">

---

## 9. Change Summary

| Category | Changes |
|----------|---------|
| **Logic Changes** | <bullet list of new functionality, behavior changes> |
| **Refactoring** | <bullet list of same-behavior restructurings> |
| **Bug Fixes** | <bullet list of explicit bug fixes with issue IDs> |
| **Config / Constant Changes** | <bullet list of new constants, build settings, flags> |
| **Dependency Changes** | <bullet list of new/removed binaries, libraries, frameworks> |

Omit categories with no changes.

---

## 10. Risk Assessment

| Risk Area | Level | Details |
|-----------|-------|---------|
| <area name> | HIGH / MEDIUM / LOW | <summary — reference issue numbers> |

### Breaking Changes & Backward Compatibility

<State whether changes are additive, breaking, or mixed. If breaking, list what breaks and migration path.>

---

## 11. Prioritized Recommendations

### P1 — Must Fix (Blocker + High)

1. **Issue #N:** <one-line description>

### P2 — Should Fix (Medium)

1. **Issue #N:** <one-line description>

### P3 — Nice to Have (Low)

1. **Issue #N:** <one-line description>
```

---

## HTML Output

When HTML format is selected, wrap the same structure in a styled HTML document with:
- A `<style>` block: clean sans-serif font, bordered tables, color-coded severity headers (Blocker=red, High=orange, Medium=yellow, Low=blue), green/red verdict badge
- All tables as `<table>` elements
- Verdict as a colored badge (`<span>` with background)
- Risk Assessment levels color-coded: HIGH=red, MEDIUM=orange, LOW=blue
- Prioritized Recommendations grouped with numbered lists under priority headers

---

## File Naming

- **Markdown:** `delta-review-<sourceBranch>-vs-<targetBranch>-<YYYY-MM-DD>.md`
- **HTML:** `delta-review-<sourceBranch>-vs-<targetBranch>-<YYYY-MM-DD>.html`
- Sanitize branch names: replace `/` with `-`
- Save in the first workspace folder
