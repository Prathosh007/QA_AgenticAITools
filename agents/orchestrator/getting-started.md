# Getting Started — UEMS Agent Orchestrator

> **Prerequisite:** Install the UEMS Agent Chat extension first.
> See **[Extension Setup Guide](../../source/uems-agent-chat/getting-started.md)**

---

## Start a Task

1. **Open your workspace** in VS Code. You can either:
   - **Let the orchestrator handle it** — it clones all affected repos automatically during Gate 2 using the `uems_agent_setup_workspace` tool
   - **Clone repos yourself** beforehand:
     ```
     git clone <repo-url-1>
     git clone <repo-url-2>
     code <workspace-folder>
     ```

   > **Tip:** If your task spans multiple repos (e.g., Agent-Utils + Patch-Management), the orchestrator detects cross-repo dependencies and sets up all affected repos for you.

2. Open **GitHub Copilot Chat** (`⌃⌘I` or click the Copilot icon in the sidebar)

3. In the chat input, click the agent dropdown and select **UEMS Agent Orchestrator** from the agent list

4. Select the model as **Claude Opus 4.6** from the model dropdown

5. Describe your task:
   ```
   Add remote shell support to dcagentservice
   ```

   Other examples:
   ```
   Fix the XPC connection leak in Patch-Management
   Refactor logging to use the new Agent-Utils wrapper
   Explain the dependency chain between Agent-Utils and Inventory-Management
   ```

6. The orchestrator will walk you through its pipeline:
   - **Gate 0** — asks which platform (mac / linux / windows)
   - **Gate 1** — loads and verifies engineering guidelines
   - **Gate 2** — clones repos, validates tags, creates feature branches
   - **Assessment** — classifies complexity (hotfix / simple / medium / complex)
   - **Plan** → **Design** → **Build** → **Review** → **QA** — delegates to sub-agents as needed
   - Pauses at **every phase** for your approval before advancing

7. After the review is approved, the QA agent generates manual test cases (structured CSV) from the implemented changes

8. After you confirm, the orchestrator commits and pushes to feature branches

---

## Hotfix (Urgent Fix)

For production crashes or urgent patches, include "hotfix" or "urgent" in your prompt:
```
Hotfix: dcagentservice crashes on macOS 15 when XPC connection drops
```

The orchestrator auto-classifies it as a hotfix, skips intermediate checkpoints, and presents one combined result (implementation + review). Gates and mandatory review still apply — reduced ceremony, not reduced rigor.

---

## Resume an Interrupted Session

If a session is interrupted (crash, timeout, network issue), start a new chat and say:
```
Resume previous task
```

The orchestrator detects the checkpoint file (`.ai-docs/checkpoint.md`) in your workspace and picks up from where it left off — no need to re-run completed phases.

---

## Using the QA Agent

The QA agent generates structured manual test cases (17-column CSV) from code changes. It works in two modes:

### Via the Orchestrator (Pipeline Mode)

No extra steps needed — the orchestrator automatically invokes the QA agent after the reviewer approves. It receives the changed files, platform, and task context from the pipeline and generates test cases.

### Standalone (Direct Invocation)

Use this when you already have a branch with changes and just need test cases — no full orchestrator pipeline required.

1. Open **GitHub Copilot Chat** and select **UEMS Agent QA** from the agent dropdown

2. Provide a branch or tag range:
   ```
   Generate test cases for branch feature/remote-shell against tag 241100
   ```

   Or point it at specific files:
   ```
   Generate test cases for the changes in Sources/DCAgentService/RemoteShell.swift
   ```

3. The QA agent will:
   - Clone/fetch the repo and checkout the branch
   - Diff the branch against the target to discover all changes
   - Detect the platform from file extensions
   - Read and classify each fix/feature
   - Generate test cases with product-level steps (no code references)

4. Output is a **CSV file** with 17 columns (per [testing-standards.md](../../guidelines/common/testing-standards.md)) plus a summary table showing coverage breakdown

### What You Get

- **Product-level test steps** — written for QA testers, not developers (no function names, no line numbers)
- **Coverage per fix** — happy path, bug scenario, edge cases, negative tests
- **Cross-environment cases** — upgrade scenarios, multi-OS, server compatibility where applicable
- **Independently executable** — each test case stands alone, no dependency on other test cases
