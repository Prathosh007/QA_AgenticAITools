# Getting Started — UEMS Agent Testcase Generator

> **Prerequisite:** Install the UEMS Agent Chat extension first.
> See **[Extension Setup Guide](../../source/uems-agent-chat/getting-started.md)**

---

## Prerequisites

### 1. Start the Testcase DB

The agent requires the testcase DB server to be running before it begins.

```powershell
cd D:\uems-ai-toolkit\source\testcase-db
node server.js
```

Or register it as a Windows Scheduled Task so it starts automatically:

```powershell
# Run as Administrator
.\setup-autostart.ps1
```

Verify the DB is running:
```
http://localhost:3000/health   → { "status": "ok" }
http://localhost:3000/view     → Test case viewer UI
```

### 2. Ensure GOAT_Operations_Context.md is Present

The agent reads `GOAT_Operations_Context.md` from the workspace root for all GOAT JSON conversion. This file must exist and be up to date.

---

## Run the Agent

1. **Open your workspace** in VS Code (`d:\AgentQA_Tools` or your local clone)

2. Open **GitHub Copilot Chat** (`Ctrl+Shift+I` or click the Copilot icon)

3. Select **UEMS Agent Testcase Generator** from the agent dropdown

4. Use **Claude Sonnet 4.6** — select it from the model dropdown

5. Send your request:

   **Functionality-level:**
   ```
   Generate test cases for Computer Rename functionality
   ```

   **Sub-functionality-level:**
   ```
   Generate test cases for Software Deployment > Patch Installation
   ```

   **Diff comparison:**
   ```
   Generate diff comparison test cases between feature_win_agent_26.05 and main in dc-agent
   ```

   **Update existing test cases:**
   ```
   Update test cases for Computer Rename with the diff from feature_rename_fix vs main
   ```

   **GOAT conversion only:**
   ```
   Convert test cases to GOAT JSON for AgentInstallation
   ```

6. The agent will:
   - Check the DB is online and show current coverage stats
   - Ask for any missing inputs (mode, functionality, branches)
   - Search the codebase to discover real file paths, log names, config keys
   - Load `testcases/<FunctionalityName>/KNOWLEDGE.md` and existing CSVs for enrichment
   - Generate hierarchical test cases and merge them into the DB
   - Convert all test cases to GOAT JSON using `GOAT_Operations_Context.md`
   - Save payloads to `testcases/<FunctionalityName>/goat-payloads/`
   - Write a gap report for any unmappable steps
   - Produce `summary.md` and `summary.html` under `testcases/<FunctionalityName>/reports/`

---

## Example Output Structure

```
testcases/
└── ComputerRename/
    ├── KNOWLEDGE.md
    ├── testcase-registry.json
    ├── csv/
    │   └── ComputerRename.csv
    ├── goat-payloads/
    │   ├── TC-COMPUTERRENAME-CFGUPDATE-001.js
    │   ├── TC-COMPUTERRENAME-CFGUPDATE-002.js
    │   └── gap-report.md
    └── reports/
        ├── summary.md
        └── summary.html
```

---

## Understanding the Output

| Output | What it is |
|--------|-----------|
| **testcase-registry.json** | Persistent DB of all test cases for this functionality — the agent reads and updates this every run |
| **goat-payloads/*.js** | GOAT framework JSON payloads, one file per test case |
| **gap-report.md** | Test cases that could not be converted — lists the missing GOAT util needed |
| **summary.html** | Visual summary with metric cards and coverage table — open in any browser |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `⛔ Testcase DB is offline` | Start `node server.js` in `source/testcase-db/` |
| `GOAT_Operations_Context.md not found` | Ensure the file exists at workspace root |
| Agent stops after CSV | This should not happen — if it does, re-run and ask "Continue to GOAT conversion" |
| Missing utils in gap report | These utils need to be added to GOAT_Operations_Context.md before conversion is possible |
