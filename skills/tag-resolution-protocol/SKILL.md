---
name: tag-resolution-protocol
description: 'Resolve user-provided tags or version numbers to actual git tag names per repo. Use when source/target refs may be tags with repo-specific prefixes (e.g., DCAGENT_, AGENT_UTILS_) that need discovery.'
user-invocable: false
---

# Tag Resolution Protocol

Resolve user-provided tags or bare version numbers to actual git tag names in each repo. Tag product prefixes differ across repos but version numbers stay the same.

## When to Use
- When the user provides a tag (e.g., `DCAGENT_26.05.01`) or bare version (e.g., `26.05.01`) as a source or target ref
- Before calling `uems_agent_diff_branches` with tag refs
- In any workflow that operates on tag ranges (review, QA, release notes)

## When NOT to Use
- When both source and target are plain branch names (no version numbers)
- When the user provides exact, verified tag names for each repo

---

## Core Principle

> **Discover, don't guess.** The agent does NOT know which product prefix a repo uses — it must call the validation tool to find out.

---

## Procedure

### Input

- **Tag refs:** One or two user-provided strings that contain version numbers (e.g., `DCAGENT_26.05.01`, `26.05.01`, `UEMS_AGENT_UTILS_26.03.01-alpha02`)
- **Repos:** List of repos in scope

### Step 1: Detect Tags

A ref is a tag if it contains a version number pattern matching `YY.MM.BUILD` (e.g., `26.05.01`, `26.03.01-alpha02`). Flag each ref that matches for resolution.

If neither ref is a tag, skip this protocol entirely.

### Step 2: Resolve Per Repo

For each tag ref flagged in Step 1, and for **each repo** in scope:

1. Call `uems_agent_validate_tag({ repo: "<repo_name>", tag: "<user_provided_tag>" })`
   - If the user gave a bare version (e.g., `26.11.01`), pass it as-is — the tool returns similar tags containing that version.

2. Handle the response:

| Response | Action |
|---|---|
| **Tag exists** | Use it as-is |
| **Similar tags returned** | Select the tag whose version number matches. Log: `"<repo>: <user_input> → <resolved_tag>"` |
| **No similar tags** | Mark repo as **failed** |

### Step 3: Build Resolved Refs Map

Build a per-repo map: `repo → { source: <resolved_source>, target: <resolved_target> }`

### Step 4: Validate

All of the following must be true:

- [ ] Every tag ref resolved to an existing tag in every repo
- [ ] Resolved tags all share the same version number as the user-provided tag
- [ ] Resolution log is ready to show the user for confirmation

If any repo failed to resolve → **STOP** and inform the user. Do NOT proceed with partial resolution.

### Output

Return the **per-repo resolved refs map** and the **resolution log** (list of `"<repo>: <user_input> → <resolved_tag>"` entries).

**Important:** From this point forward, all downstream tools (`uems_agent_diff_branches`, `uems_agent_setup_workspace`) must use the **resolved refs per repo** — NOT the original user-provided tag.
