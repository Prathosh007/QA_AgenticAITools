```skill
---
name: testcase-json-converter
description: 'Convert manual test cases to GOAT-framework JSON payloads. Uses GOAT_Operations_Context.md as the sole authoritative source for operation types, actions, and parameters. Returns a gap report with GOAT_Operations_Context.md addition suggestions for any unmappable step. All conversion rules, component detection, dependency resolution, validation, and gap report format are self-contained in this skill.'
user-invocable: true
---

# Testcase JSON Converter Protocol

Converts structured manual test cases into executable GOAT framework JSON payloads. Only generates JSON for test cases whose every step can be mapped to a known GOAT `operation_type`. Returns a named gap report for any test case with unmappable steps — it is **never silently skipped or guessed**.

## When to Use
- After test cases are generated (via `testcase-generation` skill or manually)
- When converting existing manual test steps into GOAT automation JSON
- When validating whether GOAT currently supports all steps of a test case

---

## Step 0: Read GOAT_Operations_Context.md (MANDATORY — Run First)

Before converting any test case, read `GOAT_Operations_Context.md` from the workspace root.

This file is the **sole authoritative source** for:
- All valid `operation_type` values (Quick Reference table at the end)
- Supported `action` names for each operation type
- Required and optional parameters per action
- Deprecated aliases and correction rules

> ⛔ **Strict Rule — No Other Source:** Do NOT use any other file, internal table, or memory as the source for operation types, action names, or parameter schemas. If it's not in `GOAT_Operations_Context.md`, it does not exist — add to gap report.

> ⛔ **Browser Rule:** Steps involving UEMS web console (Qengine / browser automation) must never be converted to GOAT operations. Leave them as manual product-level instructions only.

---

## Step 1: Receive Test Case Input

Present the user with this **default prompt template**:

> **Copy the prompt below, fill in the `< >` field, and send:**
>
> ```
> Convert test cases to GOAT JSON for: <FunctionalityName>
> ```

Once received, resolve:

- **`<FunctionalityName>`** → folder name under `testcases/`
- **Source** → check DB first, fallback to flat file:

  **Resolve DB URL:** Read `testcases/db-config.json`. Default `http://localhost:3000`.

  **If DB is running** (`GET <DB_URL>/health` returns 200):
  ```
  GET <DB_URL>/testcases?functionality=<FunctionalityName>&status=active
  ```
  For each TC, check payload exists:
  ```
  GET <DB_URL>/payloads/<TC-ID>
  ```
  - **200** → skip (already converted)
  - **404** → convert and POST result

  **If DB is not running (fallback):**
  - Read `testcases/<FunctionalityName>/testcase-registry.json`
  - Check if `testcases/<FunctionalityName>/goat-payloads/<TC-ID>.js` exists
    - Exists → skip; Not exists → convert

---

## Step 2: Map Each Step to a GOAT Operation

For every step in a test case:

**2.1** Identify the action being performed using this routing table:

| Test step action | GOAT operation_type |
|-----------------|---------------------|
| Read/write registry key | `registry_operation` |
| Check/wait for HTTP request/response | `communication_operation` |
| Run an `.exe` or `.bat` | `run_bat` or `exe_install` |
| Verify process running/not running | `task_manager` |
| Read/write config or JSON file | `file_folder_modification` |
| Check file exists / doesn't exist | `file_folder_operation` |
| Start/stop Windows service | `service_actions` |
| Run a system command | `run_command` |
| Download a file | `download_file` |
| GUI interaction (native) | `native_gui_operation` |
| GUI interaction (generic) | `gui_operation` |
| Extract/create archive | `zip_operation` |

> Always verify the exact `action` name from `GOAT_Operations_Context.md` — this table is a routing guide only.

**2.2** Map each action to the correct `operation_type` + `action` + required parameters by consulting `GOAT_Operations_Context.md`. Verify exact action names and required parameters from the parameter table.

**2.3** If a step **cannot be mapped** to any operation:
- Do NOT generate JSON for this test case
- Record the step text and missing capability
- Return a gap report entry (see Step 5)

---

## Step 3: Handle Dependency Resolution

When a step reads a value used by a later step:

1. Insert a read operation with a `note` parameter to capture the value:
   ```json
   {
     "operation_type": "registry_operation",
     "parameters": {
       "action": "read_key",
       "root": "HKLM",
       "path": "SOFTWARE\\AdventNet\\DesktopCentral\\DCAgent\\SystemDetails",
       "key_name": "LocalMachineName",
       "note": "LocalMachineName"
     }
   }
   ```
2. Reference the captured value in subsequent operations as `${LocalMachineName}`

For Distribution Server and Agent installation paths: always read from Windows registry first — never hardcode paths.

---

## Step 4: Build the GOAT JSON Payload

