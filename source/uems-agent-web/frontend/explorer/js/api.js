// ── Copilot API + tool REST calls ────────────────────────────
// All network I/O that isn't auth lives here.

import { app } from './state.js';
import { createStreamRenderer, renderMarkdown, truncateStr, escapeHtml } from './utils.js';
import { handleAuthExpiry, isAuthError } from './auth.js';

// ── Tool definitions cache ────────────────────────────────────

let cachedTools = null;

export async function loadToolDefinitions() {
  if (cachedTools) return cachedTools;
  const resp = await fetch('/api/tools', { credentials: 'include' }); //No I18N
  cachedTools = await resp.json();
  return cachedTools;
}

// ── Tool invocation ───────────────────────────────────────────

export async function invokeToolREST(name, argsStr) {
  try {
    let args;
    try { args = JSON.parse(argsStr); } catch (_e) { args = {}; }

    const resp = await fetch('/api/tool', { //No I18N
      method: 'POST', //No I18N
      headers: { 'Content-Type': 'application/json' }, //No I18N
      credentials: 'include', //No I18N
      body: JSON.stringify({ name, arguments: args }),
    });

    if (!resp.ok) return `Error: tool request failed (${resp.status})`;
    const data = await resp.json();
    return data.output || '';
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

// ── Stream one Copilot API round ──────────────────────────────

export async function streamCopilotRound(messages, tools, contentEl, signal) {
  const body = {
    model: app.config.chatModel,
    messages,
    stream: true,
  };
  if (tools && tools.length > 0) body.tools = tools;

  const resp = await fetch('/copilot/chat/completions', { //No I18N
    method: 'POST', //No I18N
    headers: {
      'Content-Type': 'application/json', //No I18N
      'Editor-Version': app.config.editorVersion, //No I18N
      'Editor-Plugin-Version': app.config.pluginVersion, //No I18N
      'X-Agent-Name': app.selectedAgent || 'uems-agent-explorer', //No I18N
    },
    credentials: 'include', //No I18N
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    if (isAuthError(resp.status)) {
      handleAuthExpiry();
      throw new Error('Session expired. Please log in again.'); //No I18N
    }
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Copilot API error (${resp.status}): ${errBody.slice(0, 200)}`);
  }

  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer           = '';
  let textContent      = '';
  let reasoningContent = '';
  const collectedToolCalls = {};

  const scheduleRender = createStreamRenderer(() => {
    if (reasoningContent) {
      let thinkingEl = contentEl.querySelector('.thinking-block'); //No I18N
      if (!thinkingEl) {
        thinkingEl = document.createElement('details');
        thinkingEl.className = 'thinking-block';
        thinkingEl.innerHTML = '<summary class="thinking-summary"><span class="thinking-label">Thinking\u2026</span></summary><div class="thinking-body"></div>'; //No I18N
        contentEl.appendChild(thinkingEl);
      }
      thinkingEl.querySelector('.thinking-body').innerHTML = renderMarkdown(reasoningContent); //No I18N
    }

    if (contentEl._rawText) {
      let textArea = contentEl.querySelector('.streaming-text'); //No I18N
      if (!textArea) {
        textArea = document.createElement('div');
        textArea.className = 'streaming-text';
        contentEl.appendChild(textArea);
      }
      textArea.innerHTML = renderMarkdown(contentEl._rawText);
    }
    scrollToBottom();
  }, 50);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const chunk = JSON.parse(data);
        if (!chunk.choices?.[0]) continue;
        const delta = chunk.choices[0].delta;

        if (delta.reasoning) {
          reasoningContent += delta.reasoning;
          scheduleRender();
        }

        if (delta.content) {
          textContent += delta.content;
          contentEl._rawText = (contentEl._rawText || '') + delta.content;
          scheduleRender();
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!collectedToolCalls[tc.index]) {
              collectedToolCalls[tc.index] = {
                id: tc.id || '',
                type: tc.type || 'function', //No I18N
                function: { name: '', arguments: '' },
              };
            }
            const existing = collectedToolCalls[tc.index];
            if (tc.id)                   existing.id = tc.id;
            if (tc.type)                 existing.type = tc.type;
            if (tc.function?.name)       existing.function.name = tc.function.name;
            if (tc.function?.arguments)  existing.function.arguments += tc.function.arguments;
          }
        }
      } catch (_e) { /* ignore parse errors */ }
    }
  }

  // Promote reasoning to main content when no text was returned
  if (!textContent && reasoningContent) {
    textContent = reasoningContent;
    contentEl._rawText = (contentEl._rawText || '') + reasoningContent;
    contentEl.querySelector('.thinking-block')?.remove(); //No I18N
  }

  // Mark thinking section as complete
  const thinkingEl = contentEl.querySelector('.thinking-block'); //No I18N
  if (thinkingEl) {
    const label = thinkingEl.querySelector('.thinking-label'); //No I18N
    if (label) label.textContent = 'Thinking'; //No I18N
  }

  // Final render of any buffered text
  if (contentEl._rawText) {
    let textArea = contentEl.querySelector('.streaming-text'); //No I18N
    if (!textArea) {
      textArea = document.createElement('div');
      textArea.className = 'streaming-text';
      contentEl.appendChild(textArea);
    }
    textArea.innerHTML = renderMarkdown(contentEl._rawText);
  }

  const toolCalls = Object.keys(collectedToolCalls)
    .map(Number)
    .sort((a, b) => a - b)
    .map((idx) => collectedToolCalls[idx]);

  return { text: textContent, toolCalls };
}

// ── Scroll helper (imported by api.js and others) ─────────────

function scrollToBottom() {
  const chatContainer = document.getElementById('chat-container');
  chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
}
