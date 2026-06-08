# Grounding Rules — Native Code Safety

> **What this file is:** Mandatory anti-hallucination and verification rules for ALL agents working on native codebases (C, C++, Objective-C, Swift, Go). These rules prevent the class of errors where an AI agent fabricates function signatures, memory ownership, thread-safety properties, or file paths — errors that in native code cause silent memory corruption, race conditions, and crashes that are extremely hard to diagnose.
>
> **Applies to:** Every agent — Orchestrator, Planner, Architect, Developer, Reviewer, Document Generator.
>
> **Status:** ⛔ **HARD RULE** — This file is non-negotiable. Agents MUST internalize these rules before performing any work. Violations are blockers.

---

## 1. The Five Grounding Laws

> **Why this matters for native code:** A hallucinated function name in a web app causes a runtime error caught by a test. A hallucinated function signature in C causes silent memory corruption. A wrong thread assumption causes a race condition that reproduces 1-in-1000 runs. The cost of hallucination in native code is orders of magnitude higher.

| # | Law | Rule |
|---|-----|------|
| 1 | **Read before you claim** | Never state that a file, function, struct, enum, macro, or variable exists unless you have read the file that contains it in this session. |
| 2 | **Read before you modify** | Never edit a file you haven't read in this session. Always read current content first. |
| 3 | **Cite your source** | Every factual claim must be traceable to a specific file and location. Use `file.c:42` or `file.h § section`. If you can't cite it, you don't know it. |
| 4 | **Say "I don't know"** | If uncertain about anything — a signature, thread-safety, ownership, a build flag — say so. Then read the source. Never fill gaps with plausible guesses. |
| 5 | **Verify after you act** | After writing code, read back what you wrote. After claiming a build succeeds, actually build. Trust nothing from memory alone. |

---

## 2. Forbidden Assumptions

Never assume any of these without reading the actual source:

| Category | Examples of What NOT To Assume | Risk |
|----------|-------------------------------|------|
| **Function signatures** | Parameter types, return types, nullability, `const` | Wrong types → silent memory corruption, ABI breaks |
| **Memory ownership** | Who allocates, who frees, ARC managed?, stack-allocated? | Wrong → use-after-free, double-free, leaks |
| **Thread safety** | Thread-safe?, which queue?, atomic? | Wrong → race condition, deadlock |
| **File existence** | File/header/module exists at path? | Wrong → build failure or editing wrong file |
| **API availability** | OS API exists on target version? | Wrong → runtime crash on older OS |
| **Build configuration** | Compiler flags, defines, linked frameworks | Wrong → unexpected compilation, UB |
| **Macro expansion** | What `#define` expands to | Wrong → subtle invisible bugs |
| **Enum values** | Specific integer values | Wrong → protocol mismatch, data corruption |
| **Struct layout** | Field order, padding, size | Wrong → memory corruption across boundaries |
| **Error handling** | Can fail?, how signals failure?, cleanup? | Wrong → unhandled error → crash/leak |
| **Project boundaries** | Directory names = project names without checking build configs | Wrong → wrong project inventory, wrong structure |

---

## 3. Source Citation Format

```markdown
✅ "The `ServiceManager` is initialized on the main thread (src/service_manager.m:45)
    and dispatches to a serial background queue (src/service_manager.m:112)."

❌ "ServiceManager uses GCD for background processing." (never read the file)

✅ "I haven't read service_manager.m yet — let me check before proceeding."
```

---

## 4. Forbidden Language Patterns

| Forbidden Pattern | Replace With |
|-------------------|-------------|
| "probably", "likely", "I think" | "I need to verify — let me read [file]" |
| "should be", "would be" | "According to [file:line], it is..." |
| "typically", "usually" | "In this project, [file:line] shows..." |
| "as mentioned earlier" | Re-read and re-cite the actual source |
| "the standard pattern is" | "This project's pattern (per CONVENTIONS.md) is..." |
| "I assume", "assuming that" | "Let me verify before proceeding" |
| "based on the naming, it's probably" | Read the implementation, don't guess from names |

---

## 5. Handling Contradictions

