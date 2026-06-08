/**
 * Shared orchestrator — tool-calling loop used by both the Chat Participant
 * and the HTTP Bridge. Single source of truth for model selection, tool
 * collection, and the send→tool→result loop.
 */

import * as vscode from 'vscode';

// ── Types ────────────────────────────────────────────────────────

export interface ToolCallEvent {
  id: string;
  name: string;
  arguments: unknown;
}

export interface ToolResultEvent {
  id: string;
  name: string;
  output: string;
}

/** Usage statistics from a single runToolLoop invocation. */
export interface UsageStats {
  /** Number of model.sendRequest() calls (= premium requests) */
  requests: number;
  /** Number of tool invocations */
  toolCalls: number;
}

/** Callbacks for streaming events during orchestration. */
export interface OrchestratorCallbacks {
  onText(content: string): void;
  onToolStart(event: ToolCallEvent): void;
  onToolEnd(event: ToolResultEvent): void;
  onError(message: string): void;
}

/** Options for a single orchestrator run. */
export interface OrchestratorRunOptions {
  messages: vscode.LanguageModelChatMessage[];
  model: vscode.LanguageModelChat;
  token: vscode.CancellationToken;
  callbacks: OrchestratorCallbacks;
  /** Token for tool invocations (from ChatRequest in participant, undefined in bridge). */
  toolInvocationToken?: vscode.ChatParticipantToolToken;
  maxToolRounds?: number;
  /** Optional subset of tool IDs to offer.  When omitted all UEMS tools are offered. */
  toolFilter?: Set<string>;
}

// ── Constants ────────────────────────────────────────────────────

const UEMS_TOOL_IDS = new Set([
  'uems_agent_search_repos',
  'uems_agent_list_components',
  'uems_agent_find_wrapper',
  'uems_agent_dependency_graph',
  'uems_agent_validate_tag',
  'uems_agent_create_branch',
  'uems_agent_setup_workspace',
  'uems_agent_load_guidelines',
  'uems_agent_load_skills',
  'uems_agent_diff_branches',
]);

/** Read-only exploration tools for the explorer agent. */
export const EXPLORER_TOOL_IDS = new Set([
  'uems_agent_search_repos',
  'uems_agent_list_components',
  'uems_agent_find_wrapper',
  'uems_agent_dependency_graph',
  'uems_agent_load_guidelines',
  'uems_agent_load_skills',
]);

/** Bridge-mode tools — skills/guidelines are pre-loaded in the prompt. */
export const BRIDGE_TOOL_IDS = new Set([
  'uems_agent_search_repos',
  'uems_agent_list_components',
  'uems_agent_find_wrapper',
  'uems_agent_dependency_graph',
  'uems_agent_validate_tag',
]);

const MODEL_FAMILIES = ['claude-sonnet-4.6', 'claude-sonnet-4.5', 'claude-sonnet-4', 'gpt-4o'];

// ── Public API ───────────────────────────────────────────────────

/** Collect UEMS tool definitions from vscode.lm.tools. */
export function getUemsTools(): vscode.LanguageModelChatTool[] {
  return vscode.lm.tools
    .filter((t) => UEMS_TOOL_IDS.has(t.name))
    .map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
}

/** Select the best available model, trying preferred families first. */
export async function selectModel(outputChannel?: vscode.OutputChannel): Promise<vscode.LanguageModelChat | undefined> {
  for (const family of MODEL_FAMILIES) {
    const candidates = await vscode.lm.selectChatModels({ family });
    if (candidates.length > 0) {
      // Prefer the 'copilot' vendor — other vendors (copilotcli, claude-code)
      // may not support tool calling or streaming properly via the LM API.
      const preferred = candidates.find((m) => m.vendor === 'copilot') ?? candidates[0];
      outputChannel?.appendLine(`[Orchestrator] Using model: ${preferred.name} (${preferred.family}, vendor: ${preferred.vendor})`);
      return preferred;
    }
  }
  // Fall back to any
  const all = await vscode.lm.selectChatModels();
  outputChannel?.appendLine(`[Orchestrator] Fallback — available: ${all.map((m) => `${m.family}/${m.vendor}`).join(', ') || 'none'}`);
  const preferred = all.find((m) => m.vendor === 'copilot') ?? all[0];
  return preferred ?? undefined;
}

/**
 * Run the orchestrator tool loop.
 *
 * Sends messages to the model, handles tool calls, feeds results back,
 * and repeats until the model returns text-only or maxToolRounds is reached.
 *
 * The `messages` array is mutated in-place — callers can keep a reference
 * to maintain conversation state across requests.
 */
