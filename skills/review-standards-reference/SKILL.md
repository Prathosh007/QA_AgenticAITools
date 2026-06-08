---
name: review-standards-reference
description: 'Quality scoring formula, severity classification, approval criteria, and evidence rules for UEMS code review. Use when computing quality scores, assigning issue severity, determining review verdicts, or verifying evidence requirements.'
user-invocable: false
---

# Review Standards Quick Reference

Deterministic rules extracted from `review-standards.md`. When this skill and the guideline diverge, `review-standards.md` is authoritative.

## When to Use
- When computing quality scores after a review (scoring formula)
- When assigning severity to a found issue (classification table)
- When determining APPROVED vs NEEDS_REVISION verdict (approval criteria)
- When merging results across batched review invocations (batch merging rules)

## Severity Classification (§1)

| Severity | Criteria (any single match qualifies) |
|---|---|
| **Blocker** | Security vulnerability exploitable at privilege/trust boundary · Data loss/corruption in production path · Crash/unrecoverable failure in production path · Breaking public API/IPC contract with no migration |
| **High** | Security issue not at privilege boundary · Missing input validation on external data · Hardcoded secrets · Direct platform API bypassing Agent-Utils wrapper · Breaking internal interface affecting 2+ repos |
| **Medium** | Error handling gap · Resource leak in non-critical path · Concurrency (non-crash) · Naming/style in public API |
| **Low** | Internal naming/style · Missing comment on non-obvious logic · Code organization · Dead code |

- **Informational**: Pre-existing issues in traced references only — never for issues in the diff
- If uncertain → Medium as default (never Blocker/High without concrete evidence)
- Security in root/SYSTEM/IPC context → always at least Blocker

## Quality Scoring Formula (§2)

Each dimension starts at **10**. Deduct per Verified issue:

| Severity | Deduction |
|---|---|
| Blocker | −3 |
| High | −2 |
| Medium | −1 |
| Low | −0.5 |

### Dimension Mapping

| Dimension | Counts issues in areas |
|---|---|
| Correctness | Correctness + Performance |
| Security | Security |
| Change Impact | Change Impact |
| Standards | Style |
| Architecture | Architecture |
| Maintainability | All areas at **50%** deduction |

### Calculation Steps

1. For each dimension, sum deductions from Verified issues in its mapped areas
2. Subtract from 10, floor at **1** (minimum)
3. **Overall** = `(Correctness×2 + Security×2 + ChangeImpact×2 + Standards×1 + Architecture×1 + Maintainability×1) / 9`
4. Round all scores to nearest 0.5

### Example

1 High Security (−2), 2 Medium Correctness (−1 each):
- Correctness = 10−2 = 8, Security = 10−2 = 8, Change Impact = 10, Standards = 10, Architecture = 10
- Maintainability = 10−(1+0.5+0.5) = 8
- Overall = (16+16+20+10+10+8)/9 = 80/9 ≈ 9.0

## Approval Criteria (§5)

**APPROVED** when:
- All checklist items are Pass or NA (with valid justification)
- No Blocker or High severity issues remain
- Security review passes (no OWASP violations)
- Agent-Utils wrappers used exclusively; platform standards followed
- Overall quality score ≥ 7

**NEEDS_REVISION** when any above fails.

## Evidence Rules (§4)

1. **Exact quotes** — every issue needs verbatim code from the diff/traced source (§4.1)
2. **Verify before claiming** — search/read to confirm claims about dependencies, APIs, schemas (§4.2)
3. **Confidence classification** — Verified (traced + confirmed) or Needs Investigation (suspected, can't fully confirm) (§4.3)
4. **Per-issue checklist** — code quote verbatim, line numbers match, externals verified, severity matches impact, within scope (§4.4)
5. **Blocker/High re-verification** — re-read diff lines + re-trace before finalizing (§4.5)
6. **Definitive language only** for Verified issues — no "could", "might", "may" (§4.6)

Only Verified issues affect verdicts and scores. Needs Investigation items are listed separately.

## Batch Merging Rules

When review is batched across multiple Reviewer invocations:
- **Issues**: union all, deduplicate by location
- **Checklist**: Fail in any batch = Fail; Not verifiable only if no batch could verify
- **Scores**: take the **lowest** per dimension across batches
- **Verdict**: APPROVED only if ALL batches APPROVED
- **Informational**: collected separately, excluded from verdict/scores
