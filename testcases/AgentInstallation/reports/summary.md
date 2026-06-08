# Testcase Generation Report — AgentInstallation

**Generated:** 2026-04-23  
**Mode:** Functionality-level  
**Platform:** windows  

---

## Sources & Context Used

> This section documents every input source that was used to generate these test cases.

### Repository & Code Analysis

| Attribute | Value |
|-----------|-------|
| Repository | `uems_win_agent_setup` (cloned from repos.json) |
| Search terms used | `AgentInstall`, `UEMSAgent`, `setup.bat`, `DCAgent`, `msiexec`, `install`, `silent` |
| Files analyzed | 0 files (search returned empty — repo recently cloned) |
| Functions / entry points gathered | 0 |

**Key functions discovered:**

| # | Function / Entry Point | File Path | Line |
|---|----------------------|-----------|------|
| — | (No code results — KNOWLEDGE.md used as primary context) | — | — |

**Discovered artifacts:**

| Type | Values |
|------|--------|
| Config keys | `ServerName`, `ServerPort`, `AgentVersion`, `InstallDir` |
| Registry paths | `HKLM\SOFTWARE\AdventNet\DesktopCentral\DCAgent\`, `HKLM\SYSTEM\CurrentControlSet\Services\DCAgent` |
| Log files | `C:\Program Files (x86)\ManageEngine\UEMS_Agent\logs\DCAgentService.log` |
| Services | `ManageEngine UEMS Agent Service` (DCAgent) |

### Knowledge Document

| Attribute | Value |
|-----------|-------|
| File | `testcases/AgentInstallation/KNOWLEDGE.md` |
| Status | Found ✅ |
| Sections read | Overview, How Agent Binaries Are Obtained, Automatic Install (Push), Push 3 Methods & Fallback, Manual Install (GUI/EXE), Silent Install (EXE & MSI), Zip Install, Other Methods, Post-Install Verification, Uninstallation, GOAT Rules |
| Install methods | Push (UEMSRemoteInstaller / WMI / Remcom), Manual GUI, Silent EXE, Silent MSI, Zip (setup.bat), GPO, IP Range, Network Share, SCCM, MDT |
| GUI automation IDs | 15 found |
| GOAT operation mappings | 12 found |

### Support Tickets

| Attribute | Value |
|-----------|-------|
| File | `testcases/AgentInstallation/SUPPORT_TICKETS.md` |
| Status | Not found ⚠️ |
| Tickets loaded | 0 |

### Existing Test Cases (Pre-Generation)

| Attribute | Value |
|-----------|-------|
| Source | DB API (`http://prathosh-14802-t:3000`) |
| Existing TCs | 0 (first-generation run) |
| Coverage gaps found | All categories needed |

### CSV Files Read

| Attribute | Value |
|-----------|-------|
| CSV folder | `testcases/AgentInstallation/csv/` |
| Files read | (folder empty) |
| Total rows | 0 |
| Qengine IDs | (none) |
| Note | Existing CSV at workspace root: `AgentInstallation_testcases.csv` (59 TCs) |

---

## Summary

| Metric | Count |
|--------|-------|
| Test Cases Generated | 59 |
| &nbsp;&nbsp;— New | 59 |
| &nbsp;&nbsp;— Updated | 0 |
| &nbsp;&nbsp;— Deprecated | 0 |
| &nbsp;&nbsp;— Unchanged | 0 |
| GOAT JSON Converted | 53 |
| GOAT JSON Skipped (gaps) | 6 |

---

## Coverage by Sub-Functionality

| Sub-Functionality | Total | P1 | P2 | P3 | GOAT Converted | GOAT Skipped |
|---|---|---|---|---|---|---|
| Manual GUI Install | 7 | 3 | 4 | 0 | 5 | 2 |
| Silent EXE Install | 6 | 2 | 4 | 0 | 6 | 0 |
| Silent MSI Install | 6 | 3 | 3 | 0 | 6 | 0 |
| Zip Install | 4 | 2 | 2 | 0 | 4 | 0 |
| Push Install | 8 | 5 | 3 | 0 | 8 | 0 |
| Post-Install Verification | 7 | 4 | 3 | 0 | 7 | 0 |
| Agent Uninstall | 4 | 2 | 2 | 0 | 3 | 1 |
| Edge Cases | 5 | 0 | 2 | 3 | 4 | 1 |
| Security | 3 | 0 | 3 | 0 | 3 | 0 |
| Concurrency | 1 | 0 | 1 | 0 | 1 | 0 |
| Upgrade | 1 | 1 | 0 | 0 | 1 | 0 |
| Cleanup | 2 | 1 | 1 | 0 | 2 | 0 |
| Timing | 1 | 0 | 1 | 0 | 0 | 1 |
| Integration | 1 | 1 | 0 | 0 | 1 | 0 |
| E2E | 1 | 1 | 0 | 0 | 1 | 0 |
| Rare Scenarios | 1 | 0 | 0 | 1 | 0 | 1 |
| State Transition | 1 | 0 | 1 | 0 | 1 | 0 |

---

## Coverage by Category

| Category | Count |
|---|---|
| Functional | 21 |
| Negative | 8 |
| Failure | 6 |
| Edge | 5 |
| Cross-Environment | 4 |
| Security | 4 |
| Retry | 1 |
| Concurrency | 1 |
| Upgrade | 1 |
| Cleanup | 2 |
| Timing | 1 |
| Integration | 1 |
| E2E | 2 |
| Rare | 1 |
| State Transition | 1 |
| Resource Exhaustion | 1 |

---

## GOAT Gap Report

| Testcase ID | Missing Util | Affected Step |
|---|---|---|
| TC-AGENTINSTALL-MANUALGUI-003 | `corrupt_file_simulation` | Step 1: Attempt to launch the corrupted EXE and observe system response |
| TC-AGENTINSTALL-MANUALGUI-004 | `uac_interaction` | Step 2: If UAC prompts, click No or do not enter admin credentials |
| TC-AGENTINSTALL-UNINSTALL-004 | `otp_dialog_interaction` | Step 3: When OTP prompt appears, enter an incorrect OTP or leave blank |
| TC-AGENTINSTALL-EDGE-002 | `disk_space_simulation` | Step 1: Target drive has less than 50MB free space |
| TC-AGENTINSTALL-RARE-001 | `power_failure_simulation` | Step 2: During installation, hard power off the machine |
| TC-AGENTINSTALL-TIMING-001 | `network_disconnect_simulation` | Step 2: Immediately disconnect network on target machine |

---

## Output Files

| File | Path |
|------|------|
| CSV | `AgentInstallation_testcases.csv` |
| GOAT Payloads | `testcases/AgentInstallation/goat-payloads/` |
| Gap Report | `testcases/AgentInstallation/goat-payloads/gap-report.md` |
| Markdown Report | `testcases/AgentInstallation/reports/summary.md` |
| HTML Report | `testcases/AgentInstallation/reports/summary.html` |
