---
name: platform-confirmation-protocol
description: 'Confirm target platform (mac/linux/windows) at session start. Use when an agent needs to ask the user for platform before loading guidelines, setting up workspace, or invoking platform-specific tools.'
user-invocable: false
---

# Platform Confirmation Protocol

Mandatory first step for every user-invocable UEMS agent session. The platform determines which languages, coding standards, security rules, and repo maps apply.

## When to Use
- At the start of every user-invocable agent session (Orchestrator, Explorer, Delta Reviewer)
- Before calling `uems_agent_load_guidelines` with a platform category
- Before calling `uems_agent_setup_workspace` with a platform parameter

## Procedure

1. **Ask the user** using `vscode_askQuestions` with platform as a fixed-option question: `mac` / `linux` / `windows`
2. **Map the answer** using the table below
3. **Lock for the session** — platform cannot change mid-session

If the user already provided a platform in their prompt, use it directly (no need to re-ask). If unclear or ambiguous → always ask.

**Never guess** from the user's OS, environment, workspace, or file extensions.

## Platform Mapping

| User Answer | Platform | Languages | Guidelines Category | Repo Map |
|---|---|---|---|---|
| `mac` / `macOS` | macOS | Swift 5, Objective-C | `platform: mac` | `guidelines/mac/repo-map.md` |
| `linux` / `Linux` | Linux | Go | `platform: linux` | `guidelines/linux/repo-map.md` |
| `windows` / `Windows` | Windows | C, C++, C# | `platform: windows` | `guidelines/windows/repo-map.md` |

## Rules

- **Blocking gate** — nothing proceeds until platform is confirmed
- **Session-locked** — if the user needs a different platform, they must start a new session
- **Pass to all sub-agents** — every sub-agent invocation receives the confirmed platform
- **Pass to all tools** — every tool call that accepts `platform` gets the confirmed value
