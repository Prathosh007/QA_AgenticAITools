# Getting Started — UEMS Document Generator

> **Prerequisite:** Install the UEMS Agent Chat extension first.
> See **[Extension Setup Guide](../../source/uems-agent-chat/getting-started.md)**

---

## Generate Documentation

1. **Clone your repo** and open it in VS Code:
   ```
   git clone <your-repo-url>
   code <repo-folder>
   ```

   > **Tip:** If your module has dependent repos (e.g., shared utils, frameworks), clone them all into a single VS Code workspace. This gives the Document Generator visibility into cross-repo dependencies and produces more accurate documentation.

2. Open **GitHub Copilot Chat** (`⌃⌘I` or click the Copilot icon in the sidebar)

3. In the chat input, click the agent dropdown and select **UEMS Agent Document Generator** from the agent list

4. Select the model as **Claude Opus 4.6** from the model dropdown

5. Type your prompt:
   ```
   Generate documentation for this Repository
   ```

   > **Heads up:** Depending on the size of your repo, the agent can run for a long time (potentially hours for large repos). This is expected — it's doing a thorough analysis across all source files, build configs, and architecture. Let it run to completion.

6. The agent will:
   - Pull the latest doc-standards and guidelines from the central repo
   - Analyze your source tree, build system, and architecture
   - Walk through 8 phases — from discovery to full audit
   - Generate the complete doc set under `docs/` in your repo

7. Review the generated docs and commit them to your repo

---

## Update Documentation (after code changes)

Same flow — select **UEMS Agent Document Generator** from the agent dropdown and type:
```
Update documentation for this Repository
```

It uses `git diff` to detect what changed and updates only the affected docs.
