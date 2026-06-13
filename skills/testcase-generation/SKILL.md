```skill
---
name: testcase-generation
description: 'Generate hierarchical manual test cases for any functionality or sub-functionality. Reads the codebase first (via repos.json layer architecture), then KNOWLEDGE.md, existing TCs, CSV files, and support tickets to ground test steps in real product behavior. Supports functionality-level and diff-comparison modes. Maintains a persistent testcase DB so existing coverage is reused, updated, and extended — never duplicated. All naming conventions, CSV format rules, and quality standards are self-contained in this skill.'
user-invocable: true
---

# Test Case Generation Protocol

Generates structured, product-level manual test cases. Supports functionality-first generation and diff-driven generation. Maintains a persistent testcase DB so existing coverage is reused, updated, and extended — never duplicated.

## When to Use
- User asks to generate test cases for a feature or module
- User asks to generate test cases between two branches or versions
- A code diff arrives for a functionality that already has test cases in the DB
- QA needs to verify what test coverage exists before a release

---

## Step 0: Collect Inputs (MANDATORY — ask before proceeding)

Use `vscode_askQuestions` to collect inputs in **two rounds**. Do NOT infer or assume.

### Round A — Core inputs (always ask first)

Ask two questions together:

**Question 1 — Functionality Name**

> "What is the name of the functionality (and sub-functionalities, if any) you want test cases for?"

Example answer: `Computer Rename`, `Software Deployment > Patch Installation`, `Agent Communication`

**Question 2 — Generation Mode**

> "What type of test case generation do you need?"

Options:
- **Functionality-level** — Generate test cases for a feature or module from scratch (or extend existing). You will be asked which repository the functionality code lives in.
- **Diff comparison** — Generate test cases based on what changed between two branches. You will be asked for the source branch, target branch, and repository name.

### Round B — Mode-specific inputs (ask immediately after Round A)

#### If **Functionality-level** mode was chosen:

**Question 3 — Repository**

> "Which repository does this functionality code belong to?"

This is **MANDATORY**. The agent will search this repository to ground the generated test cases in real code.

Example answer: `uems_win_agent_setup`, `uems_agent_framework`, `dc_native`, `uems-mac-agent-setup`

If unsure, common choices by platform:
- Windows delivery repo: `uems_win_agent_setup`
- Windows framework: `uems_agent_framework`
- Linux: `dc_native`
- macOS delivery repo: `uems-mac-agent-setup`

**Question 4 — Platform**

> "Which platform? (windows / mac / linux)"

---

#### If **Diff comparison** mode was chosen:

**Question 3 — Branch Details**

> "Provide the source branch and target branch."

Parse the user's free-text answer for:
- `sourceBranch` — the feature/fix branch (newer code)
- `targetBranch` — the base branch (e.g., `main`, a release tag, or a sprint tag)

Accept any natural format:
- `feature_branch → main`
- `source: feature_win_agent_26.05, target: main`
- `feature_win_agent_26.05 vs main`

**Question 4 — Repository**

> "Which repository contains the changed code?"

This is **MANDATORY** for diff comparison. The agent needs to fetch the diff from this repository.

Example answer: `uems_win_agent_setup`, `uems_agent_framework`, `dc_native`

**Question 5 — Platform**

> "Which platform? (windows / mac / linux)"

---

## Step 1: Check Testcase DB

Before generating any new test cases, check whether test cases already exist for this functionality.

**Resolve DB URL first:**
Read `testcases/db-config.json` using `uems_agent_read_workspace({ path: "testcases/db-config.json" })`. If it exists and has a `db_url` field, use that value as `<DB_URL>`. If absent, default to `http://localhost:3000`.

**If `uems_agent_testcase_db` tool is available (web portal mode):**
```
uems_agent_testcase_db({ action: "get_stats" })
```

**If running in VS Code**, use direct HTTP:
```
GET <DB_URL>/health
```

**If the DB is running:**
```
uems_agent_testcase_db({ action: "list_testcases", functionality: "<FunctionalityName>" })
```
- If results returned → note existing IDs and coverage gaps
- If empty → first-generation run

**If the DB is not running (fallback):**
- Check `testcases/<FunctionalityName>/testcase-registry.json` for local backup
- If not found → first-generation run

> ⚠️ If DB is not running, remind user at end: `cd source/testcase-db && make run`

---

## Step 2: Gather Context

### MANDATORY ORDER: Code First → Knowledge Second

> **Primary layer: codebase search. Secondary layer: KNOWLEDGE.md + CSV + Support Tickets.**
> Always gather code context first. Then enrich with product knowledge.

### For Functionality-Level Mode

#### Layer 1 — Code Context (Primary — NEVER SKIP)

> ⛔ **MANDATORY:** Always attempt code context first. Do NOT skip to KNOWLEDGE.md.

