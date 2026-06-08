# Manual Testing Standards

> Shared across all platforms. Defines the output format, naming conventions, coverage requirements, and quality rules for manual test case generation.

---

## 1. Output Format — 17-Column CSV

All generated test cases use this exact column order:

```
Testcase ID,Issue ID,Scenario,Functionality,Test Type,Priority,Pre-requisites,Test Case Description,Test Steps,Expected Output,Support Files,Platform,OS to Test,Actual Output,Status - OP,Status - Cloud,Remarks
```

### Column Definitions

| # | Column | Filled By | Description | Example |
|---|--------|-----------|-------------|---------|
| 1 | **Testcase ID** | Agent | Unique identifier following naming convention (§2) | `SLOT_WAKE_001` |
| 2 | **Issue ID** | Agent | Short identifier for the fix/feature being tested | `Slot Time Fix` |
| 3 | **Scenario** | Agent | One-line scenario title | `Sleep/Wake short duration` |
| 4 | **Functionality** | Agent | Functional area or module | `Agent Refresh / Slot Time` |
| 5 | **Test Type** | Agent | `Functional` / `Negative` / `Boundary` / `Regression` / `Integration` / `Failure/Retry` | `Negative` |
| 6 | **Priority** | Agent | `P1` (critical) / `P2` (high) / `P3` (medium) | `P1` |
| 7 | **Pre-requisites** | Agent | What must be true before the test runs | `Agent installed, server reachable` |
| 8 | **Test Case Description** | Agent | What this test validates and why | `Verify agent doesn't refresh immediately after short sleep` |
| 9 | **Test Steps** | Agent | Numbered product-level steps for a QA tester | `1. Install agent...` |
| 10 | **Expected Output** | Agent | Observable result if the test passes | `Log shows "recalculating next refresh"` |
| 11 | **Support Files** | Agent | Logs, databases, config files, plists to check | `dcagentservice.log, dcslot.plist` |
| 12 | **Platform** | Agent | `mac` / `windows` / `linux` | `mac` |
| 13 | **OS to Test** | Agent | Specific OS version requirements | `macOS 13+` |
| 14 | **Actual Output** | QA | _(empty — tester fills during execution)_ | |
| 15 | **Status - OP** | QA | _(empty — tester fills: Pass/Fail/Blocked/NA)_ | |
| 16 | **Status - Cloud** | QA | _(empty — tester fills: Pass/Fail/Blocked/NA)_ | |
| 17 | **Remarks** | Agent/QA | Notes: `BUG SCENARIO`, known issues, dependencies | `BUG SCENARIO` |

### CSV Formatting Rules

- **Multi-line content:** Use actual newlines (`\n`) inside double-quoted cells — NOT pipe (`|`) characters. This ensures proper rendering in Excel, Google Sheets, and other tools.
- **Quoting:** Any cell containing commas, newlines, or double quotes must be wrapped in double quotes. Escape internal double quotes by doubling them (`""`).
- **Test Steps** must render as a numbered list with each step on its own line within the cell:
  ```
  "1. Install agent on a fresh Mac
  2. Wait for first refresh cycle
  3. Check dcagentservice.log for slot time assignment
  4. Verify refresh happens at correct interval"
  ```
- **Never** use `|`, `\n` literal text, `<br>`, or HTML tags as line separators.

---

## 2. Test Case ID Naming Convention

### Format

```
{MODULE}_{AREA}_{NNN}
```

| Part | Description | Examples |
|------|-------------|---------|
| `{MODULE}` | Short module identifier (2–6 chars, uppercase) | `SLOT`, `REP`, `CFG`, `CERT`, `NS`, `ONDEM` |
| `{AREA}` | Functional area within the module (uppercase) | `WAKE`, `INIT`, `AUTH`, `DL`, `PARSE` |
| `{NNN}` | Sequential number, zero-padded to 3 digits | `001`, `002`, ... `999` |

### Rules

- IDs must be unique within a single CSV file
- All test cases for the same issue share the same `{MODULE}_{AREA}` prefix
- Sequential numbering starts at `001` per prefix group
- Keep prefixes short and descriptive — derive from the module or component name

### Examples

| Issue | ID Prefix | First TC |
|-------|-----------|----------|
| Slot time fix in dcagentservice | `SLOT_WAKE_` | `SLOT_WAKE_001` |
| Replication initialization | `REP_INIT_` | `REP_INIT_001` |
| Certificate chain logging | `CERT_CHAIN_` | `CERT_CHAIN_001` |
| NS port plist parse | `NS_PORT_` | `NS_PORT_001` |
| UTF-8 rebrand fix | `UTF8_REBRAND_` | `UTF8_REBRAND_001` |

---

## 3. Test Step Writing Rules

### For QA Testers — Product-Level Language

Test steps must be written for a **QA tester**, not a developer. Use platform-appropriate, product-level instructions.

**DO:**
- "Put the machine to sleep for 10 minutes and wake it"
- "Configure rebrand in server with Japanese characters"
- "Check dcagentservice.log for refresh scheduling entry"
- "Run Troubleshoot tool from the agent tray"
- "Stop the agent service and restart it"

**DON'T:**
- "Call GetNextRefreshTimeInterval with timeUntilNextRefresh < minimumRefreshInterval"
- "Verify stringWithUTF8String is used instead of stringWithFormat"
- "Check that SecTrustEvaluateWithError returns false"
- Reference function names, variable names, line numbers, or code constructs

### Platform-Specific Commands