| Situation | Action |
|-----------|--------|
| Doc says X, code says Y | **Trust the code.** Flag the doc as stale. Update it. |
| Comment says X, implementation does Y | **Trust the implementation.** Update the comment. |
| Two docs disagree | Read the source code. Fix whichever is wrong. |
| You remember X, file now says Y | **Trust what you read NOW.** Memory may be hallucinated. |
| Guideline says X, codebase does Y | Follow the guideline. Flag the code as non-compliant. |

---

## 6. Pre-Edit Verification

Before modifying ANY source file, verify:

- [ ] **I have read this file** in the current session (not from prior session memory)
- [ ] **I know the function signatures** I'm calling — verified from headers, not guessed
- [ ] **I know the memory ownership rules** for pointers/objects I'm creating or passing
- [ ] **I know which thread this code runs on** — verified from call-site analysis or documentation
- [ ] **I know the build target** this file belongs to
- [ ] **I know the language rules** for this file (ARC vs manual, exceptions, etc.)
- [ ] **I have checked for related files** needing coordinated changes (headers, build configs, tests)

If ANY box cannot be checked → **STOP and read before proceeding.**

---

## 7. Post-Edit Verification

After making changes:

1. **Re-read the modified file** — confirm the edit is what you intended
2. **Build the affected target(s)** — ALL targets that include this file, not just the default
3. **Run relevant tests** — unit tests for the modified module at minimum
4. **Check for warnings** — treat new warnings as errors
5. **Verify cross-language boundaries** — if change affects a bridge, build both sides

---

## 8. Context Recovery

```
CONTEXT OVERFLOW OR SESSION INTERRUPTION
    │
    ├─ 1. STOP — finish only the current atomic step
    ├─ 2. SAVE — record progress (checkpoint file, scratch notes)
    │     • Files read + findings
    │     • Changes made so far
    │     • What remains
    ├─ 3. BUILD — verify everything compiles
    ├─ 4. YIELD — end the turn
    │
    └─ ON RESUME:
          • Read saved progress FIRST
          • Re-read files you will modify (never trust prior session memory)
          • Verify last change (re-read, build, test)
          • Continue
```

**Critical:** Never trust what a previous session "said" it did. Always re-read files and rebuild. Previous session may have made partial edits, edited wrong files, or hallucinated changes.

---

## 9. Agent-Specific Application

| Agent | How Grounding Rules Apply |
|-------|--------------------------|
| **Orchestrator** | Verify repo/file existence before delegating. Don't assume sub-agent completed work — verify. |
| **Planner** | Cite source for every impact claim. Don't assume dependencies — verify from build configs. |
| **Architect** | Verify interfaces/signatures exist before referencing in designs. Don't assume API availability. |
| **Developer** | Full pre-edit and post-edit checklists (§6–§7). Verify every function signature from headers. |
| **Reviewer** | Every finding must cite file:line. Don't assume a pattern is wrong — read the code first. |
| **Document Generator** | Read source before documenting. Don't describe functions you haven't read. |

---

## 10. Tool & Skill Load Failure Protocol

When `uems_agent_load_skills` or `uems_agent_load_guidelines` returns an error (e.g., `"No matching skills found"`, `"Guidelines not synced yet"`):

| Rule | Action |
|------|--------|
| **Never continue silently** | A missing skill means the procedure, output format, or quality gates it defines are absent from context. Silently continuing produces incorrect or incomplete output. |
| **Stop and report** | Tell the user: *"Skill/guideline `<name>` failed to load. Please run **'UEMS Agent Chat: Sync Agent Files'** and retry."* |
| **Do NOT improvise** | Do not attempt to recreate the skill's procedure from memory or partial knowledge. Skills exist because the procedure is non-trivial — guessing it defeats the purpose. |
| **Block the dependent step** | If the skill is referenced with a ⛔ marker, the step that requires it is **blocked** until the skill loads successfully. Do not skip the step or produce its deliverable without the skill. |
| **Retry once after sync** | After the user syncs, retry the load. If it fails again, stop the workflow and escalate. |

---

## Quick Reference Card

```
⛔ BEFORE you claim something exists  →  READ the file that contains it
⛔ BEFORE you edit a file             →  READ its current content
⛔ BEFORE you call a function         →  READ its signature from the header
⛔ AFTER you edit a file              →  READ it back + BUILD + TEST
⛔ When uncertain about ANYTHING      →  SAY "I don't know" + READ the source
⛔ When memory contradicts file       →  TRUST the file, not your memory
```

---

*Last Updated: 2026-04-10*