For each test case that is **fully mappable**, produce this structure:

```javascript
component = $LocalOffice_WinAgent1;
testcaseId = "<TC-ID>";
payload = {
  "testcase_id": "<TC-ID>",
  "description": "<one-line description>",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "<type>",
      "parameters": {
        "action": "<action>",
        ...
      }
    }
  ],
  "expected_result": "<specific, verifiable outcome>"
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
```

### Component Auto-Detection

| Test case operates on… | Component |
|------------------------|-----------|
| Agent process/service/registry/logs/EXE | `$LocalOffice_WinAgent1` |
| Distribution Server service/config/registry | `$DS_Machine_IP` |
| UEMS Server service/database/API/web console backend | `$Server_Machine_IP` |

**Rules:**
- One component per test case — use where the **primary action** executes
- Cross-machine verification → note in `expected_result`, don't split component
- Cannot determine? → default to `$LocalOffice_WinAgent1` + add `// TODO: verify component`

### Payload Rules
- Use Windows backslash paths (`\\`) throughout
- `continueOnFailure` only valid on: `registry_operation`, `native_gui_operation`, `communication_operation` — remove from all others
- Do NOT invent action names — use only those in `GOAT_Operations_Context.md`
- One `operation_type` object per atomic action — do not combine multiple actions into one
- OR/AND conditions: Use `run_command` with shell `||` / `&&` logic — not separate operations

---

## Step 5: Gap Report — Unmappable Steps

For every test case with **at least one unmappable step**:

```
⚠ TESTCASE NOT GENERATED: <TC-ID>
Reason: The following step(s) require a GOAT util that is not currently available:

  Step N: "<step text>"
  Required util: <operation_type_name>

Suggested addition to GOAT_Operations_Context.md:

  | operation_type | Handler | Actions |
  |---|---|---|
  | `<type>` | <Handler Name> | `<action>` |

  Parameters for `<action>`: <param1> (Required), <param2> (Optional)
```

Collect all gaps into a summary:

```
=== CONVERSION SUMMARY ===
Converted:    N test cases
Skipped:      N test cases (missing utils)

Missing Utils Required:
  - <util_name>  (needed by: TC-XXX-001, TC-XXX-002)
```

---

## Step 6: Validation Pass

After generating all JSON payloads, validate each one:

| Check | Rule |
|-------|------|
| Unknown `operation_type` | Error — only types from Quick Reference in `GOAT_Operations_Context.md` |
| Invalid `action` for type | Error — cross-check operation section |
| Missing required parameters | Error |
| `continueOnFailure` on invalid types | Remove silently, report in summary |
| Path format | Replace forward slashes with backslashes |
| Structural issues | Must have `testcase_id`, `operations` array, `expected_result` |
| Variable references | `${...}` must have corresponding `note` capture earlier |

Fix auto-correctable issues. Report others.

---

## Step 7: Output

**For each converted TC:** Output full payload block.
**For each skipped TC:** Output gap report entry.
**At end:** Output conversion summary.

**Save results:**

_If DB is running:_
- POST each payload to `<DB_URL>/payloads`:
  ```json
  { "tc_id": "<TC-ID>", "functionality": "<Name>", "component": "<component>", "payload": "<JS content>" }
  ```
  ⚠️ Build `[PSCustomObject]` and pipe through `ConvertTo-Json -Depth 10 -Compress` to properly escape.

- POST each gap to `<DB_URL>/gaps`:
  ```json
  { "tc_id": "<TC-ID>", "functionality": "<Name>", "missing_util": "<util>", "step_text": "<step>", "suggestion": "<suggestion>" }
  ```

**Verify DB State (MANDATORY):**
- `GET <DB_URL>/payloads?functionality=<Name>` — confirm count matches converted TCs
- `GET <DB_URL>/gaps?functionality=<Name>` — confirm count matches gap entries
- Print: `✅ DB Verified: Payloads <n>/<converted>, Gaps <n>/<skipped>`

**Always save locally (regardless of DB):**
- Payloads: `testcases/<FunctionalityName>/goat-payloads/<TC-ID>.js`
- Gap report: `testcases/<FunctionalityName>/goat-payloads/gap-report.md`

---

## Appendix: Forbidden Patterns

| Pattern | Rule |
|---------|------|
| Browser/web console steps | ⛔ Never convert — Qengine scope only |
| Manual-only steps | ⛔ Leave as manual instructions |
| `continueOnFailure` on invalid types | Only valid on: `registry_operation`, `native_gui_operation`, `communication_operation` |
| Forward slashes in paths | Replace with `\\` |
| Combining multiple actions | One `operation_type` per atomic action |
| OR/AND conditions | Use `run_command` with shell `||` / `&&` |
| Invented action names | ⛔ Treat as unmapped → gap report |

```