**Codebase Location:**
All UEMS native repos are pre-cloned under `Code base/<platform>/<repo_name>/` in the workspace:
```
Code base/
├── cross-platform/   (cmickey_utils, uems_native_dependencies, uems_go_components, ...)
├── mac/              (agent-utils, patch-management, uems-mac-agent-setup, ...)
├── linux/            (dc_native)
└── windows/          (uems_agent_utils, uems_agent_framework, uems_win_agent_setup, ...)
```

**2.1 Identify and prepare the repository:**

**Step A — Use the repository provided by the user (MANDATORY):**

The user always provides a repository name in Step 0. Start there.

1. Read `source/common/repos.json` using `uems_agent_read_workspace`.
2. Look up the provided repo name in the JSON. Retrieve its `description`, `dependencies`, and `platform`.
3. Expand to include dependency repos where relevant (e.g., if testing agent installation, include `uems_agent_framework` dependencies).
4. Verify locally: `uems_agent_list_workspace({ path: "Code base/<platform>/<repo_name>" })`
   - If exists → ready for search.
   - If not → try `uems_agent_setup_workspace({ repos: ["<repo_name>"], platform: "<platform>" })`.
5. Print resolution summary:
   ```
   🔍 Repository (user-provided) + resolved dependencies:
     • <repo_name> — <description> [available ✅ / not found ❌]
     • <dependency> — <description> [available ✅ / not found ❌]
   ```
6. If the provided repo name does not match any entry → fall back to keyword matching against `description` fields and note the fallback.

**Step B — Search the codebase:**

**Option 1 (preferred) — `uems_agent_search_repos`:** Search for functionality name, class names, command names, config key prefixes. Target the user-provided repo first.

**Option 2 — Direct file browsing:**
1. `uems_agent_list_workspace({ path: "Code base/<platform>/<repo_name>" })` to discover structure.
2. Navigate into `src/`, `Source/`, or other source directories.
3. `uems_agent_read_workspace` to read relevant source files.
4. Look for: entry points, configuration parsing, service registration, error handling paths.

**2.2 Read key source files:**
- Understand entry points, data flows, state transitions, error paths.
- Discover: config key names, registry paths, file paths, service names, API endpoints.
- Note all sub-flows that represent discrete testable behaviors.

**2.3 Identify the module, functional area, and support files:**
- Determine which module/component each relevant file belongs to.
- Discover log files from code (search for `startLoggingTo`, `StartLoggingEngine`).
- Identify config files, plists, databases, or other artifacts.

**2.4 Break down sub-functionalities from code:**
- Enumerate all distinct execution paths.
- If non-obvious, ask the user to confirm before generating.

#### Layer 2 — Product Knowledge (Secondary)

**2.5 Load the Knowledge Document:**
Use `uems_agent_read_workspace({ path: "testcases/<FunctionalityName>/KNOWLEDGE.md" })`:
- **If found:** Authoritative product reference for file paths, service names, registry keys, GUI automation IDs, GOAT mappings. Cross-reference with code findings.
- **If not found:** Rely on Layer 1. Create a KNOWLEDGE.md afterward.

**2.6 Read Existing CSV Test Cases:**
Use `uems_agent_list_workspace({ path: "testcases/<FunctionalityName>/csv" })`:
- **If found:** Read every CSV file. Understand already-covered scenarios. Identify gaps. Reuse step patterns.
- **If not found:** Skip.

> ⚠️ Do NOT re-import CSV scenarios that already exist in the DB.

**2.7 Load Support Ticket Scenarios:**
Use `uems_agent_read_workspace({ path: "testcases/<FunctionalityName>/SUPPORT_TICKETS.md" })`:
- **If found:** Generate at least one **Support Ticket Scenario** TC per ticket. Cross-reference with existing TCs.
- **If not found:** Skip. Note in summary.

**2.8 Identify expected behaviors and verification points:**
Combining all sources:
- What does the agent send to the server?
- What registry/config keys are involved?
- What processes start or stop?
- What log messages or network traffic should be observed?
- What failure patterns have real customers reported?
- What race conditions or timing issues have occurred?

### For Diff-Comparison Mode

#### Layer 1 — Code Context (Primary)

**2.1** Use the **user-provided repository name** to look up the repo in `source/common/repos.json`. Verify it is available locally.
**2.2** Call `uems_agent_diff_branches({ repo: "<repoName>", sourceBranch: "<src>", targetBranch: "<tgt>" })` to get the diff. Read each changed file.
**2.3** Identify module, functional area, log files, config files.
**2.4** Read commit messages — extract issue descriptions, bug context, intent.

#### Layer 2 — Same as functionality mode (steps 2.5–2.7).

---

## Step 3: Classify Each Feature or Fix

