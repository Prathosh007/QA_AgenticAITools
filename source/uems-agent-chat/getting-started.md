# Getting Started — UEMS Agent for VS Code

## Prerequisites

- **VS Code** (latest stable recommended)
- **GitHub Copilot** — active license with Copilot Chat enabled
- **Git CLI** — installed and available in your terminal (`git --version` to verify)
- **Zoho Corp network / VPN** — required to access the internal git repos

## One-Time Setup

### 1. Download the Extension

Download the VSIX file from:
[`releases/uems-agent-chat.vsix`](releases/uems-agent-chat.vsix)

### 2. Install the Extension

**Option A — Terminal:**
```
code --install-extension uems-agent-chat.vsix
```

**Option B — VS Code UI:**
1. Open VS Code
2. Go to Extensions (`⇧⌘X`)
3. Click the `···` menu → **Install from VSIX…**
4. Select the downloaded file

### 3. Reload VS Code

Reload when prompted. The extension auto-syncs agent files on startup and checks for updates daily — no manual maintenance needed.

---

## What's Next?

Once the extension is installed, you can start using the agents. See the individual agent guides:

- **[Orchestrator — Getting Started](../../agents/orchestrator/getting-started.md)** — Automate Plan → Architect → Develop → Review for features, bugs, and refactors
- **[Delta Reviewer — Getting Started](../../agents/delta-reviewer/getting-started.md)** — Run standalone diff-based code reviews between branches
- **[Document Generator — Getting Started](../../agents/document-generator/getting-started.md)** — Generate AI-navigable documentation for your repo

