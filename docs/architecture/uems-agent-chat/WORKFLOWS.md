<!-- audience: ai-agents -->
<!-- doc-type: workflow -->
<!-- project: uems-agent-chat -->
<!-- last-updated: 2026-04-08 -->

# Workflows — uems-agent-chat

> 🎯 **Audience:** AI agents
> **Scope:** uems-agent-chat project
> **Skip if:** Working on uems-agent-web — read its own WORKFLOWS.md instead.

Runtime workflows for the VS Code extension — activation, chat request handling, tool loop, sync, self-update, and HTTP bridge.

---

## Table of Contents

1. [Extension Activation](#1-extension-activation)
2. [Chat Request Handling (Tool Loop)](#2-chat-request-handling-tool-loop)
3. [Agent File Sync](#3-agent-file-sync)
4. [Extension Self-Update](#4-extension-self-update)
5. [HTTP Bridge Chat](#5-http-bridge-chat)

---

## 1. Extension Activation

**Files:** `extension.ts`, `sync.ts`, `orchestrator.ts`, `tools/index.ts`, `http-bridge.ts`

```
VS Code loads extension
    │
    ├─ Create output channel
    ├─ Create AgentSyncManager
    │
    ├─ Check: hasLocalAgents()?
    │   ├─ NO  → Sync from git (blocking, with progress)
    │   └─ YES → Continue
    │
    ├─ Register chat participant (uems-agent-chat.explorer)
    │   └─ Handler: orchestratorHandler → runToolLoop()
    │
    ├─ initRepoRegistry(syncManager.repoDir)
    │   └─ Loads repos.json into cache
    │
    ├─ registerUemsTools() → 10 LM tools registered
    │
    ├─ Check: httpBridge.enabled?
    │   ├─ YES → new HttpBridge() → start(port)
    │   └─ NO  → Skip
    │
    ├─ Register commands:
    │   ├─ syncAgents → manual sync trigger
    │   ├─ openChat → open Copilot Chat panel
    │   ├─ checkPrerequisites → verify git + Copilot
    │   └─ setupWorkspace → clone repos for platform
    │
    ├─ Schedule periodic sync (if autoSync enabled)
    │   └─ setInterval(syncIntervalHours)
    │
    └─ Check for extension updates (if autoUpdate enabled)
        └─ ExtensionUpdater.checkAndUpdate()
```

**Key Rules:**
- First install blocks on sync — participant won't register without agent files
- Subsequent activations sync in background — no startup delay
- HTTP bridge only starts if explicitly enabled in settings

---

## 2. Chat Request Handling (Tool Loop)

**Files:** `extension.ts` → `orchestrator.ts` → `tools/*.ts`

```
User sends message in Copilot Chat
    │
    ├─ orchestratorHandler(request, ctx, stream, token)
    │   ├─ Load system prompt from assets/agents/uems-agent-explorer.agent.md
    │   ├─ Build messages: [SystemPrompt, ...history, UserMessage]
    │   └─ Call runToolLoop()
    │
    ├─ runToolLoop(messages, model, token, callbacks)
    │   │
    │   ├─ Collect UEMS tools (filter by toolFilter if set)
    │   │
    │   └─ LOOP (max 25 rounds):
    │       │
    │       ├─ Proactive compaction? (every 10 rounds)
    │       │   └─ trimOldestToolPair() if compactions < 5
    │       │
    │       ├─ model.sendRequest(messages, tools)
    │       │   ├─ ERROR: Context overflow?
    │       │   │   └─ Trim 3 tool pairs → retry round
    │       │   └─ SUCCESS → stream response
    │       │
    │       ├─ Stream fragments:
    │       │   ├─ TextPart → callbacks.onText() (live streaming)
    │       │   └─ ToolCallPart → collect in toolCalls[]
    │       │
    │       ├─ No tool calls? → BREAK (text-only response)
    │       │
    │       ├─ Has tool calls:
    │       │   ├─ Append Assistant message with tool calls
    │       │   ├─ For each tool call:
    │       │   │   ├─ callbacks.onToolStart()
    │       │   │   ├─ vscode.lm.invokeTool(name, input)
    │       │   │   │   └─ Dispatches to registered tool (tools/*.ts)
    │       │   │   ├─ callbacks.onToolEnd()
    │       │   │   └─ Append tool result to messages
    │       │   └─ Continue loop (next round)
    │       │
    │       └─ Max rounds reached → BREAK
    │
    └─ Return UsageStats { requests, toolCalls }
```

**Key Rules:**
- Text is streamed progressively — user sees partial responses immediately
- Context overflow triggers reactive compaction (trim oldest tool pairs)
- Each round is one LLM request — tool calls can chain across rounds
- Maximum 25 rounds prevents infinite loops
- Tool errors are caught and returned as text, not thrown

### Model Selection

```
selectModel()
    │
    ├─ For each family in [claude-sonnet-4.6, claude-sonnet-4.5, claude-sonnet-4, gpt-4o]:
    │   ├─ vscode.lm.selectChatModels({ family })
    │   ├─ Found? → Prefer vendor='copilot' → return
    │   └─ None? → try next family
    │
    └─ Fallback: selectChatModels() (any) → prefer vendor='copilot'
```

---

## 3. Agent File Sync

**Files:** `sync.ts`

```
sync(force?)
    │
    ├─ Dev mode?
    │   ├─ YES → syncFromLocal(devPath)
    │   │   └─ Copy agents + skills from local workspace to assets/
    │   └─ NO → Continue
    │
    ├─ Check cooldown (last sync time)
    │   ├─ Within interval AND NOT force? → Skip (return early)
    │   └─ Expired OR force? → Continue
    │
    ├─ Clone exists?
    │   ├─ YES → git fetch + git checkout origin/master
    │   └─ NO  → git clone --sparse --filter=blob:none
    │       └─ git sparse-checkout set {GIT_SUB_PATHS}
    │
    ├─ Copy agent files: cloneDir/agents/ → assets/agents/
    ├─ Copy skill files: cloneDir/skills/ → assets/skills/
    │
    ├─ Count updated files
    ├─ Save sync metadata (timestamp, version)
    │
    └─ Return SyncResult { updated, filesUpdated }
```

**GIT_SUB_PATHS synced:**
- `agents/orchestrator/agents`
- `agents/document-generator`
- `agents/delta-reviewer`
- `guidelines`
- `skills`
- `source/common`
- `source/uems-agent-chat/releases`

**Key Rules:**
- Sparse checkout minimizes bandwidth — only agent/skill/guideline files
- Dev mode skips remote sync entirely — reads from local workspace
- Cooldown prevents excessive sync (configurable interval)
- First sync is blocking (synchronous with progress bar)
- Subsequent syncs are background and non-blocking

---

## 4. Extension Self-Update

**Files:** `updater.ts`

```
checkAndUpdate()
    │
    ├─ Read cloneDir/source/uems-agent-chat/releases/latest.json
    │   └─ Parse: { version, vsixFile, changelog }
    │
    ├─ Compare: manifest.version vs currentVersion (semver)
    │   ├─ Same or older → return (up to date)
    │   └─ Newer → Continue
    │
    ├─ Copy VSIX from cloneDir/releases/ to downloadDir/
    │
    ├─ Install: execFile('code', ['--install-extension', vsixPath])
    │
    └─ Prompt user to reload VS Code
```

**Key Rules:**
- Depends on sync completing first (latest.json must be in local clone)
- Uses semver comparison — pre-release versions handled
- Non-destructive — old extension stays until reload
- User must accept reload prompt for update to take effect

---

## 5. HTTP Bridge Chat

**Files:** `http-bridge.ts` → `orchestrator.ts`

```
External frontend sends POST /chat { message, sessionId? }
    │
    ├─ Parse request body
    │
    ├─ Session exists for sessionId?
    │   ├─ YES → Reuse existing messages + model
    │   └─ NO  → Create new session:
    │       ├─ selectModel()
    │       ├─ Load system prompt from assets/agents/
    │       ├─ Build pre-loaded skills + guidelines into prompt
    │       ├─ Initialize messages = [SystemPrompt]
    │       └─ Store in sessions Map
    │
    ├─ Append user message to session.messages
    │
    ├─ Set SSE headers (text/event-stream)
    │
    ├─ runToolLoop() with callbacks:
    │   ├─ onText → SSE event: data: {"type":"text","content":"..."}
    │   ├─ onToolStart → SSE event: data: {"type":"tool_start",...}
    │   ├─ onToolEnd → SSE event: data: {"type":"tool_end",...}
    │   └─ onError → SSE event: data: {"type":"error","message":"..."}
    │
    ├─ Send SSE: data: {"type":"done","usage":{requests,toolCalls}}
    │
    └─ Update session.lastAccess
```

**Session Management:**
- Sessions expire after 30 minutes of inactivity
- GC runs every 5 minutes to clean stale sessions
- Session stores: message history, model reference, cumulative usage stats
- Bridge uses `BRIDGE_TOOL_IDS` — reduced tool set (skills/guidelines pre-loaded into prompt)

---

## Cross-Cutting Concerns

### Error Handling
- All tool invocations are wrapped in try/catch — errors become text results, not exceptions
- Context overflow triggers compaction, not failure
- HTTP bridge returns errors as SSE events, not HTTP error codes (once streaming starts)

### Context Management
- Proactive compaction: trim oldest tool pairs every 10 rounds
- Reactive compaction: on context overflow, trim 3 pairs and retry
- Maximum 5 compactions per run to prevent aggressive trimming
- Messages array is mutated in-place — shared between caller and loop

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| Static architecture | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Repo-level overview | [`ARCHITECTURE.md`](../ARCHITECTURE.md) |
| File locations | [`CODEBASE_MAP.md`](../../ai-agents/CODEBASE_MAP.md) |
| Domain terms | [`GLOSSARY.md`](../../ai-agents/GLOSSARY.md) |

---

*Last Updated: 2026-04-08*
