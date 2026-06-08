---
name: tool-preference-rules
description: 'UEMS tool preference hierarchy: uems_agent_search_repos over grep_search, uems_agent_find_wrapper over manual search, targeted read_file over full-file reads. Use when deciding which tool to call or enforcing Agent-Utils mandatory wrapper usage.'
user-invocable: false
---

# UEMS Tool Preference Rules

Rules for choosing the right tool during UEMS Agent development and review. **Always prefer UEMS tools over generic built-in tools** — they search across all workspace repos simultaneously and understand the repo structure.

## When to Use
- Before making any search or file-read tool call — check this hierarchy first
- When writing code that touches system APIs — check Agent-Utils wrappers first
- When a generic tool (grep_search, semantic_search) returns poor results — switch to UEMS tools

## Tool Preference Table

| Instead of… | Use… | Why |
|---|---|---|
| `grep_search` / `semantic_search` to find symbols or callers | `uems_agent_search_repos` | Searches across all repos at once; returns repo-aware `file:line:text` results. |
| `grep_search` to check if a wrapper exists | `uems_agent_find_wrapper` | Knows the capability-to-keyword mappings per platform; searches the correct repo automatically. |
| `read_file` on an entire file to find a definition | `uems_agent_search_repos` first, then `read_file` on the **specific line range** returned. | Avoids reading hundreds of irrelevant lines. Only read ± 10-15 lines around the match. |
| Manual `git clone` commands | `uems_agent_setup_workspace` | Handles clone vs fetch automatically based on workspace state. |
| Manual tag format checks | `uems_agent_validate_tag` | Validates format against UEMS convention and checks existence. |

## UEMS Tools Reference

| Tool | When to Use |
|---|---|
| `uems_agent_load_guidelines` | Load engineering guidelines — call with `category: "common"` + `category: "platform"`. |
| `uems_agent_setup_workspace` | Clone/fetch repos and verify workspace readiness. Pass `platform` and optionally `repos`. |
| `uems_agent_search_repos` | Find code patterns across workspace repos. Pass `query` and optionally `repos`, `filePattern`. |
| `uems_agent_list_components` | Discover classes, protocols, structs in a repo. |
| `uems_agent_find_wrapper` | Check if Agent-Utils already wraps a capability before implementing from scratch. |
| `uems_agent_dependency_graph` | Understand cross-repo impact. Pass `repo` for focused view or omit for full platform graph. |
| `uems_agent_validate_tag` | Validate tag format and check if it exists in a repo before branching. |
| `uems_agent_create_branch` | Create branches from tags across multiple repos at once. |
| `uems_agent_diff_branches` | Get unified diff and per-file stats between two branches across repos. |

## Fallback Rules

Fall back to `grep_search` or `semantic_search` **only** when:
- The target is not in a UEMS workspace repo (e.g., system headers, third-party code)
- `uems_agent_search_repos` returns no results and you need a broader search

## Agent-Utils — Mandatory Usage

Agent-Utils provides wrappers for common system capabilities. Before writing code that touches system APIs:

1. **Search Agent-Utils** using `uems_agent_find_wrapper` for wrappers covering: networking, file operations, process execution, logging, secure storage, data parsing, crypto.
2. **Use the wrapper** — not the direct platform API.
3. **If no wrapper exists**, flag it to the Orchestrator — do NOT implement a one-off alternative.

### Hard Rules

- **Always** use Agent-Utils wrappers where they exist — networking, process, logging, credentials, file ops
- **Never** skip error handling — handle all error returns with typed/structured errors
- **Never** log sensitive information (tokens, keys, passwords, PII)
- **Never** hard-code secrets — use Agent-Utils secure storage wrapper
- **Always** use full paths for external commands
- **Always** validate all external inputs
- **Always** verify code/process signatures at trust boundaries
- **Always** follow platform API guarding rules from coding standards

### Targeted Reads Only

Search first with `uems_agent_search_repos`, then `read_file` on the specific line range returned (± 10-15 lines). **Never read an entire file to find a definition.**
