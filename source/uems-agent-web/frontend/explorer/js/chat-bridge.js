// ── Chat send — bridge mode (VS Code handles the tool loop) ───
// A single SSE stream carries text, tool_start/tool_end, and
// usage events.  Retries automatically on network failures.

import { app }           from './state.js';
import { store }         from './store.js';
import { escapeHtml, renderMarkdown, truncateStr, createStreamRenderer, clearInput, buildFileContent } from './utils.js';
import { isAuthError, handleAuthExpiry } from './auth.js';
import { appendToolCallUI, completeToolCallUI, updateToolGroupHeader, bindToolCallToggles } from './tool-ui.js';
import { renderUserMessage, appendUsageBar, bindCodeCopyButtons, bindAttachmentActions, ensureMessagesListExists, appendUserMessageToDOM } from './messages.js';
import { appendFollowUpSuggestions } from './suggestions.js';

const MAX_BRIDGE_RETRIES  = 3;
const RETRY_STATUS_CODES  = new Set([502, 503, 504]);

export async function sendMessageBridge(chatContainer, chatInput, statusBar, statusText, btnSend, chatTitle, sidebarNav, renderSidebarFn) {
  const text = chatInput.value.trim();
  if (!text || app.isStreaming) return;

  const conv = store.get(app.currentConvId);
  if (!conv) return;

  // Build message content — prepend attached file contents
  const content = buildFileContent(app.pendingFiles, text);

  if (conv.messages.length === 0 && conv.title === 'New Chat') { //No I18N
    const title = text.length > 50 ? text.slice(0, 47) + '...' : text;
    store.rename(conv.id, title);
    chatTitle.textContent = title;
    renderSidebarFn(sidebarNav);
  }

  store.addMessage(conv.id, { role: 'user', content }); //No I18N
  ensureMessagesListExists(chatContainer);
  appendUserMessageToDOM(chatContainer, content);

  clearInput(chatInput);
  app.isStreaming = true;
  btnSend.disabled = true;
  statusBar.classList.remove('hidden'); //No I18N
  statusText.textContent = 'Thinking...'; //No I18N
  app.abortController = new AbortController();

  const { contentEl } = appendAssistantShell(chatContainer);

  let fullText   = '';
  const allToolCalls = [];
  let usageData  = null;
  let attempt    = 0;
  let lastError  = null;

  while (attempt <= MAX_BRIDGE_RETRIES) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      statusText.textContent = `Connection lost, retrying in ${delay / 1000}s\u2026 (${attempt}/${MAX_BRIDGE_RETRIES})`;
      await sleep(delay);
      if (app.abortController?.signal.aborted) break;
      statusText.textContent = 'Reconnecting...'; //No I18N
    }

    try {
      const resp = await fetch('/chat', { //No I18N
        method: 'POST', //No I18N
        headers: { 'Content-Type': 'application/json' }, //No I18N
        body: JSON.stringify({ message: text, sessionId: conv.bridgeSessionId || undefined }),
        signal: app.abortController.signal,
      });

      if (isAuthError(resp.status)) { handleAuthExpiry(); return; }

      if (RETRY_STATUS_CODES.has(resp.status) && attempt < MAX_BRIDGE_RETRIES) {
        attempt++;
        lastError = new Error(`Server error (${resp.status})`);
        continue;
      }

      if (!resp.ok) throw new Error(`Server error (${resp.status})`);

      lastError = null;
      await consumeSSEStream(resp, conv, contentEl, allToolCalls, statusText, chatContainer, (text) => { fullText += text; }, (data) => { usageData = data; });
      break; // stream finished OK
    } catch (err) {
      if (err.name === 'AbortError') break;

      const isNetwork = err.message.includes('network') || err.message.includes('Failed to fetch') || err.name === 'TypeError'; //No I18N
      if (isNetwork && attempt < MAX_BRIDGE_RETRIES) {
        attempt++;
        lastError = err;
        continue;
      }

      const msg = err.message.includes('network') ? 'Connection lost.' : err.message; //No I18N
      contentEl.insertAdjacentHTML('beforeend', renderMarkdown('\n\n**Error:** ' + msg)); //No I18N
      break;
    }
  }

  if (lastError && attempt > MAX_BRIDGE_RETRIES) {
    contentEl.insertAdjacentHTML('beforeend', renderMarkdown( //No I18N
      `\n\n**Error:** Connection failed after ${MAX_BRIDGE_RETRIES} retries. ${lastError.message}`
    ));
  }

  // Final render of any buffered text
  flushStreamingText(contentEl);
  finalizeStreamingText(contentEl);

  store.addMessage(conv.id, {
    role: 'assistant', //No I18N
    content: fullText || '',
    renderedHtml: contentEl.innerHTML,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  });

  if (usageData) appendUsageBar(contentEl, usageData.thisMessage, usageData.session);
  appendFollowUpSuggestions(contentEl, fullText, conv.id);

  app.isStreaming    = false;
  app.abortController = null;
  btnSend.disabled   = false;
  statusBar.classList.add('hidden'); //No I18N
  chatInput.focus();
  bindCodeCopyButtons(chatContainer);
  bindToolCallToggles(chatContainer);
}