| Attribute | How to Determine |
|-----------|-----------------|
| **Issue ID** | From commit message, branch name, or user input |
| **Functionality** | From user description or module mapping |
| **Sub-Functionality** | Specific scenario or code path |
| **Complexity** | Simple / Medium / Complex |
| **Platform** | From file extensions or user input |
| **Bug scenario** | (Diff mode) What conditions triggered the bug? |

---

## Step 4: Generate Test Cases

For each functionality + sub-functionality, generate ALL applicable categories:

### 18 Category Checklist (MANDATORY — evaluate every one)

1. **Success / Happy Path** — Core behavior works correctly
2. **Bug Scenario** — Known bug reproduction *(Remarks: `BUG SCENARIO`)*
3. **Support Ticket Scenario** — Customer-reported failures *(Remarks: `SUPPORT TICKET: <id>`)*
4. **Failure / Error Handling** — Operation fails, error codes *(Remarks: `FAILURE SCENARIO`)*
5. **Retry / Recovery** — Retry logic, reconnection, rollback *(Remarks: `RETRY SCENARIO`)*
6. **Edge Cases** — Boundary values, Unicode, special chars
7. **Negative Cases** — Invalid inputs, missing deps, corrupted data
8. **Concurrency / Race Conditions** — Parallel execution, resource contention *(Remarks: `CONCURRENCY SCENARIO`)*
9. **State Transition** — Valid/invalid state changes, interrupted transitions
10. **Timing / Timeout** — Slow network, delayed response, clock skew
11. **Resource Exhaustion** — Disk full, low memory, network unavailable
12. **Security / Permission** — Privilege escalation, access denied, tampered files
13. **Integration** — Cross-module interactions, IPC failures
14. **Upgrade / Migration** — Version upgrades, data migration, backward compat
15. **Cleanup / Uninstall** — Proper cleanup, leftover detection
16. **Cross-Environment** — OP vs Cloud, different OS versions, locales
17. **E2E** — Full workflow across multiple components
18. **Rare / Unlikely** — Power failure, crash mid-write *(Remarks: `RARE SCENARIO`)*

### Minimum Count Per Complexity
- Simple: **≥ 15 TCs**, ≥ 6 categories
- Medium: **≥ 25 TCs**, ≥ 10 categories
- Complex (multiple sub-funcs/methods): **≥ 45 TCs**, ≥ 14 categories

> ⚠️ These are **HARD FLOORS — you FAIL if you go below**. Generate ALL reasonable scenarios. If you find N error codes in the code, you need at least N failure/error test cases. If KNOWLEDGE.md defines a test matrix (e.g., office type × architecture × method), cross-multiply ALL dimensions.
>
> **Expansion rules per sub-functionality:**
> - Each sub-functionality MUST have ≥ 3 TCs (happy + negative + edge minimum)
> - Each installation/operation method = separate sub-functionality  
> - If a sub-functionality has variation dimensions (office types, architectures), cross-multiply for happy-path TCs
>
> **Self-check before finishing:** Count your TCs per category. If any applicable category has 0 TCs, STOP and add at least one. Count TCs per sub-functionality. If any sub-func has < 3 TCs, STOP and add more.

---

## Step 5: Diff-Mode — Merge With Existing DB

- Behavior still valid → **Keep unchanged**
- Expected behavior changed → **Update, increment version**
- Scenario no longer possible → **Mark deprecated**
- New scenario → **Add new TC**

Output change summary: Modified / Deprecated / Added / Unchanged counts.

---

## Step 6: Write Product-Specific Test Steps

**Critical rule:** Steps for QA testers — NO code references, NO internal variable names.

Each test case must have:
1. **Pre-requisites** — Setup required
2. **Steps** — Numbered product-level actions (one observable action each)
3. **Expected output** — Specific, verifiable (exact log message, registry value, UI state)
4. **Support files** — Exact log files, databases, config files
5. **Full absolute paths** — Every file, registry path must be absolute
6. **GOAT operation hints** — `[service_actions: status]`, `[registry_operation: read_key]`, etc.

---

## Step 7: Quality Verification Checklist

- [ ] Unique Testcase ID (Appendix A format)
- [ ] Product-level steps (no code references)
- [ ] Specific support files referenced
- [ ] Verifiable expected output
- [ ] Full absolute paths
- [ ] GOAT hints on automatable steps
- [ ] Diff mode: BUG SCENARIO per fix + regression TC
- [ ] Each TC independently executable
- [ ] One scenario per TC
- [ ] Priority assigned correctly
- [ ] All 18 categories evaluated

---

## Step 8: Output — CSV

Generate CSV with 17 columns (Appendix B). File naming:
- Functionality mode: `{FunctionalityName}_testcases.csv`
- Diff mode: `{branch_name}_testcases.csv`

