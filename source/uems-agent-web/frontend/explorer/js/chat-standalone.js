// ── Chat send — standalone (Copilot API client-side tool loop) ─

import { app }           from './state.js';
import { store }         from './store.js';
import { escapeHtml, renderMarkdown, truncateStr, clearInput, buildFileContent }  from './utils.js';
import { loadToolDefinitions, invokeToolREST, streamCopilotRound } from './api.js';
import { buildAPIMessages, estimateTokens, isContextOverflow, trimOldestToolCall } from './context.js';
import { appendToolCallUI, completeToolCallUI, updateToolGroupHeader, bindToolCallToggles } from './tool-ui.js';
import { renderUserMessage, appendUsageBar, bindCodeCopyButtons, bindAttachmentActions, ensureMessagesListExists, appendUserMessageToDOM } from './messages.js';
import { appendFollowUpSuggestions } from './suggestions.js';

export async function sendMessage(chatContainer, chatInput, statusBar, statusText, btnSend, chatTitle, sidebarNav, renderSidebarFn) {
  const text = chatInput.value.trim();
  if (!text || app.isStreaming) return;

  const conv = store.get(app.currentConvId);
  if (!conv) return;

  // Build message content — prepend attached file contents
  const content = buildFileContent(app.pendingFiles, text);

  // Auto-title on first message
  if (conv.messages.length === 0 && conv.title === 'New Chat') { //No I18N
    setAutoTitle(conv, text, chatTitle, renderSidebarFn, sidebarNav);
  }

  // Display shows just the user text + file names, but the API message includes content
  store.addMessage(conv.id, { role: 'user', content }); //No I18N
  ensureMessagesListExists(chatContainer);
  appendUserMessageToDOM(chatContainer, content);

  clearInput(chatInput);
  showStreaming(app, btnSend, statusBar, statusText, 'Thinking...'); //No I18N

  const { assistantWrapper, contentEl } = appendAssistantShell(chatContainer);

  let fullText = '';
  const allToolCalls = [];
  let msgRequests = 0;
  let msgToolCalls = 0;

  try {
    const tools      = await loadToolDefinitions();
    const apiMessages = buildAPIMessages(conv);
    const TOKEN_LIMIT   = app.config.contextTokenLimit;
    const MAX_COMPACTIONS = 5;
    let compactions = 0;

    while (true) {
      if (app.abortController?.signal.aborted) break;

      // Proactive context compaction
      let estimatedTokens = estimateTokens(apiMessages);
      if (estimatedTokens > TOKEN_LIMIT) {
        if (compactions >= MAX_COMPACTIONS) break;
        compactions += compactContext(apiMessages, TOKEN_LIMIT, statusText);
        if (compactions > MAX_COMPACTIONS) break;
      }

      let result;
      try {
        result = await streamCopilotRound(apiMessages, tools, contentEl, app.abortController.signal);
      } catch (err) {
        if (isContextOverflow(err.message)) {
          compactContext(apiMessages, TOKEN_LIMIT * 0.6, statusText);
          compactions++;
          if (compactions > MAX_COMPACTIONS) throw err;
          continue;
        }
        throw err;
      }

      const { text: roundText, toolCalls } = result;
      fullText += roundText;
      msgRequests++;

      if (!toolCalls || toolCalls.length === 0) {
        if (!roundText && allToolCalls.length > 0) {
          fullText = synthesizeFallback(allToolCalls, contentEl);
        }
        break;
      }

      freezeStreamingText(contentEl);
      contentEl._rawText = '';
      apiMessages.push({ role: 'assistant', tool_calls: toolCalls }); //No I18N

      for (const tc of toolCalls) {
        statusText.innerHTML = `Running <span class="active-tool-name">${escapeHtml(tc.function.name)}</span>...`;
        const tcEl = appendToolCallUI(contentEl, tc.function.name, tc.function.arguments);
        allToolCalls.push({ name: tc.function.name, arguments: tc.function.arguments, result: null });
        updateToolGroupHeader(contentEl);
        msgToolCalls++;

        const output = await invokeToolREST(tc.function.name, tc.function.arguments);
        completeToolCallUI(tcEl, output);
        allToolCalls[allToolCalls.length - 1].result = truncateStr(output, Math.floor(app.config.toolOutputLimit / 2));
        apiMessages.push({
          role: 'tool', //No I18N
          tool_call_id: tc.id,
          content: truncateStr(output, app.config.toolOutputLimit),
        });

        statusText.textContent = 'Thinking...'; //No I18N
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' }); //No I18N
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      const msg = err.message.includes('network') //No I18N
        ? 'Connection lost. The response may be incomplete.' //No I18N
        : err.message;
      contentEl.insertAdjacentHTML('beforeend', renderMarkdown('\n\n**Error:** ' + msg)); //No I18N
    }
  }

  finalizeStreamingText(contentEl);
  persistAssistantMessage(conv, fullText, contentEl, allToolCalls);
  appendUsageBar(contentEl, { requests: msgRequests, toolCalls: msgToolCalls });
  appendFollowUpSuggestions(contentEl, fullText, conv.id);

  stopStreaming(app, btnSend, statusBar, chatInput);
  bindCodeCopyButtons(chatContainer);
  bindToolCallToggles(chatContainer);
}

// ── Helpers ───────────────────────────────────────────────────

function setAutoTitle(conv, text, chatTitle, renderSidebarFn, sidebarNav) {
  const title = text.length > 50 ? text.slice(0, 47) + '...' : text;
  store.rename(conv.id, title);
  chatTitle.textContent = title;
  renderSidebarFn(sidebarNav);
}

function showStreaming(app, btnSend, statusBar, statusText, label) {
  app.isStreaming = true;
  btnSend.disabled = true;
  statusBar.classList.remove('hidden'); //No I18N
  statusText.textContent = label;
  app.abortController = new AbortController();
}

function stopStreaming(app, btnSend, statusBar, chatInput) {
  app.isStreaming = false;
  app.abortController = null;
  btnSend.disabled = false;
  statusBar.classList.add('hidden'); //No I18N
  chatInput.focus();
}

function appendAssistantShell(chatContainer) {
  const listEl = chatContainer.querySelector('.messages-list'); //No I18N
  const wrapper = document.createElement('div');
  wrapper.className = 'message-item assistant';
  wrapper.innerHTML = `
    <div class="message-avatar"><span class="material-symbols-rounded">auto_awesome</span></div>
    <div class="message-content"></div>`;
  listEl.appendChild(wrapper);
  return { assistantWrapper: wrapper, contentEl: wrapper.querySelector('.message-content') }; //No I18N
}

function freezeStreamingText(contentEl) {
  const curTextArea = contentEl.querySelector('.streaming-text'); //No I18N
  if (curTextArea) {
    curTextArea.classList.replace('streaming-text', 'streamed-text'); //No I18N
  }
}

function finalizeStreamingText(contentEl) {
  const finalTextArea = contentEl.querySelector('.streaming-text'); //No I18N
  if (finalTextArea) finalTextArea.classList.replace('streaming-text', 'streamed-text'); //No I18N
  contentEl._rawText = '';
}

function synthesizeFallback(allToolCalls, contentEl) {
  const lastResult = allToolCalls[allToolCalls.length - 1]?.result || '';
  if (!lastResult) return '';
  const fallback = '**Tool result:**\n```\n' + lastResult.slice(0, 4000) + '\n```'; //No I18N
  contentEl._rawText = fallback;
  let textArea = contentEl.querySelector('.streaming-text'); //No I18N
  if (!textArea) {
    textArea = document.createElement('div');
    textArea.className = 'streaming-text';
    contentEl.appendChild(textArea);
  }
  textArea.innerHTML = renderMarkdown(fallback);
  return fallback;
}

function persistAssistantMessage(conv, fullText, contentEl, allToolCalls) {
  store.addMessage(conv.id, {
    role: 'assistant', //No I18N
    content: fullText || '',
    renderedHtml: contentEl.innerHTML,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
  });
}

function compactContext(apiMessages, targetTokens, statusText) {
  statusText.textContent = 'Compacting context...'; //No I18N
  let trimCount = 0;
  while (estimateTokens(apiMessages) > targetTokens) {
    const trimmed = trimOldestToolCall(apiMessages);
    if (!trimmed) break;
    apiMessages.length = 0;
    apiMessages.push(...trimmed);
    trimCount++;
  }
  return trimCount > 0 ? 1 : 0; // return 1 compaction tick if anything was trimmed
}