// ── SSE consumer ──────────────────────────────────────────────

async function consumeSSEStream(resp, conv, contentEl, allToolCalls, statusText, chatContainer, onText, onUsage) {
  const reader  = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const scheduleRender = createStreamRenderer(() => {
    if (!contentEl._rawText) return;
    let textArea = contentEl.querySelector('.streaming-text'); //No I18N
    if (!textArea) {
      textArea = document.createElement('div');
      textArea.className = 'streaming-text';
      contentEl.appendChild(textArea);
    }
    textArea.innerHTML = renderMarkdown(contentEl._rawText);
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
  }, 50);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const { eventType, eventData } = parseSSEBlock(block);
      if (!eventType || !eventData) continue;

      let parsed;
      try { parsed = JSON.parse(eventData); } catch (_e) { continue; }

      handleSSEEvent(eventType, parsed, conv, contentEl, allToolCalls, statusText, chatContainer, onText, onUsage, scheduleRender);
    }
  }
}

function parseSSEBlock(block) {
  let eventType = '';
  let eventData = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) eventType = line.slice(7).trim();
    else if (line.startsWith('data: '))  eventData = line.slice(6);
  }
  return { eventType, eventData };
}

function handleSSEEvent(eventType, parsed, conv, contentEl, allToolCalls, statusText, chatContainer, onText, onUsage, scheduleRender) {
  if (eventType === 'session') { //No I18N
    if (parsed.sessionId) { conv.bridgeSessionId = parsed.sessionId; store.save(); }
  } else if (eventType === 'text') { //No I18N
    onText(parsed.content || '');
    contentEl._rawText = (contentEl._rawText || '') + (parsed.content || '');
    scheduleRender();
  } else if (eventType === 'tool_start') { //No I18N
    freezeStreamingText(contentEl);
    contentEl._rawText = '';
    statusText.innerHTML = `Running <span class="active-tool-name">${escapeHtml(parsed.name)}</span>...`;
    const tcEl = appendToolCallUI(contentEl, parsed.name, JSON.stringify(parsed.arguments || {}));
    tcEl.dataset.callId = parsed.id;
    allToolCalls.push({ name: parsed.name, arguments: JSON.stringify(parsed.arguments || {}), result: null });
    updateToolGroupHeader(contentEl);
  } else if (eventType === 'tool_end') { //No I18N
    const tcEl = contentEl.querySelector(`.tool-call-container[data-call-id="${parsed.id}"]`) //No I18N
      || contentEl.querySelector(`.tool-call-container[data-tool="${parsed.name}"]:last-of-type`); //No I18N
    completeToolCallUI(tcEl, parsed.output || '');
    const lastTC = allToolCalls[allToolCalls.length - 1];
    if (lastTC) lastTC.result = truncateStr(parsed.output || '', 4000);
    statusText.textContent = 'Thinking...'; //No I18N
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
  } else if (eventType === 'error') { //No I18N
    contentEl.insertAdjacentHTML('beforeend', renderMarkdown('\n\n**Error:** ' + (parsed.message || 'Unknown error'))); //No I18N
  } else if (eventType === 'usage') { //No I18N
    onUsage(parsed);
  }
  // 'done' event — no action needed
}

// ── DOM helpers (private) ─────────────────────────────────────

function appendAssistantShell(chatContainer) {
  const listEl  = chatContainer.querySelector('.messages-list'); //No I18N
  const wrapper = document.createElement('div');
  wrapper.className = 'message-item assistant';
  wrapper.innerHTML = `
    <div class="message-avatar"><span class="material-symbols-rounded">auto_awesome</span></div>
    <div class="message-content"></div>`;
  listEl.appendChild(wrapper);
  return { contentEl: wrapper.querySelector('.message-content') }; //No I18N
}

function freezeStreamingText(contentEl) {
  const cur = contentEl.querySelector('.streaming-text'); //No I18N
  if (cur) cur.classList.replace('streaming-text', 'streamed-text'); //No I18N
}

function flushStreamingText(contentEl) {
  if (!contentEl._rawText) return;
  let textArea = contentEl.querySelector('.streaming-text'); //No I18N
  if (!textArea) {
    textArea = document.createElement('div');
    textArea.className = 'streaming-text';
    contentEl.appendChild(textArea);
  }
  textArea.innerHTML = renderMarkdown(contentEl._rawText);
}

function finalizeStreamingText(contentEl) {
  const el = contentEl.querySelector('.streaming-text'); //No I18N
  if (el) el.classList.replace('streaming-text', 'streamed-text'); //No I18N
  contentEl._rawText = '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
