# GOAT Gap Report — AgentInstallation

**Generated:** 2026-04-23

## Summary

- **Converted:** 53 test cases
- **Skipped (gaps):** 6 test cases

## Missing Utils

- `corrupt_file_simulation` — needed by: TC-AGENTINSTALL-MANUALGUI-003
- `uac_interaction` — needed by: TC-AGENTINSTALL-MANUALGUI-004
- `otp_dialog_interaction` — needed by: TC-AGENTINSTALL-UNINSTALL-004
- `disk_space_simulation` — needed by: TC-AGENTINSTALL-EDGE-002
- `power_failure_simulation` — needed by: TC-AGENTINSTALL-RARE-001
- `network_disconnect_simulation` — needed by: TC-AGENTINSTALL-TIMING-001

## Detailed Gap Entries

### TC-AGENTINSTALL-MANUALGUI-003

⚠ TESTCASE NOT GENERATED: TC-AGENTINSTALL-MANUALGUI-003

**Step:** Step 1: Attempt to launch the corrupted EXE and observe system response

**Required util:** `corrupt_file_simulation`

**Suggestion:** Need a GOAT operation to create/simulate a corrupt binary file for testing, or a way to verify Windows error dialog for corrupt executables

---

### TC-AGENTINSTALL-MANUALGUI-004

⚠ TESTCASE NOT GENERATED: TC-AGENTINSTALL-MANUALGUI-004

**Step:** Step 2: If UAC prompts, click No or do not enter admin credentials

**Required util:** `uac_interaction`

**Suggestion:** Need a GOAT native_gui_operation extension for UAC dialog interaction (clicking No/Cancel on elevation prompts)

---

### TC-AGENTINSTALL-UNINSTALL-004

⚠ TESTCASE NOT GENERATED: TC-AGENTINSTALL-UNINSTALL-004

**Step:** Step 3: When OTP prompt appears, enter an incorrect OTP or leave blank

**Required util:** `otp_dialog_interaction`

**Suggestion:** Need automationId for the OTP entry dialog during agent uninstall. Add to KNOWLEDGE.md when discovered.

---

### TC-AGENTINSTALL-EDGE-002

⚠ TESTCASE NOT GENERATED: TC-AGENTINSTALL-EDGE-002

**Step:** Step 1: Target drive has less than 50MB free space

**Required util:** `disk_space_simulation`

**Suggestion:** Need a GOAT operation to fill disk to near-capacity for testing low disk space scenarios

---

### TC-AGENTINSTALL-RARE-001

⚠ TESTCASE NOT GENERATED: TC-AGENTINSTALL-RARE-001

**Step:** Step 2: During installation, hard power off the machine

**Required util:** `power_failure_simulation`

**Suggestion:** Need a GOAT operation to simulate abrupt power loss (e.g., VM hard reset). This is inherently non-automatable in standard GOAT.

---

### TC-AGENTINSTALL-TIMING-001

⚠ TESTCASE NOT GENERATED: TC-AGENTINSTALL-TIMING-001

**Step:** Step 2: Immediately disconnect network on target machine

**Required util:** `network_disconnect_simulation`

**Suggestion:** Need a GOAT operation for programmatic network interface disable/enable. Suggested: network_operation with actions: disable_adapter, enable_adapter

---

