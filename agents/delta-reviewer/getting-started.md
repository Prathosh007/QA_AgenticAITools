# Getting Started — UEMS Agent Delta Reviewer

> **Prerequisite:** Install the UEMS Agent Chat extension first.
> See **[Extension Setup Guide](../../source/uems-agent-chat/getting-started.md)**

---

## Run a Delta Review

1. **Open your workspace** in VS Code with the target repos cloned and both branches available (fetched)

2. Open **GitHub Copilot Chat** (`⌃⌘I` or click the Copilot icon)

3. Select **UEMS Agent Delta Reviewer** from the agent dropdown

4. The agent uses **Claude Opus 4.6** — ensure this model is selected in the model dropdown

5. Provide the review request:
   ```
   Review feature/remote-shell against master in agent-utils and patch-management for mac
   ```

   The agent needs four inputs (it will ask for any you don't provide):
   - **Source branch** — the branch with your changes
   - **Target branch** — the base to compare against
   - **Repos** — one or more repo names, or "all"
   - **Platform** — `mac` / `linux` / `windows`

6. The agent will:
   - Setup workspace and fetch repos + dependencies
   - Load engineering guidelines for your platform (mandatory verification gate)
   - Fetch the diff and triage files (full-review vs light-review for cosmetic-only changes)
   - Delegate full-review files to the UEMS Agent Reviewer (with DELTA MODE + inline self-review)
   - Resolve any Needs Investigation items with you
   - Ask you for output format (Markdown or HTML)
   - Generate the final report

---

## Examples

### Single repo review
```
Review feature/xpc-hardening against master in agent-utils, platform mac
```

### Multi-repo review
```
Review bugfix/config-sync against master in configuration-framework and patch-management for mac
```

### All workspace repos
```
Review feature/logging-refactor against master in all repos, platform mac
```

---

## Output Formats

When the review is complete, the agent asks:
> Output format? `md` (Markdown) · `html`

- **md** — Markdown rendered in the chat panel (default)
- **html** — Styled HTML document with color-coded severity, bordered tables, and verdict badge

---

## Understanding the Report

### Verdict

- **APPROVED** — No Blocker/High issues, all checklist items Pass/NA, security clean, overall score ≥ 7
- **NEEDS_REVISION** — Specific items listed that need fixing

### Issue Severities

| Severity | Meaning | Blocks verdict? |
|---|---|---|
| **Blocker** | Must fix — security vulnerability, data loss, crash | Yes |
| **High** | Should fix — correctness issue, missing validation | Yes |
| **Medium** | Fix recommended — standards violation, minor risk | No (but noted) |
| **Low** | Nice to fix — style, naming, minor improvement | No |
| **Informational** | Pre-existing issue in traced reference (not in your diff) | No |

### Quality Scores

Each dimension scored 1–10. Security and Correctness are weighted 2× in the overall score.

| Score | Meaning |
|---|---|
| 9–10 | Exceptional — reference implementation |
| 7–8 | Good — production-ready |
| 5–6 | Acceptable — has gaps |
| 3–4 | Below standard — significant issues |
| 1–2 | Unacceptable — fundamental problems |

---

## Tips

- **Both branches must be fetched locally** — the tool runs `git diff` locally, not on a remote
- **Large diffs are auto-batched** — if the diff exceeds 512KB, the agent splits it by file groups and reviews each batch separately, then merges results
- **Re-run after fixes** — the agent is stateless; after fixing issues, just invoke it again on the same branches
- **Works alongside the Orchestrator** — the Orchestrator uses its own Reviewer in the pipeline; the Delta Reviewer is for standalone diff reviews outside the SDLC pipeline