Output to workspace root.

---

## Step 9: Update Testcase DB

**Preferred (web portal):**
```
uems_agent_testcase_db({ action: "create_testcase", data: { ... } })
```

**Fallback (VS Code):**
```
POST <DB_URL>/testcases
```

**Verify:** Query and confirm count matches. Print `✅ DB Verified: <count>/<total>`

**Always save local backup:** `testcases/<FunctionalityName>/testcase-registry.json`

---

## Step 10: Regression Coverage Summary (Diff Mode Only)

For each changed module:
1. Identify existing functionality sharing code paths
2. State why retesting is needed
3. Suggest product-level verification tests
4. List coverage gaps

---

## Quality Gate

- Minimum TCs per complexity met
- Category minimums met
- Every category evaluated
- All P1 TCs cover core behavior
- At least one TC per support ticket
- No vague steps
- DB updated
- Diff mode: regression summary + BUG SCENARIO per fix
- Failure/Retry TCs for network/IPC/file I/O/process lifecycle code

---

## Appendix A: Testcase ID & Naming Convention

### ID Format
```
TC-<FUNCTIONALITY>-<SUBFUNCTIONALITY>-<NNN>
```

| Segment | Rule | Example |
|---------|------|---------|
| `TC-` | Fixed prefix, uppercase | `TC-` |
| `<FUNCTIONALITY>` | Feature name, uppercase, no spaces | `AGENTINSTALL` |
| `<SUBFUNCTIONALITY>` | Scenario name, uppercase, no spaces | `MANUALGUI` |
| `<NNN>` | Sequential 3-digit | `001` |

### Special Formats
| Type | Format |
|------|--------|
| E2E | `E2E_RELEASE_<NNN>` |
| Regression | `TC-<FUNC>-<SUBFUNC>-REG-<NNN>` |

### Abbreviation Table

| Full Name | Abbreviation |
|-----------|-------------|
| Computer Rename | `COMPUTERRENAME` |
| Agent Installation | `AGENTINSTALL` |
| Software Deployment | `SOFTDEPLOY` |
| Patch Installation | `PATCH` |
| Agent Communication | `AGENTCOMM` |
| Status Update | `STATUSUPDATE` |
| Remote Shell | `REMOTESHELL` |
| Inventory Scan | `INVSCAN` |
| Configuration Update | `CFGUPDATE` |
| Manual GUI Install | `MANUALGUI` |
| Push Install | `PUSHINSTALL` |
| GPO Install | `GPOINSTALL` |
| Silent Install | `SILENTINSTALL` |
| Agent Uninstall | `AGENTUNINSTALL` |
| Certificate Management | `CERTMGMT` |

> New abbreviation rule: All uppercase, no spaces, max 15 characters, recognizable.

### Priority Assignment
| Priority | Meaning |
|----------|---------|
| **P1** | Core behavior, critical bug reproduction |
| **P2** | Important edge cases, configuration variations |
| **P3** | Obscure edge cases, negative tests, stress |

### Category Distribution Targets
| Category | Target % |
|----------|----------|
| Functional | 35% |
| Bug Scenario | 15% |
| Negative | 15% |
| Failure | 10% |
| Edge | 5% |
| Integration | As needed |
| E2E | ≥ 1 per release (diff mode) |

---

## Appendix B: CSV Column Definition (17 Columns)

| # | Column | Required | Notes |
|---|--------|----------|-------|
| 1 | Testcase ID | Yes | Unique per Appendix A |
| 2 | Functionality | Yes | Top-level module |
| 3 | Sub-Functionality | Yes | Specific scenario |
| 4 | Title | Yes | One-line description |
| 5 | Pre-requisites | Yes | Setup steps |
| 6 | Steps | Yes | Numbered product-level steps |
| 7 | Expected Output | Yes | Specific, verifiable |
| 8 | Support Files | Yes | Logs, configs, DBs |
| 9 | Platform | Yes | `mac` / `windows` / `linux` |
| 10 | OS Version | Yes | e.g., `Windows 10` |
| 11 | Priority | Yes | `P1` / `P2` / `P3` |
| 12 | Category | Yes | From 18-category list |
| 13 | Remarks | No | Tags: BUG SCENARIO, etc. |
| 14 | Actual Output | No | *(QA fills)* |
| 15 | Status - OP | No | *(QA fills)* |
| 16 | Status - Cloud | No | *(QA fills)* |
| 17 | Issue ID | No | Commit hash or Qengine ID |

### Formatting Rules
- Delimiter: Comma
- Encoding: UTF-8 with BOM
- Quoting: Enclose fields with commas/newlines/quotes in double quotes
- Newlines in fields: `\n` within quoted fields
- Header row always present
- Empty fields: `""` — never `null` or `N/A`

```
