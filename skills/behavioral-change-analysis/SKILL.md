---
name: behavioral-change-analysis
description: 'Behavioral change analysis checklist for UEMS code review. Use when reviewing diffs for default value changes, removed code, storage/schema migration, and interface contract changes.'
user-invocable: false
---

# Behavioral Change Analysis

Checklist for detecting behavioral regressions in code diffs. Run this for **every diff hunk** during UEMS code review. Issues found here are classified under the **Change Impact** area.

## When to Use
- During code review when diffs modify default/fallback values, remove code, change storage formats, or alter public interfaces
- As a sub-checklist within the Reviewer's mandatory issue scan
- When triaging whether an issue is Change Impact vs Correctness vs Security

## The 4-Item Checklist

### 1. Default Value Changes

If a default/fallback value changed (default constant, fallback return, error-case value):
- Does this change the **failure mode**?
- Does the old default **fail-safe** (deny/block/error) while the new one **fails-open** (allow/skip/silent)?
- A default value change in error/fallback paths is a **behavioral regression until proven otherwise**.

### 2. Removed Code

For every deleted function, method, code block, or entire component/module in the `-` lines:
- **What capability is lost?**
- **Is there a replacement** in the `+` lines?
- If not, flag as a potential behavioral regression.

**Component-level removals:**
- If an entire component's processing logic, settings handler, or feature module is deleted → **High** severity unless an explicit replacement exists in the `+` lines.

**Settings processing:**
- If code that reads, writes, or processes component/feature settings is removed → verify the settings are still handled elsewhere.
- Silently dropped customer configurations = **data loss**.

> Deleted "redundant" code often carries hidden business logic.

### 3. Storage/Schema Migration

If the diff changes how or where data is stored (format, location, encryption, key names, schema):
- Is there **explicit migration logic** for existing installations?
- If no migration code is present → flag it. Existing data will be orphaned or misread on upgrade.

### 4. Interface Contract Changes

If a public function signature, IPC contract, or protocol/interface definition changed:
- **Find all callers** using `uems_agent_search_repos`.
- Are **all callers updated**?
- An interface change without caller updates is a **breaking change**.

## Change Impact Classification

Issues belong in the **Change Impact** area (not Correctness or Security) when the problem is specifically about the *transition* from old behavior to new — not about the new code being wrong in isolation:

- Failure mode regression (default value flips fail-safe → fail-open)
- Removed capability without replacement path
- Storage/schema change without migration logic for existing installations
- Interface contract change without updating all callers
- Behavioral change that breaks existing operational workflows

If the issue would exist even in a greenfield implementation (not a diff), it belongs in **Correctness** or **Security**, not Change Impact.

## Mandatory Issue Scan Integration

After completing all review steps, re-confirm these items were checked as part of the **Mandatory Issue Scan Checklist**:
- [ ] **Component/method removals** — Are any complete methods, settings handlers, or component processing blocks deleted without a replacement in the `+` lines?
- [ ] **Behavioral Change Analysis** — All 4 items above were checked for every diff hunk.
