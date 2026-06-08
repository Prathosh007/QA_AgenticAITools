/**
 * HTTP Bridge — exposes the UEMS agent orchestrator over HTTP/SSE
 * so external frontends (web app) can use VS Code's LM + tools.
 *
 * Endpoints:
 *   POST /chat           — run orchestrator tool loop, stream SSE
 *   DELETE /chat/:id     — delete a session
 *   GET  /api/tools      — list available UEMS tool definitions
 *   GET  /api/models     — list available LM models (debug)
 *   POST /api/tool       — invoke a single tool directly
 *   GET  /health         — liveness check
 *
 * Sessions: Each conversation maintains a server-side message array
 * so tool call history is preserved across requests. The frontend
 * sends a `sessionId` with each request.
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { runToolLoop, selectModel, getUemsTools, BRIDGE_TOOL_IDS } from './orchestrator';

// ── Types ────────────────────────────────────────────────────────

interface ChatRequest {
  message: string;
  sessionId?: string;
}

interface ToolInvokeRequest {
  name: string;
  arguments: Record<string, unknown>;
}

// ── Session store ────────────────────────────────────────────────

interface Session {
  messages: vscode.LanguageModelChatMessage[];
  model: vscode.LanguageModelChat;
  lastAccess: number;
  /** Cumulative usage across all messages in this session. */
  totalRequests: number;
  totalToolCalls: number;
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Bridge Server ────────────────────────────────────────────────

export class HttpBridge {
  private server: http.Server | null = null;
  private readonly outputChannel: vscode.OutputChannel;
  private readonly extensionPath: string;
  private readonly repoDir: string;
  private readonly sessions = new Map<string, Session>();
  private gcTimer: ReturnType<typeof setInterval> | undefined;

  constructor(outputChannel: vscode.OutputChannel, extensionPath: string, repoDir: string) {
    this.outputChannel = outputChannel;
    this.extensionPath = extensionPath;
    this.repoDir = repoDir;
  }

