# GOAT Conversion Gap Report — Agent Installation

Test cases with gaps: **84** of 102

Gaps are steps that are NOT GOAT operations — browser/console steps (owned by Qengine) and manual/observation steps. They are listed here, never silently dropped.

### TC-AGENTINSTALL-PUSHINSTALL-001

- 2. In console: Agent > Scope of Management > Computers > Add Computers; add domain/workgroup with admin credentials.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Select the target from the discovered list and click Install Agents.  _( Qengine browser / manual (not a GOAT op) )_
- 4. Server copies installer over the network using admin credentials and runs it silently.  _( Manual / observation step (no GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-002

- 2. Console: Agent > Remote Offices > add/modify the remote office; ensure Direct Communication.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Add the target via Add Computers and trigger push.  _( Qengine browser / manual (not a GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-003

- 2. Confirm DS is Active and binaries replicated (DS replication logs).  _( Qengine browser / manual (not a GOAT op) )_
- 3. Console: add target under the Remote Office and trigger push.  _( Qengine browser / manual (not a GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-004

- 4. Add target to SoM and trigger push.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-005

- 4. Add target to SoM and trigger push.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-006

- 3. Add target to SoM and trigger push.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-007

- 3. Trigger push from server.  _( Qengine browser / manual (not a GOAT op) )_
- 4. Observe server logs: first method fails, fallback proceeds to WMI.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-008

- 2. Trigger push from server.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-009

- 2. Trigger push from server.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-010

- 1. Configure invalid admin credentials for the target.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Trigger push install.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe SoM remark.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-011

- 1. Configure a low-privilege user credential for the target.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Trigger push install.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe failure.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-012

- 1. On target, disable File and Printer Sharing / network discovery.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Trigger push install from server.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe error.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-013

- 1. Trigger push install on the legacy OS target.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Observe result.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-014

- 1. Trigger push install.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Observe result.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-015

- 1. Block the server-to-target ports / WMI on the target firewall.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Trigger push install.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-016

- 1. Add a batch of targets to SoM.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Trigger push install on all simultaneously.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-017

- 1. Add a remote office with DS and immediately add a target before replication finishes.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Trigger push install.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe SoM remark.  _( Manual / observation step (no GOAT op) )_
- 4. Wait for DS replication to complete, retry push, and confirm success.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-018

- 1. Drive concurrent push operations through UEMSRemoteInstaller.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Observe the named-pipe error condition.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-019

- 1. Trigger push install with a build in 2540.01-2540.07.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Observe the endpoint display after install.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-PUSHINSTALL-020

- 3. Verify the entry is removed from Control Panel / Apps.  _( GUI step without resolvable automationId )_

### TC-AGENTINSTALL-MANUALGUI-001

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-002

- 11. 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-004

- 1. Open the UEMS console; go to Agent > Computers > Download Agent.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Select office (Local/Remote) + OS; click Download Agent.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-006

- 2. Read CAPTCHA (automationId 3) then deliberately type wrong text (automationId 6).  _( GUI step without resolvable automationId )_
- 3. Click OK (automationId 7).  _( GUI step without resolvable automationId )_
- 4. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-007

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-008

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-009

- 1. Launch installer and proceed through the documented steps.  _( GUI step without resolvable automationId )_

### TC-AGENTINSTALL-MANUALGUI-010

- 1. Start the agent download.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Disconnect the network mid-download.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-011

- 2. After install, inspect the SOM log / install classification in the console.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-012

- 1. Set %TEMP% to an invalid path on the target.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-013

- 1. Attempt manual install under the reported failure conditions.  _( GUI step without resolvable automationId )_

### TC-AGENTINSTALL-MANUALGUI-014

- 1. Set up a target whose service tag fetch returns null.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Monitor for crash / heap corruption.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-015

- 2. Monitor for crash during strcpy on the NULL string.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-016

- 2. Monitor for crash.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-017

- 3. Monitor for crash.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MANUALGUI-018

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-001

- 3. Confirm NO GUI appears.  _( Manual / observation step (no GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-002

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-004

- 2. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-005

- 2. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-006

- 2. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-008

- 1. Configure GPO to run the silent EXE on target machines.  _( Qengine browser / manual (not a GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-SILENTINSTALL-009

- 1. Build/deploy an OSD image that runs the silent EXE during provisioning.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-001

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-002

- 1. Agent > Agent Installation > Other Methods > Download Agent (Command Line option).  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-004

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-005

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-006

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-007

- 2. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-008

- 2. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-011

- 2. Monitor duration against an expected threshold.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-013

- 2. Monitor for crash / heap corruption after decryption.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-MSIINSTALL-016

- 2. Simulate a power loss mid-write (hard power off).  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-001

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-002

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-003

- 1. Agent > Agent Installation tab > Download Agent; click the office name.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-004

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-005

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-006

- 1. Run <OfficeName>_Agent.exe from the extracted folder and follow the wizard.  _( GUI step without resolvable automationId )_

### TC-AGENTINSTALL-ZIPINSTALL-007

- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-008

- 1. Reduce free disk space below the install footprint.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-ZIPINSTALL-009

- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-001

- 1. Console: Agent > Scope of Management > Remote Offices > Download Distribution Server icon for the office.  _( Qengine browser / manual (not a GOAT op) )_
- 2. In console (Agent > Scope of Management > Remote Offices) confirm DS status = Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-002

- 1. While adding/modifying the remote office, check "Install Distribution Server automatically".  _( Qengine browser / manual (not a GOAT op) )_
- 2. Provide domain admin credentials.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Save the remote office to trigger DS install (or Actions > Install DS).  _( Qengine browser / manual (not a GOAT op) )_
- 2. In console (Agent > Scope of Management > Remote Offices) confirm DS status = Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-003

- 2. In console (Agent > Scope of Management > Remote Offices) confirm DS status = Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-004

- 2. Let the IP change (renew lease).  _( Manual / observation step (no GOAT op) )_
- 3. Observe DS<->agent and DS<->Central Server communication.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-005

- 1. Configure a remote office with automatic DS/WAN install in a cloud/MSP topology.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Save and observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-006

- 1. Trigger the scheduled DS upgrade.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Observe the upgrade result and error code.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-007

- 1. Deploy a patch/software package targeting the remote office.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-DSINSTALL-008

- 2. In console (Agent > Scope of Management > Remote Offices) confirm DS status = Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-WANAGENT-001

- 1. While adding the remote office, check "Install WAN Agent automatically".  _( Qengine browser / manual (not a GOAT op) )_
- 2. Ensure communication type = Through Distribution Server.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Provide domain admin credentials.  _( Qengine browser / manual (not a GOAT op) )_
- 4. Wait for DS to contact Central Server; install starts automatically.  _( Manual / observation step (no GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-WANAGENT-002

- 1. Console: Agent > Scope of Management > Remote Offices > Download WAN Agent icon.  _( Qengine browser / manual (not a GOAT op) )_
- 2. In UEMS console (Agent > Scope of Management > Computers) confirm the machine is listed under the correct office with remark "Agent Installed successfully" / status Active.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-WANAGENT-003

- 1. Enable automatic WAN agent install in an unreachable topology.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-AGENTUNINSTALL-001

- 1. Console: Agent > Computers > select the computer > Uninstall Agent.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Wait for completion.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-AGENTUNINSTALL-002

- 1. Open Settings > Apps (or Programs and Features).  _( GUI step without resolvable automationId )_

### TC-AGENTINSTALL-AGENTUNINSTALL-004

- 1. Verify no "ManageEngine UEMS - Agent" entry in Control Panel/Apps.  _( GUI step without resolvable automationId )_

### TC-AGENTINSTALL-AGENTUNINSTALL-005

- 2. Attempt TOTP uninstall using the console OTP.  _( GUI step without resolvable automationId )_
- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-AGENTUNINSTALL-006

- 1. Enable uninstall restriction (TOTP) in policy.  _( Qengine browser / manual (not a GOAT op) )_
- 2. Attempt to remove the agent using a third-party uninstaller tool.  _( Qengine browser / manual (not a GOAT op) )_
- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-AGENTUNINSTALL-007

- 2. Observe over the next refresh cycles whether it gets auto-uninstalled.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-AGENTUNINSTALL-008

- 1. Begin manual uninstall and reach the OTP prompt.  _( GUI step without resolvable automationId )_
- 3. Observe.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-UPGRADE-003

- 2. Observe signature verification behavior.  _( Manual / observation step (no GOAT op) )_

### TC-AGENTINSTALL-UPGRADE-007

- 2. Observe how long the console takes to reflect the Actual Agent version across refresh cycles.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-E2E-001

- 2. Push install the agent from console.  _( Qengine browser / manual (not a GOAT op) )_
- 4. Upgrade the agent to a newer build; verify AgentVersion increments.  _( Qengine browser / manual (not a GOAT op) )_

### TC-AGENTINSTALL-E2E-002

- 1. Add a Remote Office with communication = Through Distribution Server.  _( Qengine browser / manual (not a GOAT op) )_

