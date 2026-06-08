---
name: symbol-tracing
description: 'Trace symbol definitions, call chains, and data flow during code review. Use when verifying function signatures via uems_agent_search_repos, checking Agent-Utils wrapper usage via uems_agent_find_wrapper, or doing bidirectional read/write analysis.'
user-invocable: false
---

# Symbol Tracing Procedure

Deterministic procedure for tracing symbols (functions, types, constants, protocols, APIs) during UEMS code review. **Never skip to reading a full file.**

## When to Use
- During code review when a diff references an external symbol (function, type, constant)
- When verifying a called function's signature, return type, or thread-safety
- When checking if an Agent-Utils wrapper exists for a platform API
- When tracing data flow (read ↔ write) across components

## Procedure

### Step A — Search for the symbol definition

Search across all workspace repos for the symbol name using `uems_agent_search_repos`.

When multiple symbols need tracing, **batch them** — search for 2-3 related symbols in a single call using regex alternation:
```
uems_agent_search_repos({ query: "symbolA|symbolB|symbolC", filePattern: "*.<ext>" })
```

### Step B — Read only the definition (narrow range)

From the search results, pick the **definition** hit (not a call site). Read **only** that line ± 10-15 lines using `read_file`.

### Step C — Check for a wrapper (if the symbol is a system/platform API)

Use `uems_agent_find_wrapper` to check if an Agent-Utils wrapper exists for the capability. **If a wrapper exists, STOP** — treat as correct.

### Step D — Bidirectional data flow check (Priority 1-2 symbols only)

For **security-sensitive** and **component boundary** symbols only: if you traced a read, also trace the corresponding write (and vice versa). Skip bidirectional checks for Priority 3 symbols.

## Tool Mapping

| Step | Tool | Notes |
|------|------|-------|
| A (search) | `uems_agent_search_repos` | Batch 2-3 symbols via regex alternation |
| B (narrow read) | `read_file` | Definition ± 10-15 lines only |
| C (wrapper check) | `uems_agent_find_wrapper` | If wrapper found → STOP tracing |
| D (bidirectional) | Repeat A-B | Priority 1-2 only |

## Depth Rules

| Priority | Max Hops | Bidirectional |
|----------|----------|---------------|
| Priority 1 (security: crypto, auth, input validation, privilege) | 2 hops from diff | Yes |
| Priority 2 (boundaries: IPC handlers, public APIs, protocol methods) | 1 hop | Yes |
| Priority 3 (complex signatures: 3+ params, generics, closures) | 1 hop | No |
| Simple helpers (`formatDate`, `buildPath`, etc.) | 0 — review inline | No |

- **Stop at Agent-Utils wrappers** — do not trace into their implementation.
- **Document skipped symbols.** If you hit the depth limit or stop rule, note the symbol name and reason in "Tracing Notes."

## Symbol Tracing Cap

Scale to diff size: **`min(3 + files_changed × 2, 15)`**

| Files Changed | Cap |
|---------------|-----|
| 1 | 5 |
| 2-3 | 7-9 |
| 4-6 | 11-15 |
| 7+ | 15 |

When diffs are batched, each batch gets its own cap based on its file count.

## Priority Order

1. **Security-sensitive** — always trace, 2 hops, bidirectional
2. **Component boundaries** — always trace, 1 hop, bidirectional
3. **Complex signatures** — trace if under cap, 1 hop, no bidirectional

If more symbols need tracing than the cap allows, trace by priority and note the rest as "not traced — lower priority."

## Anti-Patterns

- ❌ Read an entire file (hundreds of lines) to "find" a definition — search first
- ❌ Read files that are not referenced by the code under review
- ❌ Read the full implementation of a called function when only the signature matters
- ❌ Trace simple internal helpers with obvious names — review the call site inline

### When to read more than ±15 lines

Only when the narrow range reveals the function delegates to another internal function and you need one more hop to understand a correctness or security concern.