| Action | macOS | Windows | Linux |
|--------|-------|---------|-------|
| Sleep/Wake | Apple menu > Sleep | Start > Power > Sleep | `systemctl suspend` |
| Check logs | `cat /Library/ManageEngine/.../logs/` | `C:\ManageEngine\...\logs\` or Event Viewer | `journalctl` or `/opt/ManageEngine/.../logs/` |
| Service restart | `sudo launchctl unload/load` | `sc stop/start` or Services.msc | `sudo systemctl restart` |
| Config files | .plist (`plutil` / `defaults`) | Registry (`.reg`) or `.ini` | `.conf` or `.json` |
| Agent install | `.pkg` installer | `.msi`/`.exe` installer | `.deb`/`.rpm` package |
| Agent tray | Menu bar app | System tray icon | N/A (daemon only) |
| Process check | Activity Monitor / `ps aux` | Task Manager / `tasklist` | `ps aux` / `top` |

### Step Quality Checklist

- [ ] Each step describes exactly one observable action
- [ ] Steps reference specific artifacts (log file names, config file names, registry keys)
- [ ] No vague assertions ("verify it works correctly")
- [ ] Verification steps state what to look for (log message patterns, values, file contents)
- [ ] Steps are reproducible by someone unfamiliar with the codebase

---

## 4. Test Coverage Categories

| Category | Description | Priority | Target Proportion |
|----------|-------------|----------|-------------------|
| **Functional (Positive)** | Happy-path execution with valid inputs and normal conditions | P1 | ~35% |
| **Bug Scenario** | The exact conditions that triggered the original bug | P1 | ~15% |
| **Functional (Negative)** | Invalid inputs, missing dependencies, corrupted data | P1–P2 | ~15% |
| **Failure / Retry** | Operation fails, times out, is interrupted, or retries — network loss, partial install, corrupted config, process crash mid-operation | P1–P2 | ~10% |
| **Boundary / Edge** | Limit values, timing issues, empty inputs, concurrent access | P2–P3 | ~10% |
| **Regression** | Verify existing functionality is not broken by the change | P1–P2 | ~10% |
| **Integration** | Cross-repo or cross-component interaction scenarios | P2 | ~5% |

### Priority Assignment

| Priority | Criteria | Examples |
|----------|----------|---------|
| **P1 / Critical** | Core functionality, data integrity, security gates, bug scenario reproduction | Authentication succeeds, file downloads completely, the exact bug doesn't reproduce |
| **P2 / High** | Common variants, important error paths, cross-environment differences | Retry on failure, fallback to defaults, OP vs Cloud behavior differences |
| **P3 / Medium** | Edge cases, rare conditions, platform-specific quirks | Concurrent access, very long file paths, locale-specific formatting |

---

## 5. Test Case Count Guidelines

| Fix Complexity | Test Cases Per Fix |
|---------------|-------------------|
| Simple (single-line change, logging, config) | 2–3 |
| Medium (logic change, single module) | 4–6 |
| Complex (cross-module, timing, encoding, IPC) | 5–8 |
| End-to-end (covers all fixes together) | 1 |

---

## 6. Quality Rules

### Hard Rules

1. **Independence:** Each test case must be independently executable. No implicit ordering — TC_005 must not assume TC_004 ran first.
2. **Specific observables:** Steps must reference specific, verifiable artifacts — log file names, config file paths, specific log messages or values to look for.
3. **One scenario per TC:** Each test case tests exactly one scenario. Don't combine multiple unrelated validations.
4. **Bug scenario required:** Every fix must include at least one test case that reproduces the original bug scenario to confirm it's fixed. Mark it with `BUG SCENARIO` in Remarks.
5. **Regression required:** Every fix must include at least one test case that verifies existing (unchanged) functionality still works.
6. **Failure/retry required:** For changes involving network, IPC, file I/O, or process lifecycle, include at least one test case that simulates failure conditions (network loss, timeout, crash, corrupted data). Mark with `FAILURE SCENARIO` in Remarks.

### Soft Rules

7. **Cross-environment awareness:** Note if test behavior differs between OP and Cloud setups.
8. **Negative before boundary:** Write negative test cases (invalid input, missing dependency) before boundary/edge cases.
9. **End-to-end test:** For multi-fix releases, include one final test case that exercises all fixes together in a single agent lifecycle.

---

## 7. Regression Coverage Summary Format

A separate deliverable from the QA agent — identifies existing functionality that needs retesting due to the changes. This is a planning artifact for QA leads, not executable test cases.

### Structure

```markdown
# Regression Coverage Summary

**Source:** `<sourceBranch>`
**Target:** `<targetBranch>`
**Date:** <YYYY-MM-DD>

## Existing Functionality to Retest

| # | Area | Why Retest | Suggested Tests |
|---|------|------------|----------------|
| 1 | <functional area> | <what changed that could affect it> | <what to verify> |

## Missing Test Coverage

- <gap 1: what has no automated or manual test coverage>
- <gap 2>
```

### Rules

1. **Evidence-based:** Every retest area must trace to a specific change in the diff. Do not list generic areas "just in case."
2. **Specific, not broad:** "Agent settings XML processing" is acceptable. "Agent functionality" is too broad.
3. **Suggested tests are product-level:** Same language rules as test steps in §3 — no code references.
4. **Missing coverage lists real gaps:** Only list areas where neither automated nor manual testing exists or is known to be insufficient.

### File Naming

`regression-coverage-<sourceBranch>-vs-<targetBranch>-<YYYY-MM-DD>.md`

Sanitize branch names: replace `/` with `-`. Save in the same directory as the test case CSV.
