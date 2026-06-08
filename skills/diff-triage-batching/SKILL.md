---
name: diff-triage-batching
description: 'Classify diff files into full-review vs light-review and build size-bounded batches for processing. Use when a diff spans multiple files and needs to be triaged and split for batch-based review or analysis.'
user-invocable: false
---

# Diff Triage & Batching Protocol

Classify changed files by review depth and build optimally-sized batches for downstream processing (review, test generation, or analysis).

## When to Use
- Before delegating diff files to a sub-agent (Reviewer, QA) in batches
- When processing multi-file diffs that exceed a single-pass token budget
- When separating cosmetic changes from substantive ones to skip unnecessary work

## When NOT to Use
- For single-file diffs — process directly, no batching needed
- When the full diff has already been fetched and fits in a single pass

---

## Core Principle

> **Triage before processing.** Classify files first to skip cosmetic changes, then batch substantive files to stay within processing limits.

---

## Procedure

### Step 1: Fetch File Metadata

Fetch file stats (NOT full diffs) using `uems_agent_diff_branches` with `stats: true`:

```
uems_agent_diff_branches({ repos: ["<repo>"], sourceBranch: "...", targetBranch: "...", stats: true })
```

This returns: file list, per-file line counts (+/-), and total stats — without full diff content.

If the tool does not support a `stats` parameter, fetch the full diff once and use it for both triage and batching (do NOT re-fetch per batch).

If the diff is empty for all repos → report "No changes between branches" and stop.

### Step 2: Triage — Classify Files

Scan each file's diff content (or stats) and classify:

| Category | Criteria | Action |
|---|---|---|
| **full-review** | Any logic, control-flow, API, type, or security-related change | Send to downstream processor |
| **light-review** | Only whitespace, comments, formatting, import reordering, or license headers | Skip processing — document as "No substantive changes" |

**Classification rules:**
- A file is **light-review** only if EVERY hunk in its diff is purely cosmetic
- If even one hunk contains a logic change, the file is **full-review**
- Project files (.vcxproj, .sln, .pbxproj) are **full-review** if they add/remove build targets or change build settings; **light-review** if only metadata/formatting
- Build scripts are always **full-review**

Present the triage results (file name + category) before proceeding.

### Step 3: Build Batches

Build batches from **full-review files only**. Light-review files are excluded.

**Batching rules:**

| Rule | Detail |
|---|---|
| **Max per batch** | 5 files OR ~300 lines of diff, whichever is reached first |
| **Grouping** | Same-directory files together. Mix directories only when a directory has < 3 changed files |
| **Large files** | If one file's diff exceeds 300 lines, it gets its own batch |
| **Batch size preference** | Prefer smaller batches over fewer large ones |
| **Never mix repos** | Each batch contains files from exactly one repo |
| **Truncation** | If a single file is itself truncated, include as-is and warn the downstream processor |

**Batch construction algorithm:**
1. Sort full-review files by repo, then by directory path
2. For each repo, group files by directory
3. Fill batches greedily: add files from the same directory until hitting the 5-file or 300-line limit
4. When a directory group is exhausted, start mixing in small groups from other directories
5. Large files (>300 lines) get their own dedicated batch

### Step 4: Fetch Diffs Per Batch

For each batch, fetch the actual diff content scoped to that batch's files:

```
uems_agent_diff_branches({ repos: ["<repo>"], sourceBranch: "...", targetBranch: "...", files: ["file1", "file2", ...] })
```

### Step 5: Validate

All of the following must be true before proceeding:

- [ ] Every repo returned a non-empty diff (or confirmed "no changes" and was excluded)
- [ ] No truncated diffs remain unacknowledged
- [ ] File list matches expected scope
- [ ] Triage classification complete — light-review files documented, full-review files batched
- [ ] Every full-review file is assigned to exactly one batch

### Output

Return:
1. **Triage results** — list of `{ file, category, repo, lines_added, lines_deleted }`
2. **Batch plan** — ordered list of batches, each with `{ batch_id, repo, files[], total_lines }`
3. **Light-review summary** — list of skipped files with one-line descriptions of why they're cosmetic

The caller iterates over the batch plan to invoke downstream processing (review, analysis, test generation) once per batch.
