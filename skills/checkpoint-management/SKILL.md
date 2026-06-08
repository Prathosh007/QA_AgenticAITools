---
name: checkpoint-management
description: 'Checkpoint creation, update, resume, and deletion protocol for long-running UEMS agent sessions. Use when managing session persistence across interruptions — development pipelines, documentation generation, or any multi-phase workflow that needs crash recovery.'
user-invocable: false
---

# Checkpoint Management Protocol

Standardized protocol for persisting session progress so any multi-phase agent workflow can resume after interruptions (context limits, crashes, network failures).

## When to Use
- At the start of any multi-phase workflow (development pipeline, doc generation)
- After every phase boundary or completed unit of work
- When resuming a session that was interrupted
- When the final completion gate passes (delete checkpoint)

## Checkpoint Lifecycle

```
Create → Update (every phase/unit) → Resume (if interrupted) → Delete (on completion)
```

## 1. Create Checkpoint

**When:** Immediately after initial gates pass — before starting the first work phase.

1. Use **create_file** to create the checkpoint at the agent-specific path (see §Paths below)
2. Fill in Session Info from gate outputs (task, platform, repo, start date)
3. Mark initial gates as ✅ done, all work phases as ⬜ pending
4. **Verify** — use **read_file** to confirm the header line exists
5. If creation fails → retry once. If it fails again → warn the user but continue

## 2. Update Checkpoint

**When:** After every phase boundary, every completed unit of work, and before every long operation.

**Algorithm (mandatory — run every time):**

```
Step 1: Read the current checkpoint file
Step 2: Update these fields:
  • "Last Updated" → current ISO-8601 date
  • Phase/Pipeline Progress table → mark completed phase ✅, active phase 🔄
  • Inventory/output tables → add completed items with ✅ and paths
  • Resume Instructions → set "Next action" to the next phase/item
Step 3: Write the updated checkpoint to disk (use edit tool)
Step 4: Verify the write succeeded (read the file back)
  • Only THEN proceed to the next phase
```

**⛔ BLOCKING RULE:** If you find yourself starting Phase N+1 without updating the checkpoint after Phase N — STOP. Go back and update first.

**Save BEFORE starting work, not after.** If the session dies mid-work, the checkpoint should describe what was about to happen so the next session can pick it up.

## 3. Resume Protocol

**When:** Start of every session — check for existing checkpoint before starting fresh.

```
Step 1: Check for checkpoint file at the agent-specific path
  • If NOT found → fresh start, proceed normally
  • If found → RESUME MODE

Step 2: Read checkpoint fully
  • Note completed phases, active work, pending items
  • Note resume instructions

Step 3: Validate completed work
  • For each item marked ✅ → verify the artifact exists on disk
  • If a ✅ item is missing → mark it ⬜ pending (session may have died mid-write)
  • Trust checkpoint for completion status, NOT for content quality

Step 4: Re-read knowledge base / guidelines (fresh session context)
  • Always re-read — but skip the gate ceremony if checkpoint confirms it passed

Step 5: Resume from the first incomplete item
  • Skip all completed phases
  • Follow the "Resume Instructions" from checkpoint

Step 6: Continue normal workflow with checkpointing
```

### Resume Rules

1. **Trust completion status** — don't redo completed phases
2. **Don't trust content quality** — iterations/review catch quality issues later
3. **Re-read source as needed** — checkpoint tracks progress, not knowledge
4. **Corrupt/ambiguous checkpoint** — resume from last fully-completed phase
5. **In-progress (🔄) items at resume** — assume incomplete, redo from start of that item
6. **User approvals are recorded** — don't re-ask for approved checkpoints

## 4. Delete Checkpoint

**When:** After the final completion gate passes and all work is delivered.

- Delete the checkpoint file only
- Keep work artifacts (plans, architecture docs, generated docs, etc.)
- Checkpoint is a transient process artifact, never committed to version control

## Checkpoint Paths

| Agent | Path | Header |
|---|---|---|
| Orchestrator | `<primary_repo>/.ai-docs/checkpoint.md` | `# Orchestrator Session Checkpoint` |
| Document Generator | `docs/ai-agents/.doc-generation-checkpoint.md` | `# Documentation Generation Checkpoint` |

## Checkpoint File Structure

Every checkpoint file follows this pattern:

```markdown
# {Agent} Session Checkpoint

## Session Info
- **Task/Repo:** {description}
- **Platform:** {mac/linux/windows} (if applicable)
- **Started:** {ISO-8601 date}
- **Last Updated:** {ISO-8601 date}
- **Status:** in-progress | interrupted

## Phase/Pipeline Progress
| Phase | Status | Notes |
|-------|--------|-------|
| {Phase name} | ✅ / 🔄 / ⬜ | {details} |

## {Agent-specific inventory tables}

## Resume Instructions
- **Next action:** {exactly what to do next}
- **Key context:** {essential context the resuming agent needs}
```

Agents extend this base structure with their own tables (Pipeline Progress, Document Inventory, Delegated Sub-Agents, Repos & Branches, etc.).

## Save Triggers

| Trigger | What to Record |
|---------|---------------|
| **Initial gates pass** | Create checkpoint: task, platform, repos |
| **Each phase/item completes** | Mark ✅, update inventory, set next action |
| **Each sub-agent delegation** | Record delegation with 🔄 status |
| **Each sub-agent returns** | Update delegation status to ✅ or ❌ |
| **Before any long operation** | Update Resume Instructions with current state |
| **Session ending** | Full status snapshot |