  async start(port: number): Promise<void> {
    if (this.server) { return; }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        this.outputChannel.appendLine(`[HTTP Bridge] Error: ${err}`);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    });

    // Periodically clean up stale sessions
    this.gcTimer = setInterval(() => this.cleanStaleSessions(), 5 * 60 * 1000);

    return new Promise((resolve, reject) => {
      this.server!.listen(port, '127.0.0.1', () => {
        this.outputChannel.appendLine(`[HTTP Bridge] Listening on http://127.0.0.1:${port}`);
        resolve();
      });
      this.server!.on('error', (err) => {
        this.outputChannel.appendLine(`[HTTP Bridge] Failed to start: ${err.message}`);
        reject(err);
      });
    });
  }

  stop(): void {
    if (this.gcTimer) { clearInterval(this.gcTimer); this.gcTimer = undefined; }
    this.sessions.clear();
    if (this.server) {
      this.server.close();
      this.server = null;
      this.outputChannel.appendLine('[HTTP Bridge] Stopped');
    }
  }

  private cleanStaleSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccess > SESSION_TTL_MS) {
        this.sessions.delete(id);
        this.outputChannel.appendLine(`[HTTP Bridge] Session expired: ${id}`);
      }
    }
  }

  // ── Request routing ──────────────────────────────────────────

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '/';

    if (url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (url === '/chat' && req.method === 'POST') {
      await this.handleChat(req, res);
      return;
    }

    // DELETE /chat/:sessionId — clear a session
    if (url.startsWith('/chat/') && req.method === 'DELETE') {
      const sessionId = url.slice(6);
      this.sessions.delete(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ deleted: true }));
      return;
    }

    if (url === '/api/tools' && req.method === 'GET') {
      await this.handleListTools(res);
      return;
    }

    if (url === '/api/models' && req.method === 'GET') {
      await this.handleListModels(res);
      return;
    }

    if (url === '/api/tool' && req.method === 'POST') {
      await this.handleToolInvoke(req, res);
      return;
    }

    if (url === '/api/suggest' && req.method === 'POST') {
      await this.handleSuggest(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  // ── POST /chat — Orchestrator tool loop via SSE ──────────────
  //
  // If `sessionId` is provided, the bridge reuses the existing message
  // array (including tool call history) so the model keeps context.

  private async handleChat(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await readBody(req);
    let parsed: ChatRequest;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!parsed.message) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing "message" field' }));
      return;
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Get or create session
      const sessionId = parsed.sessionId || crypto.randomUUID();
      let session = this.sessions.get(sessionId);

      if (!session) {
        // New session — load system prompt with pre-loaded skills, then select model
        const systemPrompt = await this.buildBridgePrompt();
        const model = await selectModel(this.outputChannel);
        if (!model) {
          send('error', { message: 'No Copilot model available. Ensure GitHub Copilot is signed in within VS Code.' });
          res.end();
          return;
        }

        session = {
          messages: [vscode.LanguageModelChatMessage.User(systemPrompt)],
          model,
          lastAccess: Date.now(),
          totalRequests: 0,
          totalToolCalls: 0,
        };
        this.sessions.set(sessionId, session);
        this.outputChannel.appendLine(`[HTTP Bridge] New session: ${sessionId} (model: ${model.name})`);
      }

      session.lastAccess = Date.now();

      // Send sessionId back so the frontend can reuse it
      send('session', { sessionId });

      // Append the new user message
      session.messages.push(vscode.LanguageModelChatMessage.User(`query: ${parsed.message}`));

      // Abort if client disconnects
      const cancellation = new vscode.CancellationTokenSource();
      req.on('close', () => cancellation.cancel());

      // Run the shared tool loop
      const usage = await runToolLoop({
        messages: session.messages,
        model: session.model,
        token: cancellation.token,
        toolFilter: BRIDGE_TOOL_IDS,
        callbacks: {
          onText: (content) => send('text', { content }),
          onToolStart: (event) => send('tool_start', event),
          onToolEnd: (event) => send('tool_end', event),
          onError: (message) => send('error', { message }),
        },
      });

      // Accumulate session-level usage
      session.totalRequests += usage.requests;
      session.totalToolCalls += usage.toolCalls;

      // Send usage stats to frontend
      send('usage', {
        thisMessage: {
          requests: usage.requests,
          toolCalls: usage.toolCalls,
        },
        session: {
          requests: session.totalRequests,
          toolCalls: session.totalToolCalls,
        },
      });

      send('done', {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[HTTP Bridge] Chat error: ${msg}`);
      send('error', { message: msg });
    }

    res.end();
  }

  // ── GET /api/models — List available LM models (debug) ────────

  private async handleListModels(res: http.ServerResponse): Promise<void> {
    const all = await vscode.lm.selectChatModels();
    const models = all.map((m) => ({
      name: m.name,
      id: m.id,
      family: m.family,
      vendor: m.vendor,
      version: m.version,
      maxInputTokens: m.maxInputTokens,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ models }));
  }

  // ── GET /api/tools — List tool definitions ───────────────────

  private async handleListTools(res: http.ServerResponse): Promise<void> {
    const tools = getUemsTools().filter((t) => BRIDGE_TOOL_IDS.has(t.name));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tools }));
  }

  // ── POST /api/suggest — Generate follow-up suggestions ──────

  private async handleSuggest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await readBody(req);
    let parsed: { text: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!parsed.text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing "text" field' }));
      return;
    }

    try {
      const model = await selectModel(this.outputChannel);
      if (!model) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ suggestions: [] }));
        return;
      }

      const messages = [
        vscode.LanguageModelChatMessage.User(
          `Based on this assistant response, suggest exactly 3 short follow-up questions the user might want to ask next. The questions should be specific and relevant to the UEMS native agent codebase context. Return ONLY a JSON array of 3 strings, no other text.\n\nResponse:\n${parsed.text.slice(0, 2000)}`
        ),
      ];

      const cancellation = new vscode.CancellationTokenSource();
      setTimeout(() => cancellation.cancel(), 10_000);

      const chatResponse = await model.sendRequest(messages, {}, cancellation.token);
      let result = '';
      for await (const fragment of chatResponse.stream) {
        if (fragment instanceof vscode.LanguageModelTextPart) {
          result += fragment.value;
        }
      }

      // Parse JSON array from response
      const jsonMatch = result.match(/\[\s*"[\s\S]*?"\s*\]/);
      let suggestions: string[] = [];
      if (jsonMatch) {
        try {
          suggestions = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(suggestions)) { suggestions = []; }
          suggestions = suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3);
        } catch { suggestions = []; }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ suggestions }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.outputChannel.appendLine(`[HTTP Bridge] Suggest error: ${msg}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ suggestions: [] }));
    }
  }

  // ── POST /api/tool — Invoke a single tool ───────────────────

  private async handleToolInvoke(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const body = await readBody(req);
    let parsed: ToolInvokeRequest;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    if (!parsed.name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing "name" field' }));
      return;
    }

    if (!BRIDGE_TOOL_IDS.has(parsed.name)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown tool: ${parsed.name}` }));
      return;
    }

    try {
      const cancellation = new vscode.CancellationTokenSource();
      const toolResult = await vscode.lm.invokeTool(parsed.name, {
        input: parsed.arguments || {},
        toolInvocationToken: undefined,
      }, cancellation.token);

      const resultText = toolResult.content
        .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
        .map((part) => part.value)
        .join('');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output: resultText }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: msg }));
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Build the bridge system prompt with skills pre-loaded inline.
   * This avoids wasting a tool-loop round on uems_agent_load_skills,
   * which would cause the model to stop before answering the user's query.
   */
  private async buildBridgePrompt(): Promise<string> {
    const agentPrompt = await this.loadAgentPrompt('uems-agent-explorer.agent.md');

    // Pre-load the three skills the explorer prompt references
    const skillNames = ['tool-preference-rules', 'platform-confirmation-protocol', 'guideline-loading-protocol'];
    const skillSections: string[] = [];

    for (const name of skillNames) {
      try {
        const skillPath = path.join(this.extensionPath, 'assets', 'skills', name, 'SKILL.md');
        const content = await fs.readFile(skillPath, 'utf-8');
        // Strip YAML frontmatter
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        const body = match ? match[1].trim() : content.trim();
        skillSections.push(`<skill name="${name}">\n${body}\n</skill>`);
      } catch {
        // Skill not found — skip silently
      }
    }

    const skillBlock = skillSections.length > 0
      ? `\n\n<pre-loaded-skills>\nThe following skills are already loaded. Do NOT call uems_agent_load_skills for these — use them directly.\n\n${skillSections.join('\n\n')}\n</pre-loaded-skills>`
      : '';

    // Pre-load key guidelines so the LLM doesn't waste a tool round
    const guidelineSections: string[] = [];
    const guidelinesDir = path.join(this.repoDir, 'guidelines');

    // Common guidelines
    for (const name of ['grounding-rules.md', 'repo-documentation.md']) {
      try {
        const content = await fs.readFile(path.join(guidelinesDir, 'common', name), 'utf-8');
        guidelineSections.push(`<guideline name="${name}" source="guidelines/common/${name}">\n${content.trim()}\n</guideline>`);
      } catch {
        // Not found — skip
      }
    }
    // Platform repo-maps (all three — LLM picks based on context)
    for (const platform of ['mac', 'linux', 'windows']) {
      try {
        const content = await fs.readFile(path.join(guidelinesDir, platform, 'repo-map.md'), 'utf-8');
        guidelineSections.push(`<guideline name="repo-map.md" platform="${platform}" source="guidelines/${platform}/repo-map.md">\n${content.trim()}\n</guideline>`);
      } catch {
        // Not found — skip
      }
    }

    const guidelineBlock = guidelineSections.length > 0
      ? `\n\n<pre-loaded-guidelines>\nThe following guidelines are already loaded. Do NOT call uems_agent_load_guidelines for these — follow them directly.\n\n${guidelineSections.join('\n\n')}\n</pre-loaded-guidelines>`
      : '';

    const bridgeDirective = `\n\n<system-rules>
## Response Quality Rules
1. **Ground every claim in tool output.** Never invent file paths, function names, or code that wasn't returned by a tool. If no tool result confirms a fact, say "I didn't find evidence of that."
2. **Cite sources.** When referencing code, include the repo name and file path from the tool output.
3. **Admit uncertainty.** If a search returns no results or partial results, say so. Do not fill gaps with assumptions.
4. **No harmful content.** Do not generate malicious code, exploit payloads, or bypass security controls.
5. **Respect tool errors.** If a tool returns an error, report it and suggest an alternative approach.
6. **Stay in scope.** You are a UEMS codebase assistant. Decline requests unrelated to the UEMS project.
</system-rules>

<bridge-mode-rules>
You are running in HTTP bridge mode (web chat). Important differences from VS Code:
- Do NOT call uems_agent_load_skills — skills are pre-loaded above.
- Do NOT call uems_agent_load_guidelines for guidelines listed in <pre-loaded-guidelines> — they are already loaded above. You CAN call it to load other guidelines not listed above (e.g., coding-standards.md, platform-security.md).
- Do NOT call vscode_askQuestions — it is not available. Infer the platform from context (Swift → mac, Go → linux, C#/C++ → windows). If the platform cannot be inferred, do NOT default to a single platform — instead, consider all platforms (mac, linux, windows) and call tools for each relevant platform to give a comprehensive answer.
- Prioritize the user's actual query. Call the relevant tool (search_repos, dependency_graph, list_components, find_wrapper) immediately.
- Keep answers concise (2-4 sentences) and offer to expand.
</bridge-mode-rules>`;

    return agentPrompt + skillBlock + guidelineBlock + bridgeDirective;
  }

  private async loadAgentPrompt(filename: string): Promise<string> {
    const filePath = path.join(this.extensionPath, 'assets', 'agents', filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  }
}

// ── Utility ────────────────────────────────────────────────────

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX_BODY = 1024 * 1024; // 1MB limit
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}
