<!-- audience: ai-agents -->
<!-- doc-type: guide -->
<!-- project: repo-wide -->
<!-- last-updated: 2026-04-08 -->

# Agent Guide

> 🎯 **Audience:** AI agents
> **Scope:** All projects
> **Read when:** Need step-by-step walkthroughs for common development tasks.

Common task walkthroughs for the uems-ai-toolkit repository with code patterns and checklists.

---

## 1. Add a New AI Agent

**When:** You need a new AI persona (e.g., a new sub-agent or user-invocable agent).

### Steps

1. **Create the agent definition file:**
   ```
   agents/<category>/agents/uems-agent-<name>.agent.md
   ```
   Use YAML frontmatter:
   ```yaml
   ---
   name: UEMS Agent <Name>
   description: <one-line description>
   tools:
     - uems_agent_search_repos
     - uems_agent_load_guidelines
   ---
   ```
   Followed by the Markdown system prompt.

2. **Register in `package.json`:**
   ```json
   // source/uems-agent-chat/package.json → contributes.chatAgents
   {
     "path": "./assets/agents/uems-agent-<name>.agent.md"
   }
   ```

3. **Copy the agent file to extension assets:**
   ```
   cp agents/<category>/agents/uems-agent-<name>.agent.md \
      source/uems-agent-chat/assets/agents/
   ```

4. **If the agent needs a custom tool set**, add a tool ID set in `orchestrator.ts`:
   ```typescript
   export const MY_AGENT_TOOL_IDS = new Set([
     'uems_agent_search_repos',
     'uems_agent_load_guidelines',
   ]);
   ```

5. **Verify:** Build the extension (`npm run compile`), launch in Extension Development Host, and test the agent in Copilot Chat.

---

## 2. Add a New LM Tool (VS Code Extension)

**When:** You need a new tool that agents can invoke within Copilot Chat.

### Steps

1. **Create the tool implementation:**
   ```
   source/uems-agent-chat/src/tools/<name>.ts
   ```
   Implement the `vscode.LanguageModelTool` interface:
   ```typescript
   import * as vscode from 'vscode';

   interface MyToolInput {
     param1: string;
   }

   export class MyTool implements vscode.LanguageModelTool<MyToolInput> {
     async invoke(
       options: vscode.LanguageModelToolInvocationOptions<MyToolInput>,
       token: vscode.CancellationToken
     ): Promise<vscode.LanguageModelToolResult> {
       const { param1 } = options.input;
       // Implementation...
       return new vscode.LanguageModelToolResult([
         new vscode.LanguageModelTextPart(JSON.stringify(result)),
       ]);
     }
   }
   ```

2. **Register in the barrel file** (`tools/index.ts`):
   ```typescript
   import { MyTool } from './my-tool';
   // In registerUemsTools():
   { id: 'uems_agent_my_tool', tool: new MyTool() },
   ```

3. **Add the tool ID to the appropriate set(s)** in `orchestrator.ts`:
   ```typescript
   const UEMS_TOOL_IDS = new Set([
     // ...existing tools
     'uems_agent_my_tool',
   ]);
   ```

4. **Create the Go equivalent** in `source/uems-agent-web/backend/tools/<name>.go` and register in `registry.go`.

5. **Verify:** `npx tsc --noEmit` + `go build ./...`

---

## 3. Add a New MCP Tool (Go Web Server)

**When:** You need a tool in the standalone web server.

### Steps

1. **Create the tool file:**
   ```
   source/uems-agent-web/backend/tools/<name>.go
   ```
   ```go
   package tools

   import "github.com/modelcontextprotocol/go-sdk/mcp"

   func registerMyTool(s *mcp.Server) {
       s.AddTool(mcp.Tool{
           Name:        "uems_agent_my_tool",
           Description: "Does something useful",
           InputSchema: mcp.ToolInputSchema{
               Type: "object",
               Properties: map[string]map[string]interface{}{
                   "param1": {"type": "string", "description": "First parameter"},
               },
               Required: []string{"param1"},
           },
       }, myToolHandler)
   }

   func myToolHandler(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
       // Implementation...
       return mcp.NewToolResultText(output), nil
   }
   ```

2. **Register in `registry.go`:**
   ```go
   // In RegisterAll():
   registerMyTool(s)
   ```

3. **Verify:** `cd backend && go build ./... && go vet ./...`

---

## 4. Add a New Skill

**When:** You need a reusable procedure that agents can load on demand.

### Steps

1. **Create the skill file:**
   ```
   skills/<name>/SKILL.md
   ```
   With YAML frontmatter:
   ```yaml
   ---
   name: <name>
   description: '<one-line description>'
   user-invocable: false
   ---
   ```
   Followed by the Markdown skill procedure.

2. **Register in `package.json`:**
   ```json
   // source/uems-agent-chat/package.json → contributes.chatSkills
   {
     "path": "./assets/skills/<name>/SKILL.md"
   }
   ```

3. **Copy to extension assets:**
   ```bash
   mkdir -p source/uems-agent-chat/assets/skills/<name>/
   cp skills/<name>/SKILL.md source/uems-agent-chat/assets/skills/<name>/
   ```

4. **Verify:** Build extension, then test loading the skill via `uems_agent_load_skills({ files: ["<name>"] })` in Copilot Chat.

---

## 5. Add/Modify a Guideline

**When:** You need to add or update engineering standards.

### Steps

1. **Edit or create the guideline file:**
   ```
   guidelines/<platform>/<filename>.md     # platform-specific
   guidelines/common/<filename>.md         # cross-platform
   ```

2. **Verify loading:** Test via `uems_agent_load_guidelines({ category: "<platform>" })` in Copilot Chat.

3. **Note:** Guidelines are synced automatically to VS Code extension users. No registration step needed — the sync mechanism pulls the entire `guidelines/` directory.

---

## 6. Release the VS Code Extension

**When:** You need to publish a new version.

### Steps

1. **Update version** in `source/uems-agent-chat/package.json`
2. **Update** `source/uems-agent-chat/releases/latest.json`:
   ```json
   {
     "version": "0.X.Y",
     "vsixFile": "uems-agent-chat-0.X.Y.vsix",
     "changelog": "- Change description"
   }
   ```
3. **Build VSIX:**
   ```bash
   cd source/uems-agent-chat
   npm run build:vsix
   ```
4. **Place VSIX** in `source/uems-agent-chat/releases/`
5. **Commit and push** — extension auto-update picks it up

---

## 7. Modify Server Configuration

**When:** You need to add a new server flag or environment variable.

### Steps

1. **Add to `ServerConfig` struct** in `source/uems-agent-web/backend/server/main.go`
2. **Add `flag.XxxVar()` call** in the `main()` function with `envOr()` default
3. **Wire to handlers** via setter functions if needed (e.g., `handlers.SetXxx()`)
4. **Document** in `openapi.yaml` if it affects the API
5. **Verify:** `make build && make run`

---

## Related Docs

| If you need... | Read... |
|----------------|---------|
| File locations for any task | [`CODEBASE_MAP.md`](CODEBASE_MAP.md) |
| Domain term definitions | [`GLOSSARY.md`](GLOSSARY.md) |
| How to build and test | [`BUILD_GUIDE.md`](BUILD_GUIDE.md) |
| Coding conventions | [`CONVENTIONS.md`](../development/CONVENTIONS.md) |

---

*Last Updated: 2026-04-08*
