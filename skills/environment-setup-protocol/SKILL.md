---
name: environment-setup-protocol
description: 'Workspace environment setup protocol for UEMS Agent development. Use when cloning repos, validating tags, creating branches, fetching dependencies, or verifying workspace readiness before development or review work.'
user-invocable: false
---

# Environment Setup Protocol

Standardized procedure for preparing the UEMS workspace before development or review work. Covers repo cloning, tag validation, branch creation, dependency discovery, and verification.

## When to Use
- Before starting any development task (Orchestrator Gate 2)
- Before diff-based review (Delta Reviewer setup)
- When cloning repos, validating tags, or creating branches
- When discovering upstream dependencies for cross-repo impact analysis

## Core Steps

### E1 — Identify Affected Repos

- Determine which repositories are needed from the task description
- Reference `guidelines/<platform>/repo-map.md` for the full repo list and dependency chain

### E2 — Clone / Checkout

Use `uems_agent_setup_workspace` to clone missing repos and fetch latest for existing:
```
uems_agent_setup_workspace({ platform: "<platform>" })
```
- For specific repos: pass `repos: ["repo1", "repo2"]`
- The tool handles clone vs fetch automatically

### E3 — Tag Validation (when branching from a tag)

Validate tag before branching using `uems_agent_validate_tag`:
```
uems_agent_validate_tag({ repo: "<repo>", tag: "<tag>" })
```
- Invalid format → report expected format, ask user to correct
- Tag doesn't exist → tool lists similar tags; show closest matches
- Do NOT proceed with an invalid or missing tag

### E4 — Branch Creation (when creating feature/bugfix branches)

After tag validation, create branches using `uems_agent_create_branch`:
```
uems_agent_create_branch({ repos: ["<repo1>", "<repo2>"], branch: "<branch_name>", from: "<tag_or_branch>" })
```
- Validate branch name against `git-conventions.md` conventions first
- For multi-repo tasks, use the **same branch name** across all repos

### E5 — Dependency Discovery (when reviewing or analyzing cross-repo impact)

For each target repo, get upstream dependencies:
```
uems_agent_dependency_graph({ repo: "<repo>", platform: "<platform>", direction: "up" })
```
Clone any dependency repos not already in workspace:
```
uems_agent_setup_workspace({ repos: ["<dep1>", "<dep2>", ...], platform: "<platform>" })
```

### E6 — Branch Checkout (when switching to a specific branch for review/tracing)

Checkout a specific branch across repos:
```
uems_agent_setup_workspace({ repos: ["<repo1>", ...], platform: "<platform>", branch: "<branch>" })
```
The tool checks out the branch where it exists and skips repos where it doesn't.

### E7 — Verification

After setup, confirm:
- [ ] All affected repos are cloned and on the correct branch
- [ ] Branch name follows convention (if created)
- [ ] Base tag/branch is valid and exists (if specified)
- [ ] `git status` is clean in each repo (no uncommitted changes)
- [ ] Both source and target branches exist (if doing diff/review)
- [ ] All upstream dependency repos cloned/fetched (if dependency discovery was done)

If any check fails → report to the user and resolve before proceeding.

## Agent-Specific Usage

| Agent | Steps Used | Notes |
|---|---|---|
| **Orchestrator** | E1 → E2 → E3 → E4 → E7 | Full setup with tag validation and branch creation |
| **Delta Reviewer** | E1 → E2 → E5 → E6 → E7 | Setup with dependency discovery and branch checkout |
| **Document Generator** | E1 → E2 → E7 | Minimal setup for source reading |

Not all steps are needed every time. Use only the steps relevant to the task.

## Blocking Gate

This is a blocking gate — no work proceeds until verification passes. If any check in E7 fails, stop and resolve before continuing.