export async function runToolLoop(opts: OrchestratorRunOptions): Promise<UsageStats> {
  const { messages, model, token, callbacks, maxToolRounds = 25, toolFilter } = opts;

  let tools = getUemsTools();
  if (toolFilter) {
    tools = tools.filter((t) => toolFilter.has(t.name));
  }
  const requestOptions: vscode.LanguageModelChatRequestOptions = {
    tools,
    toolMode: vscode.LanguageModelChatToolMode.Auto,
  };

  const usage: UsageStats = { requests: 0, toolCalls: 0 };
  const COMPACT_AFTER = 10;
  const MAX_COMPACTIONS = 5;
  let compactions = 0;

  for (let round = 0; round < maxToolRounds; round++) {
    if (token.isCancellationRequested) { break; }

    // Proactive compaction — trim oldest tool pairs every COMPACT_AFTER rounds
    if (round > 0 && round % COMPACT_AFTER === 0) {
      if (compactions < MAX_COMPACTIONS && trimOldestToolPair(messages)) {
        compactions++;
      }
    }

    let chatResponse: vscode.LanguageModelChatResponse;
    try {
      chatResponse = await model.sendRequest(messages, requestOptions, token);
    } catch (err) {
      // Reactive compaction — context overflow, trim and retry
      if (isContextOverflow(err) && compactions < MAX_COMPACTIONS) {
        let trimmed = false;
        for (let i = 0; i < 3; i++) {
          if (trimOldestToolPair(messages)) { trimmed = true; } else { break; }
        }
        if (trimmed) {
          compactions++;
          round--; // retry this round
          continue;
        }
      }
      throw err;
    }
    usage.requests++;
    const toolCalls: vscode.LanguageModelToolCallPart[] = [];
    const streamedText: string[] = [];
    let sawToolCall = false;

    for await (const fragment of chatResponse.stream) {
      if (token.isCancellationRequested) { break; }
      if (fragment instanceof vscode.LanguageModelTextPart) {
        if (!sawToolCall) {
          // Stream text immediately — gives progressive rendering
          callbacks.onText(fragment.value);
        }
        streamedText.push(fragment.value);
      } else if (fragment instanceof vscode.LanguageModelToolCallPart) {
        sawToolCall = true;
        toolCalls.push(fragment);
      }
    }

    // No tool calls — text was already streamed, just break
    if (toolCalls.length === 0) {
      break;
    }

    // Tool calls present — text was streamed before the first tool call
    // but we discard it from the message history to prevent the model
    // from repeating itself on the next round.
    messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));

    // Invoke each tool
    for (const toolCall of toolCalls) {
      usage.toolCalls++;
      callbacks.onToolStart({
        id: toolCall.callId,
        name: toolCall.name,
        arguments: toolCall.input,
      });

      let toolResult: vscode.LanguageModelToolResult;
      try {
        toolResult = await vscode.lm.invokeTool(toolCall.name, {
          input: toolCall.input,
          toolInvocationToken: opts.toolInvocationToken,
        }, token);
      } catch (toolErr) {
        const errMsg = toolErr instanceof Error ? toolErr.message : String(toolErr);
        toolResult = new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: ${errMsg}`),
        ]);
      }

      // Extract text for the callback
      const resultText = toolResult.content
        .filter((part): part is vscode.LanguageModelTextPart => part instanceof vscode.LanguageModelTextPart)
        .map((part) => part.value)
        .join('');

      callbacks.onToolEnd({
        id: toolCall.callId,
        name: toolCall.name,
        output: resultText,
      });

      messages.push(vscode.LanguageModelChatMessage.User([
        new vscode.LanguageModelToolResultPart(toolCall.callId, toolResult.content),
      ]));
    }
  }

  return usage;
}

// ── Context overflow helpers ─────────────────────────────────────

/** Check if an error is a context window overflow. */
function isContextOverflow(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /context.*(length|window|limit)|too many tokens|max.*tokens.*exceeded/i.test(msg);
}

/** Tool names whose results provide foundational context and should not be evicted. */
const PINNED_TOOLS = new Set(['uems_agent_load_guidelines', 'uems_agent_load_skills']);

/**
 * Remove the oldest non-pinned assistant-tool-call + tool-result pair from messages.
 * Returns true if a pair was removed, false if none found.
 *
 * Pinned tools (e.g. load_guidelines) are skipped — their results provide
 * foundational context that should persist across the entire conversation.
 */
function trimOldestToolPair(messages: vscode.LanguageModelChatMessage[]): boolean {
  // Find first assistant message with tool calls that isn't pinned (skip index 0 = system prompt)
  const idx = messages.findIndex((m, i) => {
    if (i === 0) { return false; }
    if (m.role !== vscode.LanguageModelChatMessageRole.Assistant) { return false; }
    const toolParts = m.content.filter(
      (p): p is vscode.LanguageModelToolCallPart => p instanceof vscode.LanguageModelToolCallPart,
    );
    // Skip if empty or all tool calls are pinned
    return toolParts.length > 0 && toolParts.some((p) => !PINNED_TOOLS.has(p.name));
  });
  if (idx === -1) { return false; }

  // Collect callIds from that assistant message
  const callIds = new Set(
    messages[idx].content
      .filter((p): p is vscode.LanguageModelToolCallPart => p instanceof vscode.LanguageModelToolCallPart)
      .map((p) => p.callId),
  );

  // Remove the assistant message + corresponding tool result messages
  for (let i = messages.length - 1; i >= 0; i--) {
    if (i === idx) {
      messages.splice(i, 1);
      continue;
    }
    // Tool result messages are User messages containing LanguageModelToolResultPart
    const hasMatchingResult = messages[i].content.some(
      (p) => p instanceof vscode.LanguageModelToolResultPart && callIds.has(p.callId),
    );
    if (hasMatchingResult) {
      messages.splice(i, 1);
    }
  }

  return true;
}
