---
name: guideline-loading-protocol
description: 'Guideline loading protocol for UEMS agents. Use when loading engineering guidelines, security standards, coding conventions, or doc-standards via uems_agent_load_guidelines. Covers adaptive loading by task type, file verification, and escalation.'
user-invocable: false
---

# Guideline Loading Protocol

Standardized procedure for loading UEMS engineering guidelines. All agents use `uems_agent_load_guidelines` — this skill defines what to load, when, and how to verify.

## When to Use
- At session start when loading engineering guidelines (Orchestrator Gate 1)
- When a query evolves into development and more guidelines are needed
- When verifying that all expected guideline files were loaded
- When loading specialized categories (doc-standards, review-standards)

## Categories & Files

### Common Guidelines (`category: "common"`)

| File | Purpose | Required By |
|---|---|---|
| `grounding-rules.md` | Anti-hallucination laws | **All agents** — read first |
| `engineering-checklist.md` | Engineering checklist (A–M) | Developer, Reviewer, Architect |
| `security-standards.md` | OWASP-aligned security | Developer, Reviewer, Architect |
| `review-standards.md` | Severity classification, scoring | Reviewer, Delta Reviewer |
| `git-conventions.md` | Tag, branch, commit conventions | Orchestrator, Developer |
| `repo-documentation.md` | Docs-first navigation | All agents working with code |

### Platform Guidelines (`category: "platform"`)

| File | Purpose |
|---|---|
| `coding-standards.md` | Language, style, naming (platform-specific) |
| `platform-security.md` | Platform-specific security controls |
| `repo-map.md` | Repository structure and dependencies |

### Specialized Categories

| Category | Files | Used By |
|---|---|---|
| `doc-standards` | PLAN_INDEX, SYSTEM_BLUEPRINT, FORMAT_STANDARD, AGENT_BEHAVIOR_RULES | Document Generator |
| `review-standards` | report-template.md | Delta Reviewer |

## Adaptive Loading by Task Type

### Step 1 — Classify the Task

| Task Type | Description | Examples |
|---|---|---|
| **query** | Read-only questions, lookups | "List classes in agent-utils", "What's the dependency chain?" |
| **investigation** | Code audit, security review | "Audit security of module W", "Find all usages of Y" |
| **development** | Code modifications | Features, bug fixes, refactors, hotfixes |
| **review** | Code review (Reviewer/Delta Reviewer) | Diff-based review, quality audit |
| **documentation** | Doc generation/update | Create docs, update docs, audit docs |

### Step 2 — Load Based on Task Type

**Queries & Investigations** — minimal context:
```
uems_agent_load_guidelines({ platform: "<platform>", category: "common", files: ["grounding-rules.md"] })
uems_agent_load_guidelines({ platform: "<platform>", category: "platform", files: ["repo-map.md"] })
```

**Development** — full guidelines:
```
uems_agent_load_guidelines({ platform: "<platform>", category: "common" })
uems_agent_load_guidelines({ platform: "<platform>", category: "platform" })
```

**Review** — full guidelines + review-standards:
```
uems_agent_load_guidelines({ platform: "<platform>", category: "common" })
uems_agent_load_guidelines({ platform: "<platform>", category: "platform" })
uems_agent_load_guidelines({ category: "review-standards" })
```

**Documentation** — doc-standards + grounding rules:
```
uems_agent_load_guidelines({ category: "doc-standards" })
uems_agent_load_guidelines({ category: "common", files: ["grounding-rules.md"] })
```

### Step 3 — Verify Files Present

After loading, verify all expected files are present in the tool responses:

- **Common (development):** grounding-rules.md, engineering-checklist.md, security-standards.md, review-standards.md, git-conventions.md, repo-documentation.md
- **Platform:** coding-standards.md, platform-security.md, repo-map.md
- **Review-standards:** report-template.md
- **Doc-standards:** PLAN_INDEX.md, SYSTEM_BLUEPRINT.md, FORMAT_STANDARD.md, AGENT_BEHAVIOR_RULES.md

If **any** file is missing → **STOP**, report which file(s), ask the user to run **"UEMS Agent Chat: Sync Agent Files"** and retry.

## Escalation

If a query or investigation **evolves into a development task**, load the remaining guidelines before proceeding:
```
uems_agent_load_guidelines({ platform: "<platform>", category: "common" })
uems_agent_load_guidelines({ platform: "<platform>", category: "platform" })
```
Verify all files, then continue.

## Sub-Agent Guideline Loading

Sub-agents (Planner, Architect, Developer, Reviewer) receive guidelines from the Orchestrator (Gate 1). If a sub-agent needs to reference guidelines directly, it can call `uems_agent_load_guidelines` itself — but the Orchestrator should have loaded them already.
