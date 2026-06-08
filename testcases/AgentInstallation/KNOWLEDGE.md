# UEMS Agent Installation — Knowledge Base

> **Source:** [Agent Installation Methods for Windows](https://www.manageengine.com/products/desktop-central/agent-installation.html)  
> **Additional Sources:**
> - [Add Remote Office](https://www.manageengine.com/products/desktop-central/how-to/add_remote_office.html)
> - [About Remote Office](https://www.manageengine.com/products/desktop-central/help/configuring_desktop_central/managing_computers_wan.html#what-is-remote-office)
> - [Installing WAN Agents and Distribution Server](https://www.manageengine.com/products/desktop-central/help/configuring_desktop_central/installing_wan_agents_and_distribution_server.html)
>
> **Last updated:** 2026-05-11  
> **Scope:** Windows platform only (x86, x64, ARM64 architectures)

---

## Overview

Endpoint Central (UEMS) is a **client-server model**. The UEMS server manages all endpoints in an enterprise from a centralized location. An agent must be installed on every endpoint to bring it under management. The agent communicates with either the **central server** (LAN/WAN direct) or a **Distribution Server** (remote office).

Key facts:
- Reboot is **not** required after agent installation.
- The installer binary is named `<BranchOfficeName>_Agent.exe` (EXE method) or `UEMSAgent.msi` (MSI/zip method).
- All installer files (`.msi`, `.mst`, `.crt`) must be copied together — missing `.mst` causes **"Error applying transforms"**.
- **Agent installation works the same way in both Local Office and Remote Office** — every installation method (push, manual, silent, zip) is applicable to both office types.
- Remote Office agents may communicate via a Distribution Server or directly with the Central Server depending on the configured communication type.
- **Windows architecture matters:** Agent binaries and Windows APIs differ across x86 (32-bit), x64 (64-bit), and ARM64 architectures. Test cases must cover all target architectures.

---

## Windows Architecture Considerations

> ⚠️ **Mandatory test dimension:** Every agent installation test case must specify and validate against the target Windows architecture. Windows APIs, file system paths, registry views, and installer behavior differ across architectures.

### Supported Architectures

| Architecture | Description | Windows Versions | Notes |
|-------------|-------------|-----------------|-------|
| **x86** (32-bit) | 32-bit Windows | Windows 10 (32-bit) | Legacy; declining market share but still in enterprise environments |
| **x64** (64-bit) | 64-bit Windows (AMD64/Intel 64) | Windows 10/11 (64-bit), Windows Server 2016/2019/2022 | Most common enterprise deployment |
| **ARM64** | ARM-based Windows | Windows 11 on Qualcomm Snapdragon, Surface Pro X | Runs x86/x64 apps via emulation; native ARM64 APIs differ |

### Architecture-Specific Differences That Affect Agent Installation

| Aspect | x86 (32-bit) | x64 (64-bit) | ARM64 |
|--------|-------------|-------------|-------|
| **Install directory** | `C:\Program Files\ManageEngine\UEMS_Agent\` | `C:\Program Files (x86)\ManageEngine\UEMS_Agent\` | `C:\Program Files (x86)\ManageEngine\UEMS_Agent\` (emulated) |
| **Registry hive** | `HKLM\SOFTWARE\AdventNet\...` | `HKLM\SOFTWARE\WOW6432Node\AdventNet\...` (32-bit app on 64-bit OS) | `HKLM\SOFTWARE\WOW6432Node\AdventNet\...` (emulated) |
| **System32 path** | `C:\Windows\System32\` (32-bit) | `C:\Windows\SysWOW64\` (32-bit view), `C:\Windows\System32\` (64-bit) | Native ARM64 + emulated x86/x64 |
| **Push install remote tools** | 32-bit `remcom.exe` | 64-bit `remcom64.exe` preferred | May use x64 emulated tools |
| **MSI installer behavior** | Native 32-bit MSI | Runs under WOW64 MSI subsystem | Runs under emulation layer |
| **Windows services architecture** | 32-bit service binary | 32-bit service under WOW64 | Emulated; verify service starts correctly |
| **File system redirection** | None | Active (`SysWOW64` redirection for 32-bit processes) | Active (emulation layer) |
| **Performance** | Native | Native | Emulated (may have perf overhead) |

### Architecture-Specific Test Checkpoints

For **every** installation test case, include these architecture-aware verification steps:

1. **Pre-install:** Record target machine's architecture (`wmic os get osarchitecture`)
2. **Install path:** Verify agent installs to the correct `Program Files` vs `Program Files (x86)` path for the architecture
3. **Registry view:** Verify registry keys are created in the correct hive (direct vs `WOW6432Node`)
4. **Service binary:** Verify the correct architecture-specific service binary is running
5. **Push tools:** For push install, verify the correct `remcom` variant is used (`remcom.exe` for x86, `remcom64.exe` for x64)
6. **ARM64 emulation:** On ARM64 machines, verify the agent installs and runs correctly under x86/x64 emulation

### GOAT Architecture Verification Operations

| Scenario | GOAT Operation Type | Notes |
|----------|--------------------|----|  
| Detect machine architecture | `run_command` with `wmic os get osarchitecture` | Returns "32-bit" or "64-bit"; for ARM64 use `$env:PROCESSOR_ARCHITECTURE` |
| Verify correct install path | `file_folder_operation` with `action: "check_presence"` | Path differs by architecture (see table above) |
| Verify correct registry hive | `registry_operation` with `action: "read_key"` | Use `WOW6432Node` path on x64/ARM64 |
| Check process architecture | `run_command` with `tasklist /FI "IMAGENAME eq DCAgentService.exe" /FO LIST` | Verify expected process is running |

---

## Remote Office & Local Office Architecture

### What Is a Remote Office?

A **Remote Office** is a location-based group representing a geographical location of an organization's network. Each geographical presence (branch office, regional headquarters, data center, etc.) is created as a separate Remote Office to manage the computers in that location.

> 📖 Reference: [About Remote Office](https://www.manageengine.com/products/desktop-central/help/configuring_desktop_central/managing_computers_wan.html#what-is-remote-office)

### What Is a Local Office?

A **Local Office** (also called "LocalOffice") is the default office created when the UEMS server is installed. It represents the primary site where the Central Server resides. Agents in the Local Office communicate directly with the Central Server over the LAN.

### Communication Types

Agents in a Remote Office can communicate with the Central Server in two ways:

| Communication Type | How It Works | Best For |
|-------------------|-------------|----------|
| **Direct Communication** | Each agent connects directly to the Central Server over WAN | Small offices with sufficient bandwidth, fewer than 50 computers |
| **Through Distribution Server** | A Distribution Server in the remote office acts as intermediary — pulls updates from Central Server and serves them to local agents | Remote offices with limited WAN bandwidth, more than 50 computers |

**Local Office agents** always use direct communication (same LAN as Central Server).

### Comparison Matrix — Direct vs Distribution Server

| Aspect | Direct Communication | Through Distribution Server |
|--------|---------------------|---------------------------|
| Best for | Local offices or small offices with sufficient bandwidth / < 50 computers | Remote/branch offices with limited WAN bandwidth or > 50 computers |
| Setup Complexity | Simple, no intermediary server needed | Requires setting up a DS in each remote office |
| Bandwidth Usage | High — each device connects directly to Central Server | Optimized — only DS communicates with Central Server |
| Server Load | Higher — more computers contact server directly | Lower — fewer direct connections to Central Server |
| Scalability | May strain bandwidth in large environments | Scales well for large remote offices |

### Key Rule for Test Case Generation

> ⚠️ **All agent installation methods (Automatic/Push, Manual/GUI, Silent, Zip) apply to BOTH Local Office and Remote Office.** Every test case should be executable in both office types. The installer binary name changes based on the office (e.g., `LocalOffice_Agent.exe` vs `BranchOffice1_Agent.exe`), but the installation procedure is identical.

### Adding a Remote Office (Server UI Steps)

> 📖 Reference: [How to Add Remote Office](https://www.manageengine.com/products/desktop-central/how-to/add_remote_office.html)

1. Navigate to **Agent → Remote Offices → Add Remote Office**
2. **Step 1 — Remote Office Details:** Enter name and description
3. **Step 2 — Central Server Details:** Pre-filled; edit IP/port if needed (default port 8383)
4. **Step 3 — Communication Type:** Select **Direct Communication** or **Through Distribution Server**
5. **Step 4 — Distribution Server Details** (if DS chosen): Enter NetBIOS domain, computer name, IP, port, FQDN; configure replication policy (data transfer rate, schedule, interval)
6. **Step 5 — DS/WAN Agent to Central Server Communication:** HTTPS by default; configure proxy if needed
7. **Step 6 — Remote Control Settings:** Compression level and color quality
8. **Step 7 — OS Deployment Settings:** Image and driver repository
9. **Step 8 — Remote DS/Agent Installation:** Enable auto-install for DS and WAN Agent; provide domain credentials
10. **Step 9 — Managed Computers:** Add computers manually or import via CSV

### Modifying a Remote Office

1. Go to **Agent → Scope of Management → Remote Offices tab**
2. Click the **Modify icon** in the Actions column for the target remote office
3. If communication type changes from Direct to Through DS, a Distribution Server must be installed

---

## Distribution Server (DS) Installation

> 📖 Reference: [Installing WAN Agents and Distribution Server](https://www.manageengine.com/products/desktop-central/help/configuring_desktop_central/installing_wan_agents_and_distribution_server.html)

### What Is a Distribution Server?

The **Distribution Server (DS)** is a lightweight software component installed on one computer in a remote office. It acts as an intermediary between the Central Server and the agents:

- Pulls updates, patches, configurations, and software packages from the Central Server
- Replicates them to agents in the remote office
- Reduces WAN bandwidth usage — only the DS communicates with the Central Server

Key facts:
- **One DS per remote office** (and one remote office per DS)
- DS must have a **static IP address** for stable communication
- DS does NOT require Windows Server OS — it can be installed on **Windows client OS** machines
- Once installed, DS upgrades are handled **automatically**
- DS only handles file distribution; for other activities, agents still need a connection to the Central Server

### DS Installation — Automatic

1. While adding/modifying a remote office, go to **Remote Agent Installation** section
2. Check the box for **Install Distribution Server automatically**
3. Provide **domain credentials** with administrator privileges for the DS target machine
4. The DS installation is triggered automatically when the remote office is saved

**Alternative method:**
1. Navigate to **Agent → Scope of Management → Remote Offices tab**
2. In the **Actions** column, click **Actions → Install DS** for the target remote office

### DS Installation — Manual

1. Navigate to **Agent → Scope of Management → Remote Offices tab**
2. In the **Download Agent** column, click the **Download Distribution Server** icon for the target remote office
3. Copy the downloaded installer to the target DS machine
4. Run the installer
5. Select the folder path for Distribution Server files
6. Follow on-screen prompts to complete installation

### DS Post-Installation Verification

| Check | Where to Verify |
|-------|----------------|
| DS Service is Running | Windows Services → **ManageEngine UEMS Distribution Server** |
| DS registered with Central Server | UEMS console → Agent → Scope of Management → Remote Offices → DS status shows **Active** |
| DS replication working | Check replication logs on DS; verify patches/software are synced |
| DS communication with Central Server | Verify HTTPS connectivity; check proxy config if applicable |

### DS Installation — GOAT Hints

| Scenario | GOAT Operation Type | Notes |
|----------|--------------------|----|
| Run DS installer (manual) | `exe_install` or `run_bat` | Use `file_path` pointing to DS installer |
| Verify DS service state | `service_actions` with `action: "status"` | Service name: `ManageEngine UEMS Distribution Server` |
| Verify DS directory | `file_folder_operation` with `action: "check_presence"` | Default: `C:\Program Files (x86)\ManageEngine\UEMS_DS\` |

---

## Agent Installation for Both Office Types

> ⚠️ **Critical knowledge for test case generation:**
> All installation methods below work identically for both **Local Office** and **Remote Office** agents. The only differences are:

| Aspect | Local Office | Remote Office |
|--------|-------------|--------------|
| Installer filename | `LocalOffice_Agent.exe` | `<RemoteOfficeName>_Agent.exe` |
| Agent communicates with | Central Server (direct) | Distribution Server or Central Server (depending on communication type) |
| Registry key `ServerName` | Central Server hostname/IP | DS hostname/IP (if via DS) or Central Server (if direct) |
| Download path in server UI | Agent → Computers → Download Agent → Select "LocalOffice" | Agent → Computers → Download Agent → Select the remote office name |
| GOAT `component` variable | `$LocalOffice_WinAgent1` | `$<RemoteOfficeName>_WinAgent1` |

> When generating test cases, create **separate test case variants** for Local Office and Remote Office where the office type affects the test behavior (e.g., agent-to-server communication path, DS intermediary, installer binary name).

---

## How Agent and DS Binaries Are Obtained From the Server

Before any installation method can be used, the agent (or DS) binaries must be downloaded from the UEMS server:

### Agent Installers

| Download Path (Server UI) | When to Use | Office Type |
|--------------------------|-------------|-------------|
| Agent → Agent Installation tab → Download Agent (click Remote Office name) | EXE installer per office | Both Local & Remote |
| Agent → Computers → Download Agent → Select office + OS → Click Download Agent | EXE installer | Both Local & Remote |
| Agent → Agent Installation → Other Methods → Download Agent (Command Line option) | MSI zip for silent/command-line install | Both Local & Remote |

### Distribution Server Installer

| Download Path (Server UI) | When to Use |
|--------------------------|-------------|
| Agent → Scope of Management → Remote Offices → Download Distribution Server icon | Manual DS installation on a remote office machine |
| Agent → Scope of Management → Remote Offices → Actions → Install DS | Automatic DS push installation |

The downloaded agent file is either:
- `<BranchOfficeName>_Agent.exe` — single executable with embedded DS/server config (e.g., `LocalOffice_Agent.exe`, `BranchOffice1_Agent.exe`)
- A zip containing `UEMSAgent.msi`, `UEMSAgent.mst`, `DMRootCA-Server.crt`, `DMRootCA.crt`

---

## Installation Types

> All four installation methods below apply to **both Local Office and Remote Office** agents. The only difference is the installer binary name and the server/DS the agent registers with.

### 1. Automatic Installation (Push)

**What it is:** The server automatically pushes and installs the agent on discovered machines without requiring physical or manual intervention at the endpoint.

**Applies to:** Local Office ✅ | Remote Office ✅

**How it works (from the server — Local Office):**
1. Navigate to **Agent → Scope Of Management → Computers → Add Computers**.
2. Add the domain/workgroup and provide admin credentials (domain user with admin rights).
3. Select the target computers from the discovered list and click **Next**.
4. Click **Install Agents** — the server installs the agent immediately via WMI/remote push.

**How it works (from the server — Remote Office):**
1. Navigate to **Agent → Remote Offices → Add/Modify Remote Office**.
2. Under **Remote Agent Installation**, check **Install WAN Agent Automatically**.
3. Add computers via **Add Computers** or import via **CSV**.

**What happens on the agent machine:**
- The server copies the installer to the target machine over the network using admin credentials.
- The installer runs silently (no user interaction on the endpoint).
- The agent service registers with the Distribution Server or central server.

**Pre-requisites:**
- Admin credentials for the target machine must be configured in the server.
- WMI (Windows Management Instrumentation) must be accessible from the server to the target.
- Ports must be open between the server and target machine.

---

#### Push Installation — 3 Underlying Methods & Fallback/Retry Logic

The UEMS server uses **three separate executables** to perform a push installation. If one method fails, the server automatically retries using the next available method in order:

| Method | Executable | Location on DS / Server |
|--------|------------|-------------------------|
| 1. UEMSRemoteInstaller | `UEMSRemoteInstaller.exe` | `C:\Program Files (x86)\ManageEngine\UEMS_Agent\bin\` |
| 2. WMI (Windows Management Instrumentation) | Built-in Windows WMI service | Target machine must have WMI accessible |
| 3. Remcom | `remcom.exe` | `C:\Program Files (x86)\ManageEngine\UEMS_Agent\bin\` |

**Fallback order:** `UEMSRemoteInstaller.exe` → `WMI` → `remcom.exe`  
If all three fail, the push installation fails.

---

#### Testing Push Via a Specific Method (Isolation Test Approach)

To force the server to use a specific push method (and verify it works independently), **rename the other two executables** so they cannot be invoked. After the test, **rename them back to their original names**.

> ⚠️ Always restore the original filenames after each test case. Leaving executables renamed will break subsequent push installations.

**Test Case: Force UEMSRemoteInstaller only**

| Step | Action | GOAT Hint |
|------|--------|-----------|
| Setup | Rename `remcom.exe` → `remcom.exe.bak` | `file_folder_operation: rename` |
| Setup | Rename `remcom64.exe` → `remcom64.exe.bak` (if present) | `file_folder_operation: rename` |
| Setup | Disable WMI service temporarily: `net stop winmgmt /y` | `service_actions: stop` |
| Test | Trigger push install from server (Qengine step) | — |
| Verify | `ManageEngine UEMS Agent Service` is RUNNING | `service_actions: status` |
| Teardown | Start WMI service: `net start winmgmt` | `service_actions: start` |
| Teardown | Rename `remcom.exe.bak` → `remcom.exe` | `file_folder_operation: rename` |

**Test Case: Force WMI only**

| Step | Action | GOAT Hint |
|------|--------|-----------|
| Setup | Rename `UEMSRemoteInstaller.exe` → `UEMSRemoteInstaller.exe.bak` | `file_folder_operation: rename` |
| Setup | Rename `remcom.exe` → `remcom.exe.bak` | `file_folder_operation: rename` |
| Test | Trigger push install from server (Qengine step) | — |
| Verify | `ManageEngine UEMS Agent Service` is RUNNING | `service_actions: status` |
| Teardown | Rename both `.bak` files back to original names | `file_folder_operation: rename` |

**Test Case: Force Remcom only**

| Step | Action | GOAT Hint |
|------|--------|-----------|
| Setup | Rename `UEMSRemoteInstaller.exe` → `UEMSRemoteInstaller.exe.bak` | `file_folder_operation: rename` |
| Setup | Disable WMI service: `net stop winmgmt /y` | `service_actions: stop` |
| Test | Trigger push install from server (Qengine step) | — |
| Verify | `ManageEngine UEMS Agent Service` is RUNNING | `service_actions: status` |
| Teardown | Start WMI: `net start winmgmt` | `service_actions: start` |
| Teardown | Rename `UEMSRemoteInstaller.exe.bak` → `UEMSRemoteInstaller.exe` | `file_folder_operation: rename` |

**Executable paths:**
```
C:\Program Files (x86)\ManageEngine\UEMS_Agent\bin\UEMSRemoteInstaller.exe
C:\Program Files (x86)\ManageEngine\UEMS_Agent\bin\remcom.exe
C:\Program Files (x86)\ManageEngine\UEMS_Agent\bin\remcom64.exe
```

> ℹ️ **GOAT Rule for rename operations:** Use `file_folder_operation` with `action: "rename"`. Always add a teardown rename step in the same test case to restore original names — do not rely on a separate cleanup test case.

---

### 2. Manual Installation (GUI/EXE)

**What it is:** A human physically runs the agent installer on the endpoint machine via a wizard-based GUI. Used when remote push is not possible (e.g., no WMI access, firewall restrictions, or internet-isolated machine).

**Applies to:** Local Office ✅ | Remote Office ✅

**How it works (from the server):**
1. Navigate to **Agent → Computers → Download Agent**.
2. Select the Office (Local Office or Remote Office name) and operating system.
3. Click **Download Agent** → saves `<OfficeName>_Agent.exe` (e.g., `LocalOffice_Agent.exe` or `BranchOffice1_Agent.exe`).
4. Copy the EXE to the target agent machine (USB, file share, email, etc.).

**What happens on the agent machine (installer wizard flow):**

The installer is a wizard with the following interactive steps:

| Step | GUI Element | Action | AutomationId |
|------|-------------|--------|-------------|
| 1 | Captcha display label | Read CAPTCHA text | `3` |
| 2 | CAPTCHA input field | Type the CAPTCHA text read from step 1 | `6` |
| 3 | OK button | Click to validate CAPTCHA | `7` |
| 4 | "Next >" button | Wait for it to appear (timeout 10s) | `2018` |
| 5 | "Next >" button | Click (first Next — proceeds past info screen) | `2018` |
| 6 | "Next >" button | Click (second Next — starts installation) | `2018` |
| 7 | Completion status text | Wait for it to appear (timeout 30s) | `2023` |
| 8 | Completion status text | Read text; expected value: `"Installation Complete"` | `2023` |
| 9 | Close button | Click to exit installer | `2075` |

> ⚠️ **Testcase Generation Rule:**  
> Whenever a test case step involves the manual installation wizard GUI, use the `native_gui_operation` format above with the documented `automationId` values.  
> If a new GUI element is encountered that is not listed in the table above, **ask the user to provide the automationId** before generating the GOAT JSON — do NOT guess or fabricate automation IDs.

> ℹ️ **Browser automation note:**  
> Browser-based steps (e.g., navigating the UEMS server web console) are handled by **Qengine**, not GOAT. Do **not** generate `gui_operation` or `native_gui_operation` for browser steps. Leave browser steps as manual product-level instructions in the test case.

---

### 3. Silent Installation

**What it is:** The agent is installed without any GUI wizard appearing. Fully automated via command line. Used for scripted deployment, GPO, or SCCM-based rollout.

**Applies to:** Local Office ✅ | Remote Office ✅

#### Method A — EXE Silent Install

**How it works (from the server):**
1. Navigate to **Agent → Computers → Download Agent**.
2. Select Office (Local or Remote) and OS → **Download Agent** → saves `<OfficeName>_Agent.exe`.
3. Copy the EXE to the target machine.

**On the agent machine:**
```cmd
<RemoteOfficeName>_Agent.exe /silent
```
Example:
```cmd
LocalOffice_Agent.exe /silent
```
- No GUI appears.
- Agent installs and registers with the configured Distribution Server/central server.

#### Method B — MSI Zip Silent Install

**How it works (from the server):**
1. Navigate to **Agent → Agent Installation → Other Methods → Download Agent (Command Line option)**.
2. Download the zip; extract on the target machine.
3. The zip contains: `UEMSAgent.msi`, `UEMSAgent.mst`, `DMRootCA-Server.crt`, `DMRootCA.crt`.

**On the agent machine (open Command Prompt as Administrator in the extracted folder):**

For builds **below** 10.1.2220.1:
```cmd
msiexec /i "UEMSAgent.msi" /qn TRANSFORMS="UEMSAgent.mst" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual SERVER_ROOT_CRT="%cd%\DMRootCA-Server.crt" DS_ROOT_CRT="%cd%\DMRootCA.crt" /lv "Agentinstalllog.txt"
```

For builds **above** 10.1.2220.1:
```cmd
msiexec /i "UEMSAgent.msi" /qn TRANSFORMS="UEMSAgent.mst" ENABLESILENT=yes REBOOT=ReallySuppress INSTALLSOURCE=Manual SERVER_ROOT_CRT="%cd%\DMRootCA-Server.crt" DS_ROOT_CRT="%cd%\DMRootCA.crt" /lv "Agentinstalllog.txt"
```

> The log file `Agentinstalllog.txt` is created in the current directory for troubleshooting.

---

### 4. Zip Installation

**What it is:** Download the full agent package as a zip from the server, copy to the agent machine, and install by running `setup.bat` from the extracted contents. Used for remote offices or machines where the server pushes to the DS, or where the agent needs to be deployed with server-side configuration baked in.

**Applies to:** Local Office ✅ | Remote Office ✅

**Downloaded file name:** `<OfficeName>_Agent.zip` (e.g., `LocalOffice_Agent.zip`, `BranchOffice1_Agent.zip`)

**How it works (from the server):**
1. In the UEMS server web console, navigate to **Agent → Agent Installation tab**.
2. In the **Download Agent** section, click the Remote Office name — this downloads `<BranchOfficeName>_Agent.zip`.
3. Copy the zip to the target agent machine (USB, file share, etc.).

**On the agent machine (primary method — setup.bat):**
1. Extract `<BranchOfficeName>_Agent.zip` to a directory (e.g., `C:\Installers\ZipExtract\`).
2. Open Command Prompt as Administrator.
3. Navigate to the extracted directory.
4. Run:
   ```cmd
   setup.bat
   ```
5. The batch file installs the agent silently using the embedded server configuration.
6. After completion, verify:
   - **Service:** `ManageEngine UEMS Agent Service` is RUNNING
   - **Registry:** `HKLM\SOFTWARE\AdventNet\DesktopCentral\DCAgent\ServerName` is populated
   - **Install dir:** `C:\Program Files (x86)\ManageEngine\UEMS_Agent\` exists

**Alternate methods from extracted zip contents:**
- **GUI wizard:** Execute `<BranchOfficeName>_Agent.exe` and follow the same wizard steps as [Manual Installation](#2-manual-installation-guiexe) above (same `automationId` values apply).
- **Silent EXE:** `<BranchOfficeName>_Agent.exe /silent`
- **Silent MSI:** Run the `msiexec` command from the extracted directory (see [Silent Installation — Method B](#method-b--msi-zip-silent-install) above).

**Key files in the extracted zip:**

| File | Purpose |
|------|---------|
| `<BranchOfficeName>_Agent.exe` | GUI wizard / silent EXE installer |
| `setup.bat` | Primary batch installer — recommended method |
| `UEMSAgent.msi` | MSI installer (used by setup.bat and silent MSI method) |
| `UEMSAgent.mst` | MSI transform with server configuration |
| `DMRootCA-Server.crt` | Server root certificate |
| `DMRootCA.crt` | CA root certificate |

> ⚠️ All files must be present in the extracted directory. Missing `UEMSAgent.mst` causes **"Error applying transforms"**. Missing `.crt` files cause certificate validation failures.

---

## Other Installation Methods (Summary)

| Method | Entry Point in Server UI | Office Type |
|--------|--------------------------|-------------|
| Agent deployment along with OS | Agent → Agent Installation | Both |
| GPO-based installation | Agent → Agent Installation → Other Methods | Both |
| IP Range based deployment | Agent → Agent Installation → Other Methods | Both |
| Network share installation | Agent → Agent Installation → Other Methods | Both |
| ME MDM | Agent → Agent Installation → Other Methods | Both |
| Microsoft Services / AWS | Agent → Agent Installation → Other Methods | Both |
| MDT | Agent → Agent Installation → Other Methods | Both |
| SCCM | Agent → Agent Installation → Other Methods | Both |
| Agent Reinstallation | Agent → Computers → Select computer → Reinstall Agent | Both |

---

## WAN Agent Installation (Remote Office Specific)

> 📖 Reference: [Installing WAN Agents and Distribution Server](https://www.manageengine.com/products/desktop-central/help/configuring_desktop_central/installing_wan_agents_and_distribution_server.html)

WAN agents are required to manage computers in remote offices that communicate through a Distribution Server. They can be installed automatically or manually.

### WAN Agent — Automatic Installation

1. While adding the remote office, go to the **Remote Office Agent Installation** section
2. Check the box for **Install WAN Agent automatically**
3. Ensure communication type is set to **Through Distribution Server**
4. Provide domain credentials for administrator access on all managed computers
5. Agent installation starts automatically once the DS contacts the Central Server

> ⚠️ **Note:** Automatic WAN agent installation will **not work** if devices are not directly reachable from the server (e.g., cloud or MSP setups).

### WAN Agent — Manual Installation

1. Go to **Agent → Scope of Management → Remote Offices tab**
2. In the **Download Agent** column, click the **Download WAN Agent** icon next to the remote office
3. Select the platform:
   - **Windows:** Download the `.exe` file and run it
   - **macOS:** Download the `.pkg` file and complete setup
   - **Linux:** Download `UEMSLinuxAgent.zip`, unzip, and install via terminal
4. Run the installer on the target machine

### WAN Agent Post-Installation Verification

| Check | Where to Verify |
|-------|----------------|
| Agent service is Running | Windows Services → **ManageEngine UEMS Agent Service** |
| Agent communicates via DS | Agent logs show DS hostname/IP as communication target |
| Agent registered with Central Server | UEMS console → Agent → Computers → machine shows **Active** under the remote office |
| Registry `ServerName` | Points to DS hostname/IP (not Central Server) |

---

## Post-Installation Verification

After any installation method, verify the following (applies to **both Local Office and Remote Office** agents, **all architectures**):

| Check | Where to Verify | Notes | Architecture-Specific |
|-------|----------------|-------|----------------------|
| Machine architecture | `wmic os get osarchitecture` or `$env:PROCESSOR_ARCHITECTURE` | Record before all other checks | First step always |
| Service is Running | Windows Services (`services.msc`) → **ManageEngine UEMS Agent Service** | Same for both office types | Same across all architectures |
| Service Startup type is Automatic | `HKLM\SYSTEM\CurrentControlSet\Services\DCAgent` → `Start = 2` | Same for both | Same across all architectures |
| Registry keys created | `HKLM\SOFTWARE\AdventNet\DesktopCentral\DCAgent\` (x86) or `HKLM\SOFTWARE\WOW6432Node\AdventNet\DesktopCentral\DCAgent\` (x64/ARM64) → ServerName, ServerPort, AgentVersion, InstallDir | **ServerName** = Central Server IP (Local Office) or DS IP (Remote Office via DS) | **Registry hive differs by architecture** |
| Installation directory | `C:\Program Files\ManageEngine\UEMS_Agent\` (x86) or `C:\Program Files (x86)\ManageEngine\UEMS_Agent\` (x64/ARM64) with subdirs `bin\`, `conf\`, `logs\` | Same for both office types | **Install path differs by architecture** |
| Agent registered with server | UEMS server console → Agent → Computers → machine shows as **Active** | Check it appears under the correct office | Same across all architectures |
| Agent communication log | `<InstallDir>\logs\DCAgentService.log` | Verify communication target matches expected server/DS | Path follows install directory |
| ARM64 emulation working | On ARM64: verify agent process runs under emulation without errors | Check Event Viewer for emulation warnings | **ARM64 only** |

### Additional Remote Office Checks

| Check | Where to Verify |
|-------|----------------|
| Agent assigned to correct Remote Office | UEMS console → Agent → Scope of Management → computer listed under expected Remote Office |
| DS communication (if via DS) | Agent log shows DS hostname/IP as communication target, not Central Server directly |
| Replication from Central Server to DS | DS logs show successful sync of patches/software from Central Server |

---

## Uninstallation

**From the server:**
1. Agent → Computers → Select computers → **Uninstall Agent**.

**From the endpoint (Control Panel — GUI flow):**
1. Open **Settings → Apps** (Windows 10/11) or **Control Panel → Programs and Features**.
2. Search for `UEMS-Agent` in the search box.
3. Select **ManageEngine UEMS - Agent** from the results.
4. Click **Uninstall**.
5. Wait for the OTP prompt (OTP shown in UEMS console: Agent → Scope of Management → Computers → **View OTP**).
6. Enter the OTP to authorize uninstall.
7. Wait for completion — status text shows **"Agent successfully uninstalled"**.

**Manual Uninstall — GOAT `native_gui_operation` AutomationId Table:**

| Step | GUI Element | Action | AutomationId | Notes |
|------|-------------|--------|-------------|-------|
| 1 | Search box in Apps/Programs | `EnterText` | `SearchEditBox` | Type `UEMS-Agent` |
| 2 | Agent entry in list | `DoubleClick` | `ListViewSubItem-0` | Name: `ManageEngine UEMS - Agent` |
| 3 | Uninstall button | `Wait` | `UninstallBtn` | Timeout: 30s |
| 4 | Uninstall button | `Click` | `UninstallBtn` | Triggers OTP prompt |
| 5 | Completion label | `Wait` | `SuccessUninstall` | Timeout: 420s (7 min) |
| 6 | Completion label | `ReadText` | `SuccessUninstall` | Expected: `"Agent successfully uninstalled"` |

**Silent uninstall (command line):**
```cmd
C:\Program Files (x86)\ManageEngine\UEMS_Agent\bin\DCAgent.exe /uninstall /s
```

---

## GOAT Testcase Generation Rules for Agent Installation

### Full Test Scenario Matrix: Office Type × Installation Method × Architecture

> Every installation method must be tested across **office types** AND **Windows architectures**. Use this matrix to ensure full coverage:

| Installation Method | Office Type | x86 (32-bit) | x64 (64-bit) | ARM64 |
|--------------------|-------------|:------------:|:------------:|:-----:|
| Automatic (Push) | Local Office | ✅ | ✅ | ✅ |
| Automatic (Push) | Remote Office (Direct) | ✅ | ✅ | ✅ |
| Automatic (Push) | Remote Office (via DS) | ✅ | ✅ | ✅ |
| Manual (GUI/EXE) | Local Office | ✅ | ✅ | ✅ |
| Manual (GUI/EXE) | Remote Office (Direct) | ✅ | ✅ | ✅ |
| Manual (GUI/EXE) | Remote Office (via DS) | ✅ | ✅ | ✅ |
| Silent (EXE) | Local Office | ✅ | ✅ | ✅ |
| Silent (EXE) | Remote Office (Direct) | ✅ | ✅ | ✅ |
| Silent (EXE) | Remote Office (via DS) | ✅ | ✅ | ✅ |
| Silent (MSI) | Local Office | ✅ | ✅ | ✅ |
| Silent (MSI) | Remote Office (Direct) | ✅ | ✅ | ✅ |
| Silent (MSI) | Remote Office (via DS) | ✅ | ✅ | ✅ |
| Zip (setup.bat) | Local Office | ✅ | ✅ | ✅ |
| Zip (setup.bat) | Remote Office (Direct) | ✅ | ✅ | ✅ |
| Zip (setup.bat) | Remote Office (via DS) | ✅ | ✅ | ✅ |
| DS Installation | Remote Office (via DS) | ✅ | ✅ | ✅ |
| WAN Agent Auto Install | Remote Office (via DS) | N/A | ✅ | ✅ |

> **Rule for testcase generation:** When the user does not specify an architecture, generate test cases for **x64 by default** but add a note that x86 and ARM64 variants should also be executed. When the user specifies an architecture, generate architecture-specific paths and registry hives accordingly.

### GOAT Operation Mapping

| Scenario | GOAT Operation Type | Notes |
|----------|--------------------|----|
| Run EXE installer (any mode) | `run_bat` or `exe_install` | Use `file_path` pointing to the installer |
| Run silent EXE `/silent` | `run_bat` with `arguments: "/silent"` | No GUI; just verify service state after |
| Run MSI silent install | `run_command` with `msiexec ...` | Pass full MSI parameters as shown above |
| Manual wizard installation | `native_gui_operation` | Use `gui_operations` array with documented `automationId` values |
| Verify service state | `service_actions` with `action: "status"` | `expected_status: "running"` |
| Verify registry keys | `registry_operation` with `action: "read_key"` | Check ServerName, ServerPort, AgentVersion |
| Verify install directory | `file_folder_operation` with `action: "check_presence"` | Check `bin\`, `conf\`, `logs\` |
| Verify agent communication | `communication_operation` → `wait_for_request` + `validate_request` | Capture POST to `/statusUpdate` |
| Uninstall agent | `uninstall` with `product_name: "ManageEngine UEMS Agent"` | Or `run_bat` for silent uninstall |
| Manual uninstall via GUI | `native_gui_operation` | Use automationId table in Uninstallation section |
| Check process running | `task_manager` with `action: "verify_process"` | e.g., `DCAgentService.exe` |
| Rename a file (push method isolation) | `file_folder_operation` with `action: "rename"` | Used to force specific push method; must be reversed in teardown |
| Run setup.bat (zip install) | `run_bat` with `action: "execute"`, `file_path` pointing to `setup.bat` | Extracted from `<OfficeName>_Agent.zip` |
| Run DS installer | `exe_install` or `run_bat` | DS installer downloaded from Remote Offices tab |
| Verify DS service | `service_actions` with `action: "status"` | Service: `ManageEngine UEMS Distribution Server` |
| Verify DS directory | `file_folder_operation` with `action: "check_presence"` | Default: `C:\Program Files (x86)\ManageEngine\UEMS_DS\` |
| Verify agent talks to DS | `registry_operation` with `action: "read_key"` | `ServerName` should be DS IP for Remote Office via DS |

### GOAT `component` Variable by Office Type

| Office Type | GOAT Component Variable |
|------------|------------------------|
| Local Office | `$LocalOffice_WinAgent1` |
| Remote Office | `$<RemoteOfficeName>_WinAgent1` (e.g., `$BranchOffice1_WinAgent1`) |
| Distribution Server | `$<RemoteOfficeName>_DS` (e.g., `$BranchOffice1_DS`) |

### GOAT `component` Variable by Architecture

> Append the architecture suffix to distinguish test machines of different architectures:

| Architecture | Component Variable Pattern | Example |
|-------------|---------------------------|--------|
| x86 (32-bit) | `$<OfficeName>_WinAgent_x86_1` | `$LocalOffice_WinAgent_x86_1` |
| x64 (64-bit) | `$<OfficeName>_WinAgent_x64_1` | `$LocalOffice_WinAgent_x64_1`, `$BranchOffice1_WinAgent_x64_1` |
| ARM64 | `$<OfficeName>_WinAgent_ARM64_1` | `$LocalOffice_WinAgent_ARM64_1` |

### Rule: Unknown AutomationIds

If a test case step requires interacting with a GUI element **not listed in the automationId table** in this document, the testcase generator **must ask the user** for the correct `automationId` before generating the GOAT JSON payload. Never fabricate or guess `automationId` values.

### Rule: Architecture-Aware Test Cases

When generating test cases, the testcase generator **must**:
1. **Include architecture as a test parameter** — every test case must state which Windows architecture(s) it applies to (x86, x64, ARM64) or state "All architectures" if universal.
2. **Use architecture-correct paths** — install directories, registry hives, and binary paths must match the target architecture (refer to the "Architecture-Specific Differences" table).
3. **Add architecture pre-check step** — the first GOAT operation in every installation test should detect and record the machine architecture.
4. **Flag ARM64-specific risks** — test cases targeting ARM64 must include a note about x86/x64 emulation behavior and potential performance differences.
5. **Separate architecture variants** — if architecture affects the test behavior (e.g., different install path, different registry hive, different push tool), generate **separate test case variants per architecture**.

### Rule: Browser Steps

Steps that involve the UEMS **web console** (browser) are owned by **Qengine** and must be written as manual product-level instructions in the test case. Do not generate GOAT operations for browser interactions.
